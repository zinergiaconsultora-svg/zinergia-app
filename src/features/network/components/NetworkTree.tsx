import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, Users, TrendingUp,
    Mail, Eye, Pencil,
    UserPlus, Phone, MapPin
} from 'lucide-react';
import { NetworkUser } from '@/types/crm';
import { formatCurrency } from '@/lib/utils/format';
import { toast } from 'sonner';
import { ROLE_CONFIG, DEACTIVATED_CONFIG, DEFAULT_ROLE } from './networkRoleConfig';
import { EditUserModal } from './EditUserModal';

interface NetworkTreeProps {
    data: NetworkUser[];
    searchTerm?: string;
    roleFilter?: 'all' | 'franchise' | 'agent';
    onInvite: () => void;
}


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
