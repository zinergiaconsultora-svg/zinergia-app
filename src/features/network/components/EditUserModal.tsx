'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RefreshCw, Save, Trash2, UserX, X } from 'lucide-react';
import { NetworkUser } from '@/types/crm';
import { toast } from 'sonner';
import { updateNetworkUserAction, deleteProfileAction, deactivateProfileAction, reactivateProfileAction } from '@/app/actions/network';
import { ROLE_CONFIG, DEACTIVATED_CONFIG, DEFAULT_ROLE } from './networkRoleConfig';

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditUserModalProps {
    node: NetworkUser;
    onClose: () => void;
    onSaved: (updated: Partial<NetworkUser>) => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({ node, onClose, onSaved }) => {
    const [fullName, setFullName] = useState(node.full_name);
    const [email, setEmail] = useState(node.email);
    const [saving, setSaving] = useState(false);
    const [confirm, setConfirm] = useState<'delete' | 'deactivate' | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [reactivateRole, setReactivateRole] = useState<'agent' | 'franchise'>('agent');
    const isDeactivated = !node.role;
    const cfg = isDeactivated ? DEACTIVATED_CONFIG : (ROLE_CONFIG[node.role] ?? DEFAULT_ROLE);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await updateNetworkUserAction(node.id, { full_name: fullName, email });
            toast.success('Perfil actualizado');
            onSaved({ full_name: fullName, email });
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setActionLoading(true);
        try {
            await deleteProfileAction(node.id);
            toast.success(`${node.full_name} eliminado permanentemente`);
            onSaved({ full_name: '[eliminado]' });
            onClose();
            // Reload the page to refresh the tree
            window.location.reload();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Error al eliminar');
        } finally {
            setActionLoading(false);
            setConfirm(null);
        }
    };

    const handleDeactivate = async () => {
        setActionLoading(true);
        try {
            await deactivateProfileAction(node.id);
            toast.success(`${node.full_name} desactivado`);
            onClose();
            window.location.reload();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Error al desactivar');
        } finally {
            setActionLoading(false);
            setConfirm(null);
        }
    };

    const handleReactivate = async () => {
        setActionLoading(true);
        try {
            await reactivateProfileAction(node.id, reactivateRole);
            toast.success(`${node.full_name} reactivado como ${reactivateRole === 'agent' ? 'Colaborador' : 'Franquicia'}`);
            onClose();
            window.location.reload();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Error al reactivar');
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                role="dialog"
                aria-modal="true"
                aria-label="Editar usuario"
                className="bg-white rounded-3xl shadow-2xl shadow-slate-900/20 w-full max-w-sm overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 pt-6 pb-5 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl ${cfg.avatarBg} flex items-center justify-center text-lg font-black ${cfg.avatarText} shrink-0`}>
                        {node.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 truncate">{node.full_name}</p>
                        <p className="text-xs text-slate-400">{cfg.label}</p>
                    </div>
                    <button type="button" onClick={onClose} title="Cerrar" aria-label="Cerrar"
                        className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors shrink-0">
                        <X size={18} />
                    </button>
                </div>

                <div className="h-px bg-slate-100" />

                {/* Confirm overlay */}
                <AnimatePresence>
                    {confirm && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className={`mx-6 mt-5 p-4 rounded-2xl border ${confirm === 'delete' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}
                        >
                            <div className="flex items-start gap-3 mb-4">
                                <AlertTriangle size={18} className={confirm === 'delete' ? 'text-red-500 shrink-0 mt-0.5' : 'text-amber-500 shrink-0 mt-0.5'} />
                                <div>
                                    <p className={`text-sm font-bold mb-1 ${confirm === 'delete' ? 'text-red-700' : 'text-amber-700'}`}>
                                        {confirm === 'delete' ? '¿Eliminar permanentemente?' : '¿Desactivar cuenta?'}
                                    </p>
                                    <p className={`text-xs leading-relaxed ${confirm === 'delete' ? 'text-red-600' : 'text-amber-600'}`}>
                                        {confirm === 'delete'
                                            ? `Se eliminará la cuenta de ${node.full_name} y todos sus datos. Esta acción no se puede deshacer.`
                                            : `${node.full_name} perderá acceso a la plataforma pero sus datos se conservarán.`
                                        }
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setConfirm(null)}
                                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                                    Cancelar
                                </button>
                                <button type="button" disabled={actionLoading}
                                    onClick={confirm === 'delete' ? handleDelete : handleDeactivate}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 ${confirm === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
                                    {actionLoading
                                        ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        : confirm === 'delete' ? 'Eliminar' : 'Desactivar'
                                    }
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleSave} className="p-6 space-y-4">
                    <div>
                        <label htmlFor="edit-fullname" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre completo</label>
                        <input
                            id="edit-fullname"
                            type="text"
                            required
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 rounded-2xl text-sm font-medium text-slate-800 border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                            placeholder="Nombre y apellidos"
                        />
                    </div>
                    <div>
                        <label htmlFor="edit-email" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                        <input
                            id="edit-email"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 rounded-2xl text-sm font-medium text-slate-800 border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                            placeholder="correo@ejemplo.com"
                        />
                    </div>
                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-3 rounded-2xl text-sm font-semibold text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200">
                            Cancelar
                        </button>
                        <button type="submit" disabled={saving}
                            className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                            {saving
                                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <><Save size={15} /> Guardar</>
                            }
                        </button>
                    </div>

                    {/* Reactivate section (only for deactivated users) */}
                    {isDeactivated && (
                        <div className="pt-2 border-t border-slate-100">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-3">Reactivar cuenta</p>
                            <div className="flex gap-2 items-center mb-3">
                                <select
                                    aria-label="Rol al reactivar"
                                    value={reactivateRole}
                                    onChange={e => setReactivateRole(e.target.value as 'agent' | 'franchise')}
                                    className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                                >
                                    <option value="agent">Colaborador Comercial</option>
                                    <option value="franchise">Franquicia</option>
                                </select>
                                <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={handleReactivate}
                                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 transition-all"
                                >
                                    {actionLoading
                                        ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        : <><RefreshCw size={13} /> Reactivar</>
                                    }
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Danger zone */}
                    <div className="pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Zona de peligro</p>
                        <div className="flex gap-2">
                            {!isDeactivated && (
                                <button
                                    type="button"
                                    onClick={() => setConfirm('deactivate')}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-100 transition-colors"
                                >
                                    <UserX size={14} /> Desactivar
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setConfirm('delete')}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors"
                            >
                                <Trash2 size={14} /> Eliminar
                            </button>
                        </div>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};
