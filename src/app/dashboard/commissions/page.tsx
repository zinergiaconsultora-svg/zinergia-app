import { getCommissionWorkspaceAction } from '@/app/actions/commissions';
import CommissionWorkspaceView from '@/features/commissions/components/CommissionWorkspaceView';
import { buildCommissionWorkspace } from '@/lib/commissions/workspace';

export default async function CommissionsPage() {
    const result = await getCommissionWorkspaceAction();

    return (
        <CommissionWorkspaceView
            workspace={result.success ? result.data : buildCommissionWorkspace([])}
            error={result.success ? undefined : result.error}
        />
    );
}
