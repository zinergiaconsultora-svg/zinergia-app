'use client';

import { useState, useTransition } from 'react';
import {
    Building2,
    Users,
    ToggleLeft,
    ToggleRight,
    UserPlus,
    UserMinus,
    ChevronDown,
    Loader2,
    AlertCircle,
    Plus,
    X,
    Check,
} from 'lucide-react';
import type { FranchiseWithAgents, AgentProfile } from '@/app/actions/admin';
import {
    toggleFranchiseActive,
    assignAgentToFranchise,
    removeAgentFromFranchise,
    createFranchiseAction,
} from '@/app/actions/admin';
import { useRouter } from 'next/navigation';

interface FranchiseListProps {
    franchises: FranchiseWithAgents[];
    unassignedAgents: AgentProfile[];
}

function NewFranchiseForm({ onClose }: { onClose: () => void }) {
    const router = useRouter();
    const [name, setName] = useState('');
    const [isPending, start] = useTransition();
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) { setError('El nombre es obligatorio'); return; }
        start(async () => {
            try {
                await createFranchiseAction(name.trim());
                router.refresh();
                onClose();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error al crear');
            }
        });
    };

    return (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/25">
            <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
                placeholder="Nombre de la franquicia"
                className="flex-1 text-sm bg-transparent outline-none text-slate-800 dark:text-white placeholder-slate-400"
                autoFocus
            />
            {error && <span className="text-xs text-rose-500 shrink-0">{error}</span>}
            <button
                type="submit"
                disabled={isPending || !name.trim()}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors shrink-0"
                title="Crear franquicia"
            >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button
                type="button"
                onClick={onClose}
                title="Cancelar"
                aria-label="Cancelar nueva franquicia"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </form>
    );
}

export default function FranchiseList({ franchises, unassignedAgents }: FranchiseListProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [assigningTo, setAssigningTo] = useState<string | null>(null);
    const [showNewForm, setShowNewForm] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);

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

    function handleRemove(agentId: string) {
        setError(null);
        setRemovingId(agentId);
        startTransition(async () => {
            try {
                await removeAgentFromFranchise(agentId);
                router.refresh();
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Error desconocido');
            } finally {
                setRemovingId(null);
            }
        });
    }

    return (
        <div className="space-y-3">
            {/* Create new franchise */}
            {showNewForm ? (
                <NewFranchiseForm onClose={() => setShowNewForm(false)} />
            ) : (
                <button
                    type="button"
                    onClick={() => setShowNewForm(true)}
                    className="w-full flex items-center gap-2 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-indigo-400 hover:text-indigo-500 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-all text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Nueva franquicia
                </button>
            )}

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            {franchises.length === 0 ? (
                <div className="text-center py-12">
                    <Building2 className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">No hay franquicias registradas aún.</p>
                </div>
            ) : (
                franchises.map((franchise) => (
                    <div
                        key={franchise.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/30 overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-600/50 shadow-sm dark:shadow-none"
                    >
                        {/* Franchise Row */}
                        <div className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                                    franchise.is_active
                                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                        : 'bg-slate-200 dark:bg-slate-700/50 text-slate-500 border border-slate-300 dark:border-slate-600/30'
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
                                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                    <Users className="w-3.5 h-3.5" />
                                    <span>{franchise.agent_count}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleToggle(franchise.id, franchise.is_active)}
                                    disabled={isPending}
                                    className="transition-colors disabled:opacity-50"
                                    title={franchise.is_active ? 'Desactivar franquicia' : 'Activar franquicia'}
                                    aria-label={franchise.is_active ? 'Desactivar franquicia' : 'Activar franquicia'}
                                >
                                    {franchise.is_active ? (
                                        <ToggleRight className="w-6 h-6 text-emerald-400" />
                                    ) : (
                                        <ToggleLeft className="w-6 h-6 text-slate-500" />
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setExpandedId(expandedId === franchise.id ? null : franchise.id)}
                                    title={expandedId === franchise.id ? 'Contraer' : 'Expandir agentes'}
                                    aria-label={expandedId === franchise.id ? 'Contraer lista de agentes' : 'Expandir lista de agentes'}
                                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                                >
                                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expandedId === franchise.id ? 'rotate-180' : ''}`} />
                                </button>
                            </div>
                        </div>

                        {/* Expanded Detail */}
                        {expandedId === franchise.id && (
                            <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-700/30 space-y-3 mt-1">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                                        Agentes asignados
                                    </p>
                                    <button
                                        onClick={() => setAssigningTo(assigningTo === franchise.id ? null : franchise.id)}
                                        className="flex items-center gap-1.5 text-xs font-medium text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                                    >
                                        <UserPlus className="w-3.5 h-3.5" />
                                        Asignar agente
                                    </button>
                                </div>

                                {/* Assign dropdown */}
                                {assigningTo === franchise.id && (
                                    <div className="rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-indigo-200 dark:border-indigo-500/20 p-3 space-y-1">
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 font-semibold uppercase tracking-wider">
                                            {unassignedAgents.length > 0 ? 'Agentes sin franquicia' : 'Todos los agentes tienen franquicia asignada'}
                                        </p>
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

                                {/* Agent list */}
                                {franchise.agents.length === 0 ? (
                                    <p className="text-xs text-slate-500 italic py-2">Sin agentes asignados.</p>
                                ) : (
                                    <div className="space-y-1 mt-1">
                                        {franchise.agents.map(agent => (
                                            <div key={agent.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/30 group">
                                                <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
                                                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                                        {(agent.full_name ?? agent.email).charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">{agent.full_name ?? 'Sin nombre'}</p>
                                                    <p className="text-[10px] text-slate-400 truncate">{agent.email}</p>
                                                </div>
                                                {/* Remove from franchise */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemove(agent.id)}
                                                    disabled={isPending}
                                                    title="Desasignar de esta franquicia"
                                                    className="w-6 h-6 flex items-center justify-center rounded-md text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50 shrink-0"
                                                >
                                                    {removingId === agent.id ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <UserMinus className="w-3 h-3" />
                                                    )}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
}
