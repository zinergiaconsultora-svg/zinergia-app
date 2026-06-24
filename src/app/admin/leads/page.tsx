import AdminLeadsView from '@/features/admin/leads/AdminLeadsView';
import LeadMetrics from '@/features/admin/leads/LeadMetrics';
import { getAdminLeadsAction, getLeadMetricsAction, getLeadAnalyticsAction } from '@/app/actions/invoices';
import { getAllAgentsAction } from '@/app/actions/admin';
import { AdminAnalytics } from '@/features/admin/leads/AdminAnalytics';
import { buildAdminLeadQueryString, parseAdminLeadFilters } from '@/features/admin/leads/filters';

export const dynamic = 'force-dynamic';

type AdminLeadsPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminLeadsPage({ searchParams }: AdminLeadsPageProps) {
    // Admin gate comes from the /admin layout (requireRouteRole(['admin'])).
    const filters = parseAdminLeadFilters((await searchParams) ?? {});
    const [initial, { metrics, ranking }, analytics, agents] = await Promise.all([
        getAdminLeadsAction(filters, 30, 0),
        getLeadMetricsAction(),
        getLeadAnalyticsAction(),
        getAllAgentsAction().catch(() => []),
    ]);

    return (
        <div>
            <AdminAnalytics analytics={analytics} />
            <LeadMetrics metrics={metrics} ranking={ranking} />
            <AdminLeadsView
                key={buildAdminLeadQueryString(filters)}
                initialData={initial}
                initialFilters={filters}
                agents={agents}
            />
        </div>
    );
}
