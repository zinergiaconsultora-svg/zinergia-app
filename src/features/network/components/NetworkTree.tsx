import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, User, Target, ChevronDown, Users, TrendingUp, BadgeEuro, Mail, Eye } from 'lucide-react';
import { NetworkUser } from '@/types/crm';
import { formatCurrency } from '@/lib/utils/format';

interface NetworkTreeProps {
    data: NetworkUser[];
    searchTerm?: string;
    onInvite: () => void;
}

const TreeNode: React.FC<{ node: NetworkUser, depth: number, isLast?: boolean, searchTerm?: string, forceExpand?: boolean }> =
    ({ node, depth, searchTerm, forceExpand }) => {

        // Auto expand if depth < 2 OR if forced by search match
        const [isExpanded, setIsExpanded] = useState(depth < 2 || !!forceExpand);
        const hasChildren = node.children && node.children.length > 0;

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
                    className="relative z-10 mb-4"
                >
                    <div
                        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
                        className={`
                        group relative flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-3xl border transition-all duration-300 cursor-pointer overflow-hidden gap-4 sm:gap-0
                        ${node.role === 'franchise'
                                ? 'bg-slate-900/95 backdrop-blur-md border-slate-800 text-white shadow-xl shadow-slate-900/20'
                                : 'bg-white/60 backdrop-blur-md border-white/60 hover:bg-white/80 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-500/5'
                            }
                    `}
                    >
                        {/* Background decoration for Franchise */}
                        {node.role === 'franchise' && (
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[60px] -mr-20 -mt-20 pointer-events-none" />
                        )}

                        <div className="flex items-center gap-4 relative z-10">
                            {/* Avatar / Icon */}
                            <div className={`
                            w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border ring-1 ring-inset ring-black/5 relative overflow-hidden
                            ${node.role === 'franchise'
                                    ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 border-indigo-500/50 text-white'
                                    : 'bg-white border-white text-slate-500 group-hover:text-indigo-600 transition-colors'
                                }
                        `}>
                                {node.avatar_url ? (
                                    <Image src={node.avatar_url} alt={node.full_name} fill className="object-cover" sizes="48px" loading="lazy" />
                                ) : (
                                    node.role === 'franchise' ? <Building2 size={20} strokeWidth={1.5} /> : <User size={20} strokeWidth={1.5} />
                                )}
                            </div>

                            {/* Info */}
                            <div>
                                <div className="flex items-center gap-3 mb-0.5">
                                    <h4 className={`font-semibold text-base leading-tight tracking-tight ${node.role === 'franchise' ? 'text-white' : 'text-slate-800'}`}>
                                        {searchTerm ? (
                                            // Simple highlight
                                            node.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ? (
                                                <span className="bg-yellow-200/90 text-slate-900 px-1 rounded-md">{node.full_name}</span>
                                            ) : node.full_name
                                        ) : node.full_name}
                                    </h4>
                                    <span className={`
                                    px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-widest border shadow-sm
                                    ${node.role === 'franchise'
                                            ? 'bg-white/10 border-white/10 text-indigo-100'
                                            : 'bg-indigo-50 border-indigo-100 text-indigo-600'
                                        }
                                `}>
                                        {node.role === 'franchise' ? 'Franquicia' : 'Agente'}
                                    </span>
                                </div>

                                {node.franchise_config?.company_name && (
                                    <p className={`text-xs font-medium flex items-center gap-1.5 ${node.role === 'franchise' ? 'text-indigo-200/80' : 'text-slate-400'}`}>
                                        <BadgeEuro size={12} />
                                        {node.franchise_config.company_name}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Stats & Actions */}
                        <div className="flex items-center justify-between sm:justify-end gap-6 sm:mr-4 relative z-10 w-full sm:w-auto pl-16 sm:pl-0">
                            {(node.stats) && (
                                <div className="flex items-center gap-3 sm:gap-6">
                                    <div className="text-left sm:text-right">
                                        <p className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${node.role === 'franchise' ? 'text-slate-500' : 'text-slate-400'}`}>Cartera</p>
                                        <p className={`font-medium text-sm flex items-center gap-1 sm:justify-end ${node.role === 'franchise' ? 'text-slate-200' : 'text-slate-700'}`}>
                                            <Users size={14} className="opacity-50" />
                                            {node.stats.active_clients}
                                        </p>
                                    </div>
                                    <div className="text-left sm:text-right">
                                        <p className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${node.role === 'franchise' ? 'text-slate-500' : 'text-slate-400'}`}>Volumen</p>
                                        <p className={`font-medium text-sm flex items-center gap-1 sm:justify-end ${node.role === 'franchise' ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                            <TrendingUp size={14} className="opacity-50" />
                                            {formatCurrency(node.stats.total_sales)}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Hover Actions */}
                            <div className={`
                                flex items-center gap-1 pl-4 border-l transition-all duration-300
                                ${node.role === 'franchise' ? 'border-white/10' : 'border-slate-200/50'}
                                opacity-100 sm:opacity-0 sm:group-hover:opacity-100
                            `}>
                                <button className={`p-2 rounded-full transition-colors ${node.role === 'franchise' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 shadow-sm border border-slate-100'}`} title="Ver Perfil">
                                    <Eye size={16} />
                                </button>
                                <button className={`p-2 rounded-full transition-colors ${node.role === 'franchise' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 shadow-sm border border-slate-100'}`} title="Enviar Mensaje">
                                    <Mail size={16} />
                                </button>
                            </div>

                            {/* Expand Chevron */}
                            {hasChildren && (
                                <div className={`
                                p-2 rounded-full transition-all duration-300 transform
                                ${isExpanded ? 'rotate-180 bg-white/10' : 'rotate-0'}
                                ${node.role === 'franchise' ? 'text-white hover:bg-white/20' : 'text-slate-400 hover:bg-slate-100'}
                            `}>
                                    <ChevronDown size={18} strokeWidth={2.5} />
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                <AnimatePresence>
                    {isExpanded && hasChildren && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="relative ml-8 pl-8 border-l-2 border-slate-200/50 space-y-4 pt-4"
                        >
                            {node.children!.map((child, idx) => (
                                // Render child only if it passes filter
                                <FilteredTreeNode
                                    key={child.id}
                                    node={child}
                                    depth={depth + 1}
                                    isLast={idx === node.children!.length - 1}
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

export const NetworkTree: React.FC<NetworkTreeProps> = ({ data, searchTerm, onInvite }) => {
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
                {data.map(rootNode => (
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
