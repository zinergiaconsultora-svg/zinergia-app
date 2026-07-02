import {
    AlertTriangle,
    Archive,
    Clock3,
    FileScan,
    RefreshCw,
    TrendingUp,
    Users,
    XCircle,
} from 'lucide-react';
import type { ElementType } from 'react';
import type { OcrObservabilityMetrics, OcrStatusSummary } from '@/lib/ocr/observability';

interface Props {
    metrics: OcrObservabilityMetrics;
}

function formatPct(value: number): string {
    return `${value}%`;
}

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function SummaryCard({
    label,
    value,
    sub,
    tone,
    Icon,
}: {
    label: string;
    value: string | number;
    sub?: string;
    tone: 'slate' | 'emerald' | 'amber' | 'rose' | 'indigo';
    Icon: ElementType;
}) {
    const tones = {
        slate: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
        amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
        rose: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
        indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900',
    };

    return (
        <div className={`rounded-lg border p-4 ${tones[tone]}`}>
            <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-wide opacity-75">{label}</p>
                <Icon size={17} />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
            {sub && <p className="mt-1 text-xs opacity-75">{sub}</p>}
        </div>
    );
}

function WindowSummary({ title, summary }: { title: string; summary: OcrStatusSummary }) {
    return (
        <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
                <span className="text-xs font-semibold text-slate-400 tabular-nums">
                    {summary.total.toLocaleString('es-ES')} jobs
                </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
                <MetricPill label="Completados" value={summary.completed} pct={summary.completionRate} className="text-emerald-600" />
                <MetricPill label="Fallidos" value={summary.failed} pct={summary.failureRate} className="text-rose-600" />
                <MetricPill label="Procesando" value={summary.processing} className="text-amber-600" />
            </div>
        </section>
    );
}

function MetricPill({ label, value, pct, className }: { label: string; value: number; pct?: number; className: string }) {
    return (
        <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${className}`}>
                {value.toLocaleString('es-ES')}
                {pct !== undefined && <span className="ml-1 text-xs font-semibold text-slate-400">({formatPct(pct)})</span>}
            </p>
        </div>
    );
}

function TrendBars({ metrics }: { metrics: OcrObservabilityMetrics }) {
    const max = Math.max(1, ...metrics.dailyTrend.map(point => point.created));

    return (
        <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Tendencia 14 días</h2>
            <div className="mt-5 flex h-44 items-end gap-2">
                {metrics.dailyTrend.map(point => {
                    const height = Math.max(4, Math.round((point.created / max) * 100));
                    return (
                        <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                            <div className="flex h-32 w-full items-end justify-center rounded bg-slate-50 px-1 dark:bg-slate-800/60" title={`${point.date}: ${point.created} creados, ${point.completed} completados, ${point.failed} fallidos`}>
                                <div className="w-full max-w-5 rounded-t bg-indigo-500" style={{ height: `${height}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-400">{point.date.slice(5)}</span>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

export default function OcrObservabilityPanel({ metrics }: Props) {
    return (
        <div className="space-y-7">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Observabilidad OCR</h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Salud operativa del OCR sin mostrar datos extraídos de facturas.
                    </p>
                </div>
                <p className="text-xs text-slate-400">
                    Actualizado: {formatDateTime(metrics.generatedAt)}
                </p>
            </div>

            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <SummaryCard
                    label="Últimas 24h"
                    value={metrics.last24h.total.toLocaleString('es-ES')}
                    sub={`${formatPct(metrics.last24h.completionRate)} completado`}
                    tone="indigo"
                    Icon={FileScan}
                />
                <SummaryCard
                    label="Fallos 30d"
                    value={formatPct(metrics.last30d.failureRate)}
                    sub={`${metrics.last30d.failed.toLocaleString('es-ES')} jobs fallidos`}
                    tone={metrics.last30d.failureRate >= 15 ? 'rose' : 'emerald'}
                    Icon={XCircle}
                />
                <SummaryCard
                    label="Atascados"
                    value={metrics.staleProcessing.toLocaleString('es-ES')}
                    sub={`${metrics.processingNow.toLocaleString('es-ES')} procesando ahora`}
                    tone={metrics.staleProcessing > 0 ? 'amber' : 'emerald'}
                    Icon={Clock3}
                />
                <SummaryCard
                    label="Agentes 30d"
                    value={metrics.affectedAgents30d.toLocaleString('es-ES')}
                    sub={`${metrics.retryPressure.toLocaleString('es-ES')} con reintentos`}
                    tone="slate"
                    Icon={Users}
                />
            </section>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                <WindowSummary title="Últimas 24 horas" summary={metrics.last24h} />
                <WindowSummary title="Últimos 7 días" summary={metrics.last7d} />
                <WindowSummary title="Últimos 30 días" summary={metrics.last30d} />
            </div>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <SummaryCard
                    label="Archivado Drive"
                    value={formatPct(metrics.driveArchiveCoverage)}
                    sub="sobre OCR completado 30d"
                    tone="emerald"
                    Icon={Archive}
                />
                <SummaryCard
                    label="Comparado"
                    value={formatPct(metrics.comparisonCoverage)}
                    sub="OCR completado con comparativa"
                    tone="indigo"
                    Icon={TrendingUp}
                />
                <SummaryCard
                    label="Reintentos"
                    value={metrics.retryPressure.toLocaleString('es-ES')}
                    sub="jobs con más de un intento"
                    tone={metrics.retryPressure > 0 ? 'amber' : 'slate'}
                    Icon={RefreshCw}
                />
            </section>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <TrendBars metrics={metrics} />

                <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={17} className="text-amber-500" />
                        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Errores frecuentes</h2>
                    </div>
                    {metrics.frequentErrors.length === 0 ? (
                        <div className="mt-6 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                            No hay errores OCR registrados en los últimos 30 días.
                        </div>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {metrics.frequentErrors.map(error => (
                                <div key={error.message} className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                                    <div className="flex items-start justify-between gap-3">
                                        <p className="text-sm text-slate-700 dark:text-slate-200">{error.message}</p>
                                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                            {error.count}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
