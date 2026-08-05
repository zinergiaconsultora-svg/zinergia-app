'use client';

import { useEffect, useState } from 'react';

import {
    getCollaboratorRatesAction,
    setCollaboratorRateAction,
    type CollaboratorRate,
} from '@/app/actions/collaboratorCommission';
import { formatRate, parseRatePercent } from '@/lib/commissions/collaboratorCommission';

/**
 * El porcentaje de comisión de un colaborador, con su historial.
 *
 * Se guarda por separado del cambio de autoridad, con su propio botón: son dos
 * decisiones distintas y compartir el envío haría que el fallo de una dejase la
 * otra aplicada.
 *
 * El historial se muestra porque cambiar el porcentaje no reescribe lo ya
 * cerrado: lo anterior sigue vigente para las operaciones anteriores, y quien
 * mire esta pantalla tiene que poder explicar por qué una operación pagó otra
 * cosa.
 */
export function CommissionRateField({ profileId }: { profileId: string }) {
    const [rates, setRates] = useState<CollaboratorRate[] | null>(null);
    const [value, setValue] = useState('');
    const [note, setNote] = useState('');
    const [pending, setPending] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

    useEffect(() => {
        let active = true;
        void getCollaboratorRatesAction(profileId).then(result => {
            if (active) setRates(result);
        });
        return () => { active = false; };
    }, [profileId]);

    const current = rates?.[0] ?? null;
    const parsed = parseRatePercent(value);
    const canSave = !pending && parsed !== null;

    async function save() {
        if (parsed === null) return;
        setPending(true);
        setFeedback(null);

        const result = await setCollaboratorRateAction({
            profileId,
            rateBps: parsed,
            note: note.trim() || undefined,
        });

        if (result.success) {
            setValue('');
            setNote('');
            setFeedback({ type: 'ok', text: 'Comisión guardada' });
            setRates(await getCollaboratorRatesAction(profileId));
        } else {
            setFeedback({ type: 'error', text: result.error });
        }
        setPending(false);
    }

    return (
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Comisión del colaborador</p>
                <p className={`text-sm font-bold ${current ? 'text-slate-900 dark:text-white' : 'text-amber-600'}`}>
                    {rates === null ? '…' : formatRate(current?.rateBps ?? null)}
                </p>
            </div>

            {rates !== null && current === null ? (
                <p className="mt-1 text-xs text-amber-600">
                    Sin comisión configurada: este colaborador no cobraría nada por sus ventas.
                </p>
            ) : null}

            <div className="mt-2 flex gap-2">
                <label className="flex-1 text-xs font-semibold text-slate-500">
                    Nuevo porcentaje
                    <div className="relative mt-1">
                        <input
                            type="text"
                            inputMode="decimal"
                            value={value}
                            onChange={event => setValue(event.target.value)}
                            placeholder="65"
                            aria-label="Nuevo porcentaje de comisión"
                            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-7 text-sm dark:border-slate-700 dark:bg-slate-950"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                    </div>
                </label>
                <label className="flex-[2] text-xs font-semibold text-slate-500">
                    Nota (opcional)
                    <input
                        type="text"
                        value={note}
                        onChange={event => setNote(event.target.value)}
                        placeholder="Motivo del cambio"
                        aria-label="Nota del cambio de comisión"
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    />
                </label>
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-400">
                    Se aplica a lo que se cierre a partir de ahora. Lo anterior no cambia.
                </p>
                <button
                    type="button"
                    onClick={save}
                    disabled={!canSave}
                    className="shrink-0 rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 dark:bg-white dark:text-slate-950"
                >
                    {pending ? 'Guardando…' : 'Guardar comisión'}
                </button>
            </div>

            {feedback ? (
                <p
                    role={feedback.type === 'error' ? 'alert' : undefined}
                    className={`mt-2 text-xs ${feedback.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}
                >
                    {feedback.text}
                </p>
            ) : null}

            {rates && rates.length > 1 ? (
                <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] font-semibold text-slate-500">
                        Historial ({rates.length})
                    </summary>
                    <ul className="mt-1 space-y-0.5">
                        {rates.map(rate => (
                            <li key={`${rate.effectiveFrom}-${rate.rateBps}`} className="text-[11px] text-slate-500">
                                {formatRate(rate.rateBps)} desde {new Date(rate.effectiveFrom).toLocaleDateString('es-ES')}
                                {rate.note ? ` — ${rate.note}` : ''}
                            </li>
                        ))}
                    </ul>
                </details>
            ) : null}
        </div>
    );
}
