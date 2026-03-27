'use server'

import { createClient } from '@/lib/supabase/server'

export interface AppNotification {
    id: string;
    type: 'success' | 'warning' | 'info';
    title: string;
    message: string;
    created_at: string;
    read: boolean;
}

/**
 * Derives in-app notifications from real DB events (no separate notifications table).
 * Sources:
 *   - network_commissions with status='cleared'  → "Comisión Aprobada"
 *   - proposals with status='accepted'           → "Propuesta Aceptada"
 *   - pending commissions count > 0 (franchise)  → "Comisiones Pendientes"
 */
export async function getNotificationsAction(): Promise<AppNotification[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, franchise_id')
        .eq('id', user.id)
        .single()

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const notifications: AppNotification[] = []

    // 1. Recently cleared commissions (the agent's money is approved)
    const { data: cleared } = await supabase
        .from('network_commissions')
        .select('id, created_at, agent_commission, proposals(client_id, clients(name))')
        .eq('agent_id', user.id)
        .eq('status', 'cleared')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(5)

    if (cleared) {
        cleared.forEach(c => {
            const proposal = Array.isArray(c.proposals) ? c.proposals[0] : c.proposals
            const client = Array.isArray(proposal?.clients) ? proposal?.clients[0] : proposal?.clients
            const clientName = (client as { name?: string } | null)?.name ?? 'cliente'
            const amount = c.agent_commission ? `${c.agent_commission.toFixed(0)}€` : ''

            notifications.push({
                id: `comm_cleared_${c.id}`,
                type: 'success',
                title: 'Comisión Aprobada',
                message: `La venta de "${clientName}" ha sido validada${amount ? ` — ${amount}` : ''}.`,
                created_at: c.created_at,
                read: false,
            })
        })
    }

    // 2. Recently accepted proposals (franchise/admin sees their network's wins)
    const franchiseId = profile?.franchise_id
    if (franchiseId) {
        const { data: accepted } = await supabase
            .from('proposals')
            .select('id, created_at, annual_savings, clients(name)')
            .eq('franchise_id', franchiseId)
            .eq('status', 'accepted')
            .gte('created_at', thirtyDaysAgo)
            .order('created_at', { ascending: false })
            .limit(5)

        if (accepted) {
            accepted.forEach(p => {
                const client = Array.isArray(p.clients) ? p.clients[0] : p.clients
                const clientName = (client as { name?: string } | null)?.name ?? 'cliente'
                const savings = p.annual_savings ? `${p.annual_savings.toFixed(0)}€/año` : ''

                notifications.push({
                    id: `proposal_accepted_${p.id}`,
                    type: 'success',
                    title: 'Propuesta Aceptada',
                    message: `${clientName} ha aceptado la oferta${savings ? ` · ${savings} de ahorro` : ''}.`,
                    created_at: p.created_at,
                    read: false,
                })
            })
        }
    }

    // 3. Pending commissions warning (franchise/admin only)
    if (profile?.role === 'franchise' || profile?.role === 'admin') {
        const { count } = await supabase
            .from('network_commissions')
            .select('id', { count: 'exact', head: true })
            .eq('franchise_id', franchiseId ?? '')
            .eq('status', 'pending')

        if (count && count > 0) {
            notifications.push({
                id: 'pending_commissions',
                type: 'warning',
                title: 'Comisiones Pendientes',
                message: `Tienes ${count} comisión${count > 1 ? 'es' : ''} pendiente${count > 1 ? 's' : ''} de aprobación.`,
                created_at: new Date().toISOString(),
                read: false,
            })
        }
    }

    // Sort newest first, deduplicate by id
    return notifications
        .filter((n, i, arr) => arr.findIndex(x => x.id === n.id) === i)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 10)
}
