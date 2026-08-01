'use server';

import { z } from 'zod';
import { getUserRole, requireServerRole } from '@/lib/auth/permissions';
import {
    OPPORTUNITY_STAGES,
    OPPORTUNITY_TYPES,
    type OpportunityRole,
} from '@/lib/crm/opportunityState';
import {
    WORK_QUEUE_DUE_GROUPS,
    groupOpportunityWorkItems,
    mapOpportunityWorkQueueRow,
    resolveWorkQueueScope,
    type OpportunityWorkGroup,
    type OpportunityWorkQueueFilters,
} from '@/lib/crm/workQueue';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logger } from '@/lib/utils/logger';
import { revalidatePath } from 'next/cache';

const workQueueFiltersSchema = z.object({
    ownerId: z.uuid().optional(),
    types: z.array(z.enum(OPPORTUNITY_TYPES)).max(OPPORTUNITY_TYPES.length).optional(),
    stages: z.array(z.enum(OPPORTUNITY_STAGES)).max(OPPORTUNITY_STAGES.length).optional(),
    dueGroup: z.enum(WORK_QUEUE_DUE_GROUPS).optional(),
}).strict();

const WORK_QUEUE_SELECT = [
    'opportunity_id',
    'client_id',
    'supply_point_id',
    'owner_id',
    'owner_name',
    'franchise_id',
    'type',
    'stage',
    'client_name',
    'supply_label',
    'stage_entered_at',
    'stage_age_days',
    'next_action_type',
    'next_action_title',
    'next_action_due_at',
    'due_group',
].join(',');

export interface RenewalDataQualityItem {
    contractId: string;
    clientId: string;
    clientName: string;
    supplyLabel: string;
    ownerId: string;
    ownerName: string;
    marketerName: string;
    tariffName: string | null;
    startDate: string;
}

const renewalDataQualityRowSchema = z.object({
    contract_id: z.string().uuid(),
    client_id: z.string().uuid(),
    client_name: z.string().min(1),
    supply_label: z.string().min(1),
    owner_id: z.string().uuid(),
    owner_name: z.string().min(1),
    marketer_name: z.string().min(1),
    tariff_name: z.string().nullable(),
    start_date: z.iso.date(),
});

export async function getOpportunityWorkQueueAction(
    rawFilters: OpportunityWorkQueueFilters = {},
): Promise<OpportunityWorkGroup[]> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const parsedFilters = workQueueFiltersSchema.safeParse(rawFilters);
    if (!parsedFilters.success) {
        throw new Error('Filtros de trabajo inválidos');
    }

    const role = await getUserRole() as OpportunityRole | null;
    if (!role) throw new Error('No autenticado');

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const filters = parsedFilters.data;
    const scope = resolveWorkQueueScope(role, user.id, filters);
    let query = supabase
        .from('crm_work_queue')
        .select(WORK_QUEUE_SELECT);

    if (scope.ownerId) query = query.eq('owner_id', scope.ownerId);
    if (filters.types?.length) query = query.in('type', filters.types);
    if (filters.stages?.length) query = query.in('stage', filters.stages);
    if (filters.dueGroup) query = query.eq('due_group', filters.dueGroup);

    const { data, error } = await query
        .order('next_action_due_at', { ascending: true, nullsFirst: false })
        .order('stage_entered_at', { ascending: true })
        .range(0, 199);

    if (error) {
        logger.error(
            '[crm] work queue query failed',
            undefined,
            { code: error.code ?? 'unknown' },
        );
        throw new Error('No se pudo cargar la cola de trabajo');
    }

    try {
        return groupOpportunityWorkItems(
            (data ?? []).map(mapOpportunityWorkQueueRow),
        );
    } catch {
        logger.error('[crm] work queue returned an invalid row');
        throw new Error('No se pudo cargar la cola de trabajo');
    }
}

export async function getRenewalDataQualityAction(): Promise<RenewalDataQualityItem[]> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const role = await getUserRole() as OpportunityRole | null;
    if (!role) throw new Error('No autenticado');

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    let query = supabase
        .from('contract_renewal_data_quality')
        .select('*');

    if (role === 'agent') query = query.eq('owner_id', user.id);

    const { data, error } = await query
        .order('start_date', { ascending: true })
        .range(0, 49);

    if (error) {
        logger.error('[crm] renewal data-quality query failed', undefined, {
            code: error.code ?? 'unknown',
        });
        throw new Error('No se pudieron cargar los vencimientos por confirmar');
    }

    return (data ?? []).map(row => {
        const parsed = renewalDataQualityRowSchema.safeParse(row);
        if (!parsed.success) throw new Error('La cola de vencimientos contiene datos incompletos');
        return {
            contractId: parsed.data.contract_id,
            clientId: parsed.data.client_id,
            clientName: parsed.data.client_name,
            supplyLabel: parsed.data.supply_label,
            ownerId: parsed.data.owner_id,
            ownerName: parsed.data.owner_name,
            marketerName: parsed.data.marketer_name,
            tariffName: parsed.data.tariff_name,
            startDate: parsed.data.start_date,
        };
    });
}

const confirmPermanenceSchema = z.object({
    contractId: z.uuid(),
    permanenceStatus: z.enum(['known', 'none']),
    endDate: z.iso.date().nullable(),
}).superRefine((value, context) => {
    if (value.permanenceStatus === 'known' && !value.endDate) {
        context.addIssue({ code: 'custom', path: ['endDate'], message: 'Indica la fecha de vencimiento.' });
    }
    if (value.permanenceStatus === 'none' && value.endDate) {
        context.addIssue({ code: 'custom', path: ['endDate'], message: 'Un contrato sin permanencia no debe tener fecha.' });
    }
});

export async function confirmContractPermanenceAction(
    input: z.input<typeof confirmPermanenceSchema>,
): Promise<{ ok: boolean; error?: string }> {
    await requireServerRole(['admin', 'franchise', 'agent']);
    const parsed = confirmPermanenceSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0]?.message ?? 'Revisa la permanencia.' };
    }

    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return { ok: false, error: 'No autenticado' };

    const service = createServiceClient();
    const { data: updatedContract, error } = await service.rpc('confirm_contract_permanence', {
        p_contract_id: parsed.data.contractId,
        p_actor_id: user.id,
        p_permanence_status: parsed.data.permanenceStatus,
        p_end_date: parsed.data.endDate,
    });

    if (error) return { ok: false, error: 'No se pudo guardar la permanencia.' };

    await service.rpc('reconcile_contract_renewals', {
        p_as_of: new Date().toISOString().slice(0, 10),
    });

    revalidatePath('/dashboard');
    revalidatePath('/admin');
    if (updatedContract?.client_id) {
        revalidatePath(`/dashboard/clients/${updatedContract.client_id}`);
    }
    return { ok: true };
}
