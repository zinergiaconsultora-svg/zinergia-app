'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    BadgeCheck,
    Check,
    ChevronRight,
    FileText,
    ReceiptText,
    Scale,
    ShieldAlert,
    UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    resolveCommissionAdjustmentAction,
    validateCommissionAction,
} from '@/app/actions/commissionManagement';
import type {
    CommissionAdminAdjustmentItem,
    CommissionAdminQueueItem,
    CommissionAdminQueues,
} from '@/lib/commissions/adminQueues';

type Queue = 'validation' | 'settlement' | 'attention';

const inputClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-indigo-950';

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatDate(value: string | null): string {
    if (!value) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export function CommissionOperationsPanel({ queues }: { queues: CommissionAdminQueues }) {
    const [queue, setQueue] = useState<Queue>('validation');
    const options: Array<{ id: Queue; label: string; shortLabel: string; count: number; icon: typeof BadgeCheck }> = [
        { id: 'validation', label: 'Validar', shortLabel: 'Validar', count: queues.validation.length, icon: BadgeCheck },
        { id: 'settlement', label: 'Liquidar', shortLabel: 'Liquidar', count: queues.settlement.length, icon: ReceiptText },
        { id: 'attention', label: 'Ajustes y conciliación', shortLabel: 'Ajustes', count: queues.attentionCount, icon: Scale },
    ];

    return (
        <section aria-labelledby="operations-heading" className="py-6">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between dark:border-slate-800">
                <div>
                    <h2 id="operations-heading" className="text-lg font-bold text-slate-950 dark:text-white">Trabajo pendiente</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Cada cola tiene una única decisión operativa.</p>
                </div>
                <div className="w-full md:w-auto">
                    <div className="grid grid-cols-3 gap-1 rounded-md bg-slate-100 p-1 md:flex dark:bg-slate-900">
                        {options.map((option) => {
                            const Icon = option.icon;
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => setQueue(option.id)}
                                    aria-pressed={queue === option.id}
                                    className={`inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 md:px-3 ${queue === option.id ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'}`}
                                >
                                    <Icon aria-hidden="true" size={16} />
                                    <span className="hidden sm:inline">{option.label}</span>
                                    <span className="sm:hidden">{option.shortLabel}</span>
                                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs dark:bg-slate-700">{option.count}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {queue === 'validation' && <ValidationQueue items={queues.validation} />}
            {queue === 'settlement' && <SettlementQueue items={queues.settlement} />}
            {queue === 'attention' && <AttentionQueue adjustments={queues.adjustments} reconciliation={queues.reconciliation} />}
        </section>
    );
}

function ValidationQueue({ items }: { items: CommissionAdminQueueItem[] }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [openId, setOpenId] = useState<string | null>(null);
    const [reason, setReason] = useState('Contrato activo y comisión conciliada');

    function validate(item: CommissionAdminQueueItem) {
        startTransition(async () => {
            const result = await validateCommissionAction({ commissionId: item.id, reason });
            if (!result.success) {
                toast.error(result.error);
                return;
            }
            toast.success('Comisión validada');
            setOpenId(null);
            router.refresh();
        });
    }

    if (items.length === 0) return <QueueEmpty icon={BadgeCheck} title="No hay comisiones por validar" description="Las operaciones conciliadas aparecerán aquí cuando el contrato quede activo." />;

    return (
        <div className="divide-y divide-slate-200 border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {items.map((item) => (
                <article key={item.id} className="bg-white py-4 dark:bg-slate-950">
                    <QueueRow item={item} action={
                        <button type="button" onClick={() => setOpenId(openId === item.id ? null : item.id)} className="inline-flex h-9 items-center gap-2 rounded-md bg-indigo-700 px-3 text-sm font-bold text-white hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">
                            <Check aria-hidden="true" size={16} /> Validar
                        </button>
                    } />
                    {openId === item.id && (
                        <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] dark:border-slate-800">
                            <label><span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Motivo de validación</span><input value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass} /></label>
                            <button type="button" disabled={pending || reason.trim().length < 3} onClick={() => validate(item)} className="h-10 self-end rounded-md bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50">Confirmar validación</button>
                        </div>
                    )}
                </article>
            ))}
        </div>
    );
}

function SettlementQueue({ items }: { items: CommissionAdminQueueItem[] }) {
    if (items.length === 0) return <QueueEmpty icon={ReceiptText} title="No hay liquidaciones por preparar" description="Solo aparecen comisiones validadas y todavía no incluidas en una factura fiscal." />;

    return (
        <div className="divide-y divide-slate-200 border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {items.map((item) => (
                <article key={item.id} className="bg-white py-4 dark:bg-slate-950">
                    <QueueRow item={item} action={
                        item.fiscalReady ? (
                            <span className="inline-flex items-center gap-1.5 rounded bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"><BadgeCheck aria-hidden="true" size={15} /> Datos fiscales listos</span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 rounded bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"><ShieldAlert aria-hidden="true" size={15} /> Faltan datos fiscales</span>
                        )
                    } />
                </article>
            ))}
            <p className="bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                La creación de borradores permanece bloqueada hasta activar el flujo fiscal atómico y el acuerdo de autofacturación cuando corresponda.
            </p>
        </div>
    );
}

function AttentionQueue({ adjustments, reconciliation }: { adjustments: CommissionAdminAdjustmentItem[]; reconciliation: CommissionAdminQueues['reconciliation'] }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [openId, setOpenId] = useState<string | null>(null);
    const [resolution, setResolution] = useState<'confirmed' | 'disputed' | 'waived'>('confirmed');
    const [note, setNote] = useState('Revisado contra la evidencia aportada');

    function resolve(id: string) {
        startTransition(async () => {
            const result = await resolveCommissionAdjustmentAction({ adjustmentId: id, resolution, note });
            if (!result.success) {
                toast.error(result.error);
                return;
            }
            toast.success('Ajuste resuelto');
            setOpenId(null);
            router.refresh();
        });
    }

    if (adjustments.length === 0 && reconciliation.length === 0) {
        return <QueueEmpty icon={Scale} title="No hay diferencias pendientes" description="Los ajustes y bloqueos de conciliación aparecerán aquí con su evidencia." />;
    }

    return (
        <div className="space-y-7 pt-5">
            <div>
                <h3 className="text-sm font-bold text-slate-950 dark:text-white">Ajustes propuestos</h3>
                <div className="mt-2 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                    {adjustments.map((item) => (
                        <article key={item.id} className="bg-white py-4 dark:bg-slate-950">
                            <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_150px_150px_minmax(220px,1fr)_auto] lg:items-center">
                                <div><p className="font-bold text-slate-950 dark:text-white">{item.clientName}</p><p className="text-sm text-slate-500">{item.commercialName}</p></div>
                                <div><p className="text-xs font-bold text-slate-500">Causa</p><p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">{item.causeLabel}</p></div>
                                <div><p className="text-xs font-bold text-slate-500">Reversión</p><p className="mt-0.5 font-bold tabular-nums text-rose-700 dark:text-rose-300">{item.reversalPercent}% · {formatCurrency(item.reversedAmount)}</p></div>
                                <div className="min-w-0"><p className="text-xs font-bold text-slate-500">Evidencia</p><p className="mt-0.5 truncate text-sm text-slate-700 dark:text-slate-200" title={item.evidenceReference}>{item.evidenceReference}</p><p className="text-xs text-slate-500">{item.activeDays ?? 'Sin dato'} días activos</p></div>
                                <button type="button" onClick={() => setOpenId(openId === item.id ? null : item.id)} className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-slate-300 px-3 text-sm font-bold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900">Resolver <ChevronRight aria-hidden="true" size={15} /></button>
                            </div>
                            {openId === item.id && (
                                <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-[180px_minmax(0,1fr)_auto] dark:border-slate-800">
                                    <label><span className="mb-1 block text-xs font-bold text-slate-600">Resolución</span><select className={inputClass} value={resolution} onChange={(event) => setResolution(event.target.value as typeof resolution)}><option value="confirmed">Confirmar</option><option value="disputed">Abrir disputa</option><option value="waived">Anular ajuste</option></select></label>
                                    <label><span className="mb-1 block text-xs font-bold text-slate-600">Nota</span><input className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} /></label>
                                    <button type="button" disabled={pending || note.trim().length < 3} onClick={() => resolve(item.id)} className="h-10 self-end rounded-md bg-indigo-700 px-4 text-sm font-bold text-white hover:bg-indigo-800 disabled:opacity-50">Guardar resolución</button>
                                </div>
                            )}
                        </article>
                    ))}
                    {adjustments.length === 0 && <p className="py-6 text-sm text-slate-500">No hay ajustes propuestos.</p>}
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-950 dark:text-white">Conciliación</h3><span className="text-xs font-semibold text-slate-500">Corrige la configuración desde Modelo económico</span></div>
                <div className="mt-2 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                    {reconciliation.map((item) => (
                        <div key={item.commissionId} className="grid gap-3 bg-white py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center dark:bg-slate-950">
                            <div><p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><AlertTriangle aria-hidden="true" size={16} className="text-amber-600" />{item.requiredAction}</p><p className="mt-1 font-mono text-xs text-slate-500">{item.commissionId}</p></div>
                            <span className="text-xs text-slate-500">{formatDate(item.createdAt)}</span>
                        </div>
                    ))}
                    {reconciliation.length === 0 && <p className="py-6 text-sm text-slate-500">No hay bloqueos de conciliación.</p>}
                </div>
            </div>
        </div>
    );
}

function QueueRow({ item, action }: { item: CommissionAdminQueueItem; action: React.ReactNode }) {
    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,1.15fr)_minmax(190px,1fr)_150px_150px_auto] lg:items-center">
            <div><p className="font-bold text-slate-950 dark:text-white">{item.clientName}</p><p className="mt-0.5 font-mono text-xs text-slate-500">{item.proposalId ? `PROP-${item.proposalId.slice(0, 8).toUpperCase()}` : 'Sin propuesta'}</p></div>
            <div><p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100"><UserRound aria-hidden="true" size={15} />{item.commercialName}</p><p className="mt-0.5 truncate text-xs text-slate-500">{item.commercialEmail ?? 'Sin correo fiscal'}</p></div>
            <div><p className="text-xs font-bold text-slate-500">Neto</p><p className="mt-0.5 font-bold tabular-nums text-slate-950 dark:text-white">{formatCurrency(item.netAmount)}</p>{item.reversedAmount > 0 && <p className="text-xs text-rose-700">-{formatCurrency(item.reversedAmount)} ajustado</p>}</div>
            <div><p className="text-xs font-bold text-slate-500">En cola desde</p><p className="mt-0.5 text-sm text-slate-700 dark:text-slate-200">{formatDate(item.referenceAt)}</p></div>
            <div className="lg:justify-self-end">{action}</div>
        </div>
    );
}

function QueueEmpty({ icon: Icon, title, description }: { icon: typeof FileText; title: string; description: string }) {
    return (
        <div className="py-14 text-center">
            <Icon aria-hidden="true" className="mx-auto text-slate-400" size={28} />
            <h3 className="mt-3 text-base font-bold text-slate-950 dark:text-white">{title}</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-300">{description}</p>
        </div>
    );
}
