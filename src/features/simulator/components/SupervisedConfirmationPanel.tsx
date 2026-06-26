'use client';

import React from 'react';
import { CheckCircle2, ClipboardCheck, ShieldCheck } from 'lucide-react';
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

const ITEMS: Array<{ key: keyof SupervisedConfirmationState; label: string }> = [
    { key: 'savings', label: 'Ahorro' },
    { key: 'commission', label: 'Comisión' },
    { key: 'sips', label: 'SIPS/Consumo' },
    { key: 'alerts', label: 'Alertas' },
    { key: 'calculation', label: 'Desglose' },
];

export function SupervisedConfirmationPanel({ value, onChange }: Props) {
    const completed = ITEMS.filter(item => value[item.key]).length;
    const allDone = completed === ITEMS.length;

    const toggle = (key: keyof SupervisedConfirmationState) => {
        onChange({ ...value, [key]: !value[key] });
    };

    return (
        <div className={`mb-4 flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors ${allDone ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-slate-50/60'}`}>
            <div className={`rounded-lg p-1 shrink-0 ${allDone ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                {allDone ? <ShieldCheck size={14} /> : <ClipboardCheck size={14} />}
            </div>

            <div className="flex items-center gap-1 flex-wrap flex-1">
                {ITEMS.map(item => {
                    const checked = value[item.key];
                    return (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => toggle(item.key)}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-all cursor-pointer select-none ${
                                checked
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            {checked && <CheckCircle2 size={9} />}
                            {item.label}
                        </button>
                    );
                })}
            </div>

            <span className={`text-[10px] font-bold tabular-nums shrink-0 ${allDone ? 'text-emerald-700' : 'text-slate-400'}`}>
                {completed}/{ITEMS.length}
            </span>
        </div>
    );
}
