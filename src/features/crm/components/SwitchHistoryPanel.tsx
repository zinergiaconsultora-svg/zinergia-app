'use client';

import React, { useCallback, useState, useEffect } from 'react';
import type { SwitchEvent, SwitchReason } from '@/types/energy';
import { createSwitchEventAction, getSwitchEventsAction } from '@/app/actions/energy';
import { ArrowRight, TrendingDown, Building2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { toast } from 'sonner';

interface Props {
    clientId: string;
}

const REASON_LABELS: Record<string, string> = {
    mejor_precio: 'Mejor precio',
    mejor_servicio: 'Mejor servicio',
    fin_permanencia: 'Fin de permanencia',
    insatisfaccion: 'Insatisfacción',
    nuevo_punto: 'Nuevo punto',
    recomendacion: 'Recomendación',
};

export default function SwitchHistoryPanel({ clientId }: Props) {
    const [events, setEvents] = useState<SwitchEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    const loadEvents = useCallback(async () => {
        try {
            const data = await getSwitchEventsAction(clientId);
            setEvents(data);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'No se pudo cargar el historial');
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        loadEvents();
    }, [loadEvents]);

    const totalSavings = events.reduce((sum, e) => sum + (e.annual_savings || 0), 0);

    if (loading) return <div className="h-24 animate-pulse bg-slate-100 rounded-xl" />;

    return (
        <div className="space-y-3">
            {/* Summary */}
            {events.length > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Ahorro Total Generado</p>
                        <p className="text-lg font-black text-emerald-700">{formatCurrency(totalSavings)}/año</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-emerald-600 font-medium">{events.length} cambio{events.length !== 1 ? 's' : ''}</p>
                        <p className="text-[10px] text-emerald-500">de comercializadora</p>
                    </div>
                </div>
            )}

            {/* Timeline */}
            {events.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center">
                    <p className="text-xs text-slate-400">Sin cambios de comercializadora registrados</p>
                    <button
                        type="button"
                        onClick={() => setShowForm(true)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 mt-1"
                    >
                        Registrar primer cambio →
                    </button>
                </div>
            ) : (
                <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-[19px] top-2 bottom-2 w-px bg-slate-200" />

                    {events.map(event => (
                        <div key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                            {/* Dot */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 ${
                                event.annual_savings && event.annual_savings > 0
                                    ? 'bg-emerald-100 text-emerald-600'
                                    : 'bg-slate-100 text-slate-500'
                            }`}>
                                {event.annual_savings && event.annual_savings > 0
                                    ? <TrendingDown size={16} />
                                    : <Building2 size={16} />
                                }
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 pt-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-800">
                                        {event.previous_marketer || '???'}
                                    </span>
                                    <ArrowRight size={11} className="text-slate-400" />
                                    <span className="text-xs font-bold text-indigo-600">
                                        {event.new_marketer}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-slate-400">{formatDate(event.switch_date)}</span>
                                    {event.annual_savings && event.annual_savings > 0 && (
                                        <span className="text-[10px] font-bold text-emerald-600">
                                            +{formatCurrency(event.annual_savings)}/año ahorrado
                                        </span>
                                    )}
                                    {event.reason && (
                                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                            {REASON_LABELS[event.reason] || event.reason}
                                        </span>
                                    )}
                                </div>
                                {event.notes && (
                                    <p className="text-[10px] text-slate-400 mt-0.5 italic">{event.notes}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add button */}
            {events.length > 0 && !showForm && (
                <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                >
                    + Registrar cambio
                </button>
            )}

            {/* Inline form */}
            {showForm && <AddSwitchForm clientId={clientId} onClose={() => { setShowForm(false); loadEvents(); }} />}
        </div>
    );
}

function AddSwitchForm({ clientId, onClose }: { clientId: string; onClose: () => void }) {
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [savings, setSavings] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [reason, setReason] = useState('mejor_precio');
    const [saving, setSaving] = useState(false);

    async function save() {
        if (!to.trim()) return;
        setSaving(true);
        try {
            await createSwitchEventAction({
                clientId,
                switchDate: date,
                previousMarketer: from,
                newMarketer: to,
                annualSavings: savings ? parseFloat(savings) : null,
                reason: reason as SwitchReason,
            });
            toast.success('Cambio registrado');
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'No se pudo registrar el cambio');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex gap-2 items-center">
                <input type="text" value={from} onChange={e => setFrom(e.target.value)} placeholder="Comercializadora anterior" aria-label="Comercializadora anterior" className="flex-1 px-2 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 outline-none" />
                <ArrowRight size={12} className="text-slate-400 shrink-0" />
                <input type="text" value={to} onChange={e => setTo(e.target.value)} placeholder="Nueva comercializadora" aria-label="Nueva comercializadora" className="flex-1 px-2 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div className="flex gap-2">
                <input type="number" value={savings} onChange={e => setSavings(e.target.value)} placeholder="Ahorro €/año" aria-label="Ahorro anual en euros" className="w-28 px-2 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 outline-none" />
                <input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Fecha del cambio" className="px-2 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 outline-none" />
                <select value={reason} onChange={e => setReason(e.target.value)} aria-label="Motivo del cambio" className="flex-1 px-2 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 outline-none">
                    {Object.entries(REASON_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                    ))}
                </select>
            </div>
            <div className="flex gap-2">
                <button type="button" onClick={save} disabled={saving} className="flex-1 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button type="button" onClick={onClose} className="px-3 py-2 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-300">
                    Cancelar
                </button>
            </div>
        </div>
    );
}
