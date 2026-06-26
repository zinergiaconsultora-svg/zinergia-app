import ClientsView from '@/features/crm/components/ClientsView';
import { getClientsAction } from '@/app/actions/clients';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
    // getClientsAction decrypts CUPS / DNI server-side and enforces RLS by session.
    try {
        const clients = await getClientsAction(20, 0);
        return <ClientsView initialData={clients} />;
    } catch {
        return <ClientsView initialData={[]} />;
    }
}
