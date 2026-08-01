import ClientPortfolioView from '@/features/crm/components/ClientPortfolioView';
import { getClientPortfolioAction } from '@/app/actions/clients';
import { getUserRole } from '@/lib/auth/permissions';
import type { UserRole } from '@/types/crm';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
    const [items, role] = await Promise.all([
        getClientPortfolioAction(200, 0),
        getUserRole(),
    ]);

    return <ClientPortfolioView items={items} role={(role ?? 'agent') as UserRole} />;
}
