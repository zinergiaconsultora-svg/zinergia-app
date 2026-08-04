'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Save, X } from 'lucide-react';
import type { NetworkUser } from '@/types/crm';
import { toast } from 'sonner';
import { updateTeamMemberNameAction } from '@/app/actions/network';
import { DEACTIVATED_CONFIG, DEFAULT_ROLE, ROLE_CONFIG } from './networkRoleConfig';

interface EditUserModalProps {
    node: NetworkUser;
    onClose: () => void;
    onSaved: (updated: Partial<NetworkUser>) => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({ node, onClose, onSaved }) => {
    const [fullName, setFullName] = useState(node.full_name ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const cfg = !node.role ? DEACTIVATED_CONFIG : (ROLE_CONFIG[node.role] ?? DEFAULT_ROLE);

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault();
        if (saving) return;
        setSaving(true);
        setError('');
        try {
            const result = await updateTeamMemberNameAction({
                targetId: node.id,
                fullName,
            });
            if (!result.success) {
                setError(result.error);
                return;
            }
            toast.success('Nombre actualizado');
            onSaved({ full_name: fullName.trim() });
            onClose();
        } catch {
            setError('No se pudo actualizar el nombre.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                role="dialog"
                aria-modal="true"
                aria-label="Editar nombre de usuario"
                className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-900/20"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center gap-4 px-6 pb-5 pt-6">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-black ${cfg.avatarBg} ${cfg.avatarText}`}>
                        {node.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-slate-900">{node.full_name}</p>
                        <p className="text-xs text-slate-400">{cfg.label}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        title="Cerrar"
                        aria-label="Cerrar"
                        className="shrink-0 rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="h-px bg-slate-100" />

                <form onSubmit={handleSave} className="space-y-4 p-6">
                    <div>
                        <label htmlFor="edit-fullname" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                            Nombre completo
                        </label>
                        <input
                            id="edit-fullname"
                            type="text"
                            required
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            placeholder="Nombre y apellidos"
                        />
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Email</p>
                        <p className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                            {node.email}
                        </p>
                        <p className="mt-1.5 text-xs text-slate-400">
                            El email pertenece a la identidad de acceso y no se edita desde la red.
                        </p>
                    </div>

                    {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}

                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 py-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:opacity-60"
                        >
                            {saving
                                ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                : <><Save size={15} /> Guardar</>}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};
