import { cache } from 'react';
import ClientsView from '@/features/crm/components/ClientsView';
import { createClient } from '@/lib/supabase/server';
import { crmService } from '@/services/crmService';
import { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Cache the clients fetch to deduplicate requests within the same render
const getClientsCached = cache(async (supabase: SupabaseClient) => {
    return crmService.getClients(supabase);
});

export default async function ClientsPage() {
    const supabase = await createClient();
    const clients = await getClientsCached(supabase);

    return <ClientsView initialData={clients} />;
}
