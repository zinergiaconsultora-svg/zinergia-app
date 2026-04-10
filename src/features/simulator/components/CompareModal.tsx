'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { X, History, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import { SavingsResult } from '@/types/crm';
import { getProposalHistoryByCupsAction, ProposalHistoryItem } from '@/app/actions/proposals';

interface Props {
    cups: string;
    currentResults: SavingsResult[];
    currentCost: number;
    onClose: () => void;
}

const FMT_EUR = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const FMT_DATE = (iso: string) =>
    new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

function DeltaBadge({ value, suffix = '€', invert = false }: { value: number; suffix?: string; invert?: boolean }) {
    const positive = invert ? value < 0 : value > 0;
    const neutral = Math.abs(value) < 0.5;

    if (neutral) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">
                <Minus size={10} /> Sin cambio
            </span>
        );
    }

    const color = positive
        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        : 'bg-rose-50 text-rose-700 border border-rose-200';

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>
            {positive
                ? <TrendingUp size={10} />
                : <TrendingDown size={10} />
            }
            {value > 0 ? '+' : ''}{value.toFixed(1)}{suffix}
        </span>
    );
}

function SimulationColumn({
    label,
    date,
    baseCost,
    offerCost,
    savings,
    savingsPct,
    marketer,
    tariff,
    isCurrent,
}: {
    label: string;
    date: string;
    baseCost: number;
    offerCost: number;
    savings: number;
    savingsPct: number;
    marketer: string;
    tariff: string;
    isCurrent: boolean;
}) {
    return (
        <div className={`flex-1 rounded-2xl p-5 space-y-4 ${isCurrent
            ? 'bg-indigo-50 border-2 border-indigo-200'
            : 'bg-slate-50 border border-slate-200'
            }`}>
            <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${isCurrent
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-300 text-slate-600'
                    }`}>{label}</span>
                <span className="text-xs text-slate-400">{date}</span>
            </div>

            <div>
                <p className="text-xs text-slate-400 mb-0.5">Coste actual/año</p>
                <p className="text-2xl font-black text-slate-900">{FMT_EUR(baseCost)}</p>
            </div>

            <div className={`rounded-xl p-3 ${isCurrent ? 'bg-indigo-100/60' : 'bg-white border border-slate-100'}`}>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Mejor oferta</p>
                <p className="font-bold text-slate-800 text-sm">{marketer}</p>
                <p className="text-xs text-slate-500">{tariff}</p>
                <div className="mt-3 flex items-end justify-between">
                    <div>
                        <p className="text-xs text-slate-400">Coste con oferta</p>
                        <p className="font-bold text-slate-700">{FMT_EUR(offerCost)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-400">Ahorro</p>
                        <p className={`font-black text-lg ${isCurrent ? 'text-indigo-600' : 'text-emerald-600'}`}>
                            {FMT_EUR(savings)}
                        </p>
                        <p className="text-xs font-semibold text-slate-400">−{savingsPct.toFixed(1)}%</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function CompareModal({ cups, currentResults, currentCost, onClose }: Props) {
    const [history, setHistory] = useState<ProposalHistoryItem[]>([]);
    const [selected, setSelected] = useState<ProposalHistoryItem | null>(null);
    const [loading, startLoad] = useTransition();

    useEffect(() => {
        startLoad(async () => {
            try {
                const items = await getProposalHistoryByCupsAction(cups);
                setHistory(items);
                if (items.length > 0) setSelected(items[0]);
            } catch { /* ignore */ }
        });

        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [cups, onClose]);

    const best = currentResults[0];
    const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

    const deltaCost = selected ? currentCost - selected.current_annual_cost : 0;
    const deltaSavings = selected ? best.annual_savings - selected.annual_savings : 0;
    const deltaPct = selected ? best.savings_percent - selected.savings_percent : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center">
                            <History size={15} className="text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-900">Comparar con histórico</h2>
                            <p className="text-[10px] text-slate-400 font-mono">{cups}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-6 space-y-5">
                    {/* History picker */}
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : history.length === 0 ? (
                        <div className="py-12 text-center text-slate-400">
                            <History size={28} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No hay simulaciones anteriores guardadas para este CUPS</p>
                        </div>
                    ) : (
                        <>
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Selecciona simulación anterior</p>
                                <div className="flex gap-2 flex-wrap">
                                    {history.map(item => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setSelected(item)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${selected?.id === item.id
                                                ? 'bg-slate-800 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                        >
                                            {FMT_DATE(item.created_at)}
                                            <span className="ml-1.5 text-[10px] opacity-60">
                                                {item.savings_percent.toFixed(0)}% ahorro
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {selected && (
                                <>
                                    {/* Side by side */}
                                    <div className="flex items-stretch gap-3">
                                        <SimulationColumn
                                            label="Anterior"
                                            date={FMT_DATE(selected.created_at)}
                                            baseCost={selected.current_annual_cost}
                                            offerCost={selected.offer_annual_cost}
                                            savings={selected.annual_savings}
                                            savingsPct={selected.savings_percent}
                                            marketer={selected.offer_snapshot?.marketer_name ?? '—'}
                                            tariff={selected.offer_snapshot?.tariff_name ?? '—'}
                                            isCurrent={false}
                                        />
                                        <div className="flex items-center shrink-0">
                                            <ArrowRight size={20} className="text-slate-300" />
                                        </div>
                                        <SimulationColumn
                                            label="Ahora"
                                            date={today}
                                            baseCost={currentCost}
                                            offerCost={best.offer_annual_cost}
                                            savings={best.annual_savings}
                                            savingsPct={best.savings_percent}
                                            marketer={best.offer.marketer_name}
                                            tariff={best.offer.tariff_name}
                                            isCurrent={true}
                                        />
                                    </div>

                                    {/* Delta summary */}
                                    <div className="bg-slate-900 rounded-2xl p-4">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Evolución desde {FMT_DATE(selected.created_at)}</p>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="text-center">
                                                <p className="text-[10px] text-slate-500 mb-1">Coste base</p>
                                                <DeltaBadge value={deltaCost} invert={true} />
                                                <p className="text-[10px] text-slate-500 mt-1">
                                                    {deltaCost > 0 ? 'Ha subido' : deltaCost < 0 ? 'Ha bajado' : 'Sin cambio'}
                                                </p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] text-slate-500 mb-1">Ahorro posible</p>
                                                <DeltaBadge value={deltaSavings} />
                                                <p className="text-[10px] text-slate-500 mt-1">
                                                    {deltaSavings > 0 ? 'Más margen' : deltaSavings < 0 ? 'Menos margen' : 'Igual'}
                                                </p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] text-slate-500 mb-1">% de ahorro</p>
                                                <DeltaBadge value={deltaPct} suffix="%" />
                                                <p className="text-[10px] text-slate-500 mt-1">
                                                    {deltaPct > 0 ? 'Mejor oferta' : deltaPct < 0 ? 'Peor oferta' : 'Igual'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
