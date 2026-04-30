import { getBusinessMetricsAction } from '@/app/actions/businessMetrics';
import BusinessMetricsPanel from '@/features/admin/components/BusinessMetricsPanel';

export const metadata = { title: 'Business KPIs — Zinergia Admin' };

export default async function BusinessMetricsPage() {
    const metrics = await getBusinessMetricsAction();
    return <BusinessMetricsPanel metrics={metrics} />;
}
