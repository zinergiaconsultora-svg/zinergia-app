'use client';

import { useState } from 'react';
import type {
    AgentRankingEntry,
    ProposalTimeSeriesPoint,
    TimeSeriesPoint,
} from '@/app/actions/admin';
import type { BusinessMetrics } from '@/app/actions/businessMetrics';
import BusinessMetricsPanel from './BusinessMetricsPanel';
import ReportingDashboard from './ReportingDashboard';

type InsightsSection = 'summary' | 'trends';

export function AdminInsightsWorkspace({
    metrics,
    commissionData,
    proposalData,
    agentRanking,
}: {
    metrics: BusinessMetrics;
    commissionData: TimeSeriesPoint[];
    proposalData: ProposalTimeSeriesPoint[];
    agentRanking: AgentRankingEntry[];
}) {
    const [section, setSection] = useState<InsightsSection>('summary');

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-slate-950 dark:text-white">
                    Informes
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                    Evolución comercial, resultados económicos y rendimiento de la red.
                </p>
            </header>

            <nav
                aria-label="Secciones de informes"
                className="inline-flex rounded-md border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
            >
                <ReportTab
                    active={section === 'summary'}
                    label="Resumen"
                    onClick={() => setSection('summary')}
                />
                <ReportTab
                    active={section === 'trends'}
                    label="Tendencias y ranking"
                    onClick={() => setSection('trends')}
                />
            </nav>

            {section === 'summary' ? (
                <BusinessMetricsPanel metrics={metrics} embedded />
            ) : (
                <ReportingDashboard
                    commissionData={commissionData}
                    proposalData={proposalData}
                    agentRanking={agentRanking}
                    embedded
                />
            )}
        </div>
    );
}

function ReportTab({
    active,
    label,
    onClick,
}: {
    active: boolean;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={
                active
                    ? 'h-9 rounded bg-slate-900 px-4 text-sm font-bold text-white dark:bg-white dark:text-slate-950'
                    : 'h-9 rounded px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
            }
        >
            {label}
        </button>
    );
}
