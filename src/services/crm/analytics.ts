import { createClient } from '@/lib/supabase/client';
import { FunnelStep, MonthlyMetric, StatusTransition } from '@/types/crm';

export const analyticsService = {
    async getConversionFunnel(): Promise<FunnelStep[]> {
        const supabase = createClient();
        const { data, error } = await supabase.rpc('get_conversion_funnel', { p_agent_id: null });

        if (error) {
            console.error('[analyticsService] Funnel error:', error);
            return [];
        }
        return (data || []) as FunnelStep[];
    },

    async getMonthlyMetrics(months = 6): Promise<MonthlyMetric[]> {
        const supabase = createClient();
        const { data, error } = await supabase.rpc('get_monthly_metrics', { p_months: months });

        if (error) {
            console.error('[analyticsService] Monthly metrics error:', error);
            return [];
        }
        return (data || []) as MonthlyMetric[];
    },

    async getRecentTransitions(limit = 20): Promise<StatusTransition[]> {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('client_status_transitions')
            .select('*')
            .eq('agent_id', user.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) return [];
        return (data || []) as StatusTransition[];
    },
};
