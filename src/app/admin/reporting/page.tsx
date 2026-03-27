import { getCommissionTimeSeries, getProposalTimeSeries, getAgentPerformanceRanking } from '@/app/actions/admin';
import ReportingDashboard from '@/features/admin/components/ReportingDashboard';

export default async function ReportingPage() {
    const [commissionData, proposalData, agentRanking] = await Promise.all([
        getCommissionTimeSeries(12),
        getProposalTimeSeries(12),
        getAgentPerformanceRanking(),
    ]);

    return (
        <ReportingDashboard
            commissionData={commissionData}
            proposalData={proposalData}
            agentRanking={agentRanking}
        />
    );
}
