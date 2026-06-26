'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAltaPendingQueue, type AltaExpediente } from '@/app/actions/alta';
import { businessDaysSince } from '@/lib/utils/businessDays';
import { CheckCircle2, Clock, Zap, AlertTriangle, RefreshCw, ChevronRight, XCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import dynamic from 'next/dynamic';

const ExpedienteAlta = dynamic(() => import('./ExpedienteAlta'), { ssr: false });

// Static style maps — no runtime-interpolated Tailwind classes (JIT-safe)
const STATUS_CONFIG: Record<string, { icon: React.ElementType; dot: string; badge: string; label: string }> = {
    pendiente_consent: { icon: AlertTriangle, dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Sin consentimiento' },
    lista_admin: { icon: Zap, dot: 'bg-indigo-500', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', label: 'Lista para alta' },
    en_alta: { icon: Clock, dot: 'bg-blue-500 animate-pulse', badge: 'bg-blue-50 text-blue-700 border-blue-200', label: 'En trámite' },
    rechazada: { icon: XCircle, dot: 'bg-rose-400', badge: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Rechazada' },
};

export default function AltaPendingPanel() {
    const [items, setItems] = useState<AltaExpediente[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getAltaPendingQueue();
            setItems(data);
            // `selected` is derived from items via find(), so an item that leaves
            // the queue (e.g. activated) makes the drawer close on its own.
        } catch {
            // silent — panel is non-critical
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    if (loading && items.length === 0) {
        return (
            <div className="space-y-2">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-slate-100/80 dark:bg-slate-700/30 rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50/60 border border-emerald-100 px-4 py-3.5">
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                <div>
                    <p className="text-sm font-semibold text-slate-700">Sin expedientes pendientes</p>
                    <p className="text-xs text-slate-400">Todas las altas están completadas o no hay propuestas aceptadas aún.</p>
                </div>
            </div>
        );
    }

    // selected is always derived from the freshest items list (#6: no stale state)
    const selected = selectedId ? items.find(i => i.id === selectedId) ?? null : null;

    const enAlta = items.filter(i => i.altaStatus === 'en_alta');
    const listas = items.filter(i => i.altaStatus === 'lista_admin');
    const sinConsent = items.filter(i => i.altaStatus === 'pendiente_consent');
    const rechazadas = items.filter(i => i.altaStatus === 'rechazada');

    return (
        <div className="flex flex-col gap-3">
            {/* Summary strip */}
            <div className="flex items-center gap-4 flex-wrap">
                {enAlta.length > 0 && (
                    <div className="flex items-center gap-1.5">
                        <Clock size={13} className="text-blue-500" />
                        <span className="text-sm font-black text-blue-600">{enAlta.length}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">en trámite</span>
                    </div>
                )}
                {listas.length > 0 && (
                    <div className="flex items-center gap-1.5">
                        <Zap size={13} className="text-indigo-500" />
                        <span className="text-sm font-black text-indigo-600">{listas.length}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">listas</span>
                    </div>
                )}
                {sinConsent.length > 0 && (
                    <div className="flex items-center gap-1.5">
                        <AlertTriangle size={13} className="text-amber-500" />
                        <span className="text-sm font-black text-amber-600">{sinConsent.length}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">sin consentimiento</span>
                    </div>
                )}
                {rechazadas.length > 0 && (
                    <div className="flex items-center gap-1.5">
                        <XCircle size={13} className="text-rose-500" />
                        <span className="text-sm font-black text-rose-600">{rechazadas.length}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">rechazadas</span>
                    </div>
                )}
                <button
                    type="button"
                    onClick={load}
                    className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    title="Actualizar"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Expediente drawer */}
            {selected && (
                <div className="rounded-2xl border-2 border-indigo-100 bg-white p-4 shadow-md">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-sm font-bold text-slate-800">{selected.clientName}</p>
                            <p className="text-[11px] text-slate-400">{selected.agentName ?? 'Sin comercial'}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedId(null)}
                            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            Cerrar
                        </button>
                    </div>
                    <ExpedienteAlta expediente={selected} onRefresh={load} />
                </div>
            )}

            {/* List */}
            <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-0.5">
                {items.map(item => {
                    const cfg = STATUS_CONFIG[item.altaStatus ?? ''];
                    const isSelected = selectedId === item.id;
                    const slaDays = item.altaStatus === 'en_alta' && item.altaRequestedAt
                        ? businessDaysSince(item.altaRequestedAt)
                        : null;
                    const slaOverdue = slaDays !== null && slaDays > 10;

                    const rowClass = isSelected
                        ? 'border-indigo-300 bg-indigo-50'
                        : slaOverdue
                            ? 'border-rose-200 hover:border-rose-400 bg-rose-50/30'
                            : 'border-slate-100 hover:border-slate-300 bg-white dark:bg-slate-800/50';

                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedId(isSelected ? null : item.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all group ${rowClass}`}
                        >
                            {cfg && <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />}

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                                        {item.clientName}
                                    </span>
                                    {cfg && (
                                        <span className={`text-[10px] font-bold px-1.5 py-px rounded border shrink-0 ${cfg.badge}`}>
                                            {cfg.label}
                                        </span>
                                    )}
                                    {slaOverdue && (
                                        <span className="text-[10px] font-bold text-rose-600 shrink-0">⚠ SLA vencido</span>
                                    )}
                                    {slaDays !== null && !slaOverdue && (
                                        <span className="text-[10px] text-blue-500 font-medium shrink-0">{10 - slaDays}d SLA</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    {item.agentName && (
                                        <span className="text-[11px] text-slate-400 truncate">{item.agentName}</span>
                                    )}
                                    {item.annualSavings > 0 && (
                                        <>
                                            <span className="text-[10px] text-slate-200 dark:text-slate-600">·</span>
                                            <span className="text-[11px] font-semibold text-emerald-600 shrink-0">
                                                {formatCurrency(item.annualSavings)}/año ahorrado
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <ChevronRight
                                size={14}
                                className={`shrink-0 transition-transform text-slate-300 group-hover:text-slate-500 ${isSelected ? 'rotate-90' : ''}`}
                            />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
