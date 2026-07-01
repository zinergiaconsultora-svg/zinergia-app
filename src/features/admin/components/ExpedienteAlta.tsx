'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    CheckCircle2,
    Copy,
    Check,
    AlertTriangle,
    Clock,
    XCircle,
    ShieldCheck,
    Zap,
    FileSignature,
    CreditCard,
    RotateCcw,
    History,
} from 'lucide-react';
import { toast } from 'sonner';
import { validateCUPS, validateIBAN, validateNIF } from '@/lib/validation/alta';
import { businessDaysSince } from '@/lib/utils/businessDays';
import {
    confirmConsent,
    requestAlta,
    completeAlta,
    rejectAlta,
    reopenAlta,
    getAltaEvents,
} from '@/app/actions/alta';
import type { AltaExpediente, RejectionReason, AltaEvent } from '@/app/actions/alta';

// ─── Static style maps (no dynamic Tailwind classes — JIT-safe) ───────────────

const REJECTION_LABELS: Record<RejectionReason, string> = {
    cups_invalido: 'CUPS inválido',
    titular_no_coincide: 'Titular no coincide',
    deuda_pendiente: 'Deuda pendiente',
    baja_no_resuelta: 'Baja no resuelta',
    switch_pendiente: 'Cambio pendiente',
    otro: 'Otro motivo',
};

const STATUS_BAR: Record<string, { label: string; box: string; text: string }> = {
    pendiente_consent: { label: 'Pendiente consentimiento', box: 'bg-amber-50 border-amber-100', text: 'text-amber-700' },
    lista_admin: { label: 'Lista para solicitar', box: 'bg-indigo-50 border-indigo-100', text: 'text-indigo-700' },
    en_alta: { label: 'Alta solicitada — SLA activo', box: 'bg-blue-50 border-blue-100', text: 'text-blue-700' },
    activada: { label: 'Activada', box: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700' },
    rechazada: { label: 'Rechazada', box: 'bg-rose-50 border-rose-100', text: 'text-rose-700' },
};

const EVENT_LABELS: Record<AltaEvent['eventType'], string> = {
    consent_confirmed: 'Consentimiento confirmado',
    alta_requested: 'Alta solicitada',
    alta_completed: 'Activada',
    alta_rejected: 'Rechazada',
    alta_reopened: 'Reabierta',
};

// ─── ValidatedField: copy-to-clipboard with inline validation indicator ───────

interface ValidatedFieldProps {
    label: string;
    value: string | null | undefined;
    validate?: (v: string) => { valid: boolean; error?: string };
    mono?: boolean;
}

function ValidatedField({ label, value, validate, mono }: ValidatedFieldProps) {
    const [copied, setCopied] = useState(false);

    const isEmpty = !value?.trim();
    const result = !isEmpty && validate ? validate(value!) : null;
    const isValid = result?.valid ?? null;

    function copy() {
        if (!value) return;
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        });
    }

    const borderClass = isEmpty
        ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
        : isValid === false
            ? 'border-rose-200 bg-rose-50/50 hover:bg-rose-50 cursor-pointer'
            : 'border-slate-200 bg-white hover:bg-slate-50 cursor-pointer';

    return (
        <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
                {isValid === true && (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-1 py-px">
                        <CheckCircle2 size={9} /> OK
                    </span>
                )}
                {isValid === false && (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded px-1 py-px">
                        <AlertTriangle size={9} /> {result!.error}
                    </span>
                )}
            </div>
            <button
                type="button"
                onClick={copy}
                disabled={isEmpty}
                className={`group flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-all ${borderClass}`}
                title={isEmpty ? 'Sin datos' : 'Copiar al portapapeles'}
            >
                <span className={`text-sm truncate ${mono ? 'font-mono' : 'font-medium'} text-slate-700`}>
                    {isEmpty ? '—' : value}
                </span>
                <span className="shrink-0 text-slate-300 group-hover:text-slate-500 transition-colors">
                    {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </span>
            </button>
        </div>
    );
}

// ─── SLA Clock ────────────────────────────────────────────────────────────────

const SLA_STYLES = {
    rose: { icon: 'text-rose-500', text: 'text-rose-600', bar: 'bg-rose-500' },
    amber: { icon: 'text-amber-500', text: 'text-amber-600', bar: 'bg-amber-500' },
    emerald: { icon: 'text-emerald-500', text: 'text-emerald-600', bar: 'bg-emerald-500' },
} as const;

function SLAClock({ requestedAt }: { requestedAt: string }) {
    const elapsed = businessDaysSince(requestedAt);
    const remaining = Math.max(0, 10 - elapsed);
    const pct = Math.min(1, elapsed / 10);
    const tone: keyof typeof SLA_STYLES = remaining <= 2 ? 'rose' : remaining <= 5 ? 'amber' : 'emerald';
    const s = SLA_STYLES[tone];

    return (
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 flex items-center gap-4">
            <Clock size={18} className={`shrink-0 ${s.icon}`} />
            <div className="flex-1">
                <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-600">SLA legal (10 días hábiles)</span>
                    <span className={`text-xs font-black ${s.text}`}>
                        {remaining === 0 ? '⚠ Vencido' : `${remaining}d restantes`}
                    </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className={`h-full rounded-full ${s.bar} transition-all duration-700`} style={{ width: `${pct * 100}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                    Solicitada: {new Date(requestedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    &nbsp;· {elapsed}d hábiles transcurridos
                </p>
            </div>
        </div>
    );
}

// ─── Rejection Modal ──────────────────────────────────────────────────────────

interface RejectModalProps {
    proposalId: string;
    onClose: () => void;
    onRejected: () => void;
}

function RejectModal({ proposalId, onClose, onRejected }: RejectModalProps) {
    const [reason, setReason] = useState<RejectionReason>('otro');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const titleId = 'reject-alta-title';
    const reasonId = 'reject-alta-reason';
    const noteId = 'reject-alta-note';

    async function submit() {
        setLoading(true);
        const res = await rejectAlta({ proposalId, reason, note: note.trim() || undefined });
        setLoading(false);
        if (!res.ok) {
            toast.error(res.error ?? 'Error al rechazar');
            return;
        }
        toast.success('Alta marcada como rechazada');
        onRejected();
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        >
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-rose-100 p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                    <XCircle size={18} className="text-rose-500 shrink-0" />
                    <h3 id={titleId} className="text-sm font-bold text-slate-800">Rechazar alta</h3>
                </div>

                <div className="flex flex-col gap-1">
                    <label htmlFor={reasonId} className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Motivo</label>
                    <select
                        id={reasonId}
                        value={reason}
                        onChange={e => setReason(e.target.value as RejectionReason)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-300"
                    >
                        {(Object.entries(REJECTION_LABELS) as [RejectionReason, string][]).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-1">
                    <label htmlFor={noteId} className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nota (opcional)</label>
                    <textarea
                        id={noteId}
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        maxLength={500}
                        rows={3}
                        placeholder="Detalle adicional..."
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                </div>

                <div className="flex gap-2 justify-end pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-60 transition-colors"
                    >
                        {loading ? 'Guardando…' : 'Confirmar rechazo'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ExpedienteAltaProps {
    expediente: AltaExpediente;
    onRefresh: () => void;
}

function fmtEUR(n: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
}

function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ExpedienteAlta({ expediente, onRefresh }: ExpedienteAltaProps) {
    const [loading, setLoading] = useState<string | null>(null);
    const [showReject, setShowReject] = useState(false);
    const [sepaChecked, setSepaChecked] = useState(!!expediente.sepaConfirmedAt);
    const [events, setEvents] = useState<AltaEvent[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    const refreshEvents = useCallback(async () => {
        try {
            setEvents(await getAltaEvents(expediente.id));
        } catch {
            setEvents([]);
        }
    }, [expediente.id]);

    useEffect(() => {
        let cancelled = false;

        getAltaEvents(expediente.id)
            .then(nextEvents => {
                if (!cancelled) setEvents(nextEvents);
            })
            .catch(() => {
                if (!cancelled) setEvents([]);
            });

        return () => {
            cancelled = true;
        };
    }, [expediente.id, expediente.altaStatus]);

    const run = useCallback(async (action: () => Promise<{ ok: boolean; error?: string }>, label: string) => {
        setLoading(label);
        const res = await action();
        setLoading(null);
        if (!res.ok) {
            toast.error(res.error ?? 'Error');
        } else {
            await refreshEvents();
            onRefresh();
        }
    }, [onRefresh, refreshEvents]);

    const status = expediente.altaStatus;
    const statusMeta = status ? STATUS_BAR[status] : null;

    const cups = (expediente.calculationData?.cups as string)
        || (expediente.calculationData?.CUPS as string)
        || '';
    const tariff = (expediente.calculationData?.tariff_name as string)
        || (expediente.offerSnapshot?.tariff_name as string)
        || '';
    const marketer = (expediente.offerSnapshot?.marketer_name as string) ?? '';
    const potencia = (expediente.calculationData?.potencia_p1 as string)
        || (expediente.calculationData?.contracted_power as string)
        || '';

    const cupsValidation = cups ? validateCUPS(cups) : null;
    const ibanValidation = expediente.clientIban ? validateIBAN(expediente.clientIban) : null;
    const nifValidation = expediente.clientNif ? validateNIF(expediente.clientNif) : null;

    const canConfirmConsent = status === 'pendiente_consent';
    const canRequestAlta = status === 'lista_admin';
    const canComplete = status === 'en_alta';
    const isRejected = status === 'rechazada';
    const isTerminal = status === 'activada' || status === 'rechazada';

    return (
        <>
            {showReject && (
                <RejectModal
                    proposalId={expediente.id}
                    onClose={() => setShowReject(false)}
                    onRejected={() => {
                        setShowReject(false);
                        void refreshEvents();
                        onRefresh();
                    }}
                />
            )}

            <div className="flex flex-col gap-5">

                {/* Status bar */}
                {statusMeta && (
                    <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${statusMeta.box}`}>
                        <div className="flex items-center gap-2">
                            {status === 'activada' && <CheckCircle2 size={16} className="text-emerald-500" />}
                            {status === 'rechazada' && <XCircle size={16} className="text-rose-500" />}
                            {status === 'en_alta' && <Clock size={16} className="text-blue-500 animate-pulse" />}
                            {(status === 'lista_admin' || status === 'pendiente_consent') && <Zap size={16} className="text-indigo-500" />}
                            <span className={`text-sm font-bold ${statusMeta.text}`}>{statusMeta.label}</span>
                        </div>
                        {!isTerminal && (
                            <button
                                type="button"
                                onClick={() => setShowReject(true)}
                                className="text-[11px] font-medium text-rose-400 hover:text-rose-600 transition-colors"
                            >
                                Rechazar alta
                            </button>
                        )}
                    </div>
                )}

                {/* SLA clock — only when en_alta */}
                {status === 'en_alta' && expediente.altaRequestedAt && (
                    <SLAClock requestedAt={expediente.altaRequestedAt} />
                )}

                {/* Rejection detail + reopen (#4 rebote loop) */}
                {isRejected && (
                    <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 flex flex-col gap-3">
                        <div className="text-sm text-rose-700">
                            <span className="font-bold">Motivo: </span>
                            {expediente.altaRejectionReason ? REJECTION_LABELS[expediente.altaRejectionReason] : '—'}
                            {expediente.altaRejectionNote && (
                                <p className="text-xs text-rose-500 mt-1">{expediente.altaRejectionNote}</p>
                            )}
                        </div>
                        <button
                            type="button"
                            disabled={!!loading}
                            onClick={() => run(() => reopenAlta(expediente.id), 'reopen')}
                            className="self-start flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-rose-200 text-rose-700 text-sm font-bold hover:bg-rose-100 disabled:opacity-60 transition-colors"
                        >
                            <RotateCcw size={14} />
                            {loading === 'reopen' ? 'Reabriendo…' : 'Reabrir y corregir'}
                        </button>
                    </div>
                )}

                {/* ── Datos del titular ── */}
                <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Datos del titular</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <ValidatedField label="Nombre / Razón social" value={expediente.clientName} />
                        <ValidatedField label="NIF / DNI / CIF" value={expediente.clientNif} validate={validateNIF} mono />
                        <ValidatedField label="IBAN" value={expediente.clientIban} validate={validateIBAN} mono />
                        <ValidatedField label="Comercial responsable" value={expediente.agentName} />
                    </div>
                </div>

                {/* ── Datos del suministro ── */}
                <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Datos del suministro</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <ValidatedField label="CUPS" value={cups} validate={validateCUPS} mono />
                        <ValidatedField label="Tarifa / Peaje" value={tariff} />
                        <ValidatedField label="Potencia contratada" value={potencia} />
                        <ValidatedField label="Comercializadora destino" value={marketer} />
                    </div>
                </div>

                {/* ── Financiero ── */}
                <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100">
                    <div className="text-center">
                        <span className="text-lg font-black text-emerald-700">{fmtEUR(expediente.annualSavings)}</span>
                        <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">ahorro/año</p>
                    </div>
                    <div className="w-px h-8 bg-emerald-200" />
                    <div className="text-center">
                        <span className="text-lg font-black text-slate-700">{fmtEUR(expediente.offerAnnualCost)}</span>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">nuevo coste/año</p>
                    </div>
                </div>

                {/* ── Gate 1: Consentimiento ── */}
                {canConfirmConsent && (
                    <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <FileSignature size={16} className="text-amber-600 shrink-0" />
                            <span className="text-sm font-bold text-amber-800">Confirmar consentimiento del cliente</span>
                        </div>
                        <p className="text-xs text-amber-700">
                            Antes de solicitar el alta necesitas tener el <strong>contrato firmado</strong> y el <strong>mandato SEPA</strong>.
                            Sin estos documentos el proceso no puede continuar.
                        </p>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                className="w-4 h-4 accent-amber-600 cursor-pointer"
                                checked={sepaChecked}
                                onChange={e => setSepaChecked(e.target.checked)}
                            />
                            <span className="text-xs font-medium text-amber-800">
                                <CreditCard size={12} className="inline mr-1" />
                                Mandato SEPA recibido y validado
                            </span>
                        </label>
                        <button
                            type="button"
                            disabled={!!loading}
                            onClick={() => run(() => confirmConsent(expediente.id, sepaChecked), 'consent')}
                            className="self-start flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-60 transition-colors"
                        >
                            <ShieldCheck size={15} />
                            {loading === 'consent' ? 'Confirmando…' : 'Confirmar consentimiento'}
                        </button>
                    </div>
                )}

                {/* Consent confirmed badge */}
                {expediente.consentConfirmedAt && !isRejected && (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                        <ShieldCheck size={13} className="shrink-0" />
                        Consentimiento confirmado el {fmtDate(expediente.consentConfirmedAt)}
                        {expediente.sepaConfirmedAt && ' · SEPA validado'}
                    </div>
                )}

                {/* ── Gate 2: Solicitar alta ── */}
                {canRequestAlta && (
                    <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/50 p-4 flex flex-col gap-2">
                        <p className="text-xs text-indigo-700 font-medium">
                            Copia los datos de arriba en el portal de la distribuidora y pulsa el botón para activar el SLA de 10 días hábiles.
                        </p>
                        {(cupsValidation?.valid === false || ibanValidation?.valid === false || nifValidation?.valid === false) && (
                            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                                <span>Revisa los campos marcados en rojo antes de enviar al distribuidor.</span>
                            </div>
                        )}
                        <button
                            type="button"
                            disabled={!!loading}
                            onClick={() => run(() => requestAlta(expediente.id), 'alta')}
                            className="self-start flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-md shadow-indigo-200"
                        >
                            <Zap size={15} />
                            {loading === 'alta' ? 'Procesando…' : 'Marcar alta solicitada → Iniciar SLA'}
                        </button>
                    </div>
                )}

                {/* ── Gate 3: Confirmar activación ── */}
                {canComplete && (
                    <button
                        type="button"
                        disabled={!!loading}
                        onClick={() => run(() => completeAlta(expediente.id), 'complete')}
                        className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 transition-colors shadow-md shadow-emerald-200 w-full"
                    >
                        <CheckCircle2 size={16} />
                        {loading === 'complete' ? 'Guardando…' : 'Confirmar activación por distribuidor'}
                    </button>
                )}

                {/* Activated */}
                {status === 'activada' && expediente.altaCompletadaAt && (
                    <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                        <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-emerald-800">Cliente activado</p>
                            <p className="text-xs text-emerald-600">{fmtDate(expediente.altaCompletadaAt)}</p>
                        </div>
                    </div>
                )}

                {/* ── Traza de auditoría (#8) ── */}
                {events.length > 0 && (
                    <div className="border-t border-slate-100 pt-3">
                        <button
                            type="button"
                            onClick={() => setShowHistory(v => !v)}
                            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <History size={12} />
                            Historial ({events.length})
                        </button>
                        {showHistory && (
                            <ul className="mt-2 space-y-1.5">
                                {events.map(ev => (
                                    <li key={ev.id} className="flex items-start gap-2 text-xs text-slate-500">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                                        <span>
                                            <span className="font-semibold text-slate-700">{EVENT_LABELS[ev.eventType]}</span>
                                            {ev.detail && <span className="text-slate-400"> — {ev.detail}</span>}
                                            <span className="text-slate-300 block">
                                                {new Date(ev.createdAt).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
