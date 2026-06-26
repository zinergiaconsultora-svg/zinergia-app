'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, TrendingDown, Zap, CheckCircle2, BarChart3, Shield, ChevronLeft, ChevronRight, Coins } from 'lucide-react';
import { SavingsResult, InvoiceData } from '@/types/crm';
import { OptimizationRecommendation } from '@/lib/aletheia/types';
import { formatCurrency } from '@/lib/utils/format';
import { getMarketerLogo } from '@/lib/marketers/logos';

interface Props {
    results: SavingsResult[];
    invoiceData: InvoiceData;
    recommendations?: OptimizationRecommendation[];
    onClose: () => void;
}

const SLIDES = ['hero', 'detail', 'comparison', 'recommendations'] as const;
type Slide = typeof SLIDES[number];

export default function PresentationModal({ results, invoiceData, recommendations = [], onClose }: Props) {
    const best = results[0];
    const [slide, setSlide] = useState<Slide>('hero');
    const slideIdx = SLIDES.indexOf(slide);

    const activeSlides = SLIDES.filter(s => {
        if (s === 'recommendations' && recommendations.length === 0) return false;
        return true;
    });

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight' || e.key === ' ') {
                e.preventDefault();
                setSlide(prev => {
                    const idx = activeSlides.indexOf(prev);
                    return activeSlides[Math.min(idx + 1, activeSlides.length - 1)];
                });
            }
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setSlide(prev => {
                    const idx = activeSlides.indexOf(prev);
                    return activeSlides[Math.max(idx - 1, 0)];
                });
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose, activeSlides]);

    if (!best) return null;

    const bestLogo = getMarketerLogo(best.offer.marketer_name);
    const commission = best.offer.estimated_agent_commission;
    const periodDays = invoiceData.period_days || 30;
    const periodSavings = best.calculation_audit?.currentInvoiceTotal && best.calculation_audit?.simulatedInvoiceTotal
        ? best.calculation_audit.currentInvoiceTotal - best.calculation_audit.simulatedInvoiceTotal
        : (best.annual_savings / 365) * periodDays;

    return (
        <>
            <style>{`
                @media print {
                    body > *:not(#zinergia-presentation) { display: none !important; }
                    #zinergia-presentation { position: static !important; background: white !important; color: #0f172a !important; }
                    #zinergia-presentation .no-print { display: none !important; }
                    @page { margin: 10mm; size: A4 landscape; }
                }
            `}</style>

            <div id="zinergia-presentation" className="fixed inset-0 z-[200] bg-slate-950 flex flex-col overflow-hidden">
                {/* Toolbar */}
                <div className="no-print flex items-center justify-between px-6 py-2.5 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800/60 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <Zap size={14} className="text-white" fill="currentColor" />
                        </div>
                        <div>
                            <span className="text-sm font-bold text-white">Zinergia</span>
                            <span className="text-xs text-slate-400 ml-2">· {invoiceData.client_name || 'Presentación'}</span>
                        </div>
                    </div>

                    {/* Slide indicators */}
                    <div className="flex items-center gap-1.5">
                        {activeSlides.map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => setSlide(s)}
                                className={`h-1.5 rounded-full transition-all ${slide === s ? 'w-6 bg-emerald-400' : 'w-1.5 bg-slate-600 hover:bg-slate-500'}`}
                            />
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-700 hover:bg-slate-600 transition-colors">
                            <Printer size={13} /> PDF
                        </button>
                        <button type="button" onClick={onClose} aria-label="Cerrar" className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Content area */}
                <div className="flex-1 relative overflow-hidden">
                    {/* Navigation arrows */}
                    <div className="no-print absolute inset-y-0 left-0 z-10 flex items-center">
                        {slideIdx > 0 && (
                            <button type="button" onClick={() => setSlide(activeSlides[activeSlides.indexOf(slide) - 1])} className="ml-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors backdrop-blur-sm">
                                <ChevronLeft size={20} />
                            </button>
                        )}
                    </div>
                    <div className="no-print absolute inset-y-0 right-0 z-10 flex items-center">
                        {slideIdx < activeSlides.length - 1 && (
                            <button type="button" onClick={() => setSlide(activeSlides[activeSlides.indexOf(slide) + 1])} className="mr-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors backdrop-blur-sm">
                                <ChevronRight size={20} />
                            </button>
                        )}
                    </div>

                    <AnimatePresence mode="wait">
                        {/* ═══ Slide: Hero ═══ */}
                        {slide === 'hero' && (
                            <motion.div
                                key="hero"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.35, ease: 'easeInOut' }}
                                className="h-full flex flex-col items-center justify-center px-8 py-6 relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.08),transparent_60%)]" />
                                <div className="relative text-center space-y-6 max-w-4xl">
                                    <p className="text-emerald-400 text-xs font-bold uppercase tracking-[0.3em]">Propuesta de Ahorro Energético</p>
                                    <h1 className="text-5xl sm:text-6xl font-black text-white leading-tight">
                                        {invoiceData.client_name || 'Propuesta Zinergia'}
                                    </h1>
                                    {invoiceData.cups && (
                                        <p className="text-slate-500 text-sm font-mono tracking-wide">{invoiceData.cups}</p>
                                    )}

                                    {/* Hero savings */}
                                    <div className="mt-8 bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/30 rounded-3xl p-8 backdrop-blur-sm">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                                            <div>
                                                <p className="text-emerald-300/60 text-[11px] font-bold uppercase tracking-wider mb-2">Coste actual / año</p>
                                                <p className="text-3xl font-black text-white/50 line-through tabular-nums">{formatCurrency(best.current_annual_cost)}</p>
                                            </div>
                                            <div className="border-y sm:border-y-0 sm:border-x border-emerald-500/20 py-6 sm:py-0">
                                                <p className="text-emerald-300/60 text-[11px] font-bold uppercase tracking-wider mb-2">Ahorro anual</p>
                                                <p className="text-5xl font-black text-emerald-400 tabular-nums">{formatCurrency(best.annual_savings)}</p>
                                                <p className="text-emerald-300 text-lg font-bold mt-1">−{best.savings_percent.toFixed(1)}%</p>
                                            </div>
                                            <div>
                                                <p className="text-emerald-300/60 text-[11px] font-bold uppercase tracking-wider mb-2">Nuevo coste / año</p>
                                                <p className="text-3xl font-black text-white tabular-nums">{formatCurrency(best.offer_annual_cost)}</p>
                                                <div className="flex items-center justify-center gap-2 mt-2">
                                                    {bestLogo && (
                                                        <div className="w-5 h-5 rounded bg-white overflow-hidden">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img src={bestLogo} alt="" className="w-full h-full object-contain p-0.5" />
                                                        </div>
                                                    )}
                                                    <span className="text-sm text-slate-300">{best.offer.marketer_name}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-slate-600 text-xs">Pulsa → o barra espaciadora para continuar</p>
                                </div>
                            </motion.div>
                        )}

                        {/* ═══ Slide: Detail ═══ */}
                        {slide === 'detail' && (
                            <motion.div
                                key="detail"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.35, ease: 'easeInOut' }}
                                className="h-full overflow-auto px-8 py-6 max-w-6xl mx-auto w-full"
                            >
                                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <BarChart3 size={18} className="text-emerald-400" />
                                    Detalle de la Propuesta
                                </h2>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Best offer detail card */}
                                    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-5">
                                        <div className="flex items-center gap-3">
                                            {bestLogo && (
                                                <div className="w-10 h-10 rounded-xl bg-white overflow-hidden border border-slate-600 shrink-0">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={bestLogo} alt="" className="w-full h-full object-contain p-1" />
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-white font-bold text-lg">{best.offer.marketer_name}</p>
                                                <p className="text-slate-400 text-sm">{best.offer.tariff_name}</p>
                                            </div>
                                            <span className="ml-auto bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Mejor</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <MetricCard label="Ahorro anual" value={formatCurrency(best.annual_savings)} accent />
                                            <MetricCard label="Ahorro periodo" value={formatCurrency(periodSavings)} accent />
                                            <MetricCard label="Nuevo coste / año" value={formatCurrency(best.offer_annual_cost)} />
                                            <MetricCard label="Mejora" value={`${best.savings_percent.toFixed(1)}%`} accent />
                                        </div>

                                        {commission != null && (
                                            <div className="flex items-center gap-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 px-4 py-3">
                                                <Coins size={16} className="text-indigo-400" />
                                                <span className="text-sm text-indigo-300">Comisión estimada</span>
                                                <span className="ml-auto text-lg font-bold text-indigo-400 tabular-nums">{formatCurrency(commission)}</span>
                                            </div>
                                        )}

                                        {best.optimization_result && (
                                            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3">
                                                <TrendingDown size={16} className="text-emerald-400" />
                                                <span className="text-sm text-emerald-300">Optimización de potencia</span>
                                                <span className="ml-auto text-lg font-bold text-emerald-400 tabular-nums">+{formatCurrency(best.optimization_result.annual_optimization_savings)}</span>
                                            </div>
                                        )}

                                        {/* Gráfico comparativo de costes animado */}
                                        <div className="border-t border-slate-700/60 pt-4 space-y-3">
                                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Comparativa de Coste Anual</h4>
                                            <div className="space-y-3">
                                                {/* Coste Actual */}
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-xs text-slate-400">
                                                        <span>Coste Actual</span>
                                                        <span className="font-bold">{formatCurrency(best.current_annual_cost)}</span>
                                                    </div>
                                                    <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: '100%' }}
                                                            transition={{ duration: 0.8, ease: 'easeOut' }}
                                                            className="h-full bg-rose-500/80 rounded-full"
                                                        />
                                                    </div>
                                                </div>
                                                {/* Coste Propuesto */}
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-xs text-slate-400">
                                                        <span>Propuesta Zinergia</span>
                                                        <span className="font-bold text-emerald-400">{formatCurrency(best.offer_annual_cost)}</span>
                                                    </div>
                                                    <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${(best.offer_annual_cost / best.current_annual_cost) * 100}%` }}
                                                            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                                                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Invoice data & consumption */}
                                    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-4">
                                        <h3 className="text-white font-bold flex items-center gap-2">
                                            <Shield size={16} className="text-slate-400" />
                                            Datos de la factura
                                        </h3>

                                        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                            <DataRow label="Comercializadora actual" value={invoiceData.company_name || '—'} />
                                            <DataRow label="Tarifa actual" value={invoiceData.tariff_name || '—'} />
                                            <DataRow label="Período" value={`${periodDays} días`} />
                                            <DataRow label="Fecha factura" value={invoiceData.invoice_date || '—'} />
                                            <DataRow label="Importe factura" value={formatCurrency(invoiceData.total_amount || 0)} />
                                            <DataRow label="CUPS" value={invoiceData.cups || '—'} mono />
                                        </div>

                                        <div className="border-t border-slate-700 pt-3">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Consumo por periodo</h4>
                                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                                {[1, 2, 3, 4, 5, 6].map(p => {
                                                    const kwh = Number(invoiceData[`energy_p${p}` as keyof InvoiceData] || 0);
                                                    const kw = Number(invoiceData[`power_p${p}` as keyof InvoiceData] || 0);
                                                    if (kwh === 0 && kw === 0) return null;
                                                    return (
                                                        <div key={p} className="bg-slate-900/60 rounded-lg p-2 text-center">
                                                            <p className="text-[10px] font-bold text-slate-500">P{p}</p>
                                                            <p className="text-xs font-bold text-amber-400 tabular-nums">{kwh > 0 ? `${Math.round(kwh)}` : '—'}</p>
                                                            <p className="text-[9px] text-slate-500">kWh</p>
                                                            <p className="text-xs font-bold text-blue-400 tabular-nums mt-1">{kw > 0 ? kw.toFixed(2) : '—'}</p>
                                                            <p className="text-[9px] text-slate-500">kW</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ═══ Slide: Comparison ═══ */}
                        {slide === 'comparison' && (
                            <motion.div
                                key="comparison"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.35, ease: 'easeInOut' }}
                                className="h-full overflow-auto px-8 py-6 max-w-6xl mx-auto w-full"
                            >
                                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <TrendingDown size={18} className="text-emerald-400" />
                                    Comparativa de Ofertas
                                </h2>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {results.slice(0, 8).map((r, i) => {
                                        const logo = getMarketerLogo(r.offer.marketer_name);
                                        const isBest = i === 0;
                                        return (
                                            <motion.div
                                                key={r.offer.id ?? i}
                                                initial={{ opacity: 0, y: 12 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.35, delay: i * 0.08 }}
                                                className={`rounded-2xl p-5 relative transition-transform hover:scale-[1.02] ${
                                                    isBest
                                                        ? 'bg-emerald-500/10 border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                                                        : 'bg-slate-800/60 border border-slate-700'
                                                }`}
                                            >
                                                {isBest && (
                                                    <div className="absolute -top-3 left-4">
                                                        <span className="bg-emerald-500 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                                                            Mejor opción
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 mb-3 mt-1">
                                                    {logo ? (
                                                        <div className="w-7 h-7 rounded-lg bg-white overflow-hidden shrink-0">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img src={logo} alt="" className="w-full h-full object-contain p-0.5" />
                                                        </div>
                                                    ) : (
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold ${r.offer.logo_color || 'bg-slate-600'}`}>
                                                            {r.offer.marketer_name.slice(0, 2)}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <p className="text-white font-bold text-sm truncate">{r.offer.marketer_name}</p>
                                                        <p className="text-slate-400 text-xs truncate">{r.offer.tariff_name}</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-400">Coste anual</span>
                                                        <span className="text-white font-bold tabular-nums">{formatCurrency(r.offer_annual_cost)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-400">Ahorro</span>
                                                        <span className={`font-bold tabular-nums ${isBest ? 'text-emerald-400' : 'text-emerald-400/80'}`}>
                                                            {formatCurrency(r.annual_savings)}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-400">Mejora</span>
                                                        <span className="text-emerald-300 font-semibold">{r.savings_percent.toFixed(1)}%</span>
                                                    </div>
                                                    {r.offer.estimated_agent_commission != null && (
                                                        <div className="flex justify-between text-sm pt-1 border-t border-slate-700/60">
                                                            <span className="text-indigo-400/70">Comisión</span>
                                                            <span className="text-indigo-400 font-bold tabular-nums">{formatCurrency(r.offer.estimated_agent_commission)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}

                        {/* ═══ Slide: Recommendations ═══ */}
                        {slide === 'recommendations' && recommendations.length > 0 && (
                            <motion.div
                                key="recommendations"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                className="h-full overflow-auto px-8 py-6 max-w-5xl mx-auto w-full"
                            >
                                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <CheckCircle2 size={18} className="text-indigo-400" />
                                    Optimizaciones Adicionales
                                </h2>

                                <div className="space-y-3">
                                    {recommendations.map((rec, i) => (
                                        <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 flex items-start gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-black text-sm ${
                                                rec.priority === 'HIGH' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                                : rec.priority === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                            }`}>
                                                {i + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                                        rec.priority === 'HIGH' ? 'text-rose-400' : rec.priority === 'MEDIUM' ? 'text-amber-400' : 'text-blue-400'
                                                    }`}>
                                                        {rec.priority === 'HIGH' ? 'Alta prioridad' : rec.priority === 'MEDIUM' ? 'Prioridad media' : 'Sugerencia'}
                                                    </span>
                                                </div>
                                                <p className="text-white font-bold">{rec.title}</p>
                                                <p className="text-slate-400 text-sm mt-1">{rec.description}</p>
                                            </div>
                                            {rec.annual_savings > 0 && (
                                                <div className="text-right shrink-0">
                                                    <p className="text-[10px] text-emerald-400/60 font-bold uppercase">Ahorro adicional</p>
                                                    <p className="text-xl font-black text-emerald-400 tabular-nums">+{formatCurrency(rec.annual_savings)}</p>
                                                    <p className="text-xs text-slate-500">/año</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* HUD de navegación por teclado flotante */}
                <div className="no-print absolute bottom-12 left-6 flex items-center gap-1.5 bg-slate-900/85 border border-slate-800 rounded-full px-3 py-1.5 backdrop-blur-md text-[10px] text-slate-400 shadow-xl z-20">
                    <span className="font-bold text-slate-300">Teclado:</span>
                    <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[9px] text-slate-200">←</kbd>
                    <span>Ant</span>
                    <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[9px] text-slate-200">→</kbd>
                    <span>Sig</span>
                    <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[9px] text-slate-200">Espacio</kbd>
                    <span>Sig</span>
                    <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[9px] text-slate-200">ESC</kbd>
                    <span>Cerrar</span>
                </div>

                {/* Footer */}
                <div className="px-6 py-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-600 shrink-0">
                    <span>Zinergia Consultoría Energética · {new Date().toLocaleDateString('es-ES')}</span>
                    <span>Simulación basada en datos de factura · Los ahorros reales pueden variar</span>
                    <span className="no-print tabular-nums">{activeSlides.indexOf(slide) + 1} / {activeSlides.length}</span>
                </div>
            </div>
        </>
    );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    return (
        <div className="rounded-xl bg-slate-900/60 p-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-lg font-black tabular-nums ${accent ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
        </div>
    );
}

function DataRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex justify-between items-baseline py-1.5 border-b border-slate-700/50">
            <span className="text-xs text-slate-400">{label}</span>
            <span className={`text-xs font-semibold text-slate-200 ${mono ? 'font-mono' : ''}`}>{value}</span>
        </div>
    );
}
