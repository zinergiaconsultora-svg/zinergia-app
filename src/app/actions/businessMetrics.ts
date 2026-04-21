'use server';

import { requireServerRole } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FunnelStep {
    label: string;
    count: number;
    pct: number; // percentage of top-of-funnel
}

export interface MarketerStat {
    marketer_name: string;
    won: number;
    total_savings: number;
    avg_savings: number;
}

export interface FranchiseStat {
    franchise_id: string;
    franchise_name: string;
    agent_count: number;
    proposals_accepted: number;
    total_savings: number;
    total_commission: number;
}

export interface BusinessMetrics {
    funnel: FunnelStep[];
    topMarketers: MarketerStat[];
    franchiseRanking: FranchiseStat[];
    /** Last 30 days summary */
    last30: {
        ocr_jobs: number;
        proposals_created: number;
        proposals_accepted: number;
        total_savings: number;
    };
}

// ─── Action ──────────────────────────────────────────────────────────────────

export async function getBusinessMetricsAction(): Promise<BusinessMetrics> {
    await requireServerRole(['admin', 'franchise']);
    const supabase = await createClient();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
        ocrAllRes,
        ocrRecentRes,
        proposalsAllRes,
        proposalsRecentRes,
        franchisesRes,
        agentsRes,
        commissionsRes,
    ] = await Promise.all([
        // All-time OCR funnel counts
        supabase.from('ocr_jobs').select('id, status', { count: 'exact' }),
        // Recent OCR (30d)
        supabase.from('ocr_jobs').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),

        // All proposals — for funnel + marketer stats
        supabase
            .from('proposals')
            .select('id, status, offer_snapshot, annual_savings, created_at'),

        // Recent proposals (30d)
        supabase
            .from('proposals')
            .select('id, status, annual_savings')
            .gte('created_at', thirtyDaysAgo),

        // Franchises
        supabase.from('franchises').select('id, name, is_active'),

        // Agent profiles (for franchise agent count)
        supabase.from('profiles').select('id, franchise_id').eq('role', 'agent'),

        // Commissions (for franchise revenue)
        supabase
            .from('network_commissions')
            .select('franchise_id, total_revenue, agent_commission, franchise_profit, hq_royalty, status')
            .in('status', ['cleared', 'paid']),
    ]);

    // ── Funnel ──────────────────────────────────────────────────────────────
    const totalOcr = ocrAllRes.count ?? 0;
    const ocrCompleted = (ocrAllRes.data ?? []).filter(j => j.status === 'completed').length;
    const allProposals = proposalsAllRes.data ?? [];
    const totalProposals = allProposals.length;
    const sentProposals = allProposals.filter(p => ['sent', 'accepted'].includes(p.status)).length;
    const acceptedProposals = allProposals.filter(p => p.status === 'accepted').length;

    const funnel: FunnelStep[] = [
        { label: 'Facturas procesadas (OCR)', count: totalOcr, pct: 100 },
        { label: 'OCR completado', count: ocrCompleted, pct: totalOcr > 0 ? Math.round(ocrCompleted / totalOcr * 100) : 0 },
        { label: 'Propuestas creadas', count: totalProposals, pct: totalOcr > 0 ? Math.round(totalProposals / totalOcr * 100) : 0 },
        { label: 'Propuestas enviadas', count: sentProposals, pct: totalOcr > 0 ? Math.round(sentProposals / totalOcr * 100) : 0 },
        { label: 'Contratos firmados', count: acceptedProposals, pct: totalOcr > 0 ? Math.round(acceptedProposals / totalOcr * 100) : 0 },
    ];

    // ── Top marketers ────────────────────────────────────────────────────────
    const marketerMap = new Map<string, { won: number; total_savings: number }>();
    allProposals
        .filter(p => p.status === 'accepted' && p.offer_snapshot)
        .forEach(p => {
            const name = (p.offer_snapshot as { marketer_name?: string })?.marketer_name ?? 'Desconocida';
            const savings = Number(p.annual_savings) || 0;
            const existing = marketerMap.get(name) ?? { won: 0, total_savings: 0 };
            marketerMap.set(name, { won: existing.won + 1, total_savings: existing.total_savings + savings });
        });

    const topMarketers: MarketerStat[] = Array.from(marketerMap.entries())
        .map(([marketer_name, { won, total_savings }]) => ({
            marketer_name,
            won,
            total_savings: Math.round(total_savings),
            avg_savings: won > 0 ? Math.round(total_savings / won) : 0,
        }))
        .sort((a, b) => b.won - a.won)
        .slice(0, 10);

    // ── Franchise ranking ────────────────────────────────────────────────────
    const franchises = franchisesRes.data ?? [];
    const agentsByFranchise = new Map<string, number>();
    (agentsRes.data ?? []).forEach(a => {
        if (a.franchise_id) agentsByFranchise.set(a.franchise_id, (agentsByFranchise.get(a.franchise_id) ?? 0) + 1);
    });

    const proposalsByFranchise = new Map<string, { accepted: number; total_savings: number }>();
    // Get franchise_id from proposals via agent's profile — use commissions instead (which have franchise_id)
    const commissions = commissionsRes.data ?? [];
    commissions.forEach(c => {
        if (!c.franchise_id) return;
        const existing = proposalsByFranchise.get(c.franchise_id) ?? { accepted: 0, total_savings: 0 };
        proposalsByFranchise.set(c.franchise_id, {
            accepted: existing.accepted + 1,
            total_savings: existing.total_savings + (Number(c.total_revenue) || 0),
        });
    });

    const commissionsByFranchise = new Map<string, number>();
    commissions.forEach(c => {
        if (!c.franchise_id) return;
        commissionsByFranchise.set(
            c.franchise_id,
            (commissionsByFranchise.get(c.franchise_id) ?? 0) + (Number(c.franchise_profit) || 0),
        );
    });

    const franchiseRanking: FranchiseStat[] = franchises
        .map(f => {
            const p = proposalsByFranchise.get(f.id) ?? { accepted: 0, total_savings: 0 };
            return {
                franchise_id: f.id,
                franchise_name: f.name,
                agent_count: agentsByFranchise.get(f.id) ?? 0,
                proposals_accepted: p.accepted,
                total_savings: Math.round(p.total_savings),
                total_commission: Math.round(commissionsByFranchise.get(f.id) ?? 0),
            };
        })
        .sort((a, b) => b.proposals_accepted - a.proposals_accepted);

    // ── Last 30 days ─────────────────────────────────────────────────────────
    const recent = proposalsRecentRes.data ?? [];
    const last30 = {
        ocr_jobs: ocrRecentRes.count ?? 0,
        proposals_created: recent.length,
        proposals_accepted: recent.filter(p => p.status === 'accepted').length,
        total_savings: Math.round(recent.filter(p => p.status === 'accepted').reduce((s, p) => s + (Number(p.annual_savings) || 0), 0)),
    };

    return { funnel, topMarketers, franchiseRanking, last30 };
}
