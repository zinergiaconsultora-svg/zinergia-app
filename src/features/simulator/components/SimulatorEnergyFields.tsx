'use client';

import React from 'react';
import { Zap, ArrowRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { InvoiceData } from '@/types/crm';
import { SectionLabel, PeriodTable } from './SimulatorFormPrimitives';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LivePreview { bestName: string; annualSaving: number; }

interface SimulatorEnergyFieldsProps {
    data: InvoiceData;
    onUpdate: <K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) => void;
    visibleEnergyPeriods: number[];
    visiblePowerPeriods: number[];
    hasEnergyValues: boolean;
    hasPowerValues: boolean;
    livePreview: LivePreview | null;
    livePreviewLoading: boolean;
    isAnalyzing: boolean;
    loadingMessage: string;
    onCompare: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const SimulatorEnergyFields: React.FC<SimulatorEnergyFieldsProps> = ({
    data, onUpdate, visibleEnergyPeriods, visiblePowerPeriods,
    hasEnergyValues, hasPowerValues, livePreview, livePreviewLoading,
    isAnalyzing, loadingMessage, onCompare,
}) => (
    <div className="space-y-5">

        {/* Energy */}
        <section>
            <SectionLabel color="bg-emerald-400" label="Consumo kWh" />
            <PeriodTable
                periods={visibleEnergyPeriods} prefix="energy_p" data={data} onUpdate={onUpdate}
                accent="emerald" missingAlert={!hasEnergyValues ? 'Sin consumo detectado' : undefined}
            />
        </section>

        {/* Power */}
        <section>
            <SectionLabel color="bg-amber-400" label="Potencia kW" />
            <PeriodTable
                periods={visiblePowerPeriods} prefix="power_p" data={data} onUpdate={onUpdate}
                accent="amber" missingAlert={!hasPowerValues ? 'Falta potencia contratada' : undefined}
            />
        </section>

        {/* Maximeter */}
        <section>
            <div className="flex items-center gap-2 mb-2 px-1">
                <div className="w-1 h-4 bg-purple-400 rounded-full" />
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Maxímetro kW</h3>
                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-px rounded">Opcional</span>
            </div>
            <PeriodTable
                periods={visiblePowerPeriods} prefix="max_demand_p" data={data} onUpdate={onUpdate}
                accent="purple" placeholder="—"
            />
        </section>

        {/* Live tariff preview */}
        <AnimatePresence>
            {(livePreviewLoading || livePreview) && (
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-3.5 flex items-center gap-3"
                >
                    {livePreviewLoading ? (
                        <>
                            <Loader2 size={16} className="text-emerald-500 animate-spin shrink-0" />
                            <span className="text-xs text-emerald-700 font-medium">Calculando ahorro potencial…</span>
                        </>
                    ) : livePreview && (
                        <>
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                                <Zap size={15} className="text-emerald-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">Preview · Mejor tarifa</p>
                                <p className="text-sm font-bold text-emerald-900 truncate">{livePreview.bestName}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-[9px] text-emerald-600 uppercase tracking-wide mb-0.5">Ahorro est.</p>
                                <p className="text-base font-black text-emerald-700 tabular-nums">
                                    {livePreview.annualSaving > 0 ? `${livePreview.annualSaving.toFixed(0)} €` : '—'}
                                    <span className="text-[9px] font-medium text-emerald-500 ml-1">/año</span>
                                </p>
                            </div>
                        </>
                    )}
                </motion.div>
            )}
        </AnimatePresence>

        {/* CTA */}
        <motion.button
            whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}
            onClick={onCompare}
            disabled={isAnalyzing || !hasEnergyValues || !hasPowerValues}
            className="w-full relative bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-5 px-6 rounded-2xl font-bold text-base shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:grayscale transition-all overflow-hidden group"
        >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
            {isAnalyzing ? (
                <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                    <span>{loadingMessage}</span>
                </>
            ) : (
                <>
                    <span>Ejecutar Comparativa</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
            )}
        </motion.button>
    </div>
);

export default SimulatorEnergyFields;
