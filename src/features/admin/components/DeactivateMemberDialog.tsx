'use client';

import { useEffect, useRef, useState } from 'react';

import { changeProfileAuthorityAdminAction } from '@/app/actions/admin';
import type { AuthoritySummary } from '@/lib/profile-authority/schemas';

/**
 * Dar de baja a alguien del equipo, o devolverlo al trabajo.
 *
 * Antes esto solo se podía hacer entrando en "Cambiar autoridad" y eligiendo un
 * rol llamado "Pendiente / desactivado" — un nombre que mezcla dos estados
 * distintos y que nadie relaciona con dar de baja. La operación existía y era
 * invisible.
 *
 * No se borra a nadie. Sus comisiones, sus clientes y su rastro de auditoría
 * apuntan a ese perfil: borrarlo dejaría huérfano lo ya cobrado. Se le retira el
 * acceso y se conserva el histórico, que es lo que quiere decir "dar de baja"
 * en una empresa.
 */
export function DeactivateMemberDialog({
    profile,
    requestId,
    returnFocus,
    onClose,
    onChanged,
}: {
    profile: AuthoritySummary;
    requestId: string;
    returnFocus?: HTMLElement | null;
    onClose: () => void;
    onChanged: () => void;
}) {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const confirmRef = useRef<HTMLButtonElement>(null);

    const isDeactivated = profile.role === null;
    const displayName = profile.fullName ?? profile.email;

    useEffect(() => {
        confirmRef.current?.focus();
    }, []);

    const close = () => {
        returnFocus?.focus();
        onClose();
    };

    async function confirm() {
        setPending(true);
        setError('');

        // Reactivar devuelve a colaborador colgando de la administración, que es
        // el único destino que el modelo actual admite. Si hiciera falta otra
        // cosa, se ajusta después desde "Cambiar autoridad".
        const result = await changeProfileAuthorityAdminAction(
            isDeactivated
                ? {
                    targetId: profile.id,
                    desiredRole: 'agent',
                    parentId: profile.parentId,
                    franchiseId: profile.franchiseId,
                    expectedAuthorityVersion: profile.authorityVersion,
                    reasonCode: 'reactivation',
                    requestId,
                }
                : {
                    targetId: profile.id,
                    desiredRole: null,
                    parentId: null,
                    franchiseId: null,
                    expectedAuthorityVersion: profile.authorityVersion,
                    reasonCode: 'deactivation',
                    requestId,
                },
        );

        if (!result.success) {
            setError(result.error);
            setPending(false);
            return;
        }
        onChanged();
    }

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
                aria-label={isDeactivated ? 'Reactivar miembro del equipo' : 'Dar de baja a un miembro del equipo'}
                className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900"
            >
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {isDeactivated ? 'Reactivar a esta persona' : 'Dar de baja a esta persona'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{displayName}</p>

                {isDeactivated ? (
                    <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                        <p>Volverá a entrar en la aplicación como colaborador y recuperará su cartera.</p>
                        <p className="text-xs text-slate-400">
                            Su comisión será la que tuviera configurada. Compruébala antes de que empiece a vender.
                        </p>
                    </div>
                ) : (
                    <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                        <p><strong className="text-slate-900 dark:text-white">Perderá el acceso</strong> a la aplicación de inmediato.</p>
                        <p>
                            <strong className="text-slate-900 dark:text-white">No se borra nada.</strong> Sus clientes siguen
                            siendo de Zinergia, sus comisiones ya liquidadas no cambian, y su historial se conserva.
                        </p>
                        <p className="text-xs text-slate-400">
                            Se puede reactivar cuando quieras desde esta misma pantalla.
                        </p>
                    </div>
                )}

                {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={close}
                        disabled={pending}
                        className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300"
                    >
                        Cancelar
                    </button>
                    <button
                        ref={confirmRef}
                        type="button"
                        onClick={confirm}
                        disabled={pending}
                        className={`rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${
                            isDeactivated ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                    >
                        {pending
                            ? 'Guardando…'
                            : isDeactivated ? 'Reactivar' : 'Dar de baja'}
                    </button>
                </div>
            </div>
        </div>
    );
}
