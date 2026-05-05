import { createClient } from '@/lib/supabase/client';
import { Contract, ContractType, ExpiringContract } from '@/types/crm';
import { getFranchiseId } from './shared';

export const contractsService = {
    async createContract(contract: {
        client_id: string;
        proposal_id?: string;
        marketer_name: string;
        tariff_name?: string;
        contract_type?: ContractType;
        start_date?: string;
        end_date?: string;
        notice_date?: string;
        annual_savings?: number;
        monthly_cost_estimate?: number;
        notes?: string;
    }): Promise<Contract | null> {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const franchiseId = await getFranchiseId(supabase);

        const { data, error } = await supabase
            .from('contracts')
            .insert({
                ...contract,
                agent_id: user.id,
                franchise_id: franchiseId,
                contract_type: contract.contract_type || 'electricidad',
                start_date: contract.start_date || new Date().toISOString().split('T')[0],
                status: 'active',
            })
            .select()
            .single();

        if (error) {
            console.error('[contractsService] Error creating contract:', error);
            return null;
        }
        return data as Contract;
    },

    async updateContract(id: string, updates: Partial<Pick<Contract, 'marketer_name' | 'tariff_name' | 'contract_type' | 'status' | 'end_date' | 'notice_date' | 'notes' | 'monthly_cost_estimate'>>): Promise<boolean> {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { error } = await supabase
            .from('contracts')
            .update(updates)
            .eq('id', id)
            .eq('agent_id', user.id);

        if (error) {
            console.error('[contractsService] Error updating contract:', error);
            return false;
        }
        return true;
    },

    async deleteContract(id: string): Promise<boolean> {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { error } = await supabase
            .from('contracts')
            .delete()
            .eq('id', id)
            .eq('agent_id', user.id);

        return !error;
    },

    async getContractsByClient(clientId: string): Promise<Contract[]> {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('contracts')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false });

        if (error) return [];
        return (data || []) as Contract[];
    },

    async getExpiringContracts(daysThreshold = 90): Promise<ExpiringContract[]> {
        const supabase = createClient();
        const { data, error } = await supabase
            .rpc('get_expiring_contracts', { p_days_threshold: daysThreshold });

        if (error) {
            console.error('[contractsService] Error fetching expiring:', error);
            return [];
        }
        return (data || []) as ExpiringContract[];
    },

    async getContractStats(): Promise<{ active: number; expiring_90: number; expired: number; total: number }> {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { active: 0, expiring_90: 0, expired: 0, total: 0 };

        const { data, error } = await supabase
            .from('contracts')
            .select('status, end_date')
            .eq('agent_id', user.id);

        if (error || !data) return { active: 0, expiring_90: 0, expired: 0, total: 0 };

        const today = new Date().toISOString().split('T')[0];
        const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        return {
            total: data.length,
            active: data.filter(c => c.status === 'active').length,
            expiring_90: data.filter(c => c.status === 'active' && c.end_date && c.end_date <= in90Days && c.end_date >= today).length,
            expired: data.filter(c => c.status === 'expired' || (c.end_date && c.end_date < today && c.status === 'active')).length,
        };
    },
};
