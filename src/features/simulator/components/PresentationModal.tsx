'use client';

import React, { useEffect } from 'react';
import { X, Printer, TrendingDown, Zap, CheckCircle2 } from 'lucide-react';
import { SavingsResult, InvoiceData } from '@/types/crm';
import { OptimizationRecommendation } from '@/lib/aletheia/types';

interface Props {
    results: SavingsResult[];
    invoiceData: InvoiceData;
    recommendations?: OptimizationRecommendation[];
    onClose: () => void;
}

const FMT_EUR = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export default function PresentationModal({ results, invoiceData, recommendations = [], onClose }: Props) {
    const best = results[0];
    const rest = results.slice(1, 3);

    // ESC key closes
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const handlePrint = () => window.print();

    if (!best) return null;

    return (
        <>
            {/* Print styles injected via a style tag — only active during print */}
            <style>{`
                @media print {
                    body > *:not(#zinergia-presentation) { display: none !important; }
                    #zinergia-presentation { position: static !important; background: white !important; }
                    #zinergia-presentation .no-print { display: none !important; }
                    @page { margin: 10mm; size: A4 landscape; }
                }
            `}</style>

            <div
                id="zinergia-presentation"
                className="fixed inset-0 z-[200] bg-slate-950 flex flex-col overflow-auto"
            >
                {/* Toolbar */}
                <div className="no-print flex items-center justify-between px-6 py-3 bg-slate-900/80 backdrop-blur border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-energy-500 rounded-md flex items-center justify-center">
                            <Zap size={13} className="text-white" fill="currentColor" />
                        </div>
                        <span className="text-sm font-semibold text-white">Modo Presentación</span>
                        <span className="text-xs text-slate-400 ml-2">— {invoiceData.client_name || 'Cliente'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-700 hover:bg-slate-600 transition-colors"
                        >
                            <Printer size={13} /> Imprimir / PDF
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Cerrar"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 px-8 py-8 max-w-6xl mx-auto w-full space-y-8">

                    {/* ── Hero ── */}
                    <div className="text-center space-y-2 pt-2">
                        <p className="text-energy-400 text-sm font-semibold uppercase tracking-widest">Propuesta de Ahorro Energético</p>
                        <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight">
                            {invoiceData.client_name || 'Propuesta Zinergia'}
                        </h1>
                        {invoiceData.cups && (
                            <p className="text-slate-400 text-sm font-mono">{invoiceData.cups}</p>
                        )}
                    </div>

                    {/* ── Main savings card ── */}
                    <div className="bg-gradient-to-br from-energy-500 to-emerald-600 rounded-3xl p-8 shadow-2xl shadow-emerald-900/40">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-white">
                            <div className="text-center sm:text-left">
                                <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wider mb-1">Coste actual (año)</p>
                                <p className="text-3xl sm:text-4xl font-black opacity-70 line-through">
                                    {FMT_EUR(best.current_annual_cost)}
                                </p>
                            </div>
                            <div className="text-center border-y sm:border-y-0 sm:border-x border-white/20 py-4 sm:py-0">
                                <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wider mb-1">Ahorro anual estimado</p>
                                <p className="text-5xl sm:text-6xl font-black">
                                    {FMT_EUR(best.annual_savings)}
                                </p>
                                <p className="text-emerald-100 text-lg font-semibold mt-1">
                                    −{best.savings_percent.toFixed(1)}%
                                </p>
                            </div>
                            <div className="text-center sm:text-right">
                                <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wider mb-1">Nuevo coste (año)</p>
                                <p className="text-3xl sm:text-4xl font-black">
                                    {FMT_EUR(best.offer_annual_cost)}
                                </p>
                                <p className="text-emerald-100 text-sm mt-1">con {best.offer.marketer_name}</p>
                            </div>
                        </div>
                    </div>

                    {/* ── Comparison table ── */}
                    <div>
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <TrendingDown size={18} className="text-energy-400" />
                            Comparativa de Ofertas
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* Best offer */}
                            <div className="bg-energy-500/10 border-2 border-energy-500/50 rounded-2xl p-5 relative">
                                <div className="absolute -top-3 left-4">
                                    <span className="bg-energy-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        Mejor opción
                                    </span>
                                </div>
                                <p className="text-white font-bold text-lg mt-2">{best.offer.marketer_name}</p>
                                <p className="text-slate-400 text-sm">{best.offer.tariff_name}</p>
                                <div className="mt-4 space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Coste anual</span>
                                        <span className="text-white font-semibold">{FMT_EUR(best.offer_annual_cost)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Ahorro</span>
                                        <span className="text-energy-400 font-bold">{FMT_EUR(best.annual_savings)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Rest */}
                            {rest.map((r, i) => (
                                <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
                                    <p className="text-white font-bold text-lg">{r.offer.marketer_name}</p>
                                    <p className="text-slate-400 text-sm">{r.offer.tariff_name}</p>
                                    <div className="mt-4 space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Coste anual</span>
                                            <span className="text-white font-semibold">{FMT_EUR(r.offer_annual_cost)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Ahorro</span>
                                            <span className="text-emerald-400 font-bold">{FMT_EUR(r.annual_savings)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Fill empty slots */}
                            {rest.length === 0 && (
                                <>
                                    <div className="bg-slate-800/30 border border-dashed border-slate-700 rounded-2xl p-5 flex items-center justify-center text-slate-600 text-sm">Sin alternativas</div>
                                    <div className="bg-slate-800/30 border border-dashed border-slate-700 rounded-2xl p-5 flex items-center justify-center text-slate-600 text-sm">Sin alternativas</div>
                                </>
                            )}
                            {rest.length === 1 && (
                                <div className="bg-slate-800/30 border border-dashed border-slate-700 rounded-2xl p-5 flex items-center justify-center text-slate-600 text-sm">Sin alternativas</div>
                            )}
                        </div>
                    </div>

                    {/* ── Recommendations (top 3) ── */}
                    {recommendations.length > 0 && (
                        <div>
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <CheckCircle2 size={18} className="text-indigo-400" />
                                Optimizaciones Adicionales
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {recommendations.slice(0, 3).map((rec, i) => (
                                    <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                                        <div className={`text-xs font-bold mb-2 ${rec.priority === 'HIGH' ? 'text-red-400' : rec.priority === 'MEDIUM' ? 'text-amber-400' : 'text-blue-400'}`}>
                                            {rec.priority}
                                        </div>
                                        <p className="text-white text-sm font-semibold">{rec.title}</p>
                                        {rec.annual_savings > 0 && (
                                            <p className="text-energy-400 text-xs font-bold mt-2">+{FMT_EUR(rec.annual_savings)}/año</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="text-center text-xs text-slate-600 pb-4 border-t border-slate-800 pt-4">
                        Generado por Zinergia Consultores · {new Date().toLocaleDateString('es-ES')} · Simulación basada en datos de factura
                    </div>
                </div>
            </div>
        </>
    );
}
