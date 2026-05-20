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
        <section className={`mb-4 rounded-xl border px-4 py-3 shadow-sm transition-colors ${allDone ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
            <div className="flex items-center gap-3 flex-wrap">
                <div className={`rounded-lg p-1.5 shrink-0 ${allDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {allDone ? <ShieldCheck size={16} /> : <ClipboardCheck size={16} />}
                </div>
                <span className="text-xs font-bold text-slate-900 shrink-0">Supervisión</span>

                <div className="flex items-center gap-1.5 flex-wrap flex-1">
                    {ITEMS.map(item => {
                        const checked = value[item.key];
                        return (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => toggle(item.key)}
                                title={item.helper}
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer select-none ${
                                    checked
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                                {checked && <CheckCircle2 size={11} />}
                                {item.label}
                            </button>
                        );
                    })}
                </div>

                <span className={`text-[11px] font-bold tabular-nums shrink-0 ${allDone ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {completed}/{ITEMS.length}
                </span>
            </div>

            {(alertCount > 0 || (recommendation?.guardrails?.length || 0) > 0) && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-white/70 border border-amber-200 px-3 py-1.5 text-[11px] text-amber-800">
                    <AlertTriangle size={13} className="shrink-0" />
                    {alertCount} alerta(s) · {recommendation?.guardrails?.length || 0} aviso(s) — revisar antes de enviar
                </div>
            )}
        </section>
    );
}
