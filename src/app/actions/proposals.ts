'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Proposal } from '@/types/crm'
import { getActiveCommissionRule } from './commissionRules'
import { createNotificationInternal } from './notifications'

/**
 * Updates a proposal's status and, if moving to 'accepted',
 * atomically creates the commission record and awards gamification points.
 *
 * Idempotent: a second call with status='accepted' is a no-op for commissions
 * (checked via existing network_commissions row for the proposal).
 */
export interface ProposalHistoryItem {
    id: string;
    created_at: string;
    current_annual_cost: number;
    offer_annual_cost: number;
    annual_savings: number;
    savings_percent: number;
    offer_snapshot: {
        marketer_name: string;
        tariff_name: string;
    } | null;
    calculation_data: {
        company_name?: string;
        tariff_name?: string;
        cups?: string;
    } | null;
}

/**
 * Returns past proposals for a given CUPS, scoped to the current user's data.
 * Used by the simulator's comparison feature.
 */
export async function getProposalHistoryByCupsAction(cups: string): Promise<ProposalHistoryItem[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, franchise_id')
        .eq('id', user.id)
        .single()

    if (!profile) throw new Error('Perfil no encontrado')

    let query = supabase
        .from('proposals')
        .select('id, created_at, current_annual_cost, offer_annual_cost, annual_savings, savings_percent, offer_snapshot, calculation_data')
        .order('created_at', { ascending: false })
        .limit(20)

    if (profile.role === 'agent') {
        query = query.eq('agent_id', user.id) as typeof query
    } else if (profile.role === 'franchise') {
        query = query.eq('franchise_id', profile.franchise_id) as typeof query
    }

    const { data, error } = await query
    if (error) throw error

    // Filter by CUPS client-side (stored in JSONB calculation_data)
    return (data ?? []).filter(p => {
        const cd = p.calculation_data as { cups?: string } | null
        return cd?.cups === cups
    }) as ProposalHistoryItem[]
}

export async function updateProposalStatusAction(
    id: string,
    status: Proposal['status']
): Promise<Proposal> {
    const supabase = await createClient()

    // Verificar autenticación y ownership antes de actualizar
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, franchise_id')
        .eq('id', user.id)
        .single()

    if (!profile) throw new Error('Perfil no encontrado')

    // 1. Update status — filtrar por agent_id excepto para admin/franchise
    const query = supabase
        .from('proposals')
        .update({ status })
        .eq('id', id)

    // Agentes solo pueden modificar sus propias propuestas
    if (profile.role === 'agent') {
        query.eq('agent_id', user.id)
    } else if (profile.role === 'franchise') {
        query.eq('franchise_id', profile.franchise_id)
    }

    const { data: proposal, error } = await query
        .select('id, client_id, franchise_id, created_at, status, offer_snapshot, calculation_data, current_annual_cost, offer_annual_cost, annual_savings, savings_percent, notes, optimization_result, aletheia_summary')
        .single()

    if (error) throw error

    // 2. Trigger commission processing only on 'accepted'
    if (status === 'accepted') {
        await processCommissions(supabase, proposal as Proposal)
    }

    // 3. Create in-app notification for the agent
    await createStatusNotification(supabase, user.id, proposal as Proposal, status)

    revalidatePath('/dashboard/proposals')
    revalidatePath(`/dashboard/proposals/${id}`)
    revalidatePath('/dashboard')
    return proposal as Proposal
}

async function createStatusNotification(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    proposal: Proposal,
    status: Proposal['status']
) {
    try {
        const cd = proposal.calculation_data as { client_name?: string } | null
        const clientName = cd?.client_name ?? 'el cliente'
        const savings = proposal.annual_savings
            ? `${Math.round(proposal.annual_savings).toLocaleString('es-ES')} €/año`
            : null

        const map: Record<string, { title: string; message: string; type: string }> = {
            accepted: {
                title: '¡Propuesta firmada!',
                message: `${clientName} ha aceptado la oferta${savings ? ` — ahorro de ${savings}` : ''}.`,
                type: 'proposal_accepted',
            },
            rejected: {
                title: 'Propuesta rechazada',
                message: `${clientName} ha rechazado la propuesta. Puedes intentar una nueva simulación.`,
                type: 'proposal_rejected',
            },
            sent: {
                title: 'Propuesta enviada',
                message: `La propuesta para ${clientName} ha sido enviada y está pendiente de respuesta.`,
                type: 'proposal_sent',
            },
        }

        const notif = map[status]
        if (!notif) return

        await createNotificationInternal(supabase, userId, {
            title: notif.title,
            message: notif.message,
            type: notif.type as never,
            link: `/dashboard/proposals`,
        })
    } catch {
        // Non-critical — don't block the main action
    }
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

        // Load active commission rule (falls back to defaults if table missing)
        const rule = await getActiveCommissionRule()
        const pot = (proposal.annual_savings || 0) * rule.commission_rate

        // Upsert con ignoreDuplicates: si dos requests concurrentes llegan al mismo tiempo,
        // el UNIQUE constraint en proposal_id garantiza que solo uno insertará. El otro
        // fallará silenciosamente. El JS check de arriba es un early-exit barato, no la
        // garantía real.
        await supabase.from('network_commissions').upsert({
            proposal_id: proposal.id,
            agent_id: user.id,
            franchise_id: profile.franchise_id,
            total_revenue: pot,
            agent_commission: pot * rule.agent_share,
            franchise_profit: pot * rule.franchise_share,
            hq_royalty: pot * rule.hq_share,
            status: 'pending',
        }, { onConflict: 'proposal_id', ignoreDuplicates: true })

        // Award gamification points (upsert to handle first-time users)
        const { data: current } = await supabase
            .from('user_points')
            .select('points')
            .eq('user_id', user.id)
            .maybeSingle()

        await supabase.from('user_points').upsert({
            user_id: user.id,
            points: (current?.points || 0) + rule.points_per_win,
            last_updated: new Date().toISOString(),
        })
    } catch (err) {
        // Commission failure must NOT roll back the proposal status change.
        // Log and continue — commissions can be reprocessed manually if needed.
        console.error('[updateProposalStatusAction] Commission processing failed:', err)
    }
}
