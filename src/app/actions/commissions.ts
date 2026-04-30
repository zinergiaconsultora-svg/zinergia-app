'use server'

import { createClient } from '@/lib/supabase/server'
import { requireServerRole } from '@/lib/auth/permissions'
import { revalidatePath } from 'next/cache'
import { Commission } from '@/types/crm'
import { createNotificationInternal } from './notifications'
import { ActionResult, actionError, actionSuccess } from './helpers'

export async function clearCommissionAction(id: string): Promise<ActionResult<Commission>> {
    await requireServerRole(['admin', 'franchise'])
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('network_commissions')
        .update({ status: 'cleared' })
        .eq('id', id)
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
            link: '/dashboard/wallet',
        })
    } catch { /* non-critical */ }

    revalidatePath('/dashboard/wallet')
    return actionSuccess(data as Commission)
}

export async function payCommissionAction(id: string): Promise<ActionResult<Commission>> {
    await requireServerRole(['admin', 'franchise'])
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('network_commissions')
        .update({ status: 'paid' })
        .eq('id', id)
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
            link: '/dashboard/wallet',
        })
    } catch { /* non-critical */ }

    revalidatePath('/dashboard/wallet')
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
