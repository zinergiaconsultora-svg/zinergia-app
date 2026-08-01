'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireServerRole } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
    validateCommissionPlan,
    validateDecommissionPolicy,
    type CommissionChannel,
} from '@/lib/commissions/lifecycle';
import { actionError, actionSuccess, type ActionResult } from './helpers';
import {
    buildCommissionAdminQueues,
    type AdminAdjustmentSource,
    type AdminCommissionSource,
    type CommissionAdminQueues,
} from '@/lib/commissions/adminQueues';

const planSchema = z.object({
    channel: z.enum(['partner_direct', 'franchise_network']),
    name: z.string().trim().min(3).max(120),
    commercialPercent: z.number().min(0).max(100),
    franchisePercent: z.number().min(0).max(100),
});

const assignmentSchema = z.object({
    commercialId: z.uuid(),
    planId: z.uuid(),
    reason: z.string().trim().min(3).max(500),
});

const initialSetupSchema = z.object({
    directName: z.string().trim().min(3).max(120),
    directCommercialPercent: z.number().gt(0).lt(100),
    franchiseName: z.string().trim().min(3).max(120),
    franchiseCommercialPercent: z.number().gt(0).lt(100),
    franchisePercent: z.number().min(0).lt(100),
    directCommercialIds: z.array(z.uuid()).max(5).refine(
        (ids) => new Set(ids).size === ids.length,
        'Los perfiles seleccionados no pueden repetirse.',
    ),
});

const decommissionPolicySchema = z.object({
    marketerName: z.string().trim().min(2).max(120),
    productCode: z.string().trim().max(80),
    consolidationDays: z.number().int().min(0).max(3650),
    clawbackDays: z.number().int().min(0).max(3650),
    bands: z.array(z.object({
        activeDayFrom: z.number().int().min(0),
        activeDayTo: z.number().int().min(0),
        reversalPercent: z.number().min(0).max(100),
    })).min(1).max(12),
});

const commissionTransitionSchema = z.object({
    commissionId: z.uuid(),
    reason: z.string().trim().min(3).max(500),
});

const adjustmentResolutionSchema = z.object({
    adjustmentId: z.uuid(),
    resolution: z.enum(['confirmed', 'disputed', 'waived']),
    note: z.string().trim().min(3).max(500),
});

export type CommissionPlanSummary = {
    id: string;
    name: string;
    channel: CommissionChannel;
    version: number;
    commercialShareBps: number;
    franchiseShareBps: number;
    centralShareBps: number;
    effectiveFrom: string;
};

export type CommissionCommercialSummary = {
    id: string;
    name: string;
    email: string | null;
    role: string | null;
};

export type CommissionAssignmentSummary = {
    id: string;
    commercialId: string;
    planId: string;
    effectiveFrom: string;
    reason: string;
};

export type CommissionReconciliationSummary = {
    commissionId: string;
    commercialId: string | null;
    lifecycleStatus: string;
    reconciliationStatus: string;
    requiredAction: string;
    createdAt: string | null;
};

export type CommissionPolicyBandSummary = {
    id: string;
    activeDayFrom: number;
    activeDayTo: number | null;
    reversalBps: number;
};

export type CommissionPolicySummary = {
    id: string;
    name: string;
    marketerName: string;
    productCode: string | null;
    version: number;
    consolidationDays: number;
    clawbackDays: number;
    effectiveFrom: string;
    bands: CommissionPolicyBandSummary[];
};

export type CommissionManagementData = {
    actorId: string;
    plans: CommissionPlanSummary[];
    commercials: CommissionCommercialSummary[];
    assignments: CommissionAssignmentSummary[];
    policies: CommissionPolicySummary[];
    reconciliation: CommissionReconciliationSummary[];
    operations: CommissionAdminQueues;
};

export type CommissionModelSetupResult = {
    directPlanId: string;
    franchisePlanId: string;
    assignedCount: number;
};

export async function getCommissionManagementDataAction(): Promise<CommissionManagementData> {
    await requireServerRole(['admin']);
    const actorId = await getActorId();
    const service = createServiceClient();

    const [
        plansResult,
        profilesResult,
        assignmentsResult,
        policiesResult,
        bandsResult,
        reconciliationResult,
        commissionsResult,
        adjustmentsResult,
    ] = await Promise.all([
        service
            .from('commission_plans')
            .select('id, name, channel, version, commercial_share_bps, franchise_share_bps, central_share_bps, effective_from')
            .eq('is_active', true)
            .order('channel')
            .order('version', { ascending: false }),
        service
            .from('profiles')
            .select('id, full_name, email, role')
            .in('role', ['admin', 'franchise', 'agent'])
            .order('full_name'),
        service
            .from('commission_plan_assignments')
            .select('id, commercial_id, plan_id, effective_from, reason')
            .is('effective_to', null)
            .order('effective_from', { ascending: false }),
        service
            .from('commission_decommission_policies')
            .select('id, name, marketer_name, product_code, version, consolidation_days, clawback_days, effective_from')
            .eq('is_active', true)
            .order('marketer_name')
            .order('version', { ascending: false }),
        service
            .from('commission_decommission_bands')
            .select('id, policy_id, active_day_from, active_day_to, reversal_bps')
            .order('active_day_from'),
        service
            .from('commission_reconciliation_queue')
            .select('commission_id, commercial_id, lifecycle_status, reconciliation_status, required_action, created_at')
            .order('created_at', { ascending: true })
            .limit(100),
        service
            .from('network_commissions')
            .select(`
                id,
                agent_id,
                proposal_id,
                lifecycle_status,
                reconciliation_status,
                commercial_net_amount,
                agent_commission,
                total_reversed_commercial,
                invoice_id,
                created_at,
                eligible_at,
                validated_at,
                clients ( name ),
                proposals ( clients ( name ) ),
                commercial:profiles!network_commissions_agent_id_fkey (
                    full_name,
                    email,
                    company_name,
                    fiscal_verified
                )
            `)
            .order('created_at', { ascending: false })
            .limit(250),
        service
            .from('commission_adjustments')
            .select('id, commission_id, reason_code, active_days, reversal_bps, commercial_amount, evidence_reference, status, proposed_at')
            .eq('status', 'proposed')
            .order('proposed_at', { ascending: true })
            .limit(100),
    ]);

    const firstError = plansResult.error
        ?? profilesResult.error
        ?? assignmentsResult.error
        ?? policiesResult.error
        ?? bandsResult.error
        ?? reconciliationResult.error
        ?? commissionsResult.error
        ?? adjustmentsResult.error;
    if (firstError) throw new Error('No se pudo cargar la configuración de comisiones.');

    const bandsByPolicy = new Map<string, CommissionPolicyBandSummary[]>();
    for (const band of bandsResult.data ?? []) {
        const policyBands = bandsByPolicy.get(band.policy_id) ?? [];
        policyBands.push({
            id: band.id,
            activeDayFrom: band.active_day_from,
            activeDayTo: band.active_day_to,
            reversalBps: band.reversal_bps,
        });
        bandsByPolicy.set(band.policy_id, policyBands);
    }

    const reconciliation = (reconciliationResult.data ?? [])
        .filter((item) => item.commission_id)
        .map((item) => ({
            commissionId: item.commission_id!,
            commercialId: item.commercial_id,
            lifecycleStatus: item.lifecycle_status ?? 'pending',
            reconciliationStatus: item.reconciliation_status ?? 'pending_review',
            requiredAction: item.required_action ?? 'Revisar cálculo económico',
            createdAt: item.created_at,
        }));

    return {
        actorId,
        plans: (plansResult.data ?? []).map((plan) => ({
            id: plan.id,
            name: plan.name,
            channel: plan.channel as CommissionChannel,
            version: plan.version,
            commercialShareBps: plan.commercial_share_bps,
            franchiseShareBps: plan.franchise_share_bps,
            centralShareBps: plan.central_share_bps,
            effectiveFrom: plan.effective_from,
        })),
        commercials: (profilesResult.data ?? []).map((profile) => ({
            id: profile.id,
            name: profile.full_name?.trim() || profile.email || 'Perfil sin nombre',
            email: profile.email,
            role: profile.role,
        })),
        assignments: (assignmentsResult.data ?? []).map((assignment) => ({
            id: assignment.id,
            commercialId: assignment.commercial_id,
            planId: assignment.plan_id,
            effectiveFrom: assignment.effective_from,
            reason: assignment.reason,
        })),
        policies: (policiesResult.data ?? []).map((policy) => ({
            id: policy.id,
            name: policy.name,
            marketerName: policy.marketer_name,
            productCode: policy.product_code,
            version: policy.version,
            consolidationDays: policy.consolidation_days,
            clawbackDays: policy.clawback_days,
            effectiveFrom: policy.effective_from,
            bands: bandsByPolicy.get(policy.id) ?? [],
        })),
        reconciliation,
        operations: buildCommissionAdminQueues({
            commissions: (commissionsResult.data ?? []) as unknown as AdminCommissionSource[],
            adjustments: (adjustmentsResult.data ?? []) as unknown as AdminAdjustmentSource[],
            reconciliation,
        }),
    };
}

export async function validateCommissionAction(input: z.input<typeof commissionTransitionSchema>): Promise<ActionResult<string>> {
    await requireServerRole(['admin']);
    const parsed = commissionTransitionSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: 'Indica una comisión y un motivo de validación.' };

    try {
        const actorId = await getActorId();
        const service = createServiceClient();
        const { data, error } = await service.rpc('transition_commission_lifecycle', {
            p_commission_id: parsed.data.commissionId,
            p_to_status: 'validated',
            p_actor_id: actorId,
            p_reason: parsed.data.reason,
        });

        if (error || !data) return actionError(error, 'No se pudo validar la comisión.');
        revalidatePath('/admin/commissions');
        revalidatePath('/dashboard/commissions');
        return actionSuccess(data);
    } catch (error) {
        return actionError(error, 'No se pudo validar la comisión.');
    }
}

export async function resolveCommissionAdjustmentAction(
    input: z.input<typeof adjustmentResolutionSchema>,
): Promise<ActionResult<string>> {
    await requireServerRole(['admin']);
    const parsed = adjustmentResolutionSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: 'Selecciona una resolución y documenta el motivo.' };

    try {
        const actorId = await getActorId();
        const service = createServiceClient();
        const { data, error } = await service.rpc('resolve_commission_adjustment', {
            p_adjustment_id: parsed.data.adjustmentId,
            p_actor_id: actorId,
            p_resolution: parsed.data.resolution,
            p_note: parsed.data.note,
        });

        if (error || !data) return actionError(error, 'No se pudo resolver el ajuste.');
        revalidatePath('/admin/commissions');
        revalidatePath('/dashboard/commissions');
        return actionSuccess(data);
    } catch (error) {
        return actionError(error, 'No se pudo resolver el ajuste.');
    }
}

export async function createCommissionPlanAction(input: z.input<typeof planSchema>): Promise<ActionResult<string>> {
    await requireServerRole(['admin']);
    const parsed = planSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: 'Revisa los porcentajes y el nombre del plan.' };

    const commercialShareBps = percentToBps(parsed.data.commercialPercent);
    const franchiseShareBps = parsed.data.channel === 'partner_direct'
        ? 0
        : percentToBps(parsed.data.franchisePercent);
    const centralShareBps = 10_000 - commercialShareBps - franchiseShareBps;
    const errors = validateCommissionPlan({
        channel: parsed.data.channel,
        commercialShareBps,
        franchiseShareBps,
        centralShareBps,
    });
    if (centralShareBps < 0 || errors.length > 0) {
        return { success: false, error: 'El reparto debe sumar exactamente el 100 %.' };
    }

    try {
        const actorId = await getActorId();
        const service = createServiceClient();
        const code = parsed.data.channel;
        const { data: latest } = await service
            .from('commission_plans')
            .select('version')
            .eq('code', code)
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle();

        const { data, error } = await service
            .from('commission_plans')
            .insert({
                code,
                version: (latest?.version ?? 0) + 1,
                name: parsed.data.name,
                channel: parsed.data.channel,
                commercial_share_bps: commercialShareBps,
                franchise_share_bps: franchiseShareBps,
                central_share_bps: centralShareBps,
                effective_from: new Date().toISOString(),
                created_by: actorId,
            })
            .select('id')
            .single();

        if (error || !data) return actionError(error, 'No se pudo crear el plan.');
        revalidatePath('/admin/commissions');
        return actionSuccess(data.id);
    } catch (error) {
        return actionError(error, 'No se pudo crear el plan.');
    }
}

export async function setupCommissionModelAction(
    input: z.input<typeof initialSetupSchema>,
): Promise<ActionResult<CommissionModelSetupResult>> {
    await requireServerRole(['admin']);
    const parsed = initialSetupSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: 'Completa los dos repartos y selecciona como máximo cinco socios.' };
    }

    const directCommercialShareBps = percentToBps(parsed.data.directCommercialPercent);
    const directCentralShareBps = 10_000 - directCommercialShareBps;
    const franchiseCommercialShareBps = percentToBps(parsed.data.franchiseCommercialPercent);
    const franchiseShareBps = percentToBps(parsed.data.franchisePercent);
    const franchiseCentralShareBps = 10_000 - franchiseCommercialShareBps - franchiseShareBps;

    const directErrors = validateCommissionPlan({
        channel: 'partner_direct',
        commercialShareBps: directCommercialShareBps,
        franchiseShareBps: 0,
        centralShareBps: directCentralShareBps,
    });
    const franchiseErrors = validateCommissionPlan({
        channel: 'franchise_network',
        commercialShareBps: franchiseCommercialShareBps,
        franchiseShareBps,
        centralShareBps: franchiseCentralShareBps,
    });

    if (
        directErrors.length > 0
        || franchiseErrors.length > 0
        || directCommercialShareBps <= franchiseCommercialShareBps
        || directCentralShareBps >= franchiseCentralShareBps
    ) {
        return {
            success: false,
            error: 'El socio directo debe recibir más y Zinergia debe conservar más en el canal franquiciado.',
        };
    }

    try {
        const actorId = await getActorId();
        const service = createServiceClient();
        const { data, error } = await service.rpc('configure_commission_model', {
            p_actor_id: actorId,
            p_direct_name: parsed.data.directName,
            p_direct_commercial_share_bps: directCommercialShareBps,
            p_franchise_name: parsed.data.franchiseName,
            p_franchise_commercial_share_bps: franchiseCommercialShareBps,
            p_franchise_share_bps: franchiseShareBps,
            p_direct_commercial_ids: parsed.data.directCommercialIds,
            p_reason: 'Configuración inicial del modelo económico',
        });

        if (error || !data) return actionError(error, 'No se pudo guardar el modelo económico.');
        revalidatePath('/admin/commissions');
        return actionSuccess(data as unknown as CommissionModelSetupResult);
    } catch (error) {
        return actionError(error, 'No se pudo guardar el modelo económico.');
    }
}

export async function createDecommissionPolicyAction(
    input: z.input<typeof decommissionPolicySchema>,
): Promise<ActionResult<string>> {
    await requireServerRole(['admin']);
    const parsed = decommissionPolicySchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: 'Revisa la comercializadora, los días y los tramos.' };
    }

    const bands = parsed.data.bands.map((band) => ({
        activeDayFrom: band.activeDayFrom,
        activeDayTo: band.activeDayTo,
        reversalBps: percentToBps(band.reversalPercent),
    }));
    const errors = validateDecommissionPolicy({
        consolidationDays: parsed.data.consolidationDays,
        clawbackDays: parsed.data.clawbackDays,
        bands,
    });
    if (errors.length > 0) {
        return { success: false, error: 'Los tramos deben ser continuos, completos y no crecientes.' };
    }

    try {
        const actorId = await getActorId();
        const service = createServiceClient();
        const { data, error } = await service.rpc('configure_decommission_policy', {
            p_actor_id: actorId,
            p_marketer_name: parsed.data.marketerName,
            p_product_code: parsed.data.productCode || null,
            p_consolidation_days: parsed.data.consolidationDays,
            p_clawback_days: parsed.data.clawbackDays,
            p_bands: bands,
        });

        if (error || !data) return actionError(error, 'No se pudo guardar la política.');
        revalidatePath('/admin/commissions');
        return actionSuccess(data);
    } catch (error) {
        return actionError(error, 'No se pudo guardar la política.');
    }
}

export async function assignCommissionPlanAction(input: z.input<typeof assignmentSchema>): Promise<ActionResult<string>> {
    await requireServerRole(['admin']);
    const parsed = assignmentSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: 'Selecciona un perfil, un plan y un motivo.' };

    try {
        const actorId = await getActorId();
        const service = createServiceClient();
        const { data, error } = await service.rpc('assign_commission_plan', {
            p_commercial_id: parsed.data.commercialId,
            p_plan_id: parsed.data.planId,
            p_actor_id: actorId,
            p_reason: parsed.data.reason,
        });

        if (error || !data) return actionError(error, 'No se pudo asignar el plan.');
        revalidatePath('/admin/commissions');
        return actionSuccess(data);
    } catch (error) {
        return actionError(error, 'No se pudo asignar el plan.');
    }
}

function percentToBps(percent: number): number {
    return Math.round(percent * 100);
}

async function getActorId(): Promise<string> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Sesión expirada.');
    return user.id;
}
