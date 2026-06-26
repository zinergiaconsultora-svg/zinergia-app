'use client';

import { useEffect, useState, useTransition } from 'react';
import { RefreshCw, TrendingDown, Phone, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import {
    getRenewalOpportunitiesAction,
    dismissRenewalAction,
    markRenewalContactedAction,
    type RenewalOpportunity,
} from '@/app/actions/renewals';

const FMT_EUR = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

function PriorityBadge({ score }: { score: number }) {
    const config = score >= 70
        ? { label: 'Alta', cls: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300' }
        : score >= 40
            ? { label: 'Media', cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' }
            : { label: 'Baja', cls: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' };

    return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${config.cls}`}>
            {config.label}
        </span>
    );
}

export default function RenewalsPanel() {
    const [opportunities, setOpportunities] = useState<RenewalOpportunity[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        getRenewalOpportunitiesAction()
            .then(setOpportunities)
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    function handleContact(id: string) {
        startTransition(async () => {
            await markRenewalContactedAction(id);
            setOpportunities(prev => prev.map(o =>
                o.id === id ? { ...o, status: 'contacted' } : o
            ));
        });
    }

    function handleDismiss(id: string) {
        startTransition(async () => {
            await dismissRenewalAction(id);
            setOpportunities(prev => prev.filter(o => o.id !== id));
        });
    }

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-slate-400 py-2">
                <RefreshCw size={14} className="animate-spin" />
                <span className="text-sm">Analizando cartera…</span>
            </div>
        );
    }

    const totalSavings = opportunities.reduce((s, o) => s + o.potential_savings, 0);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Radar de Renovaciones</h3>
                <span className="text-[10px] text-slate-400">
                    {opportunities.length} op. · {FMT_EUR(totalSavings)}
                </span>
            </div>

            {opportunities.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl bg-emerald-50/60 border border-emerald-100 px-4 py-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                        <RefreshCw size={16} className="text-emerald-500" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700">Sin renovaciones pendientes</p>
                        <p className="text-[11px] text-slate-400 leading-snug">
                            Las mejores tarifas para tu cartera aparecerán aquí automáticamente.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-2 overflow-y-auto max-h-[260px] pr-1">
                    {opportunities.map(opp => (
                        <Card key={opp.id} variant="elevated" interactive className="p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                                        <TrendingDown size={18} className="text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                                            {opp.client_name}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            {opp.best_marketer} · {opp.best_tariff_name}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                                {FMT_EUR(opp.potential_savings)}/año
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                ({opp.savings_percent}% menos)
                                            </span>
                                            <PriorityBadge score={opp.priority_score} />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                    {opp.status === 'open' && (
                                        <button
                                            type="button"
                                            onClick={() => handleContact(opp.id)}
                                            disabled={isPending}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                        >
                                            <Phone size={10} /> Contactar
                                        </button>
                                    )}
                                    {opp.status === 'contacted' && (
                                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 px-2 py-1">
                                            Contactado
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleDismiss(opp.id)}
                                        disabled={isPending}
                                        className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                                        title="Descartar"
                                    >
                                        <X size={13} />
                                    </button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
