'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, ChevronDown, KeyRound, Loader2, Pencil, Search, Shield, UserMinus, Users, X } from 'lucide-react';
import type { FranchiseWithAgents, ProfileAuthoritySummary } from '@/app/actions/admin';
import { updateTeamMemberNameAction } from '@/app/actions/network';
import { AuthorityChangeDialog } from './AuthorityChangeDialog';

interface Props {
    agents: ProfileAuthoritySummary[];
    franchises: FranchiseWithAgents[];
}

const ROLE_META: Record<string, { label: string; cls: string }> = {
    agent: { label: 'Agente', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    franchise: { label: 'Franquicia', cls: 'bg-violet-100 text-violet-700 border-violet-200' },
    admin: { label: 'Admin', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
    pending: { label: 'Pendiente', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function RoleBadge({ role }: { role: ProfileAuthoritySummary['role'] }) {
    const meta = ROLE_META[role ?? 'pending'];
    return (
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.cls}`}>
            {meta.label}
        </span>
    );
}

function AgentAvatar({ profile }: { profile: ProfileAuthoritySummary }) {
    const label = profile.fullName ?? profile.email;
    return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 text-xs font-black text-white shadow-sm">
            {label.charAt(0).toUpperCase()}
        </div>
    );
}

function AgentRow({
    profile,
    franchises,
    onAuthority,
    onSaved,
}: {
    profile: ProfileAuthoritySummary;
    franchises: FranchiseWithAgents[];
    onAuthority: (profile: ProfileAuthoritySummary, opener: HTMLButtonElement) => void;
    onSaved: () => void;
}) {
    const [editingName, setEditingName] = useState(false);
    const [fullName, setFullName] = useState(profile.fullName ?? '');
    const [error, setError] = useState('');
    const [pending, startTransition] = useTransition();
    const displayName = profile.fullName ?? profile.email;
    const franchiseName = franchises.find(item => item.id === profile.franchiseId)?.name;

    const saveName = () => {
        startTransition(async () => {
            setError('');
            const result = await updateTeamMemberNameAction({
                targetId: profile.id,
                fullName,
            });
            if (!result.success) {
                setError(result.error);
                return;
            }
            setEditingName(false);
            onSaved();
        });
    };

    return (
        <tr className="border-b border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800/60 dark:hover:bg-slate-800/30">
            <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                    <AgentAvatar profile={profile} />
                    {editingName ? (
                        <label className="sr-only" htmlFor={`name-${profile.id}`}>Nombre completo</label>
                    ) : null}
                    {editingName ? (
                        <input
                            id={`name-${profile.id}`}
                            aria-label="Nombre completo"
                            autoFocus
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            className="w-44 rounded-lg border border-indigo-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-400/25 dark:border-indigo-600 dark:bg-slate-800 dark:text-white"
                        />
                    ) : (
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{profile.fullName ?? 'Sin nombre'}</p>
                            <p className="truncate text-xs text-slate-400">{profile.email}</p>
                        </div>
                    )}
                </div>
            </td>
            <td className="px-4 py-3"><RoleBadge role={profile.role} /></td>
            <td className="px-4 py-3">
                {franchiseName ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        {franchiseName}
                    </div>
                ) : <span className="text-xs italic text-slate-400">Sin asignar</span>}
            </td>
            <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1.5">
                    {error ? <span role="alert" className="mr-1 text-[10px] text-rose-500">{error}</span> : null}
                    {editingName ? (
                        <>
                            <button
                                type="button"
                                onClick={saveName}
                                disabled={pending}
                                aria-label="Guardar nombre"
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white disabled:opacity-50"
                            >
                                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setFullName(profile.fullName ?? '');
                                    setEditingName(false);
                                    setError('');
                                }}
                                aria-label="Cancelar edición de nombre"
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => setEditingName(true)}
                                aria-label={`Editar nombre de ${displayName}`}
                                title="Editar nombre"
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={(event) => onAuthority(profile, event.currentTarget)}
                                aria-label={`Cambiar autoridad de ${displayName}`}
                                title="Cambiar autoridad"
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-700"
                            >
                                <KeyRound className="h-3.5 w-3.5" />
                            </button>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
}

export default function AgentsManagement({ agents, franchises }: Props) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [filterRole, setFilterRole] = useState('all');
    const [filterFranchise, setFilterFranchise] = useState('all');
    const [authority, setAuthority] = useState<{
        profile: ProfileAuthoritySummary;
        requestId: string;
        opener: HTMLButtonElement;
    } | null>(null);

    const filtered = useMemo(() => {
        const normalized = query.toLowerCase();
        return agents.filter(profile => {
            const matchesQuery = !normalized
                || (profile.fullName ?? '').toLowerCase().includes(normalized)
                || profile.email.toLowerCase().includes(normalized);
            const matchesRole = filterRole === 'all' || (filterRole === 'pending' ? profile.role === null : profile.role === filterRole);
            const matchesFranchise = filterFranchise === 'all'
                || (filterFranchise === 'none' ? profile.franchiseId === null : profile.franchiseId === filterFranchise);
            return matchesQuery && matchesRole && matchesFranchise;
        });
    }, [agents, filterFranchise, filterRole, query]);

    const unassignedCount = agents.filter(profile => profile.role === 'agent' && !profile.franchiseId).length;

    return (
        <div className="space-y-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-white">
                        <Users className="h-5 w-5 text-indigo-500" /> Gestión de Agentes
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                        {agents.length} usuarios{unassignedCount > 0 ? ` · ${unassignedCount} sin franquicia` : ''}
                    </p>
                </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        aria-label="Buscar personas"
                        placeholder="Buscar por nombre o email…"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                </div>
                <FilterSelect icon={<Shield className="h-3.5 w-3.5" />} label="Filtrar por rol" value={filterRole} onChange={setFilterRole}>
                    <option value="all">Todos los roles</option>
                    <option value="agent">Agente</option>
                    <option value="franchise">Franquicia</option>
                    <option value="admin">Admin</option>
                    <option value="pending">Pendiente</option>
                </FilterSelect>
                <FilterSelect icon={<Building2 className="h-3.5 w-3.5" />} label="Filtrar por franquicia" value={filterFranchise} onChange={setFilterFranchise}>
                    <option value="all">Todas las franquicias</option>
                    <option value="none">Sin franquicia</option>
                    {franchises.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </FilterSelect>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/70 shadow-lg dark:border-slate-800 dark:bg-slate-800/60">
                {filtered.length === 0 ? (
                    <div className="py-16 text-center"><UserMinus className="mx-auto mb-3 h-10 w-10 text-slate-300" /><p className="text-sm text-slate-500">No hay resultados para esta búsqueda.</p></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead><tr className="border-b border-slate-100 dark:border-slate-800"><th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Persona</th><th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Rol</th><th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Franquicia</th><th className="px-4 py-3 text-right text-[10px] font-bold uppercase text-slate-400">Acciones</th></tr></thead>
                            <tbody>{filtered.map(profile => (
                                <AgentRow
                                    key={profile.id}
                                    profile={profile}
                                    franchises={franchises}
                                    onSaved={() => router.refresh()}
                                    onAuthority={(selected, opener) => setAuthority({
                                        profile: selected,
                                        requestId: crypto.randomUUID(),
                                        opener,
                                    })}
                                />
                            ))}</tbody>
                        </table>
                    </div>
                )}
            </div>

            {authority ? (
                <AuthorityChangeDialog
                    profile={authority.profile}
                    profiles={agents}
                    franchises={franchises.map(item => ({ id: item.id, name: item.name, isActive: item.is_active }))}
                    requestId={authority.requestId}
                    returnFocus={authority.opener}
                    onClose={() => setAuthority(null)}
                    onChanged={() => {
                        setAuthority(null);
                        router.refresh();
                    }}
                />
            ) : null}
        </div>
    );
}

function FilterSelect({
    icon,
    label,
    value,
    onChange,
    children,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    onChange: (value: string) => void;
    children: React.ReactNode;
}) {
    return (
        <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
            <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-8 pr-8 text-sm dark:border-slate-700 dark:bg-slate-800">
                {children}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>
    );
}
