'use client';

import { useState, useTransition } from 'react';
import { eraseClientAction, triggerPurgeAction } from '@/app/actions/rgpd';
import type { RgpdStats } from '@/app/actions/rgpd';

interface Props {
    stats: RgpdStats;
}

export default function RgpdPanel({ stats }: Props) {
    const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
    const [isPending, startTransition] = useTransition();

    function handlePurge() {
        startTransition(async () => {
            const result = await triggerPurgeAction();
            setMessage({ text: result.message, ok: result.success });
        });
    }

    function handleErase(clientId: string, clientName: string) {
        if (!window.confirm(`¿Eliminar permanentemente a "${clientName}"? Esta acción no se puede deshacer.`)) return;
        startTransition(async () => {
            const result = await eraseClientAction(clientId);
            setMessage({ text: result.message, ok: result.success });
        });
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                        Panel RGPD
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        Retención de datos · Art. 5.1(e) y Art. 17 RGPD
                    </p>
                </div>
                <button
                    onClick={handlePurge}
                    disabled={isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
                >
                    {isPending ? '⏳ Procesando…' : '🗑 Ejecutar purga ahora'}
                </button>
            </div>

            {/* Status message */}
            {message && (
                <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
                    message.ok
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/30'
                        : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-700/30'
                }`}>
                    {message.ok ? '✓ ' : '✗ '}{message.text}
                </div>
            )}

            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                    label="Clientes a purgar en 30 días"
                    value={stats.expiringSoon.length}
                    accent="amber"
                />
                <StatCard
                    label="Eliminaciones este año (automáticas)"
                    value={stats.totalPurgedThisYear}
                    accent="slate"
                />
                <StatCard
                    label="Eliminaciones manuales (Art. 17)"
                    value={stats.recentDeletions.filter(d => d.action === 'rgpd_deletion').length}
                    accent="rose"
                />
            </div>

            {/* Clients expiring soon */}
            <section>
                <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-3">
                    Clientes próximos a expirar (30 días)
                </h2>
                {stats.expiringSoon.length === 0 ? (
                    <EmptyState text="Ningún cliente expira en los próximos 30 días." />
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/50">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    <th className="text-left px-4 py-3">Nombre</th>
                                    <th className="text-left px-4 py-3">Email</th>
                                    <th className="text-left px-4 py-3">Estado</th>
                                    <th className="text-left px-4 py-3">Fecha purga</th>
                                    <th className="text-left px-4 py-3">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {stats.expiringSoon.map(c => (
                                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{c.name}</td>
                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{c.email ?? '—'}</td>
                                        <td className="px-4 py-3">
                                            <StatusBadge status={c.status} />
                                        </td>
                                        <td className="px-4 py-3 text-amber-600 dark:text-amber-400 font-mono text-xs">
                                            {new Date(c.purge_date).toLocaleDateString('es-ES')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => handleErase(c.id, c.name)}
                                                disabled={isPending}
                                                className="text-xs px-2.5 py-1 rounded-md bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-800/30 disabled:opacity-50 transition-colors font-medium"
                                            >
                                                Eliminar (Art. 17)
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Audit log */}
            <section>
                <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-3">
                    Últimas eliminaciones (audit log)
                </h2>
                {stats.recentDeletions.length === 0 ? (
                    <EmptyState text="No hay eliminaciones registradas aún." />
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/50">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                    <th className="text-left px-4 py-3">Fecha</th>
                                    <th className="text-left px-4 py-3">Razón</th>
                                    <th className="text-left px-4 py-3">Cliente</th>
                                    <th className="text-left px-4 py-3">Estado previo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {stats.recentDeletions.map(entry => {
                                    const data = entry.new_data ?? {};
                                    return (
                                        <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                {new Date(entry.created_at).toLocaleString('es-ES')}
                                            </td>
                                            <td className="px-4 py-3">
                                                <ReasonBadge reason={entry.action} />
                                            </td>
                                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                                {String(data.client_name ?? '—')}
                                            </td>
                                            <td className="px-4 py-3">
                                                {data.client_status
                                                    ? <StatusBadge status={String(data.client_status)} />
                                                    : <span className="text-slate-400">—</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Policy note */}
            <aside className="rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/30 p-4 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <p><strong className="font-semibold text-slate-600 dark:text-slate-300">Política de retención</strong></p>
                <p>• Clientes con contrato ganado (<code>won</code>): 5 años desde última actualización.</p>
                <p>• Leads perdidos / inactivos: 12 meses desde última actualización.</p>
                <p>• La purga automática se ejecuta a las 02:00 UTC cada día (Vercel Cron).</p>
                <p>• Los registros de eliminación se conservan en <code>audit_logs</code> durante 5 años (Art. 5.2).</p>
            </aside>
        </div>
    );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: number; accent: 'amber' | 'slate' | 'rose' }) {
    const colors = {
        amber: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-700/20 text-amber-700 dark:text-amber-400',
        slate: 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/30 text-slate-700 dark:text-slate-300',
        rose: 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-700/20 text-rose-700 dark:text-rose-400',
    };
    return (
        <div className={`rounded-xl border p-5 ${colors[accent]}`}>
            <div className="text-3xl font-black">{value}</div>
            <div className="text-xs font-medium mt-1 opacity-80">{label}</div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        won: 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
        lost: 'bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400',
        new: 'bg-sky-100 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400',
        contacted: 'bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400',
        in_process: 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
    };
    return (
        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
            {status}
        </span>
    );
}

function ReasonBadge({ reason }: { reason: string }) {
    if (reason === 'rgpd_deletion') {
        return <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400">Art. 17 manual</span>;
    }
    if (reason === 'rgpd_retention_won_5y') {
        return <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Retención 5 años (won)</span>;
    }
    return <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Retención 12 meses</span>;
}

function EmptyState({ text }: { text: string }) {
    return (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700/50 p-8 text-center text-sm text-slate-400 dark:text-slate-500">
            {text}
        </div>
    );
}
