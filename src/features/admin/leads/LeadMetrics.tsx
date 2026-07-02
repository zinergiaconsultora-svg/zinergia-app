'use client';

import React from 'react';
import { Users, UserCheck, TrendingUp, Euro, CloudOff, CalendarClock } from 'lucide-react';
import type { LeadMetrics as Metrics, LeadAgentRank } from '@/app/actions/invoices';
import { StatCard } from '@/components/ui/StatCard';
import { conversionRate } from './metrics';

function eur(n: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function FunnelBar({ label, value, max, className }: { label: string; value: number; max: number; className: string }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div>
            <div className="flex items-center justify-between text-[12px] mb-1">
                <span className="font-medium text-slate-600">{label}</span>
                <span className="text-slate-400 tabular-nums">{value}</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full ${className}`} style={{ width: `${Math.max(pct, 3)}%` }} />
            </div>
        </div>
    );
}

export default function LeadMetrics({ metrics, ranking }: { metrics: Metrics; ranking: LeadAgentRank[] }) {
    const rate = conversionRate(metrics.won_total, metrics.lost_total);
    const maxFunnel = metrics.funnel.uploaded || 1;

    return (
        <div className="space-y-5 mb-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <StatCard label="Leads abiertos" value={metrics.open_leads} icon={Users} tone="sky" />
                <StatCard label="Clientes (mes)" value={metrics.clients_this_month} icon={UserCheck} tone="emerald" />
                <StatCard label="Conversión" value={`${rate}%`} icon={TrendingUp} tone="emerald" sub={`${metrics.won_total} ganados · ${metrics.lost_total} perdidos`} />
                <StatCard label="Comisión generada" value={eur(metrics.commission_total)} icon={Euro} tone="amber" sub={`${eur(metrics.commission_this_month)} este mes`} />
                <StatCard label="Pendientes Drive" value={metrics.pending_drive} icon={CloudOff} tone={metrics.pending_drive > 0 ? 'amber' : 'slate'} />
                <StatCard label="Renovaciones ≤60d" value={metrics.permanence_due_60} icon={CalendarClock} tone={metrics.permanence_due_60 > 0 ? 'rose' : 'slate'} />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
                {/* Embudo */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-4">Embudo de conversión</h3>
                    <div className="space-y-3">
                        <FunnelBar label="Subidas" value={metrics.funnel.uploaded} max={maxFunnel} className="bg-slate-400" />
                        <FunnelBar label="OCR listo" value={metrics.funnel.ocr_done} max={maxFunnel} className="bg-blue-400" />
                        <FunnelBar label="Comparadas" value={metrics.funnel.compared} max={maxFunnel} className="bg-violet-400" />
                        <FunnelBar label="Clientes" value={metrics.funnel.won} max={maxFunnel} className="bg-emerald-500" />
                    </div>
                </div>

                {/* Ranking por comercial */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-3">Ranking por comercial</h3>
                    {ranking.length === 0 ? (
                        <p className="text-sm text-slate-400">Sin datos todavía.</p>
                    ) : (
                        <div className="overflow-x-auto -mx-1">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-[11px] uppercase tracking-wide text-slate-400 text-left">
                                        <th className="font-semibold py-1 px-1">Comercial</th>
                                        <th className="font-semibold py-1 px-1 text-right">Conv.</th>
                                        <th className="font-semibold py-1 px-1 text-right">Cli.</th>
                                        <th className="font-semibold py-1 px-1 text-right">Abiertos</th>
                                        <th className="font-semibold py-1 px-1 text-right">Comisión</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ranking.map((r) => (
                                        <tr key={r.agent_id} className="border-t border-slate-50">
                                            <td className="py-1.5 px-1 text-slate-700 truncate max-w-[140px]">{r.agent_name || '—'}</td>
                                            <td className="py-1.5 px-1 text-right font-semibold text-emerald-700 tabular-nums">{conversionRate(r.won, r.lost)}%</td>
                                            <td className="py-1.5 px-1 text-right text-slate-600 tabular-nums">{r.won}</td>
                                            <td className="py-1.5 px-1 text-right text-slate-600 tabular-nums">{r.open_leads}</td>
                                            <td className="py-1.5 px-1 text-right text-slate-600 tabular-nums">{eur(Number(r.commission))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
