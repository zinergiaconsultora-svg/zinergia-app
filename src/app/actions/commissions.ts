'use server'

import { createClient } from '@/lib/supabase/server'
import { requireServerRole } from '@/lib/auth/permissions'
import { revalidatePath } from 'next/cache'
import { Commission } from '@/types/crm'

/**
 * Advances a commission to 'cleared' (pending → cleared).
 * Admin/franchise only — represents validation that the deal is confirmed.
 */
export async function clearCommissionAction(id: string): Promise<Commission> {
    await requireServerRole(['admin', 'franchise'])
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('network_commissions')
        .update({ status: 'cleared' })
        .eq('id', id)
        .eq('status', 'pending')          // Guard: only transition from pending
        .select()
        .single()

    if (error) throw error
    if (!data) throw new Error('Comisión no encontrada o ya procesada')
    revalidatePath('/dashboard/wallet')
    return data as Commission
}

/**
 * Marks a commission as paid (cleared → paid).
 * Admin/franchise only — represents that the bank transfer has been made.
 */
export async function payCommissionAction(id: string): Promise<Commission> {
    await requireServerRole(['admin', 'franchise'])
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('network_commissions')
        .update({ status: 'paid' })
        .eq('id', id)
        .eq('status', 'cleared')          // Guard: only transition from cleared
        .select()
        .single()

    if (error) throw error
    if (!data) throw new Error('Comisión no encontrada o ya pagada')
    revalidatePath('/dashboard/wallet')
    return data as Commission
}

/**
 * Loads ALL commissions across all agents/franchises.
 * Admin/franchise only. Agents use getNetworkCommissions() from the service.
 */
export async function getAllCommissionsAction(): Promise<Commission[]> {
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

    if (error) throw error
    return (data || []) as Commission[]
}
