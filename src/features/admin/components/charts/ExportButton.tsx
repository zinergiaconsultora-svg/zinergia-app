'use client';

import { useCallback, useState } from 'react';
import * as XLSX from 'xlsx';
import type { TimeSeriesPoint, ProposalTimeSeriesPoint, AgentRankingEntry } from '@/app/actions/admin';

interface Props {
    commissions: TimeSeriesPoint[];
    proposals: ProposalTimeSeriesPoint[];
    agents: AgentRankingEntry[];
}

export default function ExportButton({ commissions, proposals, agents }: Props) {
    const [exporting, setExporting] = useState(false);

    const handleExport = useCallback(() => {
        setExporting(true);
        try {
            const wb = XLSX.utils.book_new();

            // Hoja 1: Comisiones
            const commRows = commissions.map(c => ({
                'Mes': c.month,
                'Pendientes (€)': c.pending,
                'Aprobadas (€)': c.approved,
                'Pagadas (€)': c.paid,
                'Total (€)': c.total,
            }));
            const wsComm = XLSX.utils.json_to_sheet(commRows);
            XLSX.utils.book_append_sheet(wb, wsComm, 'Comisiones');

            // Hoja 2: Propuestas
            const propRows = proposals.map(p => ({
                'Mes': p.month,
                'Borrador': p.draft,
                'Enviadas': p.sent,
                'Aceptadas': p.accepted,
                'Rechazadas': p.rejected,
                'Total': p.total,
                '% Conversión': p.conversionRate,
            }));
            const wsProp = XLSX.utils.json_to_sheet(propRows);
            XLSX.utils.book_append_sheet(wb, wsProp, 'Propuestas');

            // Hoja 3: Ranking Agentes
            const agentRows = agents.map((a, i) => ({
                'Posición': i + 1,
                'Nombre': a.full_name,
                'Email': a.email,
                'Franquicia': a.franchise_name ?? 'Sin asignar',
                'Propuestas Totales': a.proposals_total,
                'Propuestas Aceptadas': a.proposals_accepted,
                '% Conversión': a.conversion_rate,
                'Comisiones (€)': a.total_commission,
            }));
            const wsAgents = XLSX.utils.json_to_sheet(agentRows);
            XLSX.utils.book_append_sheet(wb, wsAgents, 'Ranking Agentes');

            // Descargar
            const dateStr = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `Zinergia_Report_${dateStr}.xlsx`);
        } finally {
            setExporting(false);
        }
    }, [commissions, proposals, agents]);

    return (
        <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {exporting ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
            )}
            {exporting ? 'Exportando...' : 'Exportar Excel'}
        </button>
    );
}
