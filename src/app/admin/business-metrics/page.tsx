import {
    getAgentPerformanceRanking,
    getCommissionTimeSeries,
    getProposalTimeSeries,
} from '@/app/actions/admin';
import { getBusinessMetricsAction } from '@/app/actions/businessMetrics';
import { AdminInsightsWorkspace } from '@/features/admin/components/AdminInsightsWorkspace';

export const metadata = { title: 'Informes — Zinergia Admin' };

export default async function BusinessMetricsPage() {
    const [metrics, commissionData, proposalData, agentRanking] = await Promise.all([
        getBusinessMetricsAction(),
        getCommissionTimeSeries(12),
        getProposalTimeSeries(12),
        getAgentPerformanceRanking(),
    ]);

    return (
        <AdminInsightsWorkspace
            metrics={metrics}
            commissionData={commissionData}
            proposalData={proposalData}
            agentRanking={agentRanking}
        />
    );
}
