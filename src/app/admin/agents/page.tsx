import { getAllAgentsAction, getAllFranchises } from '@/app/actions/admin';
import { TeamAdminWorkspace } from '@/features/admin/components/TeamAdminWorkspace';

export default async function AdminAgentsPage() {
    const [agents, franchises] = await Promise.all([
        getAllAgentsAction(),
        getAllFranchises(),
    ]);

    return <TeamAdminWorkspace agents={agents} franchises={franchises} />;
}
