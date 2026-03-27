import { Proposal } from '@/types/crm';
import { createClient } from '@/lib/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';

// ── Level helpers ─────────────────────────────────────────────────────────────

const POINTS_PER_LEVEL = 1_000;

function computeLevel(points: number) {
    const level = Math.floor(points / POINTS_PER_LEVEL) + 1;
    const xpInLevel = points % POINTS_PER_LEVEL;
    const progress = Math.round((xpInLevel / POINTS_PER_LEVEL) * 100);
    const nextLevelXp = level * POINTS_PER_LEVEL;
    return { level, xp: points, progress, nextLevelXp };
}

// ── Badge definitions ─────────────────────────────────────────────────────────

const BADGE_DEFS = [
    { id: 'primera_venta',   title: 'Primera Venta',  icon: '⚡', color: 'bg-yellow-100 text-yellow-600 border-yellow-200' },
    { id: 'club_100k',       title: 'Club 100k',      icon: '💎', color: 'bg-indigo-100 text-indigo-600 border-indigo-200' },
    { id: 'networker',       title: 'Networker',      icon: '🌐', color: 'bg-emerald-100 text-emerald-600 border-emerald-200' },
    { id: 'master_energia',  title: 'Master Energía', icon: '🔋', color: 'bg-slate-100 text-slate-400 border-slate-200' },
];

// ── Service ───────────────────────────────────────────────────────────────────

export const gamificationService = {

    async getLeaderboard() {
        const supabase = createClient();

        const { data, error } = await supabase
            .from('user_points')
            .select(`
                user_id,
                points,
                last_updated,
                profiles ( full_name, role, avatar_url )
            `)
            .order('points', { ascending: false })
            .limit(10);

        if (error || !data) return [];

        const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

        return data.map(row => {
            const profile = (row.profiles as { full_name?: string; role?: string; avatar_url?: string } | null) ?? {};
            return {
                id: row.user_id,
                name: profile.full_name ?? 'Agente',
                role: profile.role ?? 'agent',
                points: row.points ?? 0,
                trend: ((row.last_updated ?? '') >= sevenDaysAgo ? 'up' : 'stable') as 'up' | 'down' | 'stable',
                avatar_url: profile.avatar_url ?? '',
                badges: [] as string[],
            };
        });
    },

    async getUserGamificationStats() {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        // Fetch points + commission aggregates in parallel
        const [{ data: pointsRow }, { data: commissions }] = await Promise.all([
            supabase
                .from('user_points')
                .select('points')
                .eq('user_id', user.id)
                .maybeSingle(),
            supabase
                .from('network_commissions')
                .select('agent_commission')
                .eq('agent_id', user.id),
        ]);

        const points = pointsRow?.points ?? 0;
        const { level, xp, progress, nextLevelXp } = computeLevel(points);

        const commissionCount = commissions?.length ?? 0;
        const totalEarned = (commissions ?? []).reduce((s, c) => s + (c.agent_commission ?? 0), 0);

        const badges = BADGE_DEFS.map(b => ({
            ...b,
            unlocked:
                b.id === 'primera_venta'  ? commissionCount >= 1      :
                b.id === 'club_100k'      ? totalEarned >= 100_000    :
                b.id === 'networker'      ? commissionCount >= 5      :
                b.id === 'master_energia' ? points >= 10_000          : false,
        }));

        return { level, xp, nextLevelXp, progress, badges };
    },

    async processCommissionsAndPoints(supabase: SupabaseClient, proposal: Proposal) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (!profile) return;

            const pot = (proposal.annual_savings || 1000) * 0.15;

            await supabase.from('network_commissions').insert({
                proposal_id: proposal.id,
                agent_id: user.id,
                franchise_id: profile.franchise_id,
                total_revenue: pot,
                agent_commission: pot * 0.30,
                franchise_profit: pot * 0.50,
                hq_royalty: pot * 0.20,
                status: 'pending'
            });

            const { data: current } = await supabase.from('user_points').select('points').eq('user_id', user.id).maybeSingle();
            await supabase.from('user_points').upsert({
                user_id: user.id,
                points: (current?.points || 0) + 50,
                last_updated: new Date().toISOString()
            });
        } catch (err) {
            console.error('Gamification Processing Error:', err);
        }
    }
};
