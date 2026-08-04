import { getAdminProfileAuthoritySummariesAction, getAllFranchises } from '@/app/actions/admin';
import { TeamAdminWorkspace } from '@/features/admin/components/TeamAdminWorkspace';

export default async function AdminAgentsPage() {
    const [profilesResult, franchises] = await Promise.all([
        getAdminProfileAuthoritySummariesAction(),
        getAllFranchises(),
    ]);

    return (
        <TeamAdminWorkspace
            agents={profilesResult.success ? profilesResult.data : []}
            franchises={franchises}
        />
    );
}
