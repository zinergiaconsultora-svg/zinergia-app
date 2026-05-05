import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Building2, User, ChevronDown, Users, TrendingUp,
    Mail, Eye, ShieldCheck, Pencil, X, Save,
    UserPlus, Phone, MapPin, Trash2, UserX, AlertTriangle, RefreshCw
} from 'lucide-react';
import { NetworkUser } from '@/types/crm';
import { formatCurrency } from '@/lib/utils/format';
import { toast } from 'sonner';
import { updateNetworkUserAction, deleteProfileAction, deactivateProfileAction, reactivateProfileAction } from '@/app/actions/network';

interface NetworkTreeProps {
    data: NetworkUser[];
    searchTerm?: string;
    roleFilter?: 'all' | 'franchise' | 'agent';
    onInvite: () => void;
}

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, {
    label: string;
    icon: React.ReactNode;
    cardBg: string;
    cardBorder: string;
    avatarBg: string;
    avatarText: string;
    badgeBg: string;
    badgeText: string;
    nameCls: string;
    subCls: string;
    statLabelCls: string;
    statValueCls: string;
    dividerCls: string;
    actionBg: string;
    actionHover: string;
    actionText: string;
    chevronCls: string;
}> = {
    franchise: {
        label: 'Franquicia',
        icon: <Building2 size={18} strokeWidth={1.8} />,
        cardBg: 'bg-white',
        cardBorder: 'border-indigo-100',
        avatarBg: 'bg-indigo-50',
        avatarText: 'text-indigo-600',
        badgeBg: 'bg-indigo-50 border-indigo-100',
        badgeText: 'text-indigo-600',
        nameCls: 'text-slate-900',
        subCls: 'text-slate-400',
        statLabelCls: 'text-slate-400',
        statValueCls: 'text-slate-700',
        dividerCls: 'border-slate-100',
        actionBg: 'bg-slate-50',
        actionHover: 'hover:bg-indigo-50',
        actionText: 'text-slate-400 hover:text-indigo-600',
        chevronCls: 'text-slate-400 hover:bg-slate-100',
    },
    admin: {
        label: 'Admin',
        icon: <ShieldCheck size={18} strokeWidth={1.8} />,
        cardBg: 'bg-white',
        cardBorder: 'border-slate-200',
        avatarBg: 'bg-slate-100',
        avatarText: 'text-slate-600',
        badgeBg: 'bg-slate-100 border-slate-200',
        badgeText: 'text-slate-600',
        nameCls: 'text-slate-900',
        subCls: 'text-slate-400',
        statLabelCls: 'text-slate-400',
        statValueCls: 'text-slate-700',
        dividerCls: 'border-slate-100',
        actionBg: 'bg-slate-50',
        actionHover: 'hover:bg-slate-100',
        actionText: 'text-slate-400 hover:text-slate-700',
        chevronCls: 'text-slate-400 hover:bg-slate-100',
    },
    agent: {
        label: 'Colaborador',
        icon: <User size={18} strokeWidth={1.8} />,
        cardBg: 'bg-white',
        cardBorder: 'border-slate-200/70',
        avatarBg: 'bg-gradient-to-br from-slate-100 to-slate-200',
        avatarText: 'text-slate-600',
        badgeBg: 'bg-emerald-50 border-emerald-100',
        badgeText: 'text-emerald-700',
        nameCls: 'text-slate-900',
        subCls: 'text-slate-400',
        statLabelCls: 'text-slate-400',
        statValueCls: 'text-slate-700',
        dividerCls: 'border-slate-100',
        actionBg: 'bg-slate-50',
        actionHover: 'hover:bg-slate-100',
        actionText: 'text-slate-400 hover:text-slate-700',
        chevronCls: 'text-slate-400 hover:bg-slate-100',
    },
};

const DEACTIVATED_CONFIG = {
    label: 'Desactivado',
    icon: <UserX size={18} strokeWidth={1.8} />,
    cardBg: 'bg-slate-50',
    cardBorder: 'border-slate-200',
    avatarBg: 'bg-slate-100',
    avatarText: 'text-slate-400',
    badgeBg: 'bg-slate-100 border-slate-200',
    badgeText: 'text-slate-400',
    nameCls: 'text-slate-400',
    subCls: 'text-slate-300',
    statLabelCls: 'text-slate-300',
    statValueCls: 'text-slate-400',
    dividerCls: 'border-slate-100',
    actionBg: 'bg-slate-50',
    actionHover: 'hover:bg-slate-100',
    actionText: 'text-slate-300 hover:text-slate-500',
    chevronCls: 'text-slate-300 hover:bg-slate-100',
};

const DEFAULT_ROLE = ROLE_CONFIG.agent;

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditUserModalProps {
    node: NetworkUser;
    onClose: () => void;
    onSaved: (updated: Partial<NetworkUser>) => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ node, onClose, onSaved }) => {
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

// ─── Tree Node ────────────────────────────────────────────────────────────────

const TreeNode: React.FC<{ node: NetworkUser; depth: number; isLast?: boolean; searchTerm?: string; forceExpand?: boolean }> =
    ({ node, depth, searchTerm, forceExpand }) => {
        const [isExpanded, setIsExpanded] = useState(depth < 2 || !!forceExpand);
        const [editingNode, setEditingNode] = useState<NetworkUser | null>(null);
        const [nodeData, setNodeData] = useState<NetworkUser>(node);
        const hasChildren = (nodeData.children?.length ?? 0) > 0;
        const isDeactivated = !nodeData.role;
        const cfg = isDeactivated ? DEACTIVATED_CONFIG : (ROLE_CONFIG[nodeData.role] ?? DEFAULT_ROLE);
        const initials = nodeData.full_name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';

        const hasExpandedRef = React.useRef(false);
        useEffect(() => {
            if (forceExpand && !hasExpandedRef.current) {
                hasExpandedRef.current = true;
                requestAnimationFrame(() => setIsExpanded(true));
            }
        }, [forceExpand]);

        const highlightName = (name: string) => {
            if (!searchTerm) return <span>{name}</span>;
            if (name.toLowerCase().includes(searchTerm.toLowerCase())) {
                return <span className="bg-amber-200/80 text-slate-900 px-0.5 rounded">{name}</span>;
            }
            return <span>{name}</span>;
        };

        return (
            <div className="relative">
                {depth > 0 && (
                    <div className="absolute top-0 -left-6 w-6 h-8 border-b-2 border-slate-200/50 rounded-bl-2xl -mt-4 z-0" />
                )}

                <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    style={{ willChange: 'transform, opacity' }}
                    className="relative z-10 mb-3"
                >
                    <div className={`
                        group relative flex items-stretch rounded-2xl border shadow-sm transition-all duration-200
                        ${cfg.cardBg} ${cfg.cardBorder}
                        ${hasChildren ? 'cursor-pointer' : ''}
                        hover:shadow-md hover:-translate-y-px
                    `}>
                        {/* Role accent strip */}
                        <div className={`w-1 rounded-l-2xl shrink-0 ${
                            isDeactivated ? 'bg-slate-200' :
                            nodeData.role === 'franchise' ? 'bg-indigo-400' :
                            nodeData.role === 'admin' ? 'bg-slate-300' : 'bg-emerald-400'
                        }`} />

                        {/* Main content */}
                        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-4 min-w-0" onClick={() => hasChildren && setIsExpanded(!isExpanded)}>

                            {/* Avatar */}
                            <div className={`
                                relative w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-black text-sm shadow-sm overflow-hidden
                                ${cfg.avatarBg} ${cfg.avatarText}
                            `}>
                                {nodeData.avatar_url ? (
                                    <Image src={nodeData.avatar_url} alt={nodeData.full_name} fill className="object-cover" sizes="44px" loading="lazy" />
                                ) : initials}
                            </div>

                            {/* Name + role + email */}
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                    <span className={`font-bold text-[15px] leading-tight ${cfg.nameCls}`}>
                                        {highlightName(nodeData.full_name)}
                                    </span>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] uppercase font-black tracking-widest border ${cfg.badgeBg} ${cfg.badgeText}`}>
                                        {cfg.icon}
                                        {cfg.label}
                                    </span>
                                    {nodeData.franchise_config?.company_name && (
                                        <span className={`text-[11px] font-medium ${cfg.subCls} flex items-center gap-1`}>
                                            <MapPin size={10} />
                                            {nodeData.franchise_config.company_name}
                                        </span>
                                    )}
                                </div>
                                {nodeData.email && (
                                    <p className={`text-[11px] truncate flex items-center gap-1 ${cfg.subCls}`}>
                                        <Mail size={10} />
                                        {nodeData.email}
                                    </p>
                                )}
                            </div>

                            {/* Stats */}
                            {nodeData.stats && (
                                <div className={`flex items-center gap-4 px-4 border-l shrink-0 ${cfg.dividerCls}`}>
                                    <div className="text-right">
                                        <p className={`text-[9px] font-bold uppercase tracking-wider ${cfg.statLabelCls}`}>Cartera</p>
                                        <p className={`font-bold text-sm flex items-center justify-end gap-1 mt-0.5 ${cfg.statValueCls}`}>
                                            <Users size={12} className="opacity-60" />
                                            {nodeData.stats.active_clients}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-[9px] font-bold uppercase tracking-wider ${cfg.statLabelCls}`}>Volumen</p>
                                        <p className={`font-bold text-sm flex items-center justify-end gap-1 mt-0.5 ${
                                            nodeData.role === 'franchise' || nodeData.role === 'admin' ? 'text-emerald-400' : 'text-emerald-600'
                                        }`}>
                                            <TrendingUp size={12} className="opacity-60" />
                                            {formatCurrency(nodeData.stats.total_sales)}
                                        </p>
                                    </div>
                                    {hasChildren && (
                                        <div className="text-right">
                                            <p className={`text-[9px] font-bold uppercase tracking-wider ${cfg.statLabelCls}`}>Equipo</p>
                                            <p className={`font-bold text-sm flex items-center justify-end gap-1 mt-0.5 ${cfg.statValueCls}`}>
                                                <Users size={12} className="opacity-60" />
                                                {nodeData.children!.length}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div className={`flex flex-col justify-center gap-1 px-3 border-l shrink-0 ${cfg.dividerCls}`}>
                            <button
                                type="button"
                                title="Ver perfil"
                                onClick={(e) => { e.stopPropagation(); window.location.href = `/dashboard/profile/${nodeData.id}`; }}
                                className={`p-2 rounded-xl transition-all ${cfg.actionBg} ${cfg.actionHover} ${cfg.actionText}`}
                            >
                                <Eye size={15} />
                            </button>
                            <button
                                type="button"
                                title={nodeData.email ? 'Copiar email' : 'Sin email'}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (nodeData.email) {
                                        navigator.clipboard.writeText(nodeData.email);
                                        toast.success('Email copiado');
                                    } else {
                                        toast.info('Sin email registrado');
                                    }
                                }}
                                className={`p-2 rounded-xl transition-all ${cfg.actionBg} ${cfg.actionHover} ${cfg.actionText}`}
                            >
                                <Phone size={15} />
                            </button>
                            <button
                                type="button"
                                title="Editar usuario"
                                onClick={(e) => { e.stopPropagation(); setEditingNode(nodeData); }}
                                className={`p-2 rounded-xl transition-all ${cfg.actionBg} ${cfg.actionHover} ${cfg.actionText}`}
                            >
                                <Pencil size={15} />
                            </button>
                        </div>

                        {/* Expand chevron */}
                        {hasChildren && (
                            <div
                                className={`flex items-center px-3 border-l ${cfg.dividerCls} cursor-pointer`}
                                onClick={() => setIsExpanded(!isExpanded)}
                            >
                                <div className={`p-1.5 rounded-lg transition-all duration-300 ${cfg.chevronCls} ${isExpanded ? 'rotate-180' : ''}`}>
                                    <ChevronDown size={16} strokeWidth={2.5} className={cfg.actionText} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Children count badge */}
                    {hasChildren && !isExpanded && (
                        <div
                            className={`mt-1.5 ml-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-all
                                ${nodeData.role === 'franchise' || nodeData.role === 'admin'
                                    ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                }
                            `}
                            onClick={() => setIsExpanded(true)}
                        >
                            <Users size={10} />
                            {nodeData.children!.length} miembro{nodeData.children!.length !== 1 ? 's' : ''} — expandir
                        </div>
                    )}
                </motion.div>

                {/* Edit Modal */}
                <AnimatePresence>
                    {editingNode && (
                        <EditUserModal
                            node={editingNode}
                            onClose={() => setEditingNode(null)}
                            onSaved={(updated) => setNodeData(prev => ({ ...prev, ...updated }))}
                        />
                    )}
                </AnimatePresence>

                {/* Children */}
                <AnimatePresence>
                    {isExpanded && hasChildren && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="relative ml-6 pl-6 border-l-2 border-slate-100 space-y-0 pt-2 pb-2"
                        >
                            {nodeData.children!.map((child, idx) => (
                                <FilteredTreeNode
                                    key={child.id}
                                    node={child}
                                    depth={depth + 1}
                                    isLast={idx === nodeData.children!.length - 1}
                                    searchTerm={searchTerm}
                                />
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

// ─── Filtered wrapper ─────────────────────────────────────────────────────────

interface FilteredTreeNodeProps {
    node: NetworkUser;
    searchTerm?: string;
    depth?: number;
    isLast?: boolean;
}

const FilteredTreeNode: React.FC<FilteredTreeNodeProps> = (props) => {
    const { node, searchTerm } = props;

    const checkMatch = (n: NetworkUser): boolean => {
        if (!searchTerm) return true;
        const selfMatch =
            n.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            n.email.toLowerCase().includes(searchTerm.toLowerCase());
        return selfMatch || !!(n.children?.some(c => checkMatch(c)));
    };

    const hasMatch = checkMatch(node);
    const forceExpand = !!(searchTerm && node.children?.some((c: NetworkUser) => checkMatch(c)));

    if (!hasMatch) return null;
    return <TreeNode {...props} depth={props.depth ?? 0} forceExpand={forceExpand} />;
};

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyNetwork: React.FC<{ onInvite: () => void }> = ({ onInvite }) => (
    <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
            <Users size={36} className="text-indigo-400" strokeWidth={1.5} />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Tu Red está vacía</h3>
        <p className="text-slate-400 max-w-xs mx-auto mb-8 text-sm leading-relaxed font-light">
            Aún no tienes colaboradores o franquicias. Invita a tu primer miembro para empezar a construir tu estructura.
        </p>
        <button
            type="button"
            onClick={onInvite}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
        >
            <UserPlus size={18} />
            Invitar primer agente
        </button>
    </div>
);

// ─── Export ───────────────────────────────────────────────────────────────────

export const NetworkTree: React.FC<NetworkTreeProps> = ({ data, searchTerm, roleFilter = 'all', onInvite }) => {
    const filtered = roleFilter === 'all'
        ? data
        : data.filter(n => n.role === roleFilter || (n.children ?? []).some(c => c.role === roleFilter));

    if (!data.length) return <EmptyNetwork onInvite={onInvite} />;

    return (
        <div className="py-1">
            {filtered.map(rootNode => (
                <FilteredTreeNode
                    key={rootNode.id}
                    node={rootNode}
                    depth={0}
                    searchTerm={searchTerm}
                />
            ))}
        </div>
    );
};
