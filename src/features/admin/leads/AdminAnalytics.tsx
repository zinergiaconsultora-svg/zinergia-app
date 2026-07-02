import React from 'react';
import Link from 'next/link';
import { AlertTriangle, CloudOff, Search, CalendarClock, Clock3, ClipboardList } from 'lucide-react';
import type { LeadAnalytics, LeadAlerts } from '@/app/actions/invoices';
import { conversionRate } from './metrics';

function eur(n: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

const ALERTS: { key: keyof LeadAlerts; label: string; queue: string; Icon: typeof AlertTriangle; active: string }[] = [
    { key: 'ocr_failed', label: 'OCR fallido', queue: 'ocr_failed', Icon: AlertTriangle, active: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100' },
    { key: 'drive_pending', label: 'Pendiente Drive', queue: 'drive_pending', Icon: CloudOff, active: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' },
    { key: 'needs_comparison', label: 'Sin comparar', queue: 'needs_comparison', Icon: Search, active: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100' },
    { key: 'permanence_due', label: 'Renovaciones', queue: 'permanence_due', Icon: CalendarClock, active: 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100' },
    { key: 'needs_review', label: 'Por revisar', queue: 'needs_review', Icon: ClipboardList, active: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
    { key: 'cooling', label: 'Enfriándose', queue: 'cooling', Icon: Clock3, active: 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100' },
];

export function AdminAnalytics({ analytics }: { analytics: LeadAnalytics }) {
    const { alerts, by_franchise, loss_reasons, pipeline_savings } = analytics;
    const totalLost = loss_reasons.reduce((a, r) => a + r.count, 0) || 1;

    return (
        <div className="space-y-4 mb-6">
            {/* Alertas operativas — clic = ir a la cola */}
            <div>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Alertas operativas</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {ALERTS.map((a) => {
                        const count = alerts[a.key] ?? 0;
                        return (
                            <Link
                                key={a.key}
                                href={`/admin/leads?outcome=all&queue=${a.queue}`}
                                className={`rounded-2xl border p-3 flex items-center justify-between transition-colors ${
                                    count > 0 ? a.active : 'border-slate-100 bg-white text-slate-400 hover:bg-slate-50'
                                }`}
                            >
                                <span className="flex items-center gap-2 text-[13px] font-semibold"><a.Icon size={15} /> {a.label}</span>
                                <span className="text-lg font-bold tabular-nums">{count}</span>
                            </Link>
                        );
                    })}
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
                {/* Valor del pipeline */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Valor del pipeline</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-700">
                        {eur(pipeline_savings)}<span className="text-sm text-slate-400 font-medium">/año</span>
                    </p>
                    <p className="text-[12px] text-slate-400 mt-1">Ahorro de propuestas en leads abiertos</p>
                </div>

                {/* Conversión por franquicia */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-3">Conversión por franquicia</h3>
                    {by_franchise.length === 0 ? (
                        <p className="text-sm text-slate-400">Sin datos todavía.</p>
                    ) : (
                        <div className="overflow-x-auto -mx-1">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-[11px] uppercase tracking-wide text-slate-400 text-left">
                                        <th className="font-semibold py-1 px-1">Franquicia</th>
                                        <th className="font-semibold py-1 px-1 text-right">Conv.</th>
                                        <th className="font-semibold py-1 px-1 text-right">Clientes</th>
                                        <th className="font-semibold py-1 px-1 text-right">Abiertos</th>
                                        <th className="font-semibold py-1 px-1 text-right">Comisión</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {by_franchise.map((f, i) => (
                                        <tr key={i} className="border-t border-slate-50">
                                            <td className="py-1.5 px-1 text-slate-700 truncate max-w-[160px]">{f.franchise_name || 'Sin franquicia'}</td>
                                            <td className="py-1.5 px-1 text-right font-semibold text-emerald-700 tabular-nums">{conversionRate(f.won, f.lost)}%</td>
                                            <td className="py-1.5 px-1 text-right text-slate-600 tabular-nums">{f.won}</td>
                                            <td className="py-1.5 px-1 text-right text-slate-600 tabular-nums">{f.open_leads}</td>
                                            <td className="py-1.5 px-1 text-right text-slate-600 tabular-nums">{eur(Number(f.commission))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Motivos de pérdida */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Motivos de pérdida</h3>
                {loss_reasons.length === 0 ? (
                    <p className="text-sm text-slate-400">Aún no hay leads perdidos.</p>
                ) : (
                    <ul className="space-y-2">
                        {loss_reasons.map((r, i) => (
                            <li key={i}>
                                <div className="flex items-center justify-between text-[13px] mb-0.5">
                                    <span className="text-slate-600 truncate max-w-[80%]">{r.reason}</span>
                                    <span className="text-slate-400 tabular-nums">{r.count}</span>
                                </div>
                                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                    <div className="h-full rounded-full bg-rose-400" style={{ width: `${Math.max(Math.round((r.count / totalLost) * 100), 4)}%` }} />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
