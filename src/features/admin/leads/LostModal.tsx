'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { markLeadLostAction, type InvoiceRegistryRow } from '@/app/actions/invoices';
import { useEscapeKey } from '@/features/invoices/components/invoiceParts';

export function LostModal({
    invoice,
    onClose,
    onLost,
}: {
    invoice: InvoiceRegistryRow;
    onClose: () => void;
    onLost: (reason: string | null) => void;
}) {
    const [reason, setReason] = useState(invoice.lost_reason ?? '');
    const [saving, setSaving] = useState(false);
    useEscapeKey(onClose);
    const titleId = 'lost-lead-title';
    const descriptionId = 'lost-lead-description';

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        try {
            setSaving(true);
            const normalizedReason = reason.trim() ? reason.trim().slice(0, 300) : null;
            const res = await markLeadLostAction(invoice.job_id, normalizedReason);
            if (!res.success) {
                toast.error('No se pudo marcar como perdido');
                return;
            }
            toast.success(invoice.lost ? 'Motivo actualizado' : 'Lead marcado como perdido');
            onLost(normalizedReason);
            onClose();
        } catch {
            toast.error('No se pudo marcar como perdido');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4" onClick={onClose}>
            <motion.form
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={(e) => e.stopPropagation()}
                onSubmit={submit}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-xl space-y-4"
            >
                <h2 id={titleId} className="text-lg font-bold text-slate-900">
                    {invoice.lost ? 'Editar motivo de pérdida' : 'Marcar lead como perdido'}
                </h2>
                <p id={descriptionId} className="text-[13px] text-slate-500">
                    {invoice.titular || 'Lead'} — no aceptó la oferta. Puedes anotar el motivo (opcional).
                </p>
                <label className="block">
                    <span className="sr-only">Motivo de pérdida</span>
                    <textarea
                        name="lostReason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        placeholder="Motivo (opcional): precio, no contesta…"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 focus:border-rose-400 focus:ring-1 focus:ring-rose-400 outline-none"
                    />
                </label>
                <div className="flex gap-2">
                    <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                        Cancelar
                    </button>
                    <button type="submit" disabled={saving} className="flex-1 py-3 rounded-2xl bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50">
                        {saving ? 'Guardando…' : 'Marcar perdido'}
                    </button>
                </div>
            </motion.form>
        </div>
    );
}
