'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { SupervisedRecommendationResult } from '@/lib/supervised/recommender';

export type SupervisedConfirmationState = {
    savings: boolean;
    commission: boolean;
    sips: boolean;
    alerts: boolean;
    calculation: boolean;
};

interface Props {
    value: SupervisedConfirmationState;
    onChange: (value: SupervisedConfirmationState) => void;
    recommendation?: SupervisedRecommendationResult;
    alertCount: number;
}

const ITEMS: Array<{ key: keyof SupervisedConfirmationState; label: string; helper: string }> = [
    {
        key: 'savings',
        label: 'Ahorro revisado',
        helper: 'Importe actual, importe optimizado, ahorro en factura, ahorro anual y porcentaje.',
    },
    {
        key: 'commission',
        label: 'Comisión revisada',
        helper: 'La recomendación equilibra ahorro para cliente y comisión del colaborador.',
    },
    {
        key: 'sips',
        label: 'SIPS o consumo anual revisado',
        helper: 'Consumo anual confirmado por SIPS/CNMC o marcado como respaldo si viene de factura.',
    },
    {
        key: 'alerts',
        label: 'Alertas revisadas',
        helper: 'Excedentes, reactiva, servicios excluidos, tipos ATR y avisos de calidad del cálculo.',
    },
    {
        key: 'calculation',
        label: 'Desglose de cálculo revisado',
        helper: 'Potencia, energía, cargos obligatorios, impuestos, IVA y total simulado.',
    },
];

export function SupervisedConfirmationPanel({ value, onChange, recommendation, alertCount }: Props) {
    const completed = ITEMS.filter(item => value[item.key]).length;
    const allDone = completed === ITEMS.length;

    const toggle = (key: keyof SupervisedConfirmationState) => {
        onChange({ ...value, [key]: !value[key] });
    };

    return (
        <section className={`mb-6 rounded-2xl border p-4 shadow-sm ${allDone ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70'}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <div className={`mt-0.5 rounded-xl p-2 ${allDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {allDone ? <ShieldCheck size={20} /> : <ClipboardCheck size={20} />}
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900">Confirmación supervisada antes de compartir</h3>
                        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
                            Marca estos puntos cuando el colaborador haya revisado que la propuesta es defendible para el cliente y para la red comercial.
                        </p>
                    </div>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-bold ${allDone ? 'bg-emerald-600 text-white' : 'bg-white text-amber-700 border border-amber-200'}`}>
                    {completed}/{ITEMS.length} revisado
                </div>
            </div>

            {(alertCount > 0 || (recommendation?.guardrails?.length || 0) > 0) && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-white/70 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <span>
                        Hay {alertCount} alerta(s) de cálculo y {recommendation?.guardrails?.length || 0} aviso(s) de recomendación. Deben quedar revisados antes de enviar.
                    </span>
                </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
                {ITEMS.map(item => {
                    const checked = value[item.key];
                    return (
                        <label
                            key={item.key}
                            className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 transition-colors ${checked ? 'border-emerald-200 bg-white text-slate-900' : 'border-white/70 bg-white/60 text-slate-700 hover:bg-white'}`}
                        >
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggle(item.key)}
                                className="mt-0.5 size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="min-w-0">
                                <span className="flex items-center gap-1.5 text-xs font-bold">
                                    {item.label}
                                    {checked && <CheckCircle2 size={13} className="text-emerald-600" />}
                                </span>
                                <span className="mt-1 block text-[11px] leading-4 text-slate-500">{item.helper}</span>
                            </span>
                        </label>
                    );
                })}
            </div>
        </section>
    );
}
