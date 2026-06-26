'use client';

import React from 'react';
import { BadgeEuro, CircleAlert, Scale, ShieldCheck, TrendingDown } from 'lucide-react';
import { SupervisedRecommendationResult } from '@/lib/supervised/recommender';

interface SupervisedRecommendationPanelProps {
    recommendation: SupervisedRecommendationResult;
}

const KIND_ICON = {
    max_savings: TrendingDown,
    balanced: Scale,
    best_viable_commission: BadgeEuro,
};

export function SupervisedRecommendationPanel({ recommendation }: SupervisedRecommendationPanelProps) {
    if (recommendation.recommendations.length === 0) {
        return (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                <span className="font-semibold">Sin recomendación segura</span>
                {recommendation.guardrails[0] && <span className="text-red-600">— {recommendation.guardrails[0]}</span>}
            </div>
        );
    }

    const best = recommendation.recommendations[0];
    const BestIcon = KIND_ICON[best.kind];
    const commission = best.candidate.estimatedAgentCommission;

    return (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Compact header */}
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2 min-w-0">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-extrabold text-slate-900">Recomendación</span>
                    <span className="text-[10px] text-slate-400 hidden sm:inline">Uso interno</span>
                </div>
                {recommendation.guardrails.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700 shrink-0">
                        <CircleAlert className="h-2.5 w-2.5" />
                        {recommendation.guardrails.length} aviso{recommendation.guardrails.length !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {/* Best recommendation inline */}
            <div className="flex items-center gap-4 px-4 py-2.5 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                    <BestIcon className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 truncate">{best.candidate.company} · {best.candidate.tariffName}</span>
                </div>
                <div className="flex items-center gap-4 text-xs shrink-0">
                    <span>
                        <span className="text-slate-400">Ahorro </span>
                        <span className="font-bold text-emerald-700 tabular-nums">{best.candidate.annualSavings.toFixed(0)} €/año</span>
                    </span>
                    <span>
                        <span className="text-slate-400">Comisión </span>
                        <span className="font-bold text-slate-800 tabular-nums">
                            {commission === null || commission === undefined ? 'Pendiente' : `${commission.toFixed(0)} €`}
                        </span>
                    </span>
                </div>
                <p className="text-[10px] text-slate-400 w-full">{best.reason}</p>
            </div>

            {/* Guardrails — compact inline */}
            {recommendation.guardrails.length > 0 && (
                <div className="px-4 pb-2.5 space-y-1">
                    {recommendation.guardrails.map(guardrail => (
                        <div key={guardrail} className="flex items-center gap-1.5 text-[10px] text-amber-700">
                            <CircleAlert className="h-2.5 w-2.5 shrink-0" />
                            <span>{guardrail}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
