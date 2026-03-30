'use server';

import { createClient } from '@/lib/supabase/server';

export interface ForecastBar {
    month: string;        // 'Ene 26'
    actual: number;       // real commissions received that month
    projected: number;    // estimated (0 for past months)
    isProjection: boolean;
}

export interface PipelineItem {
    id: string;
    client_name: string;
    annual_savings: number;
    commission_estimate: number; // agent's share
    probability: number;         // 0–1
    status: string;
    days_sent: number | null;
}

export interface ForecastResult {
    chart: ForecastBar[];
    kpis: {
        secured: number;       // pending+cleared commissions (guaranteed)
        estimated: number;     // sum(pipeline × probability × commission rate)
        next_month: number;    // estimated income for next calendar month
        conversion_rate: number;
    };
    pipeline: PipelineItem[];
    agent_rate: number;        // e.g. 0.045 (15% pot × 30% agent)
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function monthLabel(date: Date) {
    return `${MONTH_NAMES[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;
}

function proposalProbability(status: string, daysSent: number | null, hasLink: boolean): number {
    if (status === 'accepted') return 1;
    if (status !== 'sent') return 0.1; // draft
    if (!hasLink) return 0.2;
    if (daysSent !== null && daysSent >= 7) return 0.4;
    if (daysSent !== null && daysSent >= 3) return 0.3;
    return 0.2;
}

export async function getForecastAction(): Promise<ForecastResult> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const now = new Date();

    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();

    // ── Run all independent queries in parallel ──
    const [
        { data: rule },
        { data: historicalComms },
        { data: pendingComms },
        { data: proposals },
        { data: recentAll },
    ] = await Promise.all([
        // 1. Commission rate from active rule
        supabase
            .from('commission_rules')
            .select('commission_rate, agent_share')
            .eq('is_active', true)
            .order('effective_from', { ascending: false })
            .limit(1)
            .maybeSingle(),

        // 2. Historical commissions (last 6 months)
        supabase
            .from('network_commissions')
            .select('created_at, agent_commission')
            .eq('agent_id', user.id)
            .gte('created_at', sixMonthsAgo.toISOString())
            .in('status', ['cleared', 'paid']),

        // 3. Secured commissions (pending, not yet cleared)
        supabase
            .from('network_commissions')
            .select('agent_commission')
            .eq('agent_id', user.id)
            .eq('status', 'pending'),

        // 4. Pipeline proposals
        supabase
            .from('proposals')
            .select(`id, status, annual_savings, updated_at, public_token, clients(name)`)
            .eq('agent_id', user.id)
            .in('status', ['draft', 'sent'])
            .order('annual_savings', { ascending: false })
            .limit(50),

        // 5. Conversion rate (last 30 days)
        supabase
            .from('proposals')
            .select('status')
            .eq('agent_id', user.id)
            .gte('created_at', thirtyDaysAgo),
    ]);

    const commissionRate = rule?.commission_rate ?? 0.15;
    const agentShare = rule?.agent_share ?? 0.30;
    const agentRate = commissionRate * agentShare;

    // Group historical commissions by month
    const actualByMonth = new Map<string, number>();
    for (let i = 0; i < 6; i++) {
        const d = new Date(sixMonthsAgo);
        d.setMonth(d.getMonth() + i);
        actualByMonth.set(monthLabel(d), 0);
    }
    (historicalComms ?? []).forEach(c => {
        const label = monthLabel(new Date(c.created_at));
        if (actualByMonth.has(label)) {
            actualByMonth.set(label, (actualByMonth.get(label) ?? 0) + (c.agent_commission ?? 0));
        }
    });

    const secured = (pendingComms ?? []).reduce((s, c) => s + (c.agent_commission ?? 0), 0);

    const pipelineItems: PipelineItem[] = (proposals ?? []).map(p => {
        const clientName = (p.clients as { name?: string } | null)?.name ?? 'Cliente';
        const daysSent = p.status === 'sent' && p.updated_at
            ? Math.floor((now.getTime() - new Date(p.updated_at).getTime()) / 86_400_000)
            : null;
        const probability = proposalProbability(p.status, daysSent, !!p.public_token);
        const commissionEstimate = (p.annual_savings ?? 0) * agentRate * probability;

        return {
            id: p.id,
            client_name: clientName,
            annual_savings: p.annual_savings ?? 0,
            commission_estimate: commissionEstimate,
            probability,
            status: p.status,
            days_sent: daysSent,
        };
    });

    const totalEstimated = pipelineItems.reduce((s, p) => s + p.commission_estimate, 0);
    const nextMonthEstimate = totalEstimated * 0.4;

    const totalRecent = recentAll?.length ?? 0;
    const acceptedRecent = (recentAll ?? []).filter(p => p.status === 'accepted').length;
    const convRate = totalRecent > 0 ? Math.round((acceptedRecent / totalRecent) * 100) : 0;

    // ── 7. Build chart: 6 past + 3 projected ──
    const chart: ForecastBar[] = [];

    // Past 6 months (actual)
    actualByMonth.forEach((value, label) => {
        chart.push({ month: label, actual: Math.round(value), projected: 0, isProjection: false });
    });

    // Next 3 months (projected)
    // Distribution: 40% next month, 35% month+2, 25% month+3
    const distribution = [0.4, 0.35, 0.25];
    for (let i = 1; i <= 3; i++) {
        const d = new Date(now);
        d.setMonth(d.getMonth() + i);
        chart.push({
            month: monthLabel(d),
            actual: 0,
            projected: Math.round(totalEstimated * distribution[i - 1]),
            isProjection: true,
        });
    }

    return {
        chart,
        kpis: {
            secured: Math.round(secured),
            estimated: Math.round(totalEstimated),
            next_month: Math.round(nextMonthEstimate),
            conversion_rate: convRate,
        },
        pipeline: pipelineItems.slice(0, 10),
        agent_rate: agentRate,
    };
}
