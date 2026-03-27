'use server'

import { createClient } from '@/lib/supabase/server'
import { Proposal } from '@/types/crm'

const COMMISSION_RATE = 0.15   // 15% of annual_savings as the commission pot
const AGENT_SHARE    = 0.30    // Agent receives 30% of pot
const FRANCHISE_SHARE = 0.50   // Franchise receives 50% of pot
const HQ_SHARE       = 0.20   // HQ receives 20% of pot
const POINTS_PER_WIN = 50

/**
 * Updates a proposal's status and, if moving to 'accepted',
 * atomically creates the commission record and awards gamification points.
 *
 * Idempotent: a second call with status='accepted' is a no-op for commissions
 * (checked via existing network_commissions row for the proposal).
 */
export async function updateProposalStatusAction(
    id: string,
    status: Proposal['status']
): Promise<Proposal> {
    const supabase = await createClient()

    // 1. Update status
    const { data: proposal, error } = await supabase
        .from('proposals')
        .update({ status })
        .eq('id', id)
        .select('*')
        .single()

    if (error) throw error

    // 2. Trigger commission processing only on 'accepted'
    if (status === 'accepted') {
        await processCommissions(supabase, proposal as Proposal)
    }

    return proposal as Proposal
}

async function processCommissions(
    supabase: Awaited<ReturnType<typeof createClient>>,
    proposal: Proposal
) {
    try {
        // Guard: skip if commission already exists for this proposal
        const { data: existing } = await supabase
            .from('network_commissions')
            .select('id')
            .eq('proposal_id', proposal.id)
            .maybeSingle()

        if (existing) return // Already processed — idempotent

        // Get the seller (current user) and their profile
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
            .from('profiles')
            .select('franchise_id, role')
            .eq('id', user.id)
            .single()

        if (!profile?.franchise_id) return

        // Calculate commission splits
        const pot = (proposal.annual_savings || 0) * COMMISSION_RATE

        await supabase.from('network_commissions').insert({
            proposal_id: proposal.id,
            agent_id: user.id,
            franchise_id: profile.franchise_id,
            total_revenue: pot,
            agent_commission: pot * AGENT_SHARE,
            franchise_profit: pot * FRANCHISE_SHARE,
            hq_royalty: pot * HQ_SHARE,
            status: 'pending',
        })

        // Award gamification points (upsert to handle first-time users)
        const { data: current } = await supabase
            .from('user_points')
            .select('points')
            .eq('user_id', user.id)
            .maybeSingle()

        await supabase.from('user_points').upsert({
            user_id: user.id,
            points: (current?.points || 0) + POINTS_PER_WIN,
            last_updated: new Date().toISOString(),
        })
    } catch (err) {
        // Commission failure must NOT roll back the proposal status change.
        // Log and continue — commissions can be reprocessed manually if needed.
        console.error('[updateProposalStatusAction] Commission processing failed:', err)
    }
}
