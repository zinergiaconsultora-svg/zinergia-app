'use client';

import { useState, useTransition } from 'react';
import { ScrollText } from 'lucide-react';
import { getAuditLogAction } from '@/app/actions/auditLog';
import type { AuditResult } from '@/app/actions/auditLog';
import { EmptyState } from '@/components/ui/EmptyState';

interface Props {
    initialData: AuditResult;
}

const ACTION_LABELS: Record<string, string> = {
    clear_commission: 'Comisión validada',
    pay_commission: 'Comisión pagada',
    save_commission_rule: 'Regla de comisión guardada',
    create_offer: 'Oferta creada',
    update_offer: 'Oferta actualizada',
    delete_offer: 'Oferta eliminada',
    create_franchise: 'Franquicia creada',
    update_agent: 'Agente actualizado',
    rgpd_deletion: 'Borrado RGPD Art. 17',
    rgpd_retention_won_5y: 'Purga retención 5 años',
    rgpd_retention_inactive_12m: 'Purga retención 12 meses',
};

const ACTION_COLORS: Record<string, string> = {
    clear_commission: 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
    pay_commission: 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
    save_commission_rule: 'bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400',
    create_offer: 'bg-sky-100 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400',
    update_offer: 'bg-sky-100 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400',
    delete_offer: 'bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400',
    create_franchise: 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400',
    update_agent: 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
    rgpd_deletion: 'bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400',
    rgpd_retention_won_5y: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    rgpd_retention_inactive_12m: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
};

export default function AuditPanel({ initialData }: Props) {
    const [data, setData] = useState<AuditResult>(initialData);
    const [filter, setFilter] = useState('');
    const [page, setPage] = useState(0);
    const [isPending, startTransition] = useTransition();
    const PAGE_SIZE = 50;

    function reload(actionFilter: string, pageIdx: number) {
        startTransition(async () => {
            const result = await getAuditLogAction({
                action: actionFilter || undefined,
                limit: PAGE_SIZE,
                offset: pageIdx * PAGE_SIZE,
            });
            setData(result);
            setPage(pageIdx);
            setFilter(actionFilter);
        });
    }

    const totalPages = Math.ceil(data.total / PAGE_SIZE);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Audit Log</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Registro de todas las operaciones administrativas • {data.total} entradas
                </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
                <button
                    onClick={() => reload('', 0)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        !filter
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                >
                    Todas
                </button>
                {data.actions.map(action => (
                    <button
                        key={action}
                        onClick={() => reload(action, 0)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            filter === action
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                        {ACTION_LABELS[action] ?? action}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/50">
                {data.entries.length === 0 ? (
                    <EmptyState
                        icon={ScrollText}
                        tone="indigo"
                        title="Sin entradas de auditoría"
                        description="Aún no se ha registrado ninguna acción. Cuando ocurran cambios sensibles, aparecerán aquí con autor, fecha y detalle."
                    />
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                <th className="text-left px-4 py-3">Fecha</th>
                                <th className="text-left px-4 py-3">Acción</th>
                                <th className="text-left px-4 py-3">Actor</th>
                                <th className="text-left px-4 py-3">Tabla</th>
                                <th className="text-left px-4 py-3">Registro</th>
                                <th className="text-left px-4 py-3">Detalle</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y divide-slate-100 dark:divide-slate-800 transition-opacity ${isPending ? 'opacity-50' : ''}`}>
                            {data.entries.map(entry => (
                                <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                        {new Date(entry.created_at).toLocaleString('es-ES', {
                                            day: '2-digit', month: '2-digit', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit',
                                        })}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${ACTION_COLORS[entry.action] ?? 'bg-slate-100 text-slate-600'}`}>
                                            {ACTION_LABELS[entry.action] ?? entry.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">
                                        {entry.actor_email ?? (entry.user_id ? entry.user_id.slice(0, 8) + '…' : '—')}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                                        {entry.table_name}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-400 dark:text-slate-500">
                                        {entry.record_id ? entry.record_id.slice(0, 8) + '…' : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                                        {entry.new_data
                                            ? Object.entries(entry.new_data)
                                                .filter(([k]) => k !== 'actor_role')
                                                .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                                                .join(', ') || '—'
                                            : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        Página {page + 1} de {totalPages} ({data.total} entradas)
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => reload(filter, page - 1)}
                            disabled={page === 0 || isPending}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            ← Anterior
                        </button>
                        <button
                            onClick={() => reload(filter, page + 1)}
                            disabled={page >= totalPages - 1 || isPending}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            Siguiente →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
