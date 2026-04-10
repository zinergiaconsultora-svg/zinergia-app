'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Pencil, Check, X, Loader2, Users,
    Building2, ChevronDown, UserMinus, Shield,
} from 'lucide-react';
import type { AgentProfile, FranchiseWithAgents } from '@/app/actions/admin';
import {
    updateAgentAdminAction,
    assignAgentToFranchise,
    removeAgentFromFranchise,
} from '@/app/actions/admin';

interface Props {
    agents: AgentProfile[];
    franchises: FranchiseWithAgents[];
}

const ROLE_META: Record<string, { label: string; cls: string }> = {
    agent:     { label: 'Agente',    cls: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/25' },
    franchise: { label: 'Franquicia', cls: 'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-500/25' },
    admin:     { label: 'Admin',     cls: 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/25' },
};

function RoleBadge({ role }: { role: string }) {
    const meta = ROLE_META[role] ?? { label: role, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${meta.cls}`}>
            {meta.label}
        </span>
    );
}

function AgentAvatar({ name, email }: { name: string | null; email: string }) {
    const label = name ?? email;
    const initial = label.charAt(0).toUpperCase();
    const colors = [
        'from-indigo-400 to-indigo-600',
        'from-violet-400 to-violet-600',
        'from-rose-400 to-rose-600',
        'from-emerald-400 to-emerald-600',
        'from-amber-400 to-amber-600',
        'from-cyan-400 to-cyan-600',
    ];
    const color = colors[label.charCodeAt(0) % colors.length];
    return (
        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white text-xs font-black shrink-0 shadow-sm`}>
            {initial}
        </div>
    );
}

interface EditState {
    agentId: string;
    fullName: string;
    role: string;
    franchiseId: string;
}

function AgentRow({
    agent,
    franchises,
    onSaved,
}: {
    agent: AgentProfile;
    franchises: FranchiseWithAgents[];
    onSaved: () => void;
}) {
    const [editing, setEditing] = useState(false);
    const [edit, setEdit] = useState<EditState>({
        agentId: agent.id,
        fullName: agent.full_name ?? '',
        role: agent.role,
        franchiseId: agent.franchise_id ?? '',
    });
    const [isPending, start] = useTransition();
    const [error, setError] = useState('');

    const franchiseName = useMemo(
        () => franchises.find(f => f.id === agent.franchise_id)?.name ?? null,
        [franchises, agent.franchise_id],
    );

    const handleSave = () => {
        start(async () => {
            try {
                await updateAgentAdminAction(agent.id, {
                    full_name: edit.fullName.trim() || undefined,
                    role: edit.role,
                });
                if (edit.franchiseId && edit.franchiseId !== agent.franchise_id) {
                    await assignAgentToFranchise(agent.id, edit.franchiseId);
                } else if (!edit.franchiseId && agent.franchise_id) {
                    await removeAgentFromFranchise(agent.id);
                }
                setEditing(false);
                onSaved();
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Error al guardar');
            }
        });
    };

    const handleCancel = () => {
        setEdit({ agentId: agent.id, fullName: agent.full_name ?? '', role: agent.role, franchiseId: agent.franchise_id ?? '' });
        setEditing(false);
        setError('');
    };

    return (
        <motion.tr
            layout
            className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors group"
        >
            {/* Name / email */}
            <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                    <AgentAvatar name={agent.full_name} email={agent.email ?? ''} />
                    {editing ? (
                        <input
                            type="text"
                            value={edit.fullName}
                            onChange={e => setEdit(prev => ({ ...prev, fullName: e.target.value }))}
                            placeholder="Nombre completo"
                            className="text-sm border border-indigo-300 dark:border-indigo-600 rounded-lg px-2.5 py-1.5 outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-white w-44 focus:ring-2 focus:ring-indigo-400/25"
                            autoFocus
                        />
                    ) : (
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                                {agent.full_name ?? <span className="text-slate-400 italic font-normal">Sin nombre</span>}
                            </p>
                            <p className="text-xs text-slate-400 truncate">{agent.email}</p>
                        </div>
                    )}
                </div>
            </td>

            {/* Role */}
            <td className="px-4 py-3">
                {editing ? (
                    <div className="relative w-36">
                        <select
                            value={edit.role}
                            onChange={e => setEdit(prev => ({ ...prev, role: e.target.value }))}
                            className="w-full appearance-none text-xs border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-400/25 pr-7"
                        >
                            <option value="agent">Agente</option>
                            <option value="franchise">Franquicia</option>
                            <option value="admin">Admin</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                    </div>
                ) : (
                    <RoleBadge role={agent.role} />
                )}
            </td>

            {/* Franchise */}
            <td className="px-4 py-3">
                {editing ? (
                    <div className="relative w-48">
                        <select
                            value={edit.franchiseId}
                            onChange={e => setEdit(prev => ({ ...prev, franchiseId: e.target.value }))}
                            className="w-full appearance-none text-xs border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-400/25 pr-7"
                        >
                            <option value="">— Sin franquicia —</option>
                            {franchises.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5">
                        {franchiseName ? (
                            <>
                                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="text-xs text-slate-600 dark:text-slate-300">{franchiseName}</span>
                            </>
                        ) : (
                            <span className="text-xs text-slate-400 italic">Sin asignar</span>
                        )}
                    </div>
                )}
            </td>

            {/* Actions */}
            <td className="px-4 py-3">
                <div className="flex items-center gap-1.5 justify-end">
                    {error && <span className="text-[10px] text-rose-500 mr-1">{error}</span>}
                    {editing ? (
                        <>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isPending}
                                title="Guardar cambios"
                                aria-label="Guardar cambios del agente"
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
                            >
                                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button
                                type="button"
                                onClick={handleCancel}
                                title="Cancelar edición"
                                aria-label="Cancelar edición del agente"
                                className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setEditing(true)}
                            title="Editar agente"
                            aria-label={`Editar agente ${agent.full_name ?? agent.email}`}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 dark:text-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </td>
        </motion.tr>
    );
}

export default function AgentsManagement({ agents, franchises }: Props) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [filterRole, setFilterRole] = useState<string>('all');
    const [filterFranchise, setFilterFranchise] = useState<string>('all');

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return agents.filter(a => {
            const matchQ = !q
                || (a.full_name ?? '').toLowerCase().includes(q)
                || (a.email ?? '').toLowerCase().includes(q);
            const matchRole = filterRole === 'all' || a.role === filterRole;
            const matchFranchise = filterFranchise === 'all'
                || (filterFranchise === 'none' ? !a.franchise_id : a.franchise_id === filterFranchise);
            return matchQ && matchRole && matchFranchise;
        });
    }, [agents, query, filterRole, filterFranchise]);

    const unassignedCount = agents.filter(a => !a.franchise_id && a.role === 'agent').length;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-500" />
                        Gestión de Agentes
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {agents.length} usuarios · {unassignedCount > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                                {unassignedCount} sin franquicia
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o email…"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-400/25 focus:border-indigo-400 transition-all"
                    />
                </div>

                {/* Role filter */}
                <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <select
                        value={filterRole}
                        onChange={e => setFilterRole(e.target.value)}
                        className="pl-8 pr-8 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-400/25 appearance-none cursor-pointer"
                    >
                        <option value="all">Todos los roles</option>
                        <option value="agent">Agente</option>
                        <option value="franchise">Franquicia</option>
                        <option value="admin">Admin</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>

                {/* Franchise filter */}
                <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <select
                        value={filterFranchise}
                        onChange={e => setFilterFranchise(e.target.value)}
                        className="pl-8 pr-8 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-400/25 appearance-none cursor-pointer"
                    >
                        <option value="all">Todas las franquicias</option>
                        <option value="none">Sin franquicia</option>
                        {franchises.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-white/80 dark:border-white/8 shadow-lg overflow-hidden">
                {filtered.length === 0 ? (
                    <div className="py-16 text-center">
                        <UserMinus className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        <p className="text-sm text-slate-500">No hay resultados para esta búsqueda.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800/60">
                                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                        Agente
                                    </th>
                                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                        Rol
                                    </th>
                                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                        Franquicia
                                    </th>
                                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence initial={false}>
                                    {filtered.map(agent => (
                                        <AgentRow
                                            key={agent.id}
                                            agent={agent}
                                            franchises={franchises}
                                            onSaved={() => router.refresh()}
                                        />
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800/40 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                        {filtered.length} de {agents.length} agentes
                    </span>
                    {query || filterRole !== 'all' || filterFranchise !== 'all' ? (
                        <button
                            type="button"
                            onClick={() => { setQuery(''); setFilterRole('all'); setFilterFranchise('all'); }}
                            className="text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
                        >
                            Limpiar filtros
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
