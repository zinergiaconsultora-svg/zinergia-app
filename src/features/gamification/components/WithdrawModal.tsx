'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { saveIbanAction } from '@/app/actions/withdrawals';
import { Commission } from '@/types/crm';
import { maskIban } from './walletShared';

export function WithdrawModal({
    iban,
    commissions,
    onClose,
    onWithdraw,
}: {
    available: number;
    iban: string | null;
    commissions: Commission[];
    onClose: () => void;
    onWithdraw: (amount: number, ids: string[]) => Promise<{ success: boolean; error?: string }>;
}) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [showIbanForm, setShowIbanForm] = useState(!iban);
    const [ibanInput, setIbanInput] = useState(iban || '');
    const [ibanSaving, setIbanSaving] = useState(false);

    const selectedTotal = commissions
        .filter(c => selected.has(c.id))
        .reduce((sum, c) => sum + (c.agent_commission || 0), 0);

    const handleSaveIban = async () => {
        setIbanSaving(true);
        const result = await saveIbanAction(ibanInput);
        setIbanSaving(false);
        if (result.success) {
            toast.success('IBAN guardado');
            setShowIbanForm(false);
        } else {
            toast.error(result.error);
        }
    };

    const toggleAll = () => {
        if (selected.size === commissions.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(commissions.map(c => c.id)));
        }
    };

    const handleSubmit = async () => {
        if (selected.size === 0) return toast.error('Selecciona comisiones');
        setLoading(true);
        await onWithdraw(selectedTotal, [...selected]);
        setLoading(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                role="dialog"
                aria-modal="true"
                aria-label="Solicitar retiro de comisiones"
                className="bg-white rounded-2xl shadow-floating w-full max-w-lg max-h-[85vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-lg font-black text-slate-900">Solicitar Retiro</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Selecciona las comisiones aprobadas que deseas retirar
                    </p>
                </div>

                {showIbanForm ? (
                    <div className="p-6 space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                            <Building2 size={18} className="text-amber-600 shrink-0" />
                            <p className="text-xs text-amber-800">Necesitas configurar tu IBAN para recibir los pagos</p>
                        </div>
                        <input
                            type="text"
                            value={ibanInput}
                            onChange={e => setIbanInput(e.target.value.toUpperCase())}
                            placeholder="ES00 0000 0000 0000 0000 0000"
                            aria-label="IBAN"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-energy-500 focus:border-energy-500 outline-none"
                            maxLength={30}
                        />
                        <button
                            onClick={handleSaveIban}
                            disabled={ibanSaving || ibanInput.length < 15}
                            className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-40 transition-colors"
                        >
                            {ibanSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Guardar IBAN'}
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 overflow-y-auto p-6 space-y-2">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold text-slate-500">{commissions.length} comisiones disponibles</span>
                                <button onClick={toggleAll} className="text-xs font-bold text-energy-600 hover:text-energy-800">
                                    {selected.size === commissions.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                                </button>
                            </div>
                            {commissions.map(comm => (
                                <label
                                    key={comm.id}
                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                        selected.has(comm.id) ? 'border-energy-500 bg-energy-50' : 'border-slate-100 hover:border-slate-200'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selected.has(comm.id)}
                                        onChange={() => {
                                            const next = new Set(selected);
                                            if (selected.has(comm.id)) { next.delete(comm.id); } else { next.add(comm.id); }
                                            setSelected(next);
                                        }}
                                        className="w-4 h-4 rounded text-energy-600"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 truncate">
                                            {comm.proposals?.clients?.name || `Propuesta ${comm.proposal_id.slice(0, 6)}`}
                                        </p>
                                        <p className="text-xs text-slate-400">{formatDate(comm.created_at)}</p>
                                    </div>
                                    <span className="text-sm font-bold text-emerald-600">{formatCurrency(comm.agent_commission)}</span>
                                </label>
                            ))}
                        </div>
                        <div className="p-6 border-t border-slate-100 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500">IBAN destino</span>
                                <span className="text-sm font-mono text-slate-700">{iban ? maskIban(iban) : 'No configurado'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-900">Total a retirar</span>
                                <span className="text-lg font-black text-energy-600">{formatCurrency(selectedTotal)}</span>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading || selected.size === 0}
                                    className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-40 transition-colors"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmar Retiro'}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </motion.div>
        </div>
    );
}
