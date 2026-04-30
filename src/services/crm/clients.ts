import { createClient } from '@/lib/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { Client } from '@/types/crm';
import { getFranchiseId, getCached, setCache, invalidateCache, invalidateCacheByPrefix } from './shared';
import { activitiesService } from './activities';
import { logger } from '@/lib/utils/logger';

export const clientService = {
    async getClients(serverClient?: SupabaseClient, limit = 20, offset = 0) {
        const supabase = serverClient || createClient();
        const franchiseId = await getFranchiseId(supabase);
        if (!franchiseId) return [];

        if (offset === 0) {
            const cached = getCached<Client[]>(`clients_${franchiseId}`);
            if (cached) return cached;
        }

        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('franchise_id', franchiseId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        if (offset === 0) setCache(`clients_${franchiseId}`, data);
        return data as Client[];
    },

    async getClientById(id: string, serverClient?: SupabaseClient) {
        const supabase = serverClient || createClient();
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Client;
    },

    async createClient(client: Partial<Client>) {
        const supabase = createClient();
        const franchiseId = await getFranchiseId(supabase);
        if (!franchiseId) throw new Error('No franchise found');

        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('clients')
            .insert({
                ...client,
                franchise_id: franchiseId,
                owner_id: user?.id
            })
            .select()
            .single();

        if (error) throw error;
        invalidateCache(`clients_${franchiseId}`);
        invalidateCache(`clients_${franchiseId}_0`);
        invalidateCacheByPrefix('dashboard_stats_');

        activitiesService.logActivity(
            (data as Client).id,
            'client_created',
            `Cliente "${(data as Client).name}" creado`,
            { name: (data as Client).name, type: client.type }
        ).catch((e) => logger.error('Failed to log client_created activity', e));

        return data as Client;
    },

    async updateClient(id: string, updates: Partial<Client>) {
        const supabase = createClient();
        const franchiseId = await getFranchiseId(supabase);
        const { data, error } = await supabase
            .from('clients')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        if (franchiseId) { invalidateCache(`clients_${franchiseId}`); invalidateCache(`clients_${franchiseId}_0`); invalidateCacheByPrefix('dashboard_stats_'); }

        if (updates.status && updates.status !== 'new') {
            activitiesService.logActivity(
                id,
                'client_status_changed',
                `Estado cambiado a "${updates.status}"`,
                { new_status: updates.status }
            ).catch((e) => logger.error('Failed to log client_status_changed', e));
        } else if (Object.keys(updates).length > 0) {
            activitiesService.logActivity(
                id,
                'client_updated',
                `Datos del cliente actualizados`,
                { fields: Object.keys(updates) }
            ).catch((e) => logger.error('Failed to log client_updated', e));
        }

        return data as Client;
    },

    async deleteClient(id: string) {
        const supabase = createClient();
        const franchiseId = await getFranchiseId(supabase);
        const { error } = await supabase.from('clients').delete().eq('id', id);
        if (error) throw error;
        if (franchiseId) { invalidateCache(`clients_${franchiseId}`); invalidateCache(`clients_${franchiseId}_0`); invalidateCacheByPrefix('dashboard_stats_'); }
    },

    async getGeolocatedClients() {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('clients')
            .select('id, name, latitude, longitude, city, zip_code')
            .not('latitude', 'is', null);

        if (error) throw error;
        return data;
    }
};
