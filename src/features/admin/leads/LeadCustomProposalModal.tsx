'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, FileText, X } from 'lucide-react';
import type { InvoiceRegistryRow, LeadProposalSummary } from '@/app/actions/invoices';
import { createCustomLeadProposalAction } from '@/app/actions/proposals';

interface LeadCustomProposalModalProps {
    lead: InvoiceRegistryRow;
    onClose: () => void;
    onCreated: (proposal: LeadProposalSummary) => void;
}

function parseAmount(raw: string | number | null): number {
    if (raw === null || raw === '') return 0;
    const n = Number(String(raw).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
}

function estimateAnnualCost(lead: InvoiceRegistryRow): number {
    const amount = parseAmount(lead.importe_total);
    const days = parseAmount(lead.period_days) || 30;
    return amount > 0 && days > 0 ? Math.round((amount / days) * 365) : 0;
}

function formatMoney(value: number) {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
    }).format(value);
}

export default function LeadCustomProposalModal({ lead, onClose, onCreated }: LeadCustomProposalModalProps) {
    const defaultCurrent = estimateAnnualCost(lead);
    const [marketerName, setMarketerName] = useState('');
    const [tariffName, setTariffName] = useState('');
    const [currentAnnualCost, setCurrentAnnualCost] = useState(defaultCurrent ? String(defaultCurrent) : '');
    const [offerAnnualCost, setOfferAnnualCost] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const inputClass = 'w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-energy-500 focus:ring-1 focus:ring-energy-500';

    const metrics = useMemo(() => {
        const current = parseAmount(currentAnnualCost);
        const offer = parseAmount(offerAnnualCost);
        const savings = Math.max(0, current - offer);
        const pct = current > 0 ? Math.round((savings / current) * 100) : 0;
        return { current, offer, savings, pct };
    }, [currentAnnualCost, offerAnnualCost]);

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        try {
            setSaving(true);
            const proposal = await createCustomLeadProposalAction(lead.job_id, {
                marketerName,
                tariffName,
                currentAnnualCost,
                offerAnnualCost,
                notes,
            });
            toast.success('Propuesta personalizada creada');
            onCreated(proposal);
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'No se pudo crear la propuesta');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
            <form
                onSubmit={submit}
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Crear propuesta personalizada"
                className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            >
                <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                            <FileText size={18} />
                        </span>
                        <div>
                            <h2 className="text-lg font-black text-slate-950">Propuesta personalizada</h2>
                            <p className="text-[13px] text-slate-500">
                                Se guardará como borrador y se notificará al comercial.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Cerrar"
                    >
                        <X size={19} />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                    <div className="mb-5 grid grid-cols-3 gap-2">
                        <Metric label="Coste actual" value={formatMoney(metrics.current)} muted />
                        <Metric label="Nueva oferta" value={formatMoney(metrics.offer)} />
                        <Metric label="Ahorro" value={`${formatMoney(metrics.savings)} · ${metrics.pct}%`} positive />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Comercializadora" required>
                            <input
                                required
                                value={marketerName}
                                onChange={(event) => setMarketerName(event.target.value)}
                                className={inputClass}
                                placeholder="Ej: Naturgy"
                            />
                        </Field>
                        <Field label="Tarifa" required>
                            <input
                                required
                                value={tariffName}
                                onChange={(event) => setTariffName(event.target.value)}
                                className={inputClass}
                                placeholder="Ej: Plan Empresas"
                            />
                        </Field>
                        <Field label="Coste actual anual" required>
                            <input
                                required
                                inputMode="decimal"
                                value={currentAnnualCost}
                                onChange={(event) => setCurrentAnnualCost(event.target.value)}
                                className={inputClass}
                            />
                        </Field>
                        <Field label="Nuevo coste anual" required>
                            <input
                                required
                                inputMode="decimal"
                                value={offerAnnualCost}
                                onChange={(event) => setOfferAnnualCost(event.target.value)}
                                className={inputClass}
                            />
                        </Field>
                    </div>

                    <label className="mt-4 block">
                        <span className="mb-1.5 block text-[11px] font-black uppercase tracking-widest text-slate-500">
                            Notas para el comercial
                        </span>
                        <textarea
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            rows={4}
                            maxLength={1200}
                            placeholder="Argumento comercial, condiciones, próximos pasos..."
                            className="w-full resize-none rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-energy-500 focus:ring-1 focus:ring-energy-500"
                        />
                        <span className="mt-1 block text-right text-[11px] text-slate-400">{notes.length}/1200</span>
                    </label>
                </div>

                <footer className="flex gap-2 border-t border-slate-100 p-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {saving ? 'Creando...' : 'Crear propuesta'} {!saving && <Check size={16} />}
                    </button>
                </footer>
            </form>
        </div>
    );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-[11px] font-black uppercase tracking-widest text-slate-500">
                {label}{required ? ' *' : ''}
            </span>
            {children}
        </label>
    );
}

function Metric({ label, value, muted, positive }: { label: string; value: string; muted?: boolean; positive?: boolean }) {
    return (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className={`mt-1 text-sm font-black tabular-nums ${positive ? 'text-emerald-700' : muted ? 'text-slate-500 line-through' : 'text-slate-950'}`}>
                {value}
            </p>
        </div>
    );
}
