'use client';

import { useState } from 'react';
import CommissionChart from './charts/CommissionChart';
import ProposalChart from './charts/ProposalChart';
import AgentRankingTable from './charts/AgentRankingTable';
import ExportButton from './charts/ExportButton';
import type { TimeSeriesPoint, ProposalTimeSeriesPoint, AgentRankingEntry } from '@/app/actions/admin';

type TabKey = 'commissions' | 'proposals' | 'ranking';

interface Props {
    commissionData: TimeSeriesPoint[];
    proposalData: ProposalTimeSeriesPoint[];
    agentRanking: AgentRankingEntry[];
    embedded?: boolean;
}

const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'commissions', label: 'Comisiones', icon: '💰' },
    { key: 'proposals', label: 'Propuestas', icon: '📄' },
    { key: 'ranking', label: 'Ranking', icon: '🏆' },
];

export default function ReportingDashboard({ commissionData, proposalData, agentRanking, embedded = false }: Props) {
    const [activeTab, setActiveTab] = useState<TabKey>('commissions');

    // KPI resumen rápido
    const totalCommissions = commissionData.reduce((s, c) => s + c.total, 0);
    const totalProposals = proposalData.reduce((s, p) => s + p.total, 0);
    const totalAccepted = proposalData.reduce((s, p) => s + p.accepted, 0);
    const avgConversion = totalProposals > 0 ? Math.round((totalAccepted / totalProposals) * 100) : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {!embedded && (
                    <div>
                        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Tendencias</h1>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Análisis de los últimos 12 meses.</p>
                    </div>
                )}
                <ExportButton commissions={commissionData} proposals={proposalData} agents={agentRanking} />
            </div>

            {/* KPI mini cards */}
            <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Comisiones Totales</p>
                    <p className="text-2xl font-bold text-white mt-1">
                        {totalCommissions.toLocaleString('es-ES', { minimumFractionDigits: 0 })} €
                    </p>
                </div>
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Propuestas</p>
                    <p className="text-2xl font-bold text-white mt-1">{totalProposals}</p>
                </div>
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Tasa Conversión</p>
                    <p className="text-2xl font-bold text-white mt-1">{avgConversion}%</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-800/30 rounded-xl p-1 border border-slate-700/30">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                            activeTab === tab.key
                                ? 'bg-slate-700/80 text-white shadow-sm'
                                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/30'
                        }`}
                    >
                        <span>{tab.icon}</span>
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Chart container */}
            <div className="rounded-2xl bg-slate-800/40 border border-slate-700/30 p-6 backdrop-blur-sm">
                {activeTab === 'commissions' && <CommissionChart data={commissionData} />}
                {activeTab === 'proposals' && <ProposalChart data={proposalData} />}
                {activeTab === 'ranking' && <AgentRankingTable data={agentRanking} />}
            </div>
        </div>
    );
}
