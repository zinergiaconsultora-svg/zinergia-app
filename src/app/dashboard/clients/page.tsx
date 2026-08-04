import ClientPortfolioView from '@/features/crm/components/ClientPortfolioView';
import { getClientPortfolioAction } from '@/app/actions/clients';
import { getUserRole } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
    const role = await getUserRole();
    if (!role) return null;
    const items = await getClientPortfolioAction(200, 0);

    return <ClientPortfolioView items={items} role={role} />;
}
