import TariffManagerView from '@/features/crm/components/TariffManagerView';
import { getUserRole, canManageTariffs } from '@/lib/auth/permissions';

export default async function TariffsPage() {
    const role = await getUserRole();
    const canWrite = role ? canManageTariffs(role) : false;
    return <TariffManagerView canWrite={canWrite} />;
}
