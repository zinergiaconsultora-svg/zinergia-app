import { createClient } from '@/lib/supabase/client';
import { ClientActivity, ActivityType } from '@/types/crm';
import { getFranchiseId } from './shared';

export const activitiesService = {
    async logActivity(
        clientId: string,
        type: ActivityType,
        description: string,
        metadata?: Record<string, unknown>
    ): Promise<void> {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const franchiseId = await getFranchiseId(supabase);

        const { error } = await supabase
            .from('client_activities')
            .insert({
                client_id: clientId,
                agent_id: user.id,
                franchise_id: franchiseId,
                type,
                description,
                metadata: metadata ?? {},
            });

        if (error) {
            console.error('[activitiesService] Error logging activity:', error);
        }
    },

    async getActivitiesByClient(clientId: string, limit = 50): Promise<ClientActivity[]> {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('client_activities')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[activitiesService] Error fetching activities:', error);
            return [];
        }
        return (data || []) as ClientActivity[];
    },

    async getRecentActivities(limit = 20): Promise<ClientActivity[]> {
        const supabase = createClient();
        const franchiseId = await getFranchiseId(supabase);
        if (!franchiseId) return [];

        const { data, error } = await supabase
            .from('client_activities')
            .select('*')
            .eq('franchise_id', franchiseId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[activitiesService] Error fetching recent:', error);
            return [];
        }
        return (data || []) as ClientActivity[];
    },
};
