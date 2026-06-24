'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Check, X } from 'lucide-react';
import type { Client } from '@/types/crm';
import type { ClientInput } from '@/app/actions/clients';
import { updateLeadClientFromLeadAction } from '@/app/actions/clients';

interface LeadClientEditModalProps {
    jobId: string;
    client: Client;
    onClose: () => void;
    onSaved: (client: Client) => void;
}

type LeadClientForm = Pick<
    ClientInput,
    'name' | 'email' | 'phone' | 'address' | 'cups' | 'dni_cif' | 'current_supplier' | 'tariff_type'
>;

function initialForm(client: Client): LeadClientForm {
    return {
        name: client.name ?? '',
        email: client.email ?? '',
        phone: client.phone ?? '',
        address: client.address ?? '',
        cups: client.cups ?? '',
        dni_cif: client.dni_cif ?? '',
        current_supplier: client.current_supplier ?? '',
        tariff_type: client.tariff_type ?? '',
    };
}

export default function LeadClientEditModal({
    jobId,
    client,
    onClose,
    onSaved,
}: LeadClientEditModalProps) {
    const [form, setForm] = useState<LeadClientForm>(() => initialForm(client));
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputClass = 'w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-energy-500 focus:ring-1 focus:ring-energy-500';

    useEffect(() => {
        setForm(initialForm(client));
        setReason('');
        setError(null);
    }, [client]);

    function setField<K extends keyof LeadClientForm>(field: K, value: LeadClientForm[K]) {
        setForm((current) => ({ ...current, [field]: value }));
        setError(null);
    }

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        if (!reason.trim()) {
            setError('Indica el motivo del cambio para dejar trazabilidad.');
            return;
        }

        try {
            setSaving(true);
            const updated = await updateLeadClientFromLeadAction(jobId, form, reason);
            toast.success('Cliente actualizado con auditoría');
            onSaved(updated);
            onClose();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'No se pudo actualizar el cliente';
            setError(message);
            toast.error(message);
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
                aria-label="Editar cliente del lead"
                className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            >
                <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
                    <div>
                        <h2 className="text-lg font-black text-slate-950">Editar cliente</h2>
                        <p className="text-[13px] text-slate-500">
                            Los cambios quedan asociados al lead y al historial del cliente.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Cerrar edición"
                    >
                        <X size={19} />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                    {error && (
                        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Nombre" required>
                            <input
                                required
                                value={form.name}
                                onChange={(event) => setField('name', event.target.value)}
                                className={inputClass}
                            />
                        </Field>
                        <Field label="Email">
                            <input
                                type="email"
                                value={form.email}
                                onChange={(event) => setField('email', event.target.value)}
                                className={inputClass}
                            />
                        </Field>
                        <Field label="Telefono">
                            <input
                                value={form.phone}
                                onChange={(event) => setField('phone', event.target.value)}
                                className={inputClass}
                            />
                        </Field>
                        <Field label="DNI/CIF">
                            <input
                                value={form.dni_cif}
                                onChange={(event) => setField('dni_cif', event.target.value.toUpperCase())}
                                className={`${inputClass} uppercase`}
                            />
                        </Field>
                        <Field label="CUPS">
                            <input
                                value={form.cups}
                                onChange={(event) => setField('cups', event.target.value.toUpperCase())}
                                className={`${inputClass} font-mono uppercase`}
                                maxLength={22}
                            />
                        </Field>
                        <Field label="Comercializadora actual">
                            <input
                                value={form.current_supplier}
                                onChange={(event) => setField('current_supplier', event.target.value)}
                                className={inputClass}
                            />
                        </Field>
                        <Field label="Tarifa actual">
                            <input
                                value={form.tariff_type}
                                onChange={(event) => setField('tariff_type', event.target.value)}
                                className={inputClass}
                                placeholder="2.0TD, 3.0TD..."
                            />
                        </Field>
                        <Field label="Direccion">
                            <input
                                value={form.address}
                                onChange={(event) => setField('address', event.target.value)}
                                className={inputClass}
                            />
                        </Field>
                    </div>

                    <label className="mt-5 block">
                        <span className="mb-1.5 block text-[11px] font-black uppercase tracking-widest text-slate-500">
                            Motivo del cambio
                        </span>
                        <textarea
                            required
                            value={reason}
                            onChange={(event) => {
                                setReason(event.target.value);
                                setError(null);
                            }}
                            rows={3}
                            maxLength={500}
                            placeholder="Ej: corregido tras cotejar la factura original con el cliente."
                            className="w-full resize-none rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-energy-500 focus:ring-1 focus:ring-energy-500"
                        />
                        <span className="mt-1 block text-right text-[11px] text-slate-400">{reason.length}/500</span>
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
                        className="inline-flex flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : 'Guardar con traza'} {!saving && <Check size={16} />}
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
