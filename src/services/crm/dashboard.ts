import { createClient } from '@/lib/supabase/client';
import { Client } from '@/types/crm';
import { getFranchiseId, getCached, setCache } from './shared';

interface RpcResult {
    total_detected: number;
    secured: number;
    pipeline: number;
    accepted_count: number;
    total_count: number;
    month_savings: number;
    monthly_goal: number;
    conversion_rate: number;
    recent_proposals: {
        id: string;
        annual_savings: number;
        status: string;
        created_at: string;
        client_name: string;
    }[];
    savings_trend: { name: string; value: number }[];
}

export const dashboardService = {
    async getDashboardStats() {
        const supabase = createClient();
        const franchiseId = await getFranchiseId(supabase);
        if (!franchiseId) return null;

        const cacheKey = `dashboard_stats_${franchiseId}`;
        const cached = getCached(cacheKey);
        if (cached) return cached;

        // Un único round-trip a Postgres via RPC reemplaza el fetch masivo de proposals.
        // Fallback a null si el RPC no existe aún (migración SQL pendiente).
        const [rpcResponse, clientsStatusResponse, recentClientsResponse, profileResponse] = await Promise.all([
            Promise.resolve(supabase.rpc('get_dashboard_stats', { p_franchise_id: franchiseId })).catch(() => ({ data: null, error: null })),
            supabase.from('clients').select('status').eq('franchise_id', franchiseId),
            supabase.from('clients')
                .select('id, name, status, created_at, cups, address')
                .eq('franchise_id', franchiseId)
                .order('created_at', { ascending: false })
                .limit(5),
            supabase.from('profiles').select('full_name, role').maybeSingle(),
        ]);

        const rpc = (rpcResponse.data ?? {}) as Partial<RpcResult>;
        const clients = clientsStatusResponse.data ?? [];
        const recentClients = (recentClientsResponse.data ?? []) as Client[];
        const userProfile = profileResponse.data;

        const totalClients = clients.length;
        const activeClients = clients.filter(c => c.status === 'won').length;
        const pendingClients = clients.filter(c => ['new', 'contacted', 'in_process'].includes(c.status ?? '')).length;
        const newClients = clients.filter(c => c.status === 'new').length;

        const totalCount = rpc.total_count ?? 0;
        const conversionRate = rpc.conversion_rate ?? (
            totalCount > 0
                ? Math.round(((rpc.accepted_count ?? 0) / totalCount) * 100)
                : 0
        );

        const result = {
            user: userProfile,
            total: totalClients,
            active: activeClients,
            pending: pendingClients,
            new: newClients,
            growth: `${conversionRate}%`,
            savingsTrend: rpc.savings_trend ?? [],
            financials: {
                total_detected: rpc.total_detected ?? 0,
                secured: rpc.secured ?? 0,
                pipeline: rpc.pipeline ?? 0,
                conversion_rate: conversionRate,
                month_savings: rpc.month_savings ?? 0,
                monthly_goal: rpc.monthly_goal ?? 10000,
            },
            recent: recentClients,
            recentProposals: rpc.recent_proposals ?? [],
            pendingActions: [],
        };

        setCache(cacheKey, result);
        return result;
    }
};
