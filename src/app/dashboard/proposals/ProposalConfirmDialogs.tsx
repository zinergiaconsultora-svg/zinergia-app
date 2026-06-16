'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, CheckCircle2 } from 'lucide-react';
import { Proposal, ProposalStatus } from '@/types/crm';

interface DeleteConfirmDialogProps {
    target: Proposal | null;
    isDeleting: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

/** Single-proposal delete confirmation. */
export function DeleteConfirmDialog({ target, isDeleting, onCancel, onConfirm }: DeleteConfirmDialogProps) {
    return (
        <AnimatePresence>
            {target && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !isDeleting && onCancel()} />
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                        role="dialog" aria-modal="true" aria-label="Eliminar propuesta"
                        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="p-6 text-center">
                            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
                                <Trash2 size={22} className="text-red-500" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-1">Eliminar propuesta</h3>
                            <p className="text-sm text-slate-500">
                                Se eliminará la propuesta de <span className="font-semibold text-slate-700">{target.clients?.name || target.calculation_data?.client_name || 'este cliente'}</span>. Esta acción no se puede deshacer.
                            </p>
                        </div>
                        <div className="flex gap-3 p-4 border-t border-slate-100 bg-slate-50/50">
                            <button type="button" onClick={onCancel} disabled={isDeleting}
                                className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-sm disabled:opacity-60">Cancelar</button>
                            <button type="button" onClick={onConfirm} disabled={isDeleting}
                                className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                                {isDeleting ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Eliminando…</> : <><Trash2 size={14} /> Eliminar</>}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

interface BulkActionDialogProps {
    action: 'delete' | 'status' | null;
    count: number;
    bulkStatus: ProposalStatus;
    isProcessing: boolean;
    onStatusChange: (status: ProposalStatus) => void;
    onCancel: () => void;
    onConfirm: () => void;
}

/** Bulk delete / status-change confirmation. */
export function BulkActionDialog({ action, count, bulkStatus, isProcessing, onStatusChange, onCancel, onConfirm }: BulkActionDialogProps) {
    return (
        <AnimatePresence>
            {action && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !isProcessing && onCancel()} />
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                        role="dialog" aria-modal="true" aria-label="Acción masiva sobre propuestas"
                        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="p-6 text-center">
                            <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl border flex items-center justify-center ${
                                action === 'delete' ? 'bg-red-50 border-red-100' : 'bg-indigo-50 border-indigo-100'
                            }`}>
                                {action === 'delete'
                                    ? <Trash2 size={22} className="text-red-500" />
                                    : <CheckCircle2 size={22} className="text-indigo-500" />}
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-1">
                                {action === 'delete' ? 'Eliminar propuestas' : 'Cambiar estado'}
                            </h3>
                            <p className="text-sm text-slate-500">
                                {count} propuesta{count > 1 ? 's' : ''} seleccionada{count > 1 ? 's' : ''}
                                {action === 'delete' ? ' se eliminarán permanentemente.' : '.'}
                            </p>
                            {action === 'status' && (
                                <select value={bulkStatus} onChange={e => onStatusChange(e.target.value as ProposalStatus)}
                                    aria-label="Cambiar estado"
                                    className="mt-3 w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20">
                                    <option value="draft">Borrador</option>
                                    <option value="sent">Enviada</option>
                                    <option value="accepted">Firmada</option>
                                    <option value="rejected">Rechazada</option>
                                </select>
                            )}
                        </div>
                        <div className="flex gap-3 p-4 border-t border-slate-100 bg-slate-50/50">
                            <button type="button" onClick={onCancel} disabled={isProcessing}
                                className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-sm disabled:opacity-60">Cancelar</button>
                            <button type="button" onClick={onConfirm} disabled={isProcessing}
                                className={`flex-1 py-2.5 text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60 ${
                                    action === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
                                }`}>
                                {isProcessing
                                    ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Procesando…</>
                                    : action === 'delete' ? <><Trash2 size={14} /> Eliminar</> : <><CheckCircle2 size={14} /> Aplicar</>}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
