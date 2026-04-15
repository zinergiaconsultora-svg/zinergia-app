import { getOcrMetrics } from '@/app/actions/ocr-metrics';
import type { OcrMetrics, OcrMetricsDaily } from '@/lib/ocr/metrics';

export const dynamic = 'force-dynamic';

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' | 'neutral' }) {
    const toneClass = tone === 'good'
        ? 'text-emerald-600 dark:text-emerald-400'
        : tone === 'bad'
            ? 'text-rose-600 dark:text-rose-400'
            : 'text-slate-800 dark:text-slate-100';
    return (
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</div>
            <div className={`text-2xl font-black tabular-nums mt-1 ${toneClass}`}>{value}</div>
        </div>
    );
}

function DailyBars({ daily }: { daily: OcrMetricsDaily[] }) {
    const max = Math.max(1, ...daily.map(d => d.total));
    return (
        <div className="flex items-end gap-1 h-24">
            {daily.map((d) => {
                const totalPct = (d.total / max) * 100;
                const failedPct = d.total > 0 ? (d.failed / d.total) * totalPct : 0;
                return (
                    <div key={d.day} className="flex-1 flex flex-col justify-end" title={`${d.day}: ${d.completed} ok / ${d.failed} failed`}>
                        <div className="relative w-full bg-slate-100 dark:bg-slate-800/60 rounded-sm" style={{ height: `${totalPct}%`, minHeight: d.total > 0 ? 2 : 0 }}>
                            <div className="absolute inset-x-0 bottom-0 bg-rose-500/80 rounded-sm" style={{ height: `${failedPct}%` }} />
                            <div className="absolute inset-x-0 bottom-0 bg-emerald-500/80 rounded-sm" style={{ height: `${totalPct - failedPct}%`, bottom: `${failedPct}%` }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default async function OcrMetricsPage() {
    const metrics: OcrMetrics = await getOcrMetrics(30);
    const successPct = (metrics.successRate * 100).toFixed(1);

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-black text-slate-800 dark:text-white">Métricas OCR</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Últimos {metrics.windowDays} días · agregado desde <code>ocr_jobs</code>
                </p>
            </header>

            <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Stat label="Total" value={metrics.total.toLocaleString()} />
                <Stat label="Completados" value={metrics.completed.toLocaleString()} tone="good" />
                <Stat label="Fallidos" value={metrics.failed.toLocaleString()} tone="bad" />
                <Stat label="En curso" value={metrics.processing.toLocaleString()} />
                <Stat
                    label="Tasa éxito"
                    value={metrics.total > 0 ? `${successPct}%` : '—'}
                    tone={metrics.successRate >= 0.9 ? 'good' : metrics.successRate >= 0.7 ? 'neutral' : 'bad'}
                />
            </section>

            <section className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Jobs por día</h2>
                <DailyBars daily={metrics.daily} />
                <div className="flex items-center gap-4 mt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500/80" /> Completado</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-rose-500/80" /> Fallido</span>
                </div>
            </section>

            <section className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Errores más frecuentes</h2>
                {metrics.topErrors.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Sin errores en la ventana.</p>
                ) : (
                    <ul className="space-y-2">
                        {metrics.topErrors.map((e) => (
                            <li key={e.message} className="flex items-start justify-between gap-3 text-sm">
                                <code className="text-slate-700 dark:text-slate-200 font-mono text-xs break-all">{e.message}</code>
                                <span className="shrink-0 text-xs font-bold tabular-nums text-rose-600 dark:text-rose-400">×{e.count}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
