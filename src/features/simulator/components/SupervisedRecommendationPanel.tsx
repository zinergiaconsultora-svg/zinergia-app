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
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <div className="flex items-center gap-2 font-semibold">
                    <CircleAlert className="h-4 w-4" />
                    Sin recomendacion comercial segura
                </div>
                <p className="mt-1 text-xs">{recommendation.guardrails[0]}</p>
            </div>
        );
    }

    return (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-emerald-600" />
                        <h3 className="text-sm font-semibold text-slate-900">Recomendacion supervisada</h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                        Equilibra ahorro para el cliente, comision interna y calidad del calculo.
                    </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Uso interno
                </span>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {recommendation.recommendations.map(item => {
                    const Icon = KIND_ICON[item.kind];
                    const commission = item.candidate.estimatedAgentCommission;

                    return (
                        <div key={`${item.kind}-${item.candidate.id}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                <Icon className="h-4 w-4 text-emerald-600" />
                                {item.title}
                            </div>
                            <div className="mt-2 text-sm font-semibold text-slate-900">
                                {item.candidate.company} · {item.candidate.tariffName}
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <div className="text-slate-400">Ahorro</div>
                                    <div className="font-semibold text-emerald-700">{item.candidate.annualSavings.toFixed(0)} €/ano</div>
                                </div>
                                <div>
                                    <div className="text-slate-400">Comision</div>
                                    <div className="font-semibold text-slate-900">
                                        {commission === null || commission === undefined ? 'Pendiente' : `${commission.toFixed(0)} €`}
                                    </div>
                                </div>
                            </div>
                            <p className="mt-3 text-[11px] leading-snug text-slate-500">{item.reason}</p>
                        </div>
                    );
                })}
            </div>

            {recommendation.guardrails.length > 0 && (
                <div className="mt-4 space-y-2">
                    {recommendation.guardrails.map(guardrail => (
                        <div key={guardrail} className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>{guardrail}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
