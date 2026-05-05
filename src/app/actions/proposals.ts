'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Proposal } from '@/types/crm'
import { getActiveCommissionRule } from './commissionRules'
import { createNotificationInternal } from './notifications'
import { requireServerRole } from '@/lib/auth/permissions'
import { calculateCommissionSplit, applyFranchiseOverride } from '@/lib/commissions/calculator'

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
    await requireServerRole(['admin', 'franchise', 'agent']);
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
    if (error) return []

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
    await requireServerRole(['admin', 'franchise', 'agent']);
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado');

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, franchise_id')
        .eq('id', user.id)
        .single()

    if (!profile) throw new Error('Perfil no encontrado');

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

    if (error) throw new Error('Error al actualizar la propuesta');

    // 2. Trigger commission processing only on 'accepted'
    if (status === 'accepted') {
        await processCommissions(supabase, proposal as Proposal)
    }

    // 3. Create in-app notification for the agent
    await createStatusNotification(supabase, user.id, proposal as Proposal, status)

    // 4. Log activity on the client timeline
    await logProposalActivity(supabase, proposal as Proposal, user.id, status)

    // 5. Auto-generate follow-up tasks & Contracts
    if (proposal.client_id) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('franchise_id')
            .eq('id', user.id)
            .maybeSingle()

        await generateFollowUpTasks(supabase, {
            clientId: proposal.client_id,
            proposalId: proposal.id,
            franchiseId: profile?.franchise_id,
            agentId: user.id,
            status,
        })

        if (status === 'accepted') {
            await autoCreateContract(supabase, {
                clientId: proposal.client_id,
                proposalId: proposal.id,
                franchiseId: profile?.franchise_id,
                agentId: user.id,
                proposal: proposal as Proposal
            })
        }
    }

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
        const baseRule = await getActiveCommissionRule()

        // Apply per-franchise royalty override if configured
        const { data: franchiseCfg } = await supabase
            .from('franchise_config')
            .select('royalty_percent')
            .eq('franchise_id', profile.franchise_id)
            .eq('active', true)
            .maybeSingle()

        const rule = applyFranchiseOverride(baseRule, franchiseCfg?.royalty_percent ?? null)
        const split = calculateCommissionSplit(proposal.annual_savings || 0, rule)

        // Upsert con ignoreDuplicates: si dos requests concurrentes llegan al mismo tiempo,
        // el UNIQUE constraint en proposal_id garantiza que solo uno insertará. El otro
        // fallará silenciosamente. El JS check de arriba es un early-exit barato, no la
        // garantía real.
        await supabase.from('network_commissions').upsert({
            proposal_id: proposal.id,
            agent_id: user.id,
            franchise_id: profile.franchise_id,
            total_revenue: split.pot,
            agent_commission: split.agent_commission,
            franchise_profit: split.franchise_profit,
            hq_royalty: split.hq_royalty,
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
            points: (current?.points || 0) + split.points,
            last_updated: new Date().toISOString(),
        })
    } catch (err) {
        // Commission failure must NOT roll back the proposal status change.
        // Log and continue — commissions can be reprocessed manually if needed.
        console.error('[updateProposalStatusAction] Commission processing failed:', err)
    }
}

const PROPOSAL_ACTIVITY_MAP: Record<string, { type: string; description_template: string }> = {
    sent: { type: 'proposal_sent', description_template: 'Propuesta enviada a {client}' },
    accepted: { type: 'proposal_accepted', description_template: '¡Propuesta aceptada por {client}! Ahorro: {savings}€/año' },
    rejected: { type: 'proposal_rejected', description_template: 'Propuesta rechazada por {client}' },
}

async function logProposalActivity(
    supabase: Awaited<ReturnType<typeof createClient>>,
    proposal: Proposal,
    agentId: string,
    status: Proposal['status']
) {
    const mapping = PROPOSAL_ACTIVITY_MAP[status]
    if (!mapping || !proposal.client_id) return

    const cd = proposal.calculation_data as { client_name?: string } | null
    const clientName = cd?.client_name ?? 'Cliente'

    const description = mapping.description_template
        .replace('{client}', clientName)
        .replace('{savings}', String(Math.round(proposal.annual_savings || 0)))

    try {
        await supabase.from('client_activities').insert({
            client_id: proposal.client_id,
            agent_id: agentId,
            franchise_id: proposal.franchise_id,
            type: mapping.type,
            description,
            metadata: {
                proposal_id: proposal.id,
                savings: proposal.annual_savings,
                marketer: proposal.offer_snapshot?.marketer_name,
            },
        })
    } catch {
        // non-critical
    }
}

async function generateFollowUpTasks(
    supabase: Awaited<ReturnType<typeof createClient>>,
    data: {
        clientId: string;
        proposalId: string;
        franchiseId?: string;
        agentId: string;
        status: Proposal['status'];
    }
) {
    if (!['sent', 'accepted'].includes(data.status)) return;

    const tasks: Array<{
        agent_id: string;
        franchise_id?: string;
        client_id: string;
        proposal_id: string;
        title: string;
        description: string;
        type: string;
        priority: string;
        due_date: string;
        auto_generated: boolean;
        status: string;
    }> = [];

    if (data.status === 'sent') {
        const in3Days = new Date();
        in3Days.setDate(in3Days.getDate() + 3);
        const in7Days = new Date();
        in7Days.setDate(in7Days.getDate() + 7);

        tasks.push({
            agent_id: data.agentId,
            franchise_id: data.franchiseId,
            client_id: data.clientId,
            proposal_id: data.proposalId,
            title: 'Seguimiento propuesta (3 días)',
            description: 'Contactar cliente para conocer su opinión sobre la propuesta enviada.',
            type: 'follow_up',
            priority: 'high',
            due_date: in3Days.toISOString().split('T')[0],
            auto_generated: true,
            status: 'pending',
        });

        tasks.push({
            agent_id: data.agentId,
            franchise_id: data.franchiseId,
            client_id: data.clientId,
            proposal_id: data.proposalId,
            title: 'Seguimiento propuesta (7 días)',
            description: 'Segundo intento de contacto si no hubo respuesta al primer seguimiento.',
            type: 'follow_up',
            priority: 'medium',
            due_date: in7Days.toISOString().split('T')[0],
            auto_generated: true,
            status: 'pending',
        });
    }

    if (data.status === 'accepted') {
        tasks.push({
            agent_id: data.agentId,
            franchise_id: data.franchiseId,
            client_id: data.clientId,
            proposal_id: data.proposalId,
            title: 'Recopilar documentación',
            description: 'Solicitar al cliente la documentación necesaria para el cambio de comercializadora.',
            type: 'documentation',
            priority: 'high',
            due_date: new Date().toISOString().split('T')[0],
            auto_generated: true,
            status: 'pending',
        });
    }

    if (tasks.length === 0) return;

    try {
        await supabase.from('tasks').insert(tasks);
    } catch {
        // non-critical
    }
}

async function autoCreateContract(
    supabase: Awaited<ReturnType<typeof createClient>>,
    data: {
        clientId: string;
        proposalId: string;
        franchiseId?: string;
        agentId: string;
        proposal: Proposal;
    }
) {
    // Evitar duplicados (idempotencia)
    const { data: existing } = await supabase
        .from('contracts')
        .select('id')
        .eq('proposal_id', data.proposalId)
        .maybeSingle()

    if (existing) return;

    const marketerName = data.proposal.offer_snapshot?.marketer_name || 'Comercializadora Desconocida';
    const tariffName = data.proposal.offer_snapshot?.tariff_name;
    const cd = data.proposal.calculation_data as unknown as Record<string, unknown> | null;
    const typeFromCalc = cd?.detected_tariff_type as string;
    
    // Inferir tipo de contrato (muy básico)
    let contractType = 'electricidad';
    if (typeFromCalc === 'gas' || tariffName?.toLowerCase().includes('gas')) contractType = 'gas';

    try {
        await supabase.from('contracts').insert({
            client_id: data.clientId,
            proposal_id: data.proposalId,
            agent_id: data.agentId,
            franchise_id: data.franchiseId,
            marketer_name: marketerName,
            tariff_name: tariffName,
            contract_type: contractType,
            status: 'pending_switch', // Inicia en trámite
            annual_savings: data.proposal.annual_savings,
            start_date: new Date().toISOString().split('T')[0],
        })
    } catch (err) {
        console.error('[autoCreateContract] Error:', err);
    }
}
