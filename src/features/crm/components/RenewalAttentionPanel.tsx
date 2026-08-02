'use client';

import { useState, useTransition } from 'react';
import { CalendarClock, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { RenewalDataQualityItem } from '@/app/actions/workQueue';
import { confirmContractPermanenceAction } from '@/app/actions/workQueue';

export default function RenewalAttentionPanel({
    items,
    showOwner = false,
}: {
    items: RenewalDataQualityItem[];
    showOwner?: boolean;
}) {
    const [visibleItems, setVisibleItems] = useState(items);
    const [values, setValues] = useState<Record<string, { status: 'known' | 'none'; endDate: string }>>({});
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    if (visibleItems.length === 0) return null;

    const updateValue = (contractId: string, patch: Partial<{ status: 'known' | 'none'; endDate: string }>) => {
        setValues(current => {
            const previous = current[contractId] ?? { status: 'known' as const, endDate: '' };
            return { ...current, [contractId]: { ...previous, ...patch } };
        });
    };

    const save = (contractId: string) => {
        const value = values[contractId] ?? { status: 'known' as const, endDate: '' };
        setPendingId(contractId);
        startTransition(async () => {
            const result = await confirmContractPermanenceAction({
                contractId,
                permanenceStatus: value.status,
                endDate: value.status === 'known' ? value.endDate || null : null,
            });
            if (result.ok) {
                setVisibleItems(current => current.filter(item => item.contractId !== contractId));
                toast.success('Vencimiento actualizado');
            } else {
                toast.error(result.error ?? 'No se pudo guardar la permanencia');
            }
            setPendingId(null);
        });
    };

    return (
        <section className="border-y border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20">
            <div className="flex items-start gap-2 px-4 py-3">
                <CalendarClock aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" />
                <div>
                    <h2 className="text-sm font-bold text-slate-950 dark:text-white">
                        Fechas de vencimiento por confirmar
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                        Confirma la permanencia para activar los recordatorios automáticos.
                    </p>
                </div>
                <span className="ml-auto text-sm font-bold text-amber-800 dark:text-amber-300">{visibleItems.length}</span>
            </div>
            <div className="divide-y divide-amber-200/70 dark:divide-amber-900/50">
                {visibleItems.slice(0, 5).map(item => {
                    const value = values[item.contractId] ?? { status: 'known' as const, endDate: '' };
                    const busy = isPending && pendingId === item.contractId;
                    return (
                    <div
                        key={item.contractId}
                        className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_150px_170px_auto] lg:items-end"
                    >
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.clientName}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300">
                                {item.supplyLabel} · {item.marketerName}{item.tariffName ? ` · ${item.tariffName}` : ''}
                            </p>
                            {showOwner && <p className="mt-0.5 text-xs text-slate-500">Responsable: {item.ownerName}</p>}
                        </div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            Permanencia
                            <select
                                value={value.status}
                                onChange={event => updateValue(item.contractId, { status: event.target.value as 'known' | 'none' })}
                                className="mt-1 h-9 w-full rounded-md border border-amber-300 bg-white px-2 text-sm dark:border-amber-800 dark:bg-slate-900"
                            >
                                <option value="known">Con fecha</option>
                                <option value="none">Sin permanencia</option>
                            </select>
                        </label>
                        {value.status === 'known' ? (
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                Fecha de vencimiento
                                <input
                                    type="date"
                                    value={value.endDate}
                                    onChange={event => updateValue(item.contractId, { endDate: event.target.value })}
                                    className="mt-1 h-9 w-full rounded-md border border-amber-300 bg-white px-2 text-sm dark:border-amber-800 dark:bg-slate-900"
                                />
                            </label>
                        ) : <div />}
                        <button
                            type="button"
                            disabled={busy || (value.status === 'known' && !value.endDate)}
                            onClick={() => save(item.contractId)}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-amber-700 px-3 text-xs font-bold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Check aria-hidden="true" size={14} />
                            {busy ? 'Guardando…' : 'Guardar'}
                        </button>
                    </div>
                )})}
            </div>
        </section>
    );
}
