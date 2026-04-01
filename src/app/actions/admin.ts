'use server';

import { createClient } from '@/lib/supabase/server';
import { requireServerRole } from '@/lib/auth/permissions';

// ─── Types ────────────────────────────────────────────────────────────
export interface AdminStats {
    totalFranchises: number;
    activeFranchises: number;
    totalAgents: number;
    commissionsPending: number;
    commissionsCleared: number;
    commissionsPaid: number;
    totalCommissionValue: number;
    billingCyclesClosed: number;
}

export interface FranchiseWithAgents {
    id: string;
    slug: string;
    name: string;
    is_active: boolean;
    created_at: string;
    agent_count: number;
    agents: { id: string; full_name: string | null; email: string }[];
}

export interface AgentProfile {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    franchise_id: string | null;
}

// ─── Queries ──────────────────────────────────────────────────────────

export async function getAdminStats(): Promise<AdminStats> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const [franchises, agents, commissions, cycles] = await Promise.all([
        supabase.from('franchises').select('id, is_active'),
        supabase.from('profiles').select('id').eq('role', 'agent'),
        supabase.from('network_commissions').select('status, franchise_commission'),
        supabase.from('billing_cycles').select('status').eq('status', 'closed'),
    ]);

    const franchiseData = franchises.data ?? [];
    const commData = commissions.data ?? [];

    return {
        totalFranchises: franchiseData.length,
        activeFranchises: franchiseData.filter(f => f.is_active).length,
        totalAgents: agents.data?.length ?? 0,
        commissionsPending: commData.filter(c => c.status === 'pending').length,
        commissionsCleared: commData.filter(c => c.status === 'cleared').length,
        commissionsPaid: commData.filter(c => c.status === 'paid').length,
        totalCommissionValue: commData.reduce((sum, c) => sum + (c.franchise_commission ?? 0), 0),
        billingCyclesClosed: cycles.data?.length ?? 0,
    };
}

export async function getAllFranchises(): Promise<FranchiseWithAgents[]> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const { data: franchises, error } = await supabase
        .from('franchises')
        .select('id, slug, name, is_active, created_at')
        .order('created_at', { ascending: false });

    if (error) throw new Error(`Error cargando franquicias: ${error.message}`);

    // Contar agentes por franquicia
    const { data: agents } = await supabase
        .from('profiles')
        .select('id, full_name, email, franchise_id')
        .in('role', ['agent', 'franchise']);

    const agentsByFranchise = new Map<string, { id: string; full_name: string | null; email: string }[]>();
    (agents ?? []).forEach(a => {
        if (a.franchise_id) {
            const list = agentsByFranchise.get(a.franchise_id) ?? [];
            list.push({ id: a.id, full_name: a.full_name, email: a.email });
            agentsByFranchise.set(a.franchise_id, list);
        }
    });

    return (franchises ?? []).map(f => {
        const franchiseAgents = agentsByFranchise.get(f.id) ?? [];
        return {
            ...f,
            agent_count: franchiseAgents.length,
            agents: franchiseAgents,
        };
    });
}

export async function getUnassignedAgents(): Promise<AgentProfile[]> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, franchise_id')
        .eq('role', 'agent')
        .is('franchise_id', null)
        .order('email');

    if (error) throw new Error(`Error cargando agentes: ${error.message}`);
    return data ?? [];
}

// ─── Mutations ────────────────────────────────────────────────────────

export async function toggleFranchiseActive(franchiseId: string, isActive: boolean): Promise<void> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const { error } = await supabase
        .from('franchises')
        .update({ is_active: isActive })
        .eq('id', franchiseId);

    if (error) throw new Error(`Error actualizando franquicia: ${error.message}`);
}

export async function assignAgentToFranchise(agentId: string, franchiseId: string): Promise<void> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const { error } = await supabase
        .from('profiles')
        .update({ franchise_id: franchiseId })
        .eq('id', agentId);

    if (error) throw new Error(`Error asignando agente: ${error.message}`);
}

export async function removeAgentFromFranchise(agentId: string): Promise<void> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const { error } = await supabase
        .from('profiles')
        .update({ franchise_id: null })
        .eq('id', agentId);

    if (error) throw new Error(`Error desvinculando agente: ${error.message}`);
}

// ─── Reporting Queries ────────────────────────────────────────────────

export interface TimeSeriesPoint {
    month: string; // 'YYYY-MM'
    pending: number;
    approved: number;
    paid: number;
    total: number;
}

export interface ProposalTimeSeriesPoint {
    month: string;
    draft: number;
    sent: number;
    accepted: number;
    rejected: number;
    total: number;
    conversionRate: number;
}

export interface AgentRankingEntry {
    id: string;
    full_name: string;
    email: string;
    franchise_name: string | null;
    proposals_total: number;
    proposals_accepted: number;
    total_commission: number;
    conversion_rate: number;
}

function getMonthKey(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function generateMonthRange(months: number): string[] {
    const result: string[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return result;
}

export async function getCommissionTimeSeries(months = 12): Promise<TimeSeriesPoint[]> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('network_commissions')
        .select('status, franchise_commission, created_at')
        .order('created_at', { ascending: true });

    if (error) throw new Error(`Error cargando comisiones: ${error.message}`);

    const monthRange = generateMonthRange(months);
    const buckets = new Map<string, TimeSeriesPoint>();
    monthRange.forEach(m => buckets.set(m, { month: m, pending: 0, approved: 0, paid: 0, total: 0 }));

    (data ?? []).forEach(row => {
        const key = getMonthKey(row.created_at);
        const bucket = buckets.get(key);
        if (!bucket) return;
        const amount = Number(row.franchise_commission) || 0;
        bucket.total += amount;
        if (row.status === 'pending') bucket.pending += amount;
        else if (row.status === 'approved') bucket.approved += amount;
        else if (row.status === 'paid') bucket.paid += amount;
    });

    return monthRange.map(m => buckets.get(m)!);
}

export async function getProposalTimeSeries(months = 12): Promise<ProposalTimeSeriesPoint[]> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('proposals')
        .select('status, created_at')
        .order('created_at', { ascending: true });

    if (error) throw new Error(`Error cargando propuestas: ${error.message}`);

    const monthRange = generateMonthRange(months);
    const buckets = new Map<string, ProposalTimeSeriesPoint>();
    monthRange.forEach(m => buckets.set(m, { month: m, draft: 0, sent: 0, accepted: 0, rejected: 0, total: 0, conversionRate: 0 }));

    (data ?? []).forEach(row => {
        const key = getMonthKey(row.created_at);
        const bucket = buckets.get(key);
        if (!bucket) return;
        bucket.total++;
        if (row.status === 'draft') bucket.draft++;
        else if (row.status === 'sent') bucket.sent++;
        else if (row.status === 'accepted') bucket.accepted++;
        else if (row.status === 'rejected') bucket.rejected++;
    });

    // Calcular tasa de conversión
    monthRange.forEach(m => {
        const b = buckets.get(m)!;
        b.conversionRate = b.total > 0 ? Math.round((b.accepted / b.total) * 100) : 0;
    });

    return monthRange.map(m => buckets.get(m)!);
}

export async function getAgentPerformanceRanking(): Promise<AgentRankingEntry[]> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const [agentsRes, proposalsRes, commissionsRes, franchisesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, franchise_id').eq('role', 'agent'),
        supabase.from('proposals').select('id, client_id, status'),
        supabase.from('network_commissions').select('agent_id, franchise_commission, status'),
        supabase.from('franchises').select('id, name'),
    ]);

    const agents = agentsRes.data ?? [];
    const proposals = proposalsRes.data ?? [];
    const commissions = commissionsRes.data ?? [];
    const franchises = franchisesRes.data ?? [];

    // Mapear clientes a sus owners para vincular propuestas a agentes
    const { data: clients } = await supabase.from('clients').select('id, owner_id');
    const clientOwnerMap = new Map<string, string>();
    (clients ?? []).forEach(c => clientOwnerMap.set(c.id, c.owner_id));

    const franchiseMap = new Map<string, string>();
    franchises.forEach(f => franchiseMap.set(f.id, f.name));

    return agents.map(agent => {
        const agentProposals = proposals.filter(p => clientOwnerMap.get(p.client_id) === agent.id);
        const agentCommissions = commissions.filter(c => c.agent_id === agent.id);
        const totalComm = agentCommissions.reduce((s, c) => s + (Number(c.franchise_commission) || 0), 0);
        const accepted = agentProposals.filter(p => p.status === 'accepted').length;
        const total = agentProposals.length;

        return {
            id: agent.id,
            full_name: agent.full_name ?? 'Sin nombre',
            email: agent.email ?? '',
            franchise_name: agent.franchise_id ? (franchiseMap.get(agent.franchise_id) ?? null) : null,
            proposals_total: total,
            proposals_accepted: accepted,
            total_commission: totalComm,
            conversion_rate: total > 0 ? Math.round((accepted / total) * 100) : 0,
        };
    }).sort((a, b) => b.total_commission - a.total_commission);
}
