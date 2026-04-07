import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, User, Target, ChevronDown, Users, TrendingUp, BadgeEuro, Mail, Eye, ShieldCheck, Pencil, X, Save } from 'lucide-react';
import { NetworkUser } from '@/types/crm';
import { formatCurrency } from '@/lib/utils/format';
import { toast } from 'sonner';
import { updateNetworkUserAction } from '@/app/actions/network';

interface NetworkTreeProps {
    data: NetworkUser[];
    searchTerm?: string;
    roleFilter?: 'all' | 'franchise' | 'agent';
    onInvite: () => void;
}

// ─── Edit Modal ──────────────────────────────────────────────────────────────

interface EditUserModalProps {
    node: NetworkUser;
    onClose: () => void;
    onSaved: (updated: Partial<NetworkUser>) => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ node, onClose, onSaved }) => {
    const [fullName, setFullName] = useState(node.full_name);
    const [email, setEmail] = useState(node.email);
    const [saving, setSaving] = useState(false);

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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">Editar usuario</h2>
                    <button type="button" onClick={onClose} title="Cerrar" aria-label="Cerrar" className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSave} className="p-6 space-y-4">
                    <div>
                        <label htmlFor="edit-fullname" className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre completo</label>
                        <input
                            id="edit-fullname"
                            type="text"
                            required
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                            placeholder="Nombre y apellidos"
                        />
                    </div>
                    <div>
                        <label htmlFor="edit-email" className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                        <input
                            id="edit-email"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                            placeholder="correo@ejemplo.com"
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl font-semibold text-slate-500 hover:bg-slate-50 transition-colors text-sm border border-slate-200">
                            Cancelar
                        </button>
                        <button type="submit" disabled={saving} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all text-sm flex items-center justify-center gap-2">
                            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={16} /> Guardar</>}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
    franchise: 'Franquicia',
    agent: 'Agente',
    admin: 'Admin',
}

const ROLE_ICON: Record<string, React.ReactNode> = {
    franchise: <Building2 size={20} strokeWidth={1.5} />,
    admin: <ShieldCheck size={20} strokeWidth={1.5} />,
    agent: <User size={20} strokeWidth={1.5} />,
}

const TreeNode: React.FC<{ node: NetworkUser, depth: number, isLast?: boolean, searchTerm?: string, forceExpand?: boolean }> =
    ({ node, depth, searchTerm, forceExpand }) => {

        // Auto expand if depth < 2 OR if forced by search match
        const [isExpanded, setIsExpanded] = useState(depth < 2 || !!forceExpand);
        const [editingNode, setEditingNode] = useState<NetworkUser | null>(null);
        const [nodeData, setNodeData] = useState<NetworkUser>(node);
        const hasChildren = nodeData.children && nodeData.children.length > 0;

        // Sync forceExpand prop to state using ref to avoid setState in effect
        const hasExpandedRef = React.useRef(false);
        useEffect(() => {
            if (forceExpand && !hasExpandedRef.current) {
                hasExpandedRef.current = true;
                // Use requestAnimationFrame to avoid synchronous setState
                requestAnimationFrame(() => {
                    setIsExpanded(true);
                });
            }
        }, [forceExpand]);

        return (
            <div className="relative">
                {/* Connecting Lines for children flow */}
                {depth > 0 && (
                    <div className="absolute top-0 -left-6 w-6 h-8 border-b-2 border-slate-200/60 rounded-bl-2xl -mt-4 z-0" />
                )}

                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{ willChange: 'transform, opacity' }}
                    className="relative z-10 mb-4"
                >
                    <div
                        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
                        className={`
                        group relative flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-3xl border transition-all duration-300 cursor-pointer overflow-hidden gap-4 sm:gap-0
                        ${nodeData.role === 'franchise'
                                ? 'bg-slate-900/95 backdrop-blur-md border-slate-800 text-white shadow-xl shadow-slate-900/20'
                                : 'bg-white/60 backdrop-blur-md border-white/60 hover:bg-white/80 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-500/5'
                            }
                    `}
                    >
                        {/* Background decoration for Franchise */}
                        {nodeData.role === 'franchise' && (
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[60px] -mr-20 -mt-20 pointer-events-none" />
                        )}

                        <div className="flex items-center gap-4 relative z-10">
                            {/* Avatar / Icon */}
                            <div className={`
                            w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border ring-1 ring-inset ring-black/5 relative overflow-hidden
                            ${nodeData.role === 'franchise'
                                    ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 border-indigo-500/50 text-white'
                                    : 'bg-white border-white text-slate-500 group-hover:text-indigo-600 transition-colors'
                                }
                        `}>
                                {nodeData.avatar_url ? (
                                    <Image src={nodeData.avatar_url} alt={nodeData.full_name} fill className="object-cover" sizes="48px" loading="lazy" />
                                ) : (
                                    ROLE_ICON[nodeData.role] ?? <User size={20} strokeWidth={1.5} />
                                )}
                            </div>

                            {/* Info */}
                            <div>
                                <div className="flex items-center gap-3 mb-0.5">
                                    <h4 className={`font-semibold text-base leading-tight tracking-tight ${nodeData.role === 'franchise' ? 'text-white' : 'text-slate-800'}`}>
                                        {searchTerm ? (
                                            nodeData.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ? (
                                                <span className="bg-yellow-200/90 text-slate-900 px-1 rounded-md">{nodeData.full_name}</span>
                                            ) : nodeData.full_name
                                        ) : nodeData.full_name}
                                    </h4>
                                    <span className={`
                                    px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-widest border shadow-sm
                                    ${nodeData.role === 'franchise' || nodeData.role === 'admin'
                                            ? 'bg-white/10 border-white/10 text-indigo-100'
                                            : 'bg-indigo-50 border-indigo-100 text-indigo-600'
                                        }
                                `}>
                                        {ROLE_LABEL[nodeData.role] ?? nodeData.role}
                                    </span>
                                </div>

                                {nodeData.franchise_config?.company_name && (
                                    <p className={`text-xs font-medium flex items-center gap-1.5 ${nodeData.role === 'franchise' ? 'text-indigo-200/80' : 'text-slate-400'}`}>
                                        <BadgeEuro size={12} />
                                        {nodeData.franchise_config.company_name}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Stats & Actions */}
                        <div className="flex items-center justify-between sm:justify-end gap-6 sm:mr-4 relative z-10 w-full sm:w-auto pl-16 sm:pl-0">
                            {(nodeData.stats) && (
                                <div className="flex items-center gap-3 sm:gap-6">
                                    <div className="text-left sm:text-right">
                                        <p className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${nodeData.role === 'franchise' ? 'text-slate-500' : 'text-slate-400'}`}>Cartera</p>
                                        <p className={`font-medium text-sm flex items-center gap-1 sm:justify-end ${nodeData.role === 'franchise' ? 'text-slate-200' : 'text-slate-700'}`}>
                                            <Users size={14} className="opacity-50" />
                                            {nodeData.stats.active_clients}
                                        </p>
                                    </div>
                                    <div className="text-left sm:text-right">
                                        <p className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${nodeData.role === 'franchise' ? 'text-slate-500' : 'text-slate-400'}`}>Volumen</p>
                                        <p className={`font-medium text-sm flex items-center gap-1 sm:justify-end ${nodeData.role === 'franchise' ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                            <TrendingUp size={14} className="opacity-50" />
                                            {formatCurrency(nodeData.stats.total_sales)}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Hover Actions */}
                            <div className={`
                                flex items-center gap-1 pl-4 border-l transition-all duration-300
                                ${nodeData.role === 'franchise' ? 'border-white/10' : 'border-slate-200/50'}
                                opacity-100 sm:opacity-0 sm:group-hover:opacity-100
                            `}>
                                <button type="button" onClick={(e) => { e.stopPropagation(); window.location.href = `/dashboard/profile/${nodeData.id}`; }} className={`p-2 rounded-full transition-colors ${nodeData.role === 'franchise' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 shadow-sm border border-slate-100'}`} title="Ver Perfil">
                                    <Eye size={16} />
                                </button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); if (nodeData.email) { navigator.clipboard.writeText(nodeData.email); toast.success('Email copiado'); } else { toast.info('Sin email registrado'); } }} className={`p-2 rounded-full transition-colors ${nodeData.role === 'franchise' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 shadow-sm border border-slate-100'}`} title="Copiar email">
                                    <Mail size={16} />
                                </button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); setEditingNode(nodeData); }} className={`p-2 rounded-full transition-colors ${nodeData.role === 'franchise' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-amber-50 text-slate-400 hover:text-amber-600 shadow-sm border border-slate-100'}`} title="Editar usuario">
                                    <Pencil size={16} />
                                </button>
                            </div>

                            {/* Expand Chevron */}
                            {hasChildren && (
                                <div className={`
                                p-2 rounded-full transition-all duration-300 transform
                                ${isExpanded ? 'rotate-180 bg-white/10' : 'rotate-0'}
                                ${nodeData.role === 'franchise' ? 'text-white hover:bg-white/20' : 'text-slate-400 hover:bg-slate-100'}
                            `}>
                                    <ChevronDown size={18} strokeWidth={2.5} />
                                </div>
                            )}
                        </div>
                    </div>
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

                <AnimatePresence>
                    {isExpanded && hasChildren && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="relative ml-8 pl-8 border-l-2 border-slate-200/50 space-y-4 pt-4"
                        >
                            {nodeData.children!.map((child, idx) => (
                                // Render child only if it passes filter
                                <FilteredTreeNode
                                    key={child.id}
                                    node={child}
                                    depth={depth + 1}
                                    isLast={idx === nodeData.children!.length - 1}
                                    searchTerm={searchTerm}
                                />
                            ))}
                            {/* Cover the bottom part of the vertical line for the last child to make a curve */}
                            {/* <div className="absolute bottom-0 left-[-2px] w-2 h-8 bg-white z-10 translate-y-4" /> */}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

// Wrapper to handle filtering logic recursively
interface FilteredTreeNodeProps {
    node: NetworkUser;
    searchTerm?: string;
    depth?: number;
    isLast?: boolean;
}

const FilteredTreeNode: React.FC<FilteredTreeNodeProps> = (props) => {
    const { node, searchTerm } = props;

    // Helper to check match
    const checkMatch = (n: NetworkUser): boolean => {
        if (!searchTerm) return true;
        const selfMatch =
            n.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            n.email.toLowerCase().includes(searchTerm.toLowerCase());

        const childrenMatch = n.children?.some(c => checkMatch(c));
        return selfMatch || !!childrenMatch;
    };

    const hasMatch = checkMatch(node);
    const forceExpand = searchTerm && node.children?.some((c: NetworkUser) => checkMatch(c)); // Expand if children match

    if (!hasMatch) return null;

    return <TreeNode {...props} depth={props.depth || 0} forceExpand={!!forceExpand} />;
};

export const NetworkTree: React.FC<NetworkTreeProps> = ({ data, searchTerm, roleFilter = 'all', onInvite }) => {
    const filtered = roleFilter === 'all' ? data : data.filter(n => n.role === roleFilter || (n.children || []).some(c => c.role === roleFilter));

    if (!data.length) {
        return (
            <div className="bg-white/60 backdrop-blur-md rounded-[2rem] p-16 text-center border border-slate-200/50 shadow-sm flex flex-col items-center">
                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6 text-indigo-400 shadow-inner">
                    <Target size={36} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Tu Red está vacía</h3>
                <p className="text-slate-500 max-w-sm mx-auto mb-8 font-light leading-relaxed">
                    Aún no tienes colaboradores o franquicias bajo tu jerarquía. ¡Es el momento de empezar a construir tu imperio!
                </p>
                <button
                    type="button"
                    onClick={onInvite}
                    className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
                >
                    Invitar Primer Agente
                </button>
            </div>
        );
    }

    return (
        <div className="py-2">
            <div className="max-w-5xl mx-auto">
                {filtered.map(rootNode => (
                    <FilteredTreeNode
                        key={rootNode.id}
                        node={rootNode}
                        depth={0}
                        searchTerm={searchTerm}
                    />
                ))}
            </div>
        </div>
    );
};
