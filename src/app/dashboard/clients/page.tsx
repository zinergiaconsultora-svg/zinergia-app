import ClientsView from '@/features/crm/components/ClientsView';
import { getClientsAction } from '@/app/actions/clients';
import type { Client } from '@/types/crm';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
    // getClientsAction decrypts CUPS / DNI server-side and enforces RLS by session.
    let clients: Client[] = [];
    try {
        clients = await getClientsAction(20, 0);
    } catch {
        clients = [];
    }

    return <ClientsView initialData={clients} />;
}
