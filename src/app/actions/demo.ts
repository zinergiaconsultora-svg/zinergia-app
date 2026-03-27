'use server'

import { createClient } from '@/lib/supabase/server'
import { requireServerRole } from '@/lib/auth/permissions'

/**
 * Simulates a sale of the given amount for demo/testing purposes.
 * Restricted to admin role only — never callable by agents or franchises.
 */
export async function simulateSaleAction(amount = 2500) {
    await requireServerRole(['admin'])

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    const { data: profile } = await supabase
        .from('profiles')
        .select('franchise_id')
        .eq('id', user.id)
        .single()

    const franchiseId = profile?.franchise_id
    if (!franchiseId) throw new Error('Sin franquicia asignada')

    const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({ name: `Demo ${Date.now()}`, franchise_id: franchiseId, status: 'new', owner_id: user.id, type: 'company' })
        .select('id')
        .single()

    if (clientError || !client) throw clientError ?? new Error('Error al crear cliente demo')

    const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .insert({ client_id: client.id, status: 'draft', annual_savings: amount, franchise_id: franchiseId })
        .select('id')
        .single()

    if (proposalError || !proposal) throw proposalError ?? new Error('Error al crear propuesta demo')

    // Trigger commission flow via accepted status
    const { updateProposalStatusAction } = await import('./proposals')
    await updateProposalStatusAction(proposal.id, 'accepted')

    return proposal
}
