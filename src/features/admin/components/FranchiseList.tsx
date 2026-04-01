'use client';

import { useState, useTransition } from 'react';
import {
    Building2,
    Users,
    ToggleLeft,
    ToggleRight,
    UserPlus,
    ChevronDown,
    Loader2,
    AlertCircle,
} from 'lucide-react';
import type { FranchiseWithAgents, AgentProfile } from '@/app/actions/admin';
import {
    toggleFranchiseActive,
    assignAgentToFranchise,
} from '@/app/actions/admin';
import { useRouter } from 'next/navigation';

interface FranchiseListProps {
    franchises: FranchiseWithAgents[];
    unassignedAgents: AgentProfile[];
}

export default function FranchiseList({ franchises, unassignedAgents }: FranchiseListProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [assigningTo, setAssigningTo] = useState<string | null>(null);

    function handleToggle(franchiseId: string, currentState: boolean) {
        setError(null);
        startTransition(async () => {
            try {
                await toggleFranchiseActive(franchiseId, !currentState);
                router.refresh();
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Error desconocido');
            }
        });
    }

    function handleAssign(agentId: string, franchiseId: string) {
        setError(null);
        startTransition(async () => {
            try {
                await assignAgentToFranchise(agentId, franchiseId);
                setAssigningTo(null);
                router.refresh();
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Error desconocido');
            }
        });
    }

    if (franchises.length === 0) {
        return (
            <div className="text-center py-12">
                <Building2 className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400">No hay franquicias registradas aún.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            {franchises.map((franchise) => (
                <div
                    key={franchise.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/30 overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-600/50 shadow-sm dark:shadow-none"
                >
                    {/* Franchise Row */}
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                                franchise.is_active
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-slate-700/50 text-slate-500 border border-slate-600/30'
                            }`}>
                                {franchise.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                                    {franchise.name}
                                </p>
                                <p className="text-[11px] text-slate-500 font-mono">{franchise.slug}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Agent Count */}
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                <Users className="w-3.5 h-3.5" />
                                <span>{franchise.agent_count}</span>
                            </div>

                            {/* Toggle Active */}
                            <button
                                onClick={() => handleToggle(franchise.id, franchise.is_active)}
                                disabled={isPending}
                                className="transition-colors disabled:opacity-50"
                                title={franchise.is_active ? 'Desactivar' : 'Activar'}
                            >
                                {franchise.is_active ? (
                                    <ToggleRight className="w-6 h-6 text-emerald-400" />
                                ) : (
                                    <ToggleLeft className="w-6 h-6 text-slate-500" />
                                )}
                            </button>

                            {/* Expand */}
                            <button
                                onClick={() => setExpandedId(expandedId === franchise.id ? null : franchise.id)}
                                className="p-1 rounded-lg hover:bg-slate-700/50 transition-colors"
                                title={expandedId === franchise.id ? 'Contraer' : 'Expandir'}
                            >
                                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expandedId === franchise.id ? 'rotate-180' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Expanded Detail */}
                    {expandedId === franchise.id && (
                        <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-700/30 space-y-3 mt-1">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">Agentes asignados</p>
                                <button
                                    onClick={() => setAssigningTo(assigningTo === franchise.id ? null : franchise.id)}
                                    className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                                >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    Asignar
                                </button>
                            </div>

                            {/* Assign Agent Dropdown */}
                            {assigningTo === franchise.id && unassignedAgents.length > 0 && (
                                <div className="rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-indigo-200 dark:border-indigo-500/20 p-3 space-y-2">
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">Agentes sin franquicia:</p>
                                    {unassignedAgents.map(agent => (
                                        <button
                                            key={agent.id}
                                            onClick={() => handleAssign(agent.id, franchise.id)}
                                            disabled={isPending}
                                            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors text-left disabled:opacity-50"
                                        >
                                            <div>
                                                <p className="text-xs font-medium text-slate-800 dark:text-white">{agent.full_name ?? 'Sin nombre'}</p>
                                                <p className="text-[10px] text-slate-500">{agent.email}</p>
                                            </div>
                                            {isPending ? (
                                                <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                                            ) : (
                                                <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {assigningTo === franchise.id && unassignedAgents.length === 0 && (
                                <p className="text-xs text-slate-500 italic">Todos los agentes ya tienen franquicia asignada.</p>
                            )}

                            {/* Agent list */}
                            {franchise.agents.length === 0 ? (
                                <p className="text-xs text-slate-500 italic py-2">Sin agentes asignados.</p>
                            ) : (
                                <div className="space-y-1 mt-1">
                                    {franchise.agents.map(agent => (
                                        <div key={agent.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/30">
                                            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
                                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                                    {(agent.full_name ?? agent.email).charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">{agent.full_name ?? 'Sin nombre'}</p>
                                                <p className="text-[10px] text-slate-400 truncate">{agent.email}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
