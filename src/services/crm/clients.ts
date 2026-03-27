import { createClient } from '@/lib/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { Client } from '@/types/crm';
import { getFranchiseId, getCached, setCache, invalidateCache } from './shared';

export const clientService = {
    async getClients(serverClient?: SupabaseClient) {
        const supabase = serverClient || createClient();
        const franchiseId = await getFranchiseId(supabase);
        if (!franchiseId) return [];

        const cacheKey = `clients_${franchiseId}`;
        const cached = getCached<Client[]>(cacheKey);
        if (cached) return cached;

        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('franchise_id', franchiseId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        setCache(cacheKey, data);
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
        if (franchiseId) invalidateCache(`clients_${franchiseId}`);
        return data as Client;
    },

    async deleteClient(id: string) {
        const supabase = createClient();
        const franchiseId = await getFranchiseId(supabase);
        const { error } = await supabase.from('clients').delete().eq('id', id);
        if (error) throw error;
        if (franchiseId) invalidateCache(`clients_${franchiseId}`);
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
