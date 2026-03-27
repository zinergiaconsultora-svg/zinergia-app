import { getAdminStats, getAllFranchises, getUnassignedAgents } from '@/app/actions/admin';
import AdminDashboard from '@/features/admin/components/AdminDashboard';

export default async function AdminPage() {
    const [stats, franchises, unassignedAgents] = await Promise.all([
        getAdminStats(),
        getAllFranchises(),
        getUnassignedAgents(),
    ]);

    return (
        <AdminDashboard
            stats={stats}
            franchises={franchises}
            unassignedAgents={unassignedAgents}
        />
    );
}
