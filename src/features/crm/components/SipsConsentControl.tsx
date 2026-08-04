'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
    getSipsConsentStatusAction,
    recordSipsConsentAction,
    revokeSipsConsentAction,
    type SipsConsentSource,
    type SipsConsentStatus,
} from '@/app/actions/sipsConsent';

/**
 * Contextual SIPS consent capture (ZIN-SDD-043 REQ-006 / REQ-011).
 *
 * Lives inside the supply point it belongs to, so the CUPS and the client are already in
 * context and are never re-entered. There is no navigation entry for consent: it is a
 * property of a supply, not a module.
 *
 * SIPS holds the holder's personal data, so the consultation is gated on their
 * authorization. Recording it here is what opens the query - and it is the evidence that
 * should exist regardless.
 */

interface Props {
    cups: string;
    clientId: string;
}

const SOURCE_LABELS: Record<SipsConsentSource, string> = {
    agent_confirmation: 'Confirmación del agente',
    verbal_visit: 'Verbal en visita',
    signed_document: 'Documento firmado',
    email: 'Email del titular',
};

export default function SipsConsentControl({ cups, clientId }: Props) {
    const [status, setStatus] = useState<SipsConsentStatus | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [source, setSource] = useState<SipsConsentSource>('agent_confirmation');
    const [notes, setNotes] = useState('');

    const fetchStatus = useCallback(async (): Promise<SipsConsentStatus> => {
        try {
            return await getSipsConsentStatusAction(cups, clientId);
        } catch {
            // Unknown state is shown as "no consent": never imply an authorization we
            // could not confirm. Treated as SIPS-off so a broken lookup shows nothing
            // rather than an amber prompt the agent cannot resolve.
            return { sipsEnabled: false, hasActiveConsent: false };
        }
    }, [cups, clientId]);

    // The guard stops a slow response for a previous supply from overwriting the current
    // one, which would show the wrong consent state against the wrong CUPS.
    useEffect(() => {
        let active = true;
        fetchStatus().then(next => {
            if (active) setStatus(next);
        });
        return () => { active = false; };
    }, [fetchStatus]);

    const refresh = useCallback(async () => {
        setStatus(await fetchStatus());
    }, [fetchStatus]);

    async function record() {
        setBusy(true);
        const result = await recordSipsConsentAction({
            cups,
            clientId,
            source,
            notes: notes.trim() || undefined,
        });
        setBusy(false);

        if (!result.success) {
            toast.error(result.error);
            return;
        }
        toast.success(result.data.created
            ? 'Consentimiento registrado'
            : 'Ya había un consentimiento activo para este suministro');
        setExpanded(false);
        setNotes('');
        refresh();
    }

    async function revoke() {
        if (!status?.consentId) return;
        setBusy(true);
        const result = await revokeSipsConsentAction(status.consentId);
        setBusy(false);

        if (!result.success) {
            toast.error(result.error);
            return;
        }
        toast.success('Consentimiento revocado. La consulta SIPS queda bloqueada.');
        refresh();
    }

    if (!status) {
        return <div className="mx-3 mb-3 h-8 rounded-lg bg-slate-50 animate-pulse" aria-hidden="true" />;
    }

    // SIPS off: no prompt, no placeholder, nothing. Asking an agent to record an
    // authorization for a query they cannot run is noise, not compliance.
    if (!status.sipsEnabled) return null;

    if (status.hasActiveConsent) {
        return (
            <div className="mx-3 mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-2.5 py-2">
                <ShieldCheck size={13} className="text-emerald-600 shrink-0" aria-hidden="true" />
                <p className="text-[10px] font-semibold text-emerald-800 min-w-0">
                    Consulta SIPS autorizada
                    {status.consentAt && (
                        <span className="font-normal text-emerald-700">
                            {' · '}{new Date(status.consentAt).toLocaleDateString('es-ES')}
                        </span>
                    )}
                    {status.consentSource && SOURCE_LABELS[status.consentSource as SipsConsentSource] && (
                        <span className="font-normal text-emerald-700">
                            {' · '}{SOURCE_LABELS[status.consentSource as SipsConsentSource]}
                        </span>
                    )}
                </p>
                <button
                    type="button"
                    onClick={revoke}
                    disabled={busy}
                    className="ml-auto text-[10px] font-bold text-emerald-800 underline underline-offset-2 hover:text-emerald-900 disabled:opacity-50"
                >
                    {busy ? 'Revocando…' : 'Revocar'}
                </button>
            </div>
        );
    }

    return (
        <div className="mx-3 mb-3 rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-2">
            <div className="flex flex-wrap items-center gap-2">
                <ShieldAlert size={13} className="text-amber-600 shrink-0" aria-hidden="true" />
                <p className="text-[10px] font-semibold text-amber-800 min-w-0">
                    Sin consentimiento para consultar el SIPS
                </p>
                <button
                    type="button"
                    onClick={() => setExpanded(value => !value)}
                    aria-expanded={expanded}
                    className="ml-auto text-[10px] font-bold text-amber-900 underline underline-offset-2 hover:text-amber-950"
                >
                    {expanded ? 'Cancelar' : 'Registrar'}
                </button>
            </div>

            {expanded && (
                <div className="mt-2 space-y-2">
                    <p className="text-[10px] leading-relaxed text-amber-900/80">
                        El SIPS contiene datos del titular del suministro. Registra cómo te ha
                        autorizado a consultarlo; queda guardado con tu usuario y la fecha.
                    </p>
                    <label className="block">
                        <span className="sr-only">Origen del consentimiento</span>
                        <select
                            value={source}
                            onChange={event => setSource(event.target.value as SipsConsentSource)}
                            className="w-full px-2 py-1.5 rounded-lg border border-amber-200 bg-white text-[11px] font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                        >
                            {(Object.keys(SOURCE_LABELS) as SipsConsentSource[]).map(value => (
                                <option key={value} value={value}>{SOURCE_LABELS[value]}</option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="sr-only">Notas del consentimiento</span>
                        <input
                            type="text"
                            value={notes}
                            onChange={event => setNotes(event.target.value)}
                            maxLength={500}
                            placeholder="Referencia o nota (opcional)"
                            className="w-full px-2 py-1.5 rounded-lg border border-amber-200 bg-white text-[11px] focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                    </label>
                    <button
                        type="button"
                        onClick={record}
                        disabled={busy}
                        className="w-full py-1.5 rounded-lg bg-amber-600 text-white text-[11px] font-bold hover:bg-amber-700 disabled:opacity-60 flex items-center justify-center gap-1.5"
                    >
                        {busy && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
                        {busy ? 'Registrando…' : 'Registrar consentimiento'}
                    </button>
                </div>
            )}
        </div>
    );
}
