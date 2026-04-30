'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
    FileText,
    Lock,
    Unlock,
    Download,
    ChevronDown,
    ChevronUp,
    Calendar,
    AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';
import { useBillingHistory } from '../hooks/useBillingHistory';
import { formatCurrency } from '@/lib/utils/format';

interface BillingHistoryPanelProps {
    franchiseId: string | null;
    canManage: boolean;
}

const MONTH_NAMES: Record<string, string> = {
    '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
    '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
    '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};

function formatMonthYear(monthYear: string): string {
    const [year, month] = monthYear.split('-');
    return `${MONTH_NAMES[month] || month} ${year}`;
}

export default function BillingHistoryPanel({ franchiseId, canManage }: BillingHistoryPanelProps) {
    const {
        cycles,
        loading,
        isPending,
        currentMonth,
        hasCurrentMonthCycle,
        handleCloseCycle,
        handleVoidCycle,
    } = useBillingHistory(franchiseId);

    const [expanded, setExpanded] = useState(true);
    const [confirmVoid, setConfirmVoid] = useState<string | null>(null);

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-card border border-slate-200 flex items-center justify-center gap-3 text-slate-400 p-8">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-energy-600" />
                <span className="text-sm">Cargando liquidaciones...</span>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-xl shadow-card border border-slate-200 overflow-hidden"
        >
            {/* Header */}
            <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className="w-full p-6 flex justify-between items-center hover:bg-slate-50/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-energy-100 rounded-xl">
                        <FileText size={18} className="text-energy-600" />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-slate-900 text-sm">Liquidaciones Mensuales</h3>
                        <p className="text-xs text-slate-500">
                            {cycles.filter(c => c.status === 'closed').length} cierres realizados
                        </p>
                    </div>
                </div>
                {expanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
            </button>

            {expanded && (
                <>
                    {/* Close current month action */}
                    {canManage && !hasCurrentMonthCycle && (
                        <div className="px-6 pb-4 border-b border-slate-100">
                            <div className="flex items-center justify-between bg-energy-50 rounded-2xl p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-energy-100 rounded-xl">
                                        <Lock size={16} className="text-energy-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">
                                            Cerrar {formatMonthYear(currentMonth)}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            Congela las comisiones aprobadas en un snapshot inmutable
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (confirm(`¿Cerrar las liquidaciones de ${formatMonthYear(currentMonth)}? Esta acción congela todas las comisiones aprobadas.`)) {
                                            handleCloseCycle(currentMonth);
                                        }
                                    }}
                                    disabled={isPending}
                                    className="px-4 py-2 bg-energy-600 hover:bg-energy-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
                                >
                                    {isPending ? 'Procesando...' : 'Cerrar Ciclo'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Cycles table */}
                    <div className="divide-y divide-slate-50">
                        {cycles.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                                <FileText size={32} className="opacity-30" />
                                No hay liquidaciones registradas aún.
                            </div>
                        ) : (
                            cycles.map(cycle => (
                                <div
                                    key={cycle.id}
                                    className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors gap-4"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${
                                            cycle.status === 'closed' ? 'bg-green-100 text-green-600' :
                                            cycle.status === 'voided' ? 'bg-red-100 text-red-500' :
                                                                        'bg-amber-100 text-amber-600'
                                        }`}>
                                            {cycle.status === 'closed' ? <Lock size={16} /> :
                                             cycle.status === 'voided' ? <Unlock size={16} /> :
                                                                         <Calendar size={16} />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900">
                                                {formatMonthYear(cycle.month_year)}
                                            </p>
                                            <p className="text-xs text-slate-400 flex items-center gap-1.5">
                                                {cycle.total_proposals} propuestas
                                                {cycle.closed_at && (
                                                    <>
                                                        <span className="text-slate-300">·</span>
                                                        Cerrado: {new Date(cycle.closed_at).toLocaleDateString('es-ES')}
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-slate-900">
                                                {formatCurrency(cycle.total_commissions)}
                                            </p>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                                cycle.status === 'closed' ? 'bg-green-100 text-green-700' :
                                                cycle.status === 'voided' ? 'bg-red-100 text-red-600' :
                                                                           'bg-amber-100 text-amber-700'
                                            }`}>
                                                {cycle.status === 'closed' ? 'Cerrado' :
                                                 cycle.status === 'voided' ? 'Anulado' : 'Abierto'}
                                            </span>
                                        </div>

                                        {/* Download snapshot */}
                                        {cycle.status === 'closed' && cycle.snapshot_data && (
                                            <button
                                                type="button"
                                                title="Descargar snapshot"
                                                onClick={() => {
                                                    const blob = new Blob(
                                                        [JSON.stringify(cycle.snapshot_data, null, 2)],
                                                        { type: 'application/json' }
                                                    );
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = `liquidacion_${cycle.month_year}.json`;
                                                    a.click();
                                                    URL.revokeObjectURL(url);
                                                }}
                                                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                                aria-label="Descargar snapshot"
                                            >
                                                <Download size={14} className="text-slate-600" />
                                            </button>
                                        )}

                                        {/* Void action (admin only) */}
                                        {canManage && cycle.status === 'closed' && (
                                            <>
                                                {confirmVoid === cycle.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                handleVoidCycle(cycle.id);
                                                                setConfirmVoid(null);
                                                            }}
                                                            disabled={isPending}
                                                            className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded-lg disabled:opacity-50"
                                                        aria-label="Confirmar anulación"
                                                        >
                                                            Confirmar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setConfirmVoid(null)}
                                                            className="px-2 py-1 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-lg"
                                                            aria-label="Cancelar anulación"
                                                        >
                                                            No
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        title="Anular cierre"
                                                        onClick={() => setConfirmVoid(cycle.id)}
                                                        className="p-2 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                                    >
                                                        <AlertTriangle size={14} className="text-red-500" />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </motion.div>
    );
}
