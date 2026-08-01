import { getCommissionManagementDataAction } from '@/app/actions/commissionManagement';
import { getFiscalAdminSetupAction } from '@/app/actions/invoicing';
import { CommissionAdminWorkspace } from '@/features/admin/components/CommissionAdminWorkspace';

export default async function AdminCommissionsPage() {
    const [data, fiscalData] = await Promise.all([
        getCommissionManagementDataAction(),
        getFiscalAdminSetupAction(),
    ]);
    return <CommissionAdminWorkspace initialData={data} fiscalData={fiscalData} />;
}
