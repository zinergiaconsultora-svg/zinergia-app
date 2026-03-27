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

        const [clientsStatusResponse, proposalsResponse, recentProposalsResponse, recentClientsResponse] = await Promise.all([
            supabase.from('clients').select('status').eq('franchise_id', franchiseId),
            supabase.from('proposals').select('id, annual_savings, status, created_at, clients(name)').eq('franchise_id', franchiseId),
            supabase.from('proposals')
                .select('id, annual_savings, status, created_at, clients(name)')
                .eq('franchise_id', franchiseId)
                .order('created_at', { ascending: false })
                .limit(5),
            supabase.from('clients')
                .select('id, name, status, created_at, cups, address, city')
                .eq('franchise_id', franchiseId)
                .order('created_at', { ascending: false })
                .limit(5)
        ]);

        const clients = clientsStatusResponse.data || [];
        const proposals = (proposalsResponse.data || []) as unknown as (Proposal & { clients: { name: string } | null })[];
        const recentProposals = (recentProposalsResponse.data || []) as unknown as (Proposal & { clients: { name: string } | null })[];
        const recentClients = (recentClientsResponse.data || []) as Client[];

        const totalClients = clients.length;
        const activeClients = clients.filter(c => c.status === 'won').length;
        const pendingClients = clients.filter(c => ['new', 'contacted', 'in_process'].includes(c.status || '')).length;

        const totalSavingsDetected = proposals.reduce((sum, p) => sum + (p.annual_savings || 0), 0);
        const securedSavings = proposals.filter(p => p.status === 'accepted').reduce((sum, p) => sum + (p.annual_savings || 0), 0);

        const [{ data: { user: _user } }, { data: userProfile }] = await Promise.all([
            supabase.auth.getUser(),
            supabase.from('profiles').select('full_name, role, avatar_url').maybeSingle()
        ]);

        const result = {
            user: userProfile,
            total: totalClients,
            active: activeClients,
            pending: pendingClients,
            financials: {
                total_detected: totalSavingsDetected,
                secured: securedSavings,
                month_savings: proposals.filter(p => p.created_at >= startOfMonth).reduce((sum, p) => sum + (p.annual_savings || 0), 0)
            },
            recent: recentClients,
            recentProposals: recentProposals.map(p => ({
                id: p.id,
                client_name: p.clients?.name || 'Cliente',
                annual_savings: p.annual_savings,
                status: p.status,
                created_at: p.created_at
            }))
        };

        setCache(cacheKey, result);
        return result;
    }
};
