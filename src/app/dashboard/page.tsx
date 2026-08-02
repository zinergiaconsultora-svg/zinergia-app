import { getUserRole } from '@/lib/auth/permissions'
import { ClientDocumentRedirect } from '@/components/ClientDocumentRedirect'
import { getOpportunityWorkQueueAction, getRenewalDataQualityAction } from '@/app/actions/workQueue'
import WorkQueueView from '@/features/crm/components/WorkQueueView'

export default async function DashboardPage() {
    const role = await getUserRole()
    if (role === 'admin') return <ClientDocumentRedirect to="/admin" />
    const resolvedRole = role ?? 'agent'
    const [groups, renewalAttention] = await Promise.all([
        getOpportunityWorkQueueAction(),
        getRenewalDataQualityAction(),
    ])

    return <WorkQueueView groups={groups} role={resolvedRole} renewalAttention={renewalAttention} />
}
