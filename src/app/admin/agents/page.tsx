import { getAllAgentsAction, getAllFranchises } from '@/app/actions/admin';
import AgentsManagement from '@/features/admin/components/AgentsManagement';

export default async function AdminAgentsPage() {
    const [agents, franchises] = await Promise.all([
        getAllAgentsAction(),
        getAllFranchises(),
    ]);

    return <AgentsManagement agents={agents} franchises={franchises} />;
}
