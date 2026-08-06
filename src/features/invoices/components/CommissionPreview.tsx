'use client';

import React, { useEffect, useState } from 'react';

import { getCollaboratorRatesAction } from '@/app/actions/collaboratorCommission';
import {
    calculateCollaboratorCommission,
    formatRate,
} from '@/lib/commissions/collaboratorCommission';

/**
 * Lo que va a cobrar el colaborador por esta operación, mientras se cierra.
 *
 * Antes había un único campo "Comisión del comercial" donde se escribía el
 * importe a mano. Con el modelo nuevo ese importe tiene dos partes —el
 * porcentaje del colaborador y el extra que decide la administración— y esta
 * pieza las enseña por separado antes de guardar.
 *
 * Que se vea desglosado importa: un total que nadie sabe de dónde sale es lo
 * que acaba en una reclamación tres meses después.
 */
export function CommissionPreview({
    agentId,
    grossCommission,
    extraAmount,
    onExtraChange,
}: {
    agentId: string;
    grossCommission: number;
    extraAmount: number;
    onExtraChange: (value: number) => void;
}) {
    const [rateBps, setRateBps] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [extraText, setExtraText] = useState(extraAmount ? String(extraAmount) : '');

    useEffect(() => {
        let active = true;
        void getCollaboratorRatesAction(agentId).then(rates => {
            if (!active) return;
            setRateBps(rates[0]?.rateBps ?? null);
            setLoading(false);
        });
        return () => { active = false; };
    }, [agentId]);

    const result = calculateCollaboratorCommission({
        grossCommission,
        rateBps,
        extraAmount,
    });

    function handleExtra(raw: string) {
        setExtraText(raw);
        const value = Number(raw.replace(',', '.'));
        onExtraChange(Number.isFinite(value) && value >= 0 ? value : 0);
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Comisión del colaborador
            </p>

            {loading ? (
                <p className="mt-1 text-sm text-slate-400">Cargando…</p>
            ) : result.missingRate ? (
                <p className="mt-1 text-xs text-amber-600">
                    Este colaborador no tiene porcentaje configurado. Solo cobrará el extra que añadas aquí.
                </p>
            ) : (
                <p className="mt-1 text-xs text-slate-500">
                    {formatRate(rateBps)} de {grossCommission.toFixed(2)} € ={' '}
                    <span className="font-bold text-slate-700">{result.fromRate.toFixed(2)} €</span>
                </p>
            )}

            <label className="mt-2 block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Extra para esta operación (€)
                </span>
                <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={extraText}
                    onChange={event => handleExtra(event.target.value)}
                    placeholder="0,00"
                    aria-label="Extra para esta operación"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-energy-500 focus:ring-1 focus:ring-energy-500"
                />
                <span className="mt-1 block text-[11px] text-slate-400">
                    Opcional. Lo normal es dejarlo vacío.
                </span>
            </label>

            <div className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-2">
                <span className="text-xs font-semibold text-slate-600">Total para el colaborador</span>
                <span className="text-base font-bold text-slate-900">{result.total.toFixed(2)} €</span>
            </div>
        </div>
    );
}
