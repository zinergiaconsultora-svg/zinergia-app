import { getAdminStats, getAllFranchises, getUnassignedAgents } from '@/app/actions/admin';
import AdminDashboard from '@/features/admin/components/AdminDashboard';
import { getAcceptanceIntegrityItemsAction } from '@/app/actions/acceptanceIntegrity';
import { getRenewalDataQualityAction } from '@/app/actions/workQueue';

export default async function AdminPage() {
    const [stats, franchises, unassignedAgents, acceptanceIntegrityItems, renewalAttention] = await Promise.all([
        getAdminStats(),
        getAllFranchises(),
        getUnassignedAgents(),
        getAcceptanceIntegrityItemsAction(),
        getRenewalDataQualityAction(),
    ]);

    return (
        <AdminDashboard
            stats={stats}
            franchises={franchises}
            unassignedAgents={unassignedAgents}
            acceptanceIntegrityItems={acceptanceIntegrityItems}
            renewalAttention={renewalAttention}
        />
    );
}
