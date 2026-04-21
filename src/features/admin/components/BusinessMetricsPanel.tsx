'use client';

import type { BusinessMetrics, FunnelStep, MarketerStat, FranchiseStat } from '@/app/actions/businessMetrics';

interface Props {
    metrics: BusinessMetrics;
}

function formatEur(value: number): string {
    return value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

// ── Funnel ────────────────────────────────────────────────────────────────────

function FunnelChart({ steps }: { steps: FunnelStep[] }) {
    const maxCount = steps[0]?.count ?? 1;
    return (
        <div className="space-y-3">
            {steps.map((step, i) => (
                <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">{step.label}</span>
                        <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                            {step.count.toLocaleString('es-ES')} <span className="text-slate-400 dark:text-slate-500">({step.pct}%)</span>
                        </span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: maxCount > 0 ? `${(step.count / maxCount) * 100}%` : '0%',
                                background: `hsl(${230 - i * 30}, 70%, ${55 + i * 5}%)`,
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Marketer table ────────────────────────────────────────────────────────────

function MarketerTable({ marketers }: { marketers: MarketerStat[] }) {
    if (marketers.length === 0) {
        return <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">Sin datos</p>;
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700/50 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        <th className="text-left pb-2 pr-3">#</th>
                        <th className="text-left pb-2 pr-3">Comercializadora</th>
                        <th className="text-right pb-2 pr-3">Contratos</th>
                        <th className="text-right pb-2 pr-3">Ahorro total</th>
                        <th className="text-right pb-2">Ahorro medio</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {marketers.map((m, i) => (
                        <tr key={m.marketer_name} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-2 pr-3 text-slate-400 dark:text-slate-500 tabular-nums">{i + 1}</td>
                            <td className="py-2 pr-3 font-medium text-slate-700 dark:text-slate-200">{m.marketer_name}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{m.won}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{formatEur(m.total_savings)}</td>
                            <td className="py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">{formatEur(m.avg_savings)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ── Franchise ranking ─────────────────────────────────────────────────────────

function FranchiseTable({ franchises }: { franchises: FranchiseStat[] }) {
    if (franchises.length === 0) {
        return <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">Sin franquicias</p>;
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700/50 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        <th className="text-left pb-2 pr-3">#</th>
                        <th className="text-left pb-2 pr-3">Franquicia</th>
                        <th className="text-right pb-2 pr-3">Agentes</th>
                        <th className="text-right pb-2 pr-3">Contratos</th>
                        <th className="text-right pb-2 pr-3">Ahorro total</th>
                        <th className="text-right pb-2">Comisión</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {franchises.map((f, i) => (
                        <tr key={f.franchise_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-2 pr-3 text-slate-400 dark:text-slate-500 tabular-nums">{i + 1}</td>
                            <td className="py-2 pr-3 font-medium text-slate-700 dark:text-slate-200">{f.franchise_name}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-slate-500 dark:text-slate-400">{f.agent_count}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-indigo-600 dark:text-indigo-400 font-semibold">{f.proposals_accepted}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{formatEur(f.total_savings)}</td>
                            <td className="py-2 text-right tabular-nums text-violet-600 dark:text-violet-400">{formatEur(f.total_commission)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-white tabular-nums">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
        </div>
    );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function BusinessMetricsPanel({ metrics }: Props) {
    const { funnel, topMarketers, franchiseRanking, last30 } = metrics;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Business KPIs</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Métricas globales del negocio — histórico completo + últimos 30 días
                </p>
            </div>

            {/* Last 30 days summary */}
            <section>
                <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-3">
                    Últimos 30 días
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Facturas OCR" value={last30.ocr_jobs.toLocaleString('es-ES')} />
                    <StatCard label="Propuestas creadas" value={last30.proposals_created.toLocaleString('es-ES')} />
                    <StatCard label="Contratos firmados" value={last30.proposals_accepted.toLocaleString('es-ES')} />
                    <StatCard
                        label="Ahorro generado"
                        value={formatEur(last30.total_savings)}
                        sub="en contratos firmados"
                    />
                </div>
            </section>

            {/* Conversion funnel */}
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/50 p-6">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
                    Embudo de conversión (histórico)
                </h2>
                <FunnelChart steps={funnel} />
            </section>

            {/* Two-column: marketers + franchises */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Top marketers */}
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/50 p-6">
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
                        Top comercializadoras (por contratos ganados)
                    </h2>
                    <MarketerTable marketers={topMarketers} />
                </section>

                {/* Franchise ranking */}
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/50 p-6">
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
                        Ranking de franquicias
                    </h2>
                    <FranchiseTable franchises={franchiseRanking} />
                </section>
            </div>
        </div>
    );
}
