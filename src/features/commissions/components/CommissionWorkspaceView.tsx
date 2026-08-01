'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
    AlertTriangle,
    ArrowRight,
    BadgeCheck,
    CalendarDays,
    CheckCircle2,
    CircleDollarSign,
    Clock3,
    FileCheck2,
    FileText,
    History,
    ReceiptText,
    RotateCcw,
    ShieldCheck,
} from 'lucide-react';
import type {
    CommissionLifecycleStatus,
    CommissionWorkspace,
    CommissionWorkspaceItem,
} from '@/lib/commissions/workspace';

type Filter = 'all' | CommissionLifecycleStatus | 'adjustments';

const STATUS_STYLES: Record<CommissionLifecycleStatus, { icon: typeof Clock3; badge: string; dot: string }> = {
    pending: { icon: Clock3, badge: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
    eligible: { icon: ShieldCheck, badge: 'bg-sky-50 text-sky-800', dot: 'bg-sky-500' },
    validated: { icon: BadgeCheck, badge: 'bg-indigo-50 text-indigo-800', dot: 'bg-indigo-600' },
    invoiced: { icon: FileCheck2, badge: 'bg-violet-50 text-violet-800', dot: 'bg-violet-500' },
    paid: { icon: CheckCircle2, badge: 'bg-emerald-50 text-emerald-800', dot: 'bg-emerald-600' },
    reverted: { icon: RotateCcw, badge: 'bg-rose-50 text-rose-800', dot: 'bg-rose-500' },
};

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

function formatDate(value: string | null): string {
    if (!value) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(value));
}

function shortReference(value: string | null, prefix: string): string {
    return value ? `${prefix}-${value.slice(0, 8).toUpperCase()}` : 'Sin referencia';
}

export default function CommissionWorkspaceView({
    workspace,
    error,
}: {
    workspace: CommissionWorkspace;
    error?: string;
}) {
    const [filter, setFilter] = useState<Filter>('all');
    const filteredItems = useMemo(() => {
        if (filter === 'all') return workspace.items;
        if (filter === 'adjustments') return workspace.items.filter((item) => item.adjustments.length > 0);
        return workspace.items.filter((item) => item.status === filter);
    }, [filter, workspace.items]);

    const filters: Array<{ id: Filter; label: string; count: number }> = [
        { id: 'all', label: 'Todas', count: workspace.items.length },
        ...workspace.statuses.map((status) => ({ id: status.id, label: status.shortLabel, count: status.count })),
        { id: 'adjustments', label: 'Ajustes', count: workspace.adjustmentCount },
    ];

    return (
        <div className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-5 md:px-0 md:pb-5">
            <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between dark:border-slate-800">
                <div>
                    <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Comisiones</h1>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Estado, importe neto y ajustes de cada operación.
                    </p>
                </div>
                <Link
                    href="/dashboard/invoicing"
                    className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-md border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 sm:self-auto dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                    <ReceiptText aria-hidden="true" size={17} />
                    Facturas fiscales
                </Link>
            </header>

            {error ? (
                <div role="alert" className="mt-5 flex items-start gap-3 border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                    <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
                    <div>
                        <p className="font-bold">No se pudieron cargar las comisiones</p>
                        <p className="mt-1">{error}</p>
                    </div>
                </div>
            ) : (
                <>
                    <section aria-label="Resumen de comisiones" className="grid border-b border-slate-200 sm:grid-cols-2 xl:grid-cols-4 dark:border-slate-800">
                        <SummaryMetric icon={CircleDollarSign} label="Neto registrado" value={formatCurrency(workspace.totalNetAmount)} description={`${workspace.items.length} operaciones`} />
                        <SummaryMetric icon={FileText} label="Disponible para facturar" value={formatCurrency(workspace.availableToInvoiceAmount)} description="Comisiones validadas" />
                        <SummaryMetric icon={CheckCircle2} label="Pagado" value={formatCurrency(workspace.paidAmount)} description="Cobros confirmados" />
                        <SummaryMetric icon={RotateCcw} label="Reversado" value={formatCurrency(workspace.reversedAmount)} description={`${workspace.adjustmentCount} ajustes`} />
                    </section>

                    <nav aria-label="Filtrar comisiones" className="-mx-4 overflow-x-auto border-b border-slate-200 px-4 py-3 md:mx-0 md:px-0 dark:border-slate-800">
                        <div className="flex min-w-max gap-1">
                            {filters.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setFilter(item.id)}
                                    aria-pressed={filter === item.id}
                                    className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${filter === item.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'}`}
                                >
                                    {item.label}
                                    <span className={`min-w-5 rounded px-1.5 py-0.5 text-center text-xs ${filter === item.id ? 'bg-white/15 dark:bg-slate-900/10' : 'bg-slate-200/70 dark:bg-slate-700'}`}>
                                        {item.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </nav>

                    {workspace.items.length === 0 ? (
                        <EmptyCommissions />
                    ) : filteredItems.length === 0 ? (
                        <div className="py-14 text-center">
                            <History aria-hidden="true" className="mx-auto text-slate-400" size={28} />
                            <h2 className="mt-3 text-base font-bold text-slate-950 dark:text-white">No hay movimientos en este estado</h2>
                            <button type="button" onClick={() => setFilter('all')} className="mt-3 text-sm font-bold text-indigo-700 hover:underline dark:text-indigo-300">
                                Ver todas las comisiones
                            </button>
                        </div>
                    ) : (
                        <section aria-label="Movimientos de comisión" className="border-b border-slate-200 dark:border-slate-800">
                            <div className="hidden grid-cols-[minmax(220px,1.25fr)_minmax(180px,1fr)_180px_150px_145px] gap-4 bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 lg:grid dark:bg-slate-900 dark:text-slate-300">
                                <span>Operación</span><span>Origen</span><span>Estado</span><span className="text-right">Importe neto</span><span className="text-right">Fecha</span>
                            </div>
                            <div className="divide-y divide-slate-200 dark:divide-slate-800">
                                {filteredItems.map((item) => <CommissionRow key={item.id} item={item} />)}
                            </div>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}

function SummaryMetric({ icon: Icon, label, value, description }: { icon: typeof Clock3; label: string; value: string; description: string }) {
    return (
        <div className="flex min-w-0 items-start gap-3 border-t border-slate-200 px-3 py-5 first:border-t-0 sm:px-4 sm:[&:nth-child(-n+2)]:border-t-0 xl:border-l xl:border-t-0 xl:first:border-l-0 dark:border-slate-800">
            <Icon aria-hidden="true" className="mt-0.5 shrink-0 text-slate-500" size={19} />
            <div className="min-w-0">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{label}</p>
                <p className="mt-1 truncate text-xl font-bold tabular-nums text-slate-950 dark:text-white">{value}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
            </div>
        </div>
    );
}

function CommissionRow({ item }: { item: CommissionWorkspaceItem }) {
    const config = STATUS_STYLES[item.status];
    const hasReconciliationIssue = item.reconciliationStatus !== 'ready';

    return (
        <article className="bg-white px-4 py-4 dark:bg-slate-950">
            <div className="grid gap-4 lg:grid-cols-[minmax(220px,1.25fr)_minmax(180px,1fr)_180px_150px_145px] lg:items-center">
                <div className="min-w-0">
                    <p className="truncate font-bold text-slate-950 dark:text-white">{item.clientName}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">{shortReference(item.proposalId, 'PROP')}</p>
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{item.marketerName}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{item.productName}</p>
                </div>
                <div>
                    <span className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-bold ${config.badge}`}>
                        <span aria-hidden="true" className={`size-1.5 rounded-full ${config.dot}`} />
                        {item.statusLabel}
                    </span>
                </div>
                <div className="lg:text-right">
                    <p className="text-base font-bold tabular-nums text-slate-950 dark:text-white">{formatCurrency(item.netAmount)}</p>
                    {item.reversedAmount > 0 && <p className="mt-0.5 text-xs font-semibold tabular-nums text-rose-700 dark:text-rose-300">-{formatCurrency(item.reversedAmount)} ajustado</p>}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 lg:justify-end dark:text-slate-300">
                    <CalendarDays aria-hidden="true" size={15} />{formatDate(item.createdAt)}
                </div>
            </div>

            {(item.adjustments.length > 0 || hasReconciliationIssue) && (
                <details className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 rounded px-2 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:text-slate-200 dark:hover:bg-slate-900">
                        <span className="flex min-w-0 items-center gap-2">
                            {hasReconciliationIssue ? <AlertTriangle aria-hidden="true" size={16} className="shrink-0 text-amber-600" /> : <History aria-hidden="true" size={16} className="shrink-0 text-slate-500" />}
                            {hasReconciliationIssue ? item.reconciliationLabel : `${item.adjustments.length} ${item.adjustments.length === 1 ? 'ajuste' : 'ajustes'}`}
                        </span>
                        <ArrowRight aria-hidden="true" size={16} className="shrink-0" />
                    </summary>
                    <div className="mt-3 grid gap-4 border-l-2 border-slate-200 pl-4 dark:border-slate-700">
                        {item.adjustments.map((adjustment) => (
                            <div key={adjustment.id} className="grid gap-3 text-sm md:grid-cols-[minmax(180px,1fr)_140px_140px_minmax(180px,1fr)]">
                                <div><p className="font-bold text-slate-900 dark:text-white">{adjustment.reasonLabel}</p><p className="mt-0.5 text-xs text-slate-500">{adjustment.frozenPolicyLabel}</p></div>
                                <div><p className="text-xs font-bold text-slate-500">Días activos</p><p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">{adjustment.activeDays ?? 'No informado'}</p></div>
                                <div><p className="text-xs font-bold text-slate-500">Reversión</p><p className="mt-0.5 font-bold tabular-nums text-rose-700 dark:text-rose-300">{adjustment.reversalPercent}% · {formatCurrency(adjustment.reversedAmount)}</p></div>
                                <div className="min-w-0"><p className="text-xs font-bold text-slate-500">Evidencia y estado</p><p className="mt-0.5 truncate font-semibold text-slate-800 dark:text-slate-100" title={adjustment.evidenceReference}>{adjustment.evidenceReference}</p><p className="mt-0.5 text-xs text-slate-500">{adjustment.disputeLabel}</p></div>
                            </div>
                        ))}
                        {item.adjustments.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-300">Esta operación necesita revisión antes de continuar.</p>}
                    </div>
                </details>
            )}
        </article>
    );
}

function EmptyCommissions() {
    return (
        <div className="py-16 text-center">
            <CircleDollarSign aria-hidden="true" className="mx-auto text-slate-400" size={30} />
            <h2 className="mt-3 text-lg font-bold text-slate-950 dark:text-white">Todavía no hay comisiones</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-300">Aparecerán aquí cuando una propuesta aceptada genere una operación económica.</p>
            <Link href="/dashboard" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-indigo-700 hover:underline dark:text-indigo-300">Volver a Trabajo<ArrowRight aria-hidden="true" size={16} /></Link>
        </div>
    );
}
