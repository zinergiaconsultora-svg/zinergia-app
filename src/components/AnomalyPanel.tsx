'use client';

import { useState } from 'react';
import { InvoiceAnomaly, AnomalySeverity, getAnomalySummary } from '@/lib/anomalyDetector';
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, Zap } from 'lucide-react';

interface AnomalyPanelProps {
    anomalies: InvoiceAnomaly[];
    compact?: boolean; // modo resumen (para OcrJobsPanel)
}

const SEVERITY_CONFIG: Record<AnomalySeverity, {
    icon: typeof AlertTriangle;
    label: string;
    bg: string;
    border: string;
    text: string;
    badge: string;
    dot: string;
}> = {
    critical: {
        icon: AlertCircle,
        label: 'Crítico',
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-200 dark:border-red-800/50',
        text: 'text-red-700 dark:text-red-300',
        badge: 'bg-red-100 text-red-700 border-red-200',
        dot: 'bg-red-500',
    },
    warning: {
        icon: AlertTriangle,
        label: 'Atención',
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-200 dark:border-amber-800/50',
        text: 'text-amber-700 dark:text-amber-300',
        badge: 'bg-amber-100 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
    },
    info: {
        icon: Info,
        label: 'Info',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-800/50',
        text: 'text-blue-700 dark:text-blue-300',
        badge: 'bg-blue-100 text-blue-700 border-blue-200',
        dot: 'bg-blue-400',
    },
};

// Versión compacta: solo muestra el resumen con puntos de colores
export function AnomalySummaryBadge({ anomalies }: { anomalies: InvoiceAnomaly[] }) {
    const summary = getAnomalySummary(anomalies);
    if (summary.total === 0) return null;

    return (
        <div className="flex items-center gap-1.5">
            <Zap size={10} className="text-slate-400" />
            <span className="text-[10px] text-slate-500">
                {summary.total} anomalía{summary.total > 1 ? 's' : ''}
            </span>
            <div className="flex gap-0.5">
                {summary.critical > 0 && (
                    <span className="w-2 h-2 rounded-full bg-red-500" title={`${summary.critical} crítica${summary.critical > 1 ? 's' : ''}`} />
                )}
                {summary.warning > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-400" title={`${summary.warning} advertencia${summary.warning > 1 ? 's' : ''}`} />
                )}
                {summary.info > 0 && (
                    <span className="w-2 h-2 rounded-full bg-blue-400" title={`${summary.info} info`} />
                )}
            </div>
        </div>
    );
}

// Panel expandible completo
export function AnomalyPanel({ anomalies, compact = false }: AnomalyPanelProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const summary = getAnomalySummary(anomalies);

    if (summary.total === 0) return null;

    if (compact) {
        // En modo compacto solo lista las anomalías sin cabecera
        return (
            <div className="space-y-1.5 mt-2">
                {anomalies.map(anomaly => {
                    const cfg = SEVERITY_CONFIG[anomaly.severity];
                    const Icon = cfg.icon;
                    const isOpen = expandedId === anomaly.id;

                    return (
                        <div key={anomaly.id} className={`rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden`}>
                            <button
                                type="button"
                                onClick={() => setExpandedId(isOpen ? null : anomaly.id)}
                                className="w-full flex items-center gap-2 p-2.5 text-left"
                            >
                                <Icon size={12} className={`${cfg.text} shrink-0`} />
                                <span className={`text-[11px] font-semibold flex-1 ${cfg.text}`}>{anomaly.title}</span>
                                {isOpen ? <ChevronUp size={11} className={cfg.text} /> : <ChevronDown size={11} className={cfg.text} />}
                            </button>
                            {isOpen && (
                                <div className="px-2.5 pb-2.5 space-y-1">
                                    <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">{anomaly.description}</p>
                                    {anomaly.impact && (
                                        <p className={`text-[10px] font-semibold ${cfg.text}`}>💰 {anomaly.impact}</p>
                                    )}
                                    <p className="text-[10px] text-slate-500 italic">→ {anomaly.action}</p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }

    // Panel completo con cabecera y contador
    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Cabecera */}
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1">
                    Anomalías detectadas en la factura
                </span>
                <div className="flex items-center gap-1.5">
                    {summary.critical > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                            {summary.critical} crítica{summary.critical > 1 ? 's' : ''}
                        </span>
                    )}
                    {summary.warning > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                            {summary.warning} aviso{summary.warning > 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            </div>

            {/* Lista */}
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {anomalies.map(anomaly => {
                    const cfg = SEVERITY_CONFIG[anomaly.severity];
                    const Icon = cfg.icon;
                    const isOpen = expandedId === anomaly.id;

                    return (
                        <div key={anomaly.id} className="bg-white dark:bg-slate-800">
                            <button
                                type="button"
                                onClick={() => setExpandedId(isOpen ? null : anomaly.id)}
                                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left"
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} mt-1.5 shrink-0`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{anomaly.title}</span>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${cfg.badge}`}>
                                            {cfg.label}
                                        </span>
                                    </div>
                                    {!isOpen && (
                                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">{anomaly.description}</p>
                                    )}
                                </div>
                                <div className="shrink-0 mt-0.5">
                                    {isOpen
                                        ? <ChevronUp size={14} className="text-slate-400" />
                                        : <ChevronDown size={14} className="text-slate-400" />
                                    }
                                </div>
                            </button>

                            {isOpen && (
                                <div className={`mx-4 mb-3 p-3 rounded-xl ${cfg.bg} border ${cfg.border} space-y-2`}>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{anomaly.description}</p>
                                    {anomaly.impact && (
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Impacto:</span>
                                            <span className={`text-[11px] font-bold ${cfg.text}`}>{anomaly.impact}</span>
                                        </div>
                                    )}
                                    <div className="pt-1 border-t border-slate-200/50 dark:border-slate-700/30">
                                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Acción recomendada: </span>
                                        <span className="text-[11px] text-slate-600 dark:text-slate-300">{anomaly.action}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
