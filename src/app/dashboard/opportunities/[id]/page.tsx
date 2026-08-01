import { notFound } from 'next/navigation';
import { getUserRole } from '@/lib/auth/permissions';
import { getOpportunityWorkspaceAction } from '@/app/actions/opportunities';
import OpportunityWorkspaceView from '@/features/crm/components/OpportunityWorkspaceView';
import type { UserRole } from '@/types/crm';

export const dynamic = 'force-dynamic';

export default async function OpportunityPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const [workspace, role] = await Promise.all([
        getOpportunityWorkspaceAction(id),
        getUserRole(),
    ]);

    if (!workspace || !role) notFound();

    return (
        <OpportunityWorkspaceView
            workspace={workspace}
            role={role as UserRole}
        />
    );
}
