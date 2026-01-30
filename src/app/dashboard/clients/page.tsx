import ClientsView from '@/features/crm/components/ClientsView';
import { createClient } from '@/lib/supabase/server';
import { crmService } from '@/services/crmService';

export default async function ClientsPage() {
    const supabase = await createClient();
    const clients = await crmService.getClients(supabase);

    return <ClientsView initialData={clients} />;
}
