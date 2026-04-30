'use client';

import React from 'react';
import {
    ChevronLeft, Eye, EyeOff, Target, CheckCircle2, ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OpportunityScore {
    total: number;
    label: string;
    color: 'emerald' | 'amber' | string;
    insights: string[];
}

interface SimulatorTopBarProps {
    onBack: () => void;
    pdfUrl?: string | null;
    showPdf: boolean;
    onTogglePdf: () => void;
    hasEnergyValues: boolean;
    hasPowerValues: boolean;
    opportunityScore: OpportunityScore;
    globalConfidence: number | null;
    circumference: number;
    dashOffset: number;
    ringColor: string;
    scoreColor: string;
    ocrDataConfirmed: boolean;
    localConfirmed: boolean;
    isConfirming: boolean;
    onConfirm: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const SimulatorTopBar: React.FC<SimulatorTopBarProps> = ({
    onBack, pdfUrl, showPdf, onTogglePdf,
    hasEnergyValues, hasPowerValues, opportunityScore,
    globalConfidence, circumference, dashOffset, ringColor, scoreColor,
    ocrDataConfirmed, localConfirmed, isConfirming, onConfirm,
}) => (
    <div className="flex items-center justify-between gap-4 mb-6">
        <motion.button
            whileHover={{ x: -3 }}
            onClick={onBack}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-xs font-bold tracking-widest uppercase transition-colors group"
        >
            <ChevronLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
            Nueva factura
        </motion.button>

        <div className="flex items-center gap-2">
            {/* PDF toggle */}
            {pdfUrl && (
                <button type="button" onClick={onTogglePdf}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border
                        bg-white/60 border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700">
                    {showPdf ? <EyeOff size={12} /> : <Eye size={12} />}
                    {showPdf ? 'Ocultar PDF' : 'Ver PDF'}
                </button>
            )}

            {/* Opportunity score badge */}
            {(hasEnergyValues || hasPowerValues) && (
                <div className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-default
                    ${opportunityScore.color === 'emerald' ? 'bg-emerald-50 border-emerald-200' :
                      opportunityScore.color === 'amber'   ? 'bg-amber-50 border-amber-200' :
                                                             'bg-slate-50 border-slate-200'}`}>
                    <Target size={13} className={
                        opportunityScore.color === 'emerald' ? 'text-emerald-600' :
                        opportunityScore.color === 'amber'   ? 'text-amber-600' : 'text-slate-400'} />
                    <div>
                        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-0.5">Oportunidad</p>
                        <p className={`text-sm font-black tabular-nums leading-none
                            ${opportunityScore.color === 'emerald' ? 'text-emerald-700' :
                              opportunityScore.color === 'amber'   ? 'text-amber-700' : 'text-slate-500'}`}>
                            {opportunityScore.total}<span className="text-[9px] font-medium ml-px">/100</span>
                        </p>
                    </div>
                    {/* Tooltip */}
                    <div className="absolute top-full right-0 mt-1.5 w-56 z-20 hidden group-hover:block">
                        <div className="bg-slate-900 rounded-xl p-3 shadow-xl text-left">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Score {opportunityScore.label}</p>
                            {opportunityScore.insights.map((ins, i) => (
                                <p key={i} className="text-[10px] text-slate-300 leading-snug mb-1 flex gap-1.5">
                                    <span className="text-emerald-400 shrink-0">·</span>{ins}
                                </p>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* OCR score ring */}
            {globalConfidence !== null && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/60 border border-slate-200">
                    <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
                        <circle cx="18" cy="18" r="16" fill="none" strokeWidth="3" className="stroke-slate-100" />
                        <circle cx="18" cy="18" r="16" fill="none" strokeWidth="3"
                            className={`${ringColor} transition-all duration-700`}
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round" />
                    </svg>
                    <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">OCR</p>
                        <p className={`text-sm font-black tabular-nums leading-none ${scoreColor}`}>
                            {Math.round(globalConfidence * 100)}%
                        </p>
                    </div>
                </div>
            )}

            {/* Confirm button */}
            <AnimatePresence mode="wait">
                {(ocrDataConfirmed || localConfirmed) ? (
                    <motion.div key="confirmed"
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                        <CheckCircle2 size={13} />
                        Confirmado
                    </motion.div>
                ) : (
                    <motion.button key="confirm"
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={onConfirm} disabled={isConfirming}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-60">
                        {isConfirming
                            ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                                className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full" />
                            : <ShieldCheck size={13} />
                        }
                        {isConfirming ? 'Guardando…' : 'Confirmar datos'}
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    </div>
);

export default SimulatorTopBar;
