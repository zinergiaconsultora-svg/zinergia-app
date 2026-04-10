'use server';

import { createClient } from '@/lib/supabase/server';
import { requireServerRole } from '@/lib/auth/permissions';

export interface AgentStat {
    id: string;
    full_name: string | null;
    email: string;
    clients_total: number;
    clients_active: number;   // status = 'in_process'
    clients_won: number;
    proposals_total: number;
    proposals_accepted: number;
    best_saving: number;      // max annual_savings in their proposals
    conversion_rate: number;  // accepted / total, %
}

export interface FranchiseOverview {
    franchise_name: string;
    agents: AgentStat[];
    totals: {
        clients: number;
        proposals: number;
        accepted: number;
        pipeline_value: number;  // sum of avg_monthly_bill for in_process clients
        commissions_pending: number;
    };
}

export async function getFranchiseOverviewAction(): Promise<FranchiseOverview> {
    await requireServerRole(['franchise', 'admin']);

    const supabase = await createClient();

    // Get current user's franchise_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { data: myProfile } = await supabase
        .from('profiles')
        .select('franchise_id')
        .eq('id', user.id)
        .single();

    const franchiseId = myProfile?.franchise_id;
    if (!franchiseId) throw new Error('No se encontró la franquicia');

    // Franchise name
    const { data: franchise } = await supabase
        .from('franchises')
        .select('name')
        .eq('id', franchiseId)
        .single();

    // All agents in this franchise
    const { data: agentProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('franchise_id', franchiseId)
        .eq('role', 'agent');

    const agents = agentProfiles ?? [];
    if (agents.length === 0) {
        return {
            franchise_name: franchise?.name ?? 'Franquicia',
            agents: [],
            totals: { clients: 0, proposals: 0, accepted: 0, pipeline_value: 0, commissions_pending: 0 },
        };
    }

    const agentIds = agents.map(a => a.id);

    // All clients in this franchise (with owner_id)
    const { data: allClients } = await supabase
        .from('clients')
        .select('id, owner_id, status, average_monthly_bill')
        .eq('franchise_id', franchiseId);

    // All proposals for these clients
    const clientIds = (allClients ?? []).map(c => c.id);
    const { data: allProposals } = clientIds.length > 0
        ? await supabase
            .from('proposals')
            .select('id, client_id, status, annual_savings')
            .in('client_id', clientIds)
        : { data: [] };

    // Pending commissions for this franchise
    const { data: pendingComm } = await supabase
        .from('commissions')
        .select('agent_commission')
        .eq('status', 'pending')
        .in('agent_id', agentIds);

    const commissionsPending = (pendingComm ?? []).reduce((s, c) => s + (c.agent_commission ?? 0), 0);

    // Build per-agent stats
    const agentStats: AgentStat[] = agents.map(agent => {
        const myClients = (allClients ?? []).filter(c => c.owner_id === agent.id);
        const myClientIds = new Set(myClients.map(c => c.id));
        const myProposals = (allProposals ?? []).filter(p => myClientIds.has(p.client_id));

        const accepted = myProposals.filter(p => p.status === 'accepted').length;
        const total = myProposals.length;
        const bestSaving = myProposals.length > 0
            ? Math.max(...myProposals.map(p => p.annual_savings ?? 0))
            : 0;

        return {
            id: agent.id,
            full_name: agent.full_name,
            email: agent.email,
            clients_total: myClients.length,
            clients_active: myClients.filter(c => c.status === 'in_process').length,
            clients_won: myClients.filter(c => c.status === 'won').length,
            proposals_total: total,
            proposals_accepted: accepted,
            best_saving: bestSaving,
            conversion_rate: total > 0 ? Math.round((accepted / total) * 100) : 0,
        };
    });

    const pipelineValue = (allClients ?? [])
        .filter(c => c.status === 'in_process')
        .reduce((s, c) => s + (c.average_monthly_bill ?? 0), 0);

    return {
        franchise_name: franchise?.name ?? 'Franquicia',
        agents: agentStats.sort((a, b) => b.clients_total - a.clients_total),
        totals: {
            clients: (allClients ?? []).length,
            proposals: (allProposals ?? []).length,
            accepted: (allProposals ?? []).filter(p => p.status === 'accepted').length,
            pipeline_value: pipelineValue,
            commissions_pending: commissionsPending,
        },
    };
}
