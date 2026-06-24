'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ExternalLink, CheckCircle2, Clock3, X, Euro, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { closeInvoiceAction, type InvoiceProcessStatus, type InvoiceRegistryRow } from '@/app/actions/invoices';

/** Closes a dialog/overlay when Escape is pressed. */
export function useEscapeKey(onEscape: () => void) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onEscape();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onEscape]);
}

// ── Format helpers ───────────────────────────────────────────────────────────

export function formatEur(raw: string | number | null): string | null {
    if (raw === null || raw === '') return null;
    const n = Number(String(raw).replace(',', '.'));
    if (Number.isNaN(n)) return typeof raw === 'string' ? raw : null;
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
}

export function formatDate(raw: string | null): string {
    if (!raw) return '';
    return new Date(raw).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Badges ───────────────────────────────────────────────────────────────────

const PROCESS_META: Record<InvoiceProcessStatus, { label: string; className: string }> = {
    uploaded:    { label: 'Subida',     className: 'bg-slate-100 text-slate-600' },
    ocr_done:    { label: 'OCR listo',  className: 'bg-blue-50 text-blue-700' },
    compared:    { label: 'Comparada',  className: 'bg-violet-50 text-violet-700' },
    closed_won:  { label: 'Cerrada',    className: 'bg-emerald-50 text-emerald-700' },
    closed_lost: { label: 'No cerrada', className: 'bg-rose-50 text-rose-700' },
    failed:      { label: 'Error OCR',  className: 'bg-red-50 text-red-700' },
};

export function ProcessBadge({ status }: { status: InvoiceProcessStatus }) {
    const meta = PROCESS_META[status] ?? PROCESS_META.uploaded;
    return (
        <span className={cn('px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide uppercase', meta.className)}>
            {meta.label}
        </span>
    );
}

/** Primary lifecycle pill: LEAD → CLIENTE (admin confirma) o PERDIDO (no aceptó). */
export function LeadStatusBadge({ closed, lost }: { closed: boolean; lost: boolean }) {
    if (closed) {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold tracking-wide uppercase bg-emerald-600 text-white">
                <CheckCircle2 size={12} /> Cliente
            </span>
        );
    }
    if (lost) {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold tracking-wide uppercase bg-rose-100 text-rose-700 ring-1 ring-rose-200">
                <XCircle size={12} /> Perdido
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold tracking-wide uppercase bg-sky-100 text-sky-700 ring-1 ring-sky-200">
            Lead
        </span>
    );
}

export function DriveChip({ link, synced }: { link: string | null; synced: boolean }) {
    if (synced && link) {
        return (
            <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md transition-colors"
            >
                <CheckCircle2 size={12} /> En Drive <ExternalLink size={11} className="opacity-70" />
            </a>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
            <Clock3 size={12} /> Pendiente Drive
        </span>
    );
}

export function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
            <p className="text-slate-800 truncate">{value}</p>
        </div>
    );
}

// ── Close modal (convertir lead → cliente) ───────────────────────────────────

export function CloseInvoiceModal({
    invoice,
    onClose,
    onClosed,
}: {
    invoice: InvoiceRegistryRow;
    onClose: () => void;
    onClosed: (patch: Partial<InvoiceRegistryRow>) => void;
}) {
    const [company, setCompany] = useState(invoice.comercializadora_actual ?? '');
    const [tariff, setTariff] = useState(invoice.tarifa_actual ?? '');
    const [hasPermanence, setHasPermanence] = useState(false);
    const [permanenceUntil, setPermanenceUntil] = useState('');
    const [commission, setCommission] = useState('');
    const [saving, setSaving] = useState(false);
    useEscapeKey(onClose);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!company.trim()) {
            toast.error('Indica la compañía contratada');
            return;
        }
        setSaving(true);
        const res = await closeInvoiceAction(invoice.job_id, {
            company: company.trim(),
            tariff: tariff.trim() || null,
            permanenceUntil: hasPermanence && permanenceUntil ? permanenceUntil : null,
            commission: commission === '' ? 0 : Number(commission),
        });
        setSaving(false);
        if (!res.success) {
            toast.error(res.message ?? 'No se pudo convertir');
            return;
        }
        toast.success('Lead convertido en cliente');
        onClosed({
            closed: true,
            lost: false,
            process_status: 'closed_won',
            compania_contratada: company.trim(),
            tarifa_contratada: tariff.trim() || null,
            permanencia_hasta: hasPermanence && permanenceUntil ? permanenceUntil : null,
            commission_amount: commission === '' ? 0 : Number(commission),
            closed_at: new Date().toISOString(),
        });
        onClose();
    }

    const inputCls =
        'mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 focus:border-energy-500 focus:ring-1 focus:ring-energy-500 outline-none';

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4" onClick={onClose}>
            <motion.form
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={(e) => e.stopPropagation()}
                onSubmit={submit}
                role="dialog"
                aria-modal="true"
                aria-label="Convertir lead en cliente"
                className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-xl space-y-4"
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Convertir lead en cliente</h2>
                        <p className="text-[12px] text-slate-500">Confirma que el lead aceptó la oferta.</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar">
                        <X size={20} />
                    </button>
                </div>

                <label className="block">
                    <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Compañía contratada *</span>
                    <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Ej. Endesa, Iberdrola…" className={inputCls} autoFocus />
                </label>

                <label className="block">
                    <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Tarifa</span>
                    <input value={tariff} onChange={(e) => setTariff(e.target.value)} placeholder="Ej. 2.0TD" className={inputCls} />
                </label>

                <div className="rounded-xl bg-slate-50 p-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={hasPermanence} onChange={(e) => setHasPermanence(e.target.checked)} className="h-4 w-4 rounded accent-energy-500" />
                        <span className="text-sm font-medium text-slate-700">Tiene permanencia</span>
                    </label>
                    {hasPermanence && (
                        <label className="block mt-2">
                            <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Revisar el</span>
                            <input type="date" value={permanenceUntil} onChange={(e) => setPermanenceUntil(e.target.value)} className={inputCls} />
                        </label>
                    )}
                </div>

                <label className="block">
                    <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Comisión del comercial (€)</span>
                    <div className="mt-1 relative">
                        <Euro size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="number" min="0" step="0.01" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="0,00" className={cn(inputCls, 'mt-0 pl-9')} />
                    </div>
                </label>

                <button type="submit" disabled={saving} className="w-full py-3 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50">
                    {saving ? 'Guardando…' : 'Confirmar cliente'}
                </button>
            </motion.form>
        </div>
    );
}
