'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { changeProfileAuthorityAdminAction } from '@/app/actions/admin';
import { CommissionRateField } from './CommissionRateField';
import type {
    AuthorityReasonCode,
    AuthoritySummary,
    ProfileRole,
} from '@/lib/profile-authority/schemas';

type FranchiseOption = { id: string; name: string; isActive: boolean };

const ROLE_LABELS: Record<ProfileRole | 'deactivated', string> = {
    admin: 'Administrador',
    franchise: 'Franquicia',
    agent: 'Colaborador',
    deactivated: 'Pendiente / desactivado',
};

const REASONS: Array<{ value: AuthorityReasonCode; label: string }> = [
    { value: 'role_change', label: 'Cambio de rol' },
    { value: 'franchise_assignment', label: 'Asignación de franquicia' },
    { value: 'franchise_removal', label: 'Retirada de franquicia' },
    { value: 'deactivation', label: 'Desactivación' },
    { value: 'reactivation', label: 'Reactivación' },
    { value: 'authority_correction', label: 'Corrección de autoridad' },
];

export function AuthorityChangeDialog({
    profile,
    profiles,
    franchises,
    requestId,
    returnFocus,
    onClose,
    onChanged,
}: {
    profile: AuthoritySummary;
    profiles: AuthoritySummary[];
    franchises: FranchiseOption[];
    requestId: string;
    returnFocus?: HTMLElement | null;
    onClose: () => void;
    onChanged: () => void;
}) {
    const [role, setRole] = useState<ProfileRole | 'deactivated'>(profile.role ?? 'deactivated');
    const [parentId, setParentId] = useState(profile.parentId ?? '');
    const [franchiseId, setFranchiseId] = useState(profile.franchiseId ?? '');
    const [reasonCode, setReasonCode] = useState<AuthorityReasonCode | ''>('');
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const roleRef = useRef<HTMLSelectElement>(null);

    useEffect(() => {
        roleRef.current?.focus();
    }, []);

    const close = () => {
        returnFocus?.focus();
        onClose();
    };

    const desiredRole = role === 'deactivated' ? null : role;
    const needsScope = desiredRole === 'agent' || desiredRole === 'franchise';
    const proposedParentId = needsScope ? (parentId || null) : null;
    const proposedFranchiseId = needsScope ? (franchiseId || null) : null;
    const canSubmit = !pending
        && reasonCode !== ''
        && (!needsScope || (proposedParentId !== null && proposedFranchiseId !== null));

    const parentOptions = useMemo(() => profiles.filter((candidate) => {
        if (candidate.id === profile.id) return false;
        if (candidate.role === 'admin' && candidate.parentId === null && candidate.franchiseId === null) return true;
        return desiredRole === 'agent'
            && candidate.role === 'franchise'
            && candidate.franchiseId === proposedFranchiseId;
    }), [desiredRole, profile.id, profiles, proposedFranchiseId]);

    const changeRole = (next: ProfileRole | 'deactivated') => {
        setRole(next);
        setError('');
        if (next === 'admin' || next === 'deactivated') {
            setParentId('');
            setFranchiseId('');
        } else if (next !== profile.role) {
            setParentId('');
            setFranchiseId('');
        }
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!canSubmit) return;
        setPending(true);
        setError('');
        const result = await changeProfileAuthorityAdminAction({
            targetId: profile.id,
            desiredRole,
            parentId: proposedParentId,
            franchiseId: proposedFranchiseId,
            expectedAuthorityVersion: profile.authorityVersion,
            reasonCode,
            requestId,
        });
        if (!result.success) {
            setError(result.error);
            setPending(false);
            return;
        }
        onChanged();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) close();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="authority-dialog-title"
                onKeyDown={(event) => {
                    if (event.key === 'Escape' && !pending) close();
                }}
                className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900"
            >
                <h2 id="authority-dialog-title" className="text-lg font-bold text-slate-950 dark:text-white">
                    Cambiar autoridad
                </h2>
                <p className="mt-1 text-sm text-slate-500">{profile.fullName ?? profile.email}</p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <AuthorityState label="Actual" role={profile.role} parentId={profile.parentId} franchiseId={profile.franchiseId} />
                    <AuthorityState label="Propuesta" role={desiredRole} parentId={proposedParentId} franchiseId={proposedFranchiseId} />
                </div>

                <form onSubmit={submit} className="mt-5 space-y-4">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Rol propuesto
                        <select
                            ref={roleRef}
                            aria-label="Rol propuesto"
                            value={role}
                            onChange={(event) => changeRole(event.target.value as ProfileRole | 'deactivated')}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                        >
                            <option value="agent">Colaborador</option>
                            <option value="franchise">Franquicia</option>
                            <option value="admin">Administrador</option>
                            <option value="deactivated">Pendiente / desactivado</option>
                        </select>
                    </label>

                    {needsScope ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Franquicia
                                <select
                                    aria-label="Franquicia propuesta"
                                    value={franchiseId}
                                    onChange={(event) => {
                                        setFranchiseId(event.target.value);
                                        setParentId('');
                                    }}
                                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                                >
                                    <option value="">Selecciona…</option>
                                    {franchises.filter(item => item.isActive).map(item => (
                                        <option key={item.id} value={item.id}>{item.name}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Responsable
                                <select
                                    aria-label="Responsable propuesto"
                                    value={parentId}
                                    onChange={(event) => setParentId(event.target.value)}
                                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                                >
                                    <option value="">Selecciona…</option>
                                    {parentOptions.map(item => (
                                        <option key={item.id} value={item.id}>{item.fullName ?? item.email}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    ) : null}

                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Motivo
                        <select
                            aria-label="Motivo"
                            value={reasonCode}
                            onChange={(event) => setReasonCode(event.target.value as AuthorityReasonCode | '')}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                        >
                            <option value="">Selecciona un motivo…</option>
                            {REASONS.map(reason => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
                        </select>
                    </label>

                    {/*
                      * La comisión se guarda por su cuenta, con su propio botón. Va aquí
                      * porque es el momento en que se configura a una persona, pero no
                      * comparte el envío con el cambio de autoridad: si una fallara, la
                      * otra no debe quedar aplicada a medias.
                      */}
                    {desiredRole === 'agent' ? (
                        <CommissionRateField profileId={profile.id} />
                    ) : null}

                    {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}

                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={close} disabled={pending} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600">
                            Cancelar
                        </button>
                        <button type="submit" disabled={!canSubmit} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-slate-950">
                            {pending ? 'Guardando…' : 'Confirmar cambio'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function AuthorityState({
    label,
    role,
    parentId,
    franchiseId,
}: {
    label: string;
    role: ProfileRole | null;
    parentId: string | null;
    franchiseId: string | null;
}) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800">
            <p className="font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 font-semibold text-slate-900 dark:text-white">{ROLE_LABELS[role ?? 'deactivated']}</p>
            <p className="mt-1 truncate text-slate-500">Responsable: {parentId ?? '—'}</p>
            <p className="truncate text-slate-500">Franquicia: {franchiseId ?? '—'}</p>
        </div>
    );
}
