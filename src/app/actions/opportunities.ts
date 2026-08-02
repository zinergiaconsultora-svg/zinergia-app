'use server';

import { requireServerRole } from '@/lib/auth/permissions';
import {
    OPPORTUNITY_STAGES,
    canTransitionOpportunity,
    type OpportunityStage,
} from '@/lib/crm/opportunityState';
import {
    buildOpportunityWorkspace,
    type OpportunityWorkspace,
    type OpportunityWorkspaceSource,
} from '@/lib/crm/opportunityWorkspace';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logger } from '@/lib/utils/logger';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const transitionReasonSchema = z.enum([
    'ocr_completed',
    'ocr_confirmed',
    'proposal_sent',
    'proposal_accepted',
    'activation_started',
    'activation_confirmed',
    'lead_lost',
    'reopen',
    'manual_correction',
]);

const lossReasonSchema = z.enum([
    'no_interest',
    'price',
    'no_response',
    'competitor',
    'invalid_data',
    'activation_rejected',
    'other',
]);

const transitionOpportunitySchema = z.object({
    opportunityId: z.string().uuid(),
    expectedStage: z.enum(OPPORTUNITY_STAGES),
    toStage: z.enum(OPPORTUNITY_STAGES),
    reasonCode: transitionReasonSchema.optional(),
    nextActionDueAt: z.string().datetime({ offset: true }).nullable().optional(),
    lossReason: lossReasonSchema.optional(),
});

export type TransitionOpportunityInput = z.infer<typeof transitionOpportunitySchema>;

export interface OpportunityTransitionSnapshot {
    id: string;
    clientId: string;
    supplyPointId: string;
    ownerId: string;
    stage: OpportunityStage;
    stageEnteredAt: string;
    nextActionType: string | null;
    nextActionTitle: string | null;
    nextActionDueAt: string | null;
    closedAt: string | null;
}

export type TransitionOpportunityError =
    | 'INVALID_INPUT'
    | 'UNAUTHENTICATED'
    | 'NOT_AUTHORIZED'
    | 'NOT_AVAILABLE'
    | 'STATE_CHANGED'
    | 'TRANSITION_REJECTED'
    | 'PERSISTENCE_FAILED';

export type TransitionOpportunityResult =
    | { ok: true; opportunity: OpportunityTransitionSnapshot }
    | { ok: false; error: TransitionOpportunityError };

const opportunityIdSchema = z.string().uuid();

export async function getOpportunityWorkspaceAction(
    rawOpportunityId: string,
): Promise<OpportunityWorkspace | null> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const parsedId = opportunityIdSchema.safeParse(rawOpportunityId);
    if (!parsedId.success) return null;

    const supabase = await createClient();
    const { data: opportunity, error: opportunityError } = await supabase
        .from('opportunities')
        .select('id,client_id,supply_point_id,owner_id,type,stage,stage_entered_at,next_action_type,next_action_title,next_action_due_at,loss_reason')
        .eq('id', parsedId.data)
        .maybeSingle();

    if (opportunityError) {
        logger.error('[crm] opportunity workspace lookup failed', undefined, {
            code: opportunityError.code ?? 'unknown',
        });
        throw new Error('No se pudo cargar la oportunidad');
    }
    if (!opportunity) return null;

    const [
        clientResult,
        supplyPointResult,
        ownerResult,
        documentsResult,
        proposalsResult,
        contractsResult,
        commissionsResult,
        tasksResult,
        historyResult,
    ] = await Promise.all([
        supabase
            .from('clients')
            .select('id,name,email,phone,status')
            .eq('id', opportunity.client_id)
            .maybeSingle(),
        supabase
            .from('supply_points')
            .select('id,client_id,supply_type,cups_last4,address,city,current_marketer,current_tariff,annual_consumption_kwh')
            .eq('id', opportunity.supply_point_id)
            .maybeSingle(),
        supabase
            .from('profiles')
            .select('id,full_name')
            .eq('id', opportunity.owner_id)
            .maybeSingle(),
        supabase
            .from('ocr_jobs')
            .select('id,opportunity_id,file_name,status,created_at,confirmed_at,error_message')
            .eq('opportunity_id', opportunity.id)
            .order('created_at', { ascending: false }),
        supabase
            .from('proposals')
            .select('id,opportunity_id,status,created_at,sent_date,accepted_date,annual_savings,offer_snapshot,alta_status')
            .eq('opportunity_id', opportunity.id)
            .order('created_at', { ascending: false }),
        supabase
            .from('contracts')
            .select('id,opportunity_id,status,marketer_name,tariff_name,start_date,end_date,permanence_status')
            .eq('opportunity_id', opportunity.id)
            .order('created_at', { ascending: false }),
        supabase
            .from('network_commissions')
            .select('id,opportunity_id,status,agent_commission,franchise_commission,invoiced,paid_date')
            .eq('opportunity_id', opportunity.id)
            .order('created_at', { ascending: false }),
        supabase
            .from('tasks')
            .select('id,opportunity_id,title,description,status,due_date,created_at')
            .eq('opportunity_id', opportunity.id)
            .order('created_at', { ascending: false }),
        supabase
            .from('opportunity_stage_history')
            .select('id,opportunity_id,from_stage,to_stage,reason_code,created_at')
            .eq('opportunity_id', opportunity.id)
            .order('created_at', { ascending: false }),
    ]);

    const requiredResults = [clientResult, supplyPointResult, ownerResult];
    const relatedResults = [
        documentsResult,
        proposalsResult,
        contractsResult,
        commissionsResult,
        tasksResult,
        historyResult,
    ];
    const firstError = [...requiredResults, ...relatedResults].find(result => result.error)?.error;
    if (firstError) {
        logger.error('[crm] opportunity workspace relations failed', undefined, {
            code: firstError.code ?? 'unknown',
        });
        throw new Error('No se pudo cargar el expediente');
    }
    if (!clientResult.data || !supplyPointResult.data) return null;

    try {
        return buildOpportunityWorkspace({
            opportunity,
            client: clientResult.data,
            supplyPoint: supplyPointResult.data,
            owner: ownerResult.data ?? {
                id: opportunity.owner_id,
                full_name: null,
            },
            documents: documentsResult.data ?? [],
            proposals: proposalsResult.data ?? [],
            contracts: contractsResult.data ?? [],
            commissions: commissionsResult.data ?? [],
            tasks: tasksResult.data ?? [],
            history: historyResult.data ?? [],
        } as OpportunityWorkspaceSource);
    } catch {
        logger.error('[crm] opportunity workspace boundary validation failed');
        throw new Error('El expediente contiene relaciones incompatibles');
    }
}

interface RpcError {
    code?: string;
}

function mapTransitionError(error: RpcError): TransitionOpportunityError {
    switch (error.code) {
        case '42501':
            return 'NOT_AUTHORIZED';
        case 'P0002':
            return 'NOT_AVAILABLE';
        case '40001':
            return 'STATE_CHANGED';
        case '22023':
            return 'TRANSITION_REJECTED';
        default:
            return 'PERSISTENCE_FAILED';
    }
}

export async function transitionOpportunityAction(
    input: TransitionOpportunityInput,
): Promise<TransitionOpportunityResult> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const parsed = transitionOpportunitySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'INVALID_INPUT' };

    const {
        opportunityId,
        expectedStage,
        toStage,
        reasonCode,
        nextActionDueAt,
        lossReason,
    } = parsed.data;

    const isReopen = expectedStage === 'lost' && reasonCode === 'reopen';
    if (!isReopen && !canTransitionOpportunity(expectedStage, toStage)) {
        return { ok: false, error: 'TRANSITION_REJECTED' };
    }

    if (toStage === 'lost' && !lossReason) {
        return { ok: false, error: 'INVALID_INPUT' };
    }

    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return { ok: false, error: 'UNAUTHENTICATED' };

    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient.rpc('transition_crm_opportunity', {
        p_opportunity_id: opportunityId,
        p_expected_stage: expectedStage,
        p_to_stage: toStage,
        p_actor_id: user.id,
        p_reason_code: reasonCode ?? null,
        p_safe_metadata: { source: 'authenticated_server_action' },
        p_next_action_due_at: nextActionDueAt ?? null,
        p_loss_reason: lossReason ?? null,
    });

    if (error || !data) {
        return { ok: false, error: mapTransitionError(error ?? {}) };
    }

    const row = data as Record<string, unknown>;
    const stage = row.stage as OpportunityStage;
    if (!OPPORTUNITY_STAGES.includes(stage)) {
        return { ok: false, error: 'PERSISTENCE_FAILED' };
    }

    revalidatePath('/dashboard');
    revalidatePath('/admin');
    revalidatePath(`/dashboard/clients/${row.client_id as string}`);

    return {
        ok: true,
        opportunity: {
            id: row.id as string,
            clientId: row.client_id as string,
            supplyPointId: row.supply_point_id as string,
            ownerId: row.owner_id as string,
            stage,
            stageEnteredAt: row.stage_entered_at as string,
            nextActionType: (row.next_action_type as string) ?? null,
            nextActionTitle: (row.next_action_title as string) ?? null,
            nextActionDueAt: (row.next_action_due_at as string) ?? null,
            closedAt: (row.closed_at as string) ?? null,
        },
    };
}
