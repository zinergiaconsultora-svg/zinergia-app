import { createClient } from '@/lib/supabase/client';
import { NetworkUser, UserRole } from '@/types/crm';

export const networkService = {
    async getNetworkHierarchy(): Promise<NetworkUser[]> {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data: rawProfiles, error } = await supabase
            .from('profiles')
            .select('id, full_name, role, parent_id, email, phone');

        if (error) throw error;

        const profiles = rawProfiles || [];
        const profileIds = profiles.map(p => p.id);

        // Fetch franchise configs separately to avoid implicit join issues
        const { data: franchiseConfigs } = profileIds.length
            ? await supabase.from('franchise_config').select('franchise_id, company_name, royalty_percent').in('franchise_id', profileIds)
            : { data: [] };

        const configMap: Record<string, { company_name?: string; royalty_percent?: number }> = {};
        (franchiseConfigs || []).forEach(fc => {
            configMap[fc.franchise_id] = { company_name: fc.company_name ?? undefined, royalty_percent: fc.royalty_percent ?? undefined };
        });

        const { data: allClients } = profileIds.length
            ? await supabase.from('clients').select('owner_id, status').in('owner_id', profileIds)
            : { data: [] };

        const clientCounts: Record<string, number> = {};
        const volumeCounts: Record<string, number> = {};

        if (allClients) {
            allClients.forEach(c => {
                if (c.owner_id) {
                    clientCounts[c.owner_id] = (clientCounts[c.owner_id] || 0) + 1;
                    volumeCounts[c.owner_id] = (volumeCounts[c.owner_id] || 0) + (c.status === 'won' ? 1500 : 0);
                }
            });
        }

        const nodes: NetworkUser[] = profiles.map(p => ({
            id: p.id,
            email: p.email || '',
            full_name: p.full_name || 'Usuario',
            role: p.role as UserRole,
            parent_id: p.parent_id,
            avatar_url: undefined,
            franchise_config: configMap[p.id] ?? null,
            children: [],
            stats: {
                active_clients: clientCounts[p.id] || 0,
                total_sales: volumeCounts[p.id] || 0,
                commission_earned: Math.floor((volumeCounts[p.id] || 0) * 0.10)
            }
        }));

        const nodeMap = new Map<string, NetworkUser>();
        nodes.forEach(n => nodeMap.set(n.id, n));

        const rootNodes: NetworkUser[] = [];
        nodes.forEach(node => {
            if (node.parent_id && nodeMap.has(node.parent_id)) {
                const parent = nodeMap.get(node.parent_id)!;
                parent.children = parent.children || [];
                parent.children.push(node);
            } else {
                rootNodes.push(node);
            }
        });

        return rootNodes;
    },

    async createInvitation(email: string, role: 'franchise' | 'agent') {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const code = crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();

        const { data, error } = await supabase
            .from('network_invitations')
            .insert({
                creator_id: user.id,
                email,
                role,
                code
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async getNetworkCommissions() {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data: profile } = await supabase
            .from('profiles')
            .select('role, franchise_id')
            .eq('id', user.id)
            .single();

        let query = supabase
            .from('network_commissions')
            .select('*, proposals(client_id, clients(name))')
            .order('created_at', { ascending: false });

        if (profile?.role === 'franchise') {
            query = query.eq('franchise_id', profile.franchise_id);
        } else {
            query = query.eq('agent_id', user.id);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async getNetworkStats() {
        const supabase = createClient();
        const { data: commissions, error } = await supabase
            .from('network_commissions')
            .select('agent_commission, franchise_commission, created_at');

        if (error) throw error;

        const total = (c: { agent_commission: number; franchise_commission: number }) =>
            (c.agent_commission || 0) + (c.franchise_commission || 0);

        const totalVolumen = commissions.reduce((sum, c) => sum + total(c), 0);

        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

        const thisMonthVol = commissions
            .filter(c => c.created_at && c.created_at >= startOfThisMonth)
            .reduce((sum, c) => sum + total(c), 0);
        const lastMonthVol = commissions
            .filter(c => c.created_at && c.created_at >= startOfLastMonth && c.created_at < startOfThisMonth)
            .reduce((sum, c) => sum + total(c), 0);

        return {
            totalVolumen,
            monthlyGrowth: lastMonthVol > 0 ? Math.round(((thisMonthVol - lastMonthVol) / lastMonthVol) * 100) : 0
        };
    }
};
