import AdminDashboard from '@/features/admin/components/AdminDashboard';
import { getAcceptanceIntegrityItemsAction } from '@/app/actions/acceptanceIntegrity';
import { getRenewalDataQualityAction } from '@/app/actions/workQueue';

export default async function AdminPage() {
    const [acceptanceIntegrityItems, renewalAttention] = await Promise.all([
        getAcceptanceIntegrityItemsAction(),
        getRenewalDataQualityAction(),
    ]);

    return (
        <AdminDashboard
            acceptanceIntegrityItems={acceptanceIntegrityItems}
            renewalAttention={renewalAttention}
        />
    );
}
