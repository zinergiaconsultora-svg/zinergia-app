import { createClient } from '@/lib/supabase/client';
import { Client, Proposal } from '@/types/crm';
import { getFranchiseId, getCached, setCache } from './shared';

export const dashboardService = {
    async getDashboardStats() {
        const supabase = createClient();
        const franchiseId = await getFranchiseId(supabase);
        if (!franchiseId) return null;

        const cacheKey = `dashboard_stats_${franchiseId}`;
        const cached = getCached(cacheKey);
        if (cached) return cached;

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const [clientsStatusResponse, proposalsResponse, recentClientsResponse, authResponse, profileResponse] = await Promise.all([
            supabase.from('clients').select('status').eq('franchise_id', franchiseId),
            supabase.from('proposals').select('id, annual_savings, status, created_at, clients(name)').eq('franchise_id', franchiseId),
            supabase.from('clients')
                .select('id, name, status, created_at, cups, address, city')
                .eq('franchise_id', franchiseId)
                .order('created_at', { ascending: false })
                .limit(5),
            supabase.auth.getUser(),
            supabase.from('profiles').select('full_name, role, avatar_url').maybeSingle()
        ]);

        const clients = clientsStatusResponse.data || [];
        const proposals = (proposalsResponse.data || []) as unknown as (Proposal & { clients: { name: string } | null })[];
        const recentClients = (recentClientsResponse.data || []) as Client[];
        const _user = authResponse.data.user;
        const userProfile = profileResponse.data;

        const totalClients = clients.length;
        const activeClients = clients.filter(c => c.status === 'won').length;
        const pendingClients = clients.filter(c => ['new', 'contacted', 'in_process'].includes(c.status || '')).length;
        const newClients = clients.filter(c => c.status === 'new').length;

        const totalSavingsDetected = proposals.reduce((sum, p) => sum + (p.annual_savings || 0), 0);
        const securedSavings = proposals.filter(p => p.status === 'accepted').reduce((sum, p) => sum + (p.annual_savings || 0), 0);
        const pipelineSavings = proposals.filter(p => ['sent', 'draft'].includes(p.status || '')).reduce((sum, p) => sum + (p.annual_savings || 0), 0);
        const acceptedCount = proposals.filter(p => p.status === 'accepted').length;
        const conversionRate = proposals.length > 0 ? Math.round((acceptedCount / proposals.length) * 100) : 0;

        // Savings trend: single O(n) pass grouping proposals already in memory
        const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const trendMap = new Map<string, number>();
        for (const p of proposals) {
            const d = new Date(p.created_at);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            trendMap.set(key, (trendMap.get(key) ?? 0) + (p.annual_savings || 0));
        }
        const savingsTrend = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            return { name: MONTH_LABELS[d.getMonth()], value: trendMap.get(key) ?? 0 };
        });

        const recentProposals = [...proposals]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5);

        const result = {
            user: userProfile,
            total: totalClients,
            active: activeClients,
            pending: pendingClients,
            new: newClients,
            growth: `${conversionRate}%`,
            savingsTrend,
            financials: {
                total_detected: totalSavingsDetected,
                secured: securedSavings,
                pipeline: pipelineSavings,
                conversion_rate: conversionRate,
                month_savings: proposals.filter(p => p.created_at >= startOfMonth).reduce((sum, p) => sum + (p.annual_savings || 0), 0)
            },
            recent: recentClients,
            recentProposals: recentProposals.map(p => ({
                id: p.id,
                client_name: p.clients?.name || 'Cliente',
                annual_savings: p.annual_savings,
                status: p.status,
                created_at: p.created_at
            })),
            pendingActions: []
        };

        setCache(cacheKey, result);
        return result;
    }
};
