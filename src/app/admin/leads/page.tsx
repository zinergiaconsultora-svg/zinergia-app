import AdminLeadsView from '@/features/admin/leads/AdminLeadsView';
import LeadMetrics from '@/features/admin/leads/LeadMetrics';
import { getAdminLeadsAction, getLeadMetricsAction } from '@/app/actions/invoices';

export const dynamic = 'force-dynamic';

export default async function AdminLeadsPage() {
    // Admin gate comes from the /admin layout (requireRouteRole(['admin'])).
    const [initial, { metrics, ranking }] = await Promise.all([
        getAdminLeadsAction({ outcome: 'open' }, 30, 0),
        getLeadMetricsAction(),
    ]);

    return (
        <div>
            <LeadMetrics metrics={metrics} ranking={ranking} />
            <AdminLeadsView initialData={initial} />
        </div>
    );
}
