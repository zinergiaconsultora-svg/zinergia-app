'use server'

import { createClient } from '@/lib/supabase/server'
import { requireServerRole } from '@/lib/auth/permissions'
import { revalidatePath } from 'next/cache'
import { Commission } from '@/types/crm'
import { createNotificationInternal } from './notifications'
import { ActionResult, actionError, actionSuccess } from './helpers'
import { uuidSchema } from '@/lib/validation/schemas'
import { logAdminAction } from '@/lib/audit/logger'
import {
    buildCommissionWorkspace,
    type CommissionWorkspace,
    type CommissionWorkspaceSource,
} from '@/lib/commissions/workspace'

export async function getCommissionWorkspaceAction(): Promise<ActionResult<CommissionWorkspace>> {
    await requireServerRole(['admin', 'franchise', 'agent'])
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('network_commissions')
        .select(`
            id,
            proposal_id,
            contract_id,
            created_at,
            lifecycle_status,
            reconciliation_status,
            agent_commission,
            commercial_net_amount,
            gross_supplier_commission,
            total_reversed_commercial,
            calculation_snapshot,
            policy_snapshot,
            clients ( name ),
            proposals ( offer_snapshot, clients ( name ) ),
            commission_adjustments (
                id,
                reason_code,
                active_days,
                reversal_bps,
                commercial_amount,
                evidence_reference,
                policy_snapshot,
                status,
                proposed_at,
                resolved_at,
                resolution_note
            )
        `)
        .order('created_at', { ascending: false })

    if (error) return actionError(error, 'Error al cargar las comisiones')
    return actionSuccess(buildCommissionWorkspace((data ?? []) as unknown as CommissionWorkspaceSource[]))
}

export async function clearCommissionAction(id: string): Promise<ActionResult<Commission>> {
    await requireServerRole(['admin', 'franchise'])
    const safeId = uuidSchema.parse(id)
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('network_commissions')
        .update({ status: 'cleared' })
        .eq('id', safeId)
        .eq('status', 'pending')
        .select('*, proposals(clients(name))')
        .single()

    if (error) return actionError(error, 'Error al aprobar la comisión')
    if (!data) return { success: false, error: 'Comisión no encontrada o ya procesada' }

    try {
        const clientName = (data.proposals as Record<string, unknown>)?.clients
            ? ((data.proposals as Record<string, unknown>).clients as Record<string, string>)?.name || 'Cliente'
            : 'Cliente'
        await createNotificationInternal(supabase, data.agent_id, {
            title: 'Comisión aprobada',
            message: `Tu comisión de ${data.agent_commission.toFixed(2)}€ por ${clientName} ha sido aprobada.`,
            type: 'commission_cleared',
            link: '/dashboard/commissions',
        })
    } catch { /* non-critical */ }

    revalidatePath('/dashboard/commissions')
    revalidatePath('/dashboard/commissions')
    logAdminAction('clear_commission', 'network_commissions', safeId).catch(() => {})
    return actionSuccess(data as Commission)
}

export async function payCommissionAction(id: string): Promise<ActionResult<Commission>> {
    await requireServerRole(['admin', 'franchise'])
    const safeId = uuidSchema.parse(id)
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('network_commissions')
        .update({ status: 'paid' })
        .eq('id', safeId)
        .eq('status', 'cleared')
        .select('*, proposals(clients(name))')
        .single()

    if (error) return actionError(error, 'Error al pagar la comisión')
    if (!data) return { success: false, error: 'Comisión no encontrada o ya pagada' }

    try {
        const clientName = (data.proposals as Record<string, unknown>)?.clients
            ? ((data.proposals as Record<string, unknown>).clients as Record<string, string>)?.name || 'Cliente'
            : 'Cliente'
        await createNotificationInternal(supabase, data.agent_id, {
            title: 'Comisión pagada',
            message: `Tu comisión de ${data.agent_commission.toFixed(2)}€ por ${clientName} ha sido pagada.`,
            type: 'commission_earned',
            link: '/dashboard/commissions',
        })
    } catch { /* non-critical */ }

    revalidatePath('/dashboard/commissions')
    revalidatePath('/dashboard/commissions')
    logAdminAction('pay_commission', 'network_commissions', safeId).catch(() => {})
    return actionSuccess(data as Commission)
}

export async function getAllCommissionsAction(): Promise<ActionResult<Commission[]>> {
    await requireServerRole(['admin', 'franchise'])
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('network_commissions')
        .select(`
            *,
            proposals (
                client_id,
                annual_savings,
                clients ( name )
            )
        `)
        .order('created_at', { ascending: false })

    if (error) return actionError(error, 'Error al cargar las comisiones')
    return actionSuccess((data || []) as Commission[])
}
