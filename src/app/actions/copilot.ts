'use server';

import { createClient } from '@/lib/supabase/server';

export interface NextAction {
    id: string;
    client_id: string | null;
    client_name?: string;
    proposal_id: string | null;
    action_type: string;
    priority: string;
    title: string;
    description: string | null;
    reason: string | null;
    due_date: string | null;
    metadata: Record<string, unknown>;
}

export interface CommissionForecast {
    p10: number;
    p50: number;
    p90: number;
    pipeline_count: number;
    won_this_month: number;
    won_commission: number;
}

export interface DailyBriefing {
    actions: NextAction[];
    forecast: CommissionForecast;
    renewals_open: number;
    clients_total: number;
    proposals_pending: number;
}

export async function getDailyBriefingAction(): Promise<DailyBriefing> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const [actionsResult, forecastResult, renewalsResult, clientsResult, proposalsResult] = await Promise.all([
        supabase
            .from('next_actions')
            .select('id, client_id, proposal_id, action_type, priority, title, description, reason, due_date, metadata')
            .eq('agent_id', user.id)
            .is('completed_at', null)
            .order('priority', { ascending: true })
            .order('due_date', { ascending: true, nullsFirst: false })
            .limit(10),

        computeCommissionForecast(supabase, user.id),

        supabase
            .from('renewal_opportunities')
            .select('id', { count: 'exact', head: true })
            .eq('agent_id', user.id)
            .eq('status', 'open'),

        supabase
            .from('clients')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', user.id),

        supabase
            .from('proposals')
            .select('id', { count: 'exact', head: true })
            .eq('agent_id', user.id)
            .in('status', ['draft', 'sent']),
    ]);

    const actions: NextAction[] = (actionsResult.data ?? []).map(a => ({
        id: a.id,
        client_id: a.client_id,
        proposal_id: a.proposal_id,
        action_type: a.action_type,
        priority: a.priority,
        title: a.title,
        description: a.description,
        reason: a.reason,
        due_date: a.due_date,
        metadata: (a.metadata as Record<string, unknown>) ?? {},
    }));

    return {
        actions,
        forecast: forecastResult,
        renewals_open: renewalsResult.count ?? 0,
        clients_total: clientsResult.count ?? 0,
        proposals_pending: proposalsResult.count ?? 0,
    };
}

async function computeCommissionForecast(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
): Promise<CommissionForecast> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [pipelineResult, wonResult] = await Promise.all([
        supabase
            .from('proposals')
            .select('annual_savings, close_probability, status')
            .eq('agent_id', userId)
            .in('status', ['draft', 'sent']),

        supabase
            .from('network_commissions')
            .select('agent_commission, status')
            .eq('agent_id', userId)
            .gte('created_at', monthStart),
    ]);

    const pipeline = pipelineResult.data ?? [];
    const wonCommissions = wonResult.data ?? [];

    const wonCommission = wonCommissions
        .reduce((sum, c) => sum + Number(c.agent_commission ?? 0), 0);

    const wonThisMonth = wonCommissions.length;

    const statusProbability: Record<string, number> = {
        draft: 10,
        sent: 30,
    };

    let expectedTotal = 0;
    let varianceTotal = 0;

    for (const p of pipeline) {
        const savings = Number(p.annual_savings ?? 0);
        if (savings <= 0) continue;

        const prob = Number(p.close_probability) > 0
            ? Number(p.close_probability) / 100
            : (statusProbability[p.status] ?? 15) / 100;

        const commissionRate = 0.15;
        const agentShare = 0.30;
        const potentialCommission = savings * commissionRate * agentShare;

        expectedTotal += potentialCommission * prob;
        varianceTotal += potentialCommission * potentialCommission * prob * (1 - prob);
    }

    const stdDev = Math.sqrt(varianceTotal);

    return {
        p10: Math.max(0, Math.round(wonCommission + expectedTotal - 1.28 * stdDev)),
        p50: Math.round(wonCommission + expectedTotal),
        p90: Math.round(wonCommission + expectedTotal + 1.28 * stdDev),
        pipeline_count: pipeline.length,
        won_this_month: wonThisMonth,
        won_commission: Math.round(wonCommission),
    };
}

export async function completeActionAction(actionId: string): Promise<void> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    await supabase
        .from('next_actions')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', actionId)
        .eq('agent_id', user.id);
}
