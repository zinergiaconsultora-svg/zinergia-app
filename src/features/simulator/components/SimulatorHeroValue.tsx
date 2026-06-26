'use client';

import React from 'react';
import {
    TrendingDown, ArrowRight, Loader2, ShieldCheck, AlertTriangle,
    CheckCircle2, Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FMT_EUR = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

interface ValidationSummary {
    totalFields: number;
    greenFields: number;
    yellowFields: number;
    redFields: number;
    alertCount: number;
    errorCount: number;
}

interface SimulatorHeroValueProps {
    clientName: string | null;
    companyName: string | null;
    tariffLabel: string;
    livePreview: { bestName: string; annualSaving: number } | null;
    livePreviewLoading: boolean;
    currentAnnualCost: number | null;
    validation: ValidationSummary;
    ocrDataConfirmed: boolean;
    localConfirmed: boolean;
    isConfirming: boolean;
    onConfirm: () => void;
    estimatedReviewTime: number;
}

export default function SimulatorHeroValue({
    clientName, companyName, tariffLabel,
    livePreview, livePreviewLoading, currentAnnualCost,
    validation, ocrDataConfirmed, localConfirmed,
    isConfirming, onConfirm, estimatedReviewTime,
}: SimulatorHeroValueProps) {
    const confirmed = ocrDataConfirmed || localConfirmed;
    const hasErrors = validation.errorCount > 0;
    const hasPending = validation.yellowFields > 0 || validation.redFields > 0;
    const allGreen = !hasPending && !hasErrors && validation.greenFields > 0;

    const bestAnnualCost = (currentAnnualCost && livePreview)
        ? currentAnnualCost - livePreview.annualSaving
        : null;
    const savingsPct = (currentAnnualCost && livePreview && currentAnnualCost > 0)
        ? Math.round((livePreview.annualSaving / currentAnnualCost) * 100)
        : null;

    const confirmBtn = confirmed ? (
        <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold">
            <CheckCircle2 size={12} /> Confirmado
        </motion.div>
    ) : allGreen ? (
        <motion.button key="go" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={onConfirm} disabled={isConfirming}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60 shadow-sm shadow-emerald-500/20">
            {isConfirming ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
            {isConfirming ? 'Guardando...' : 'Confirmar datos'}
        </motion.button>
    ) : (
        <motion.button key="review" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={onConfirm} disabled={isConfirming || hasErrors}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-60 ${
                hasErrors
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-emerald-700 dark:hover:bg-emerald-400'
            }`}
            title={hasErrors ? `Resuelve ${validation.redFields} error${validation.redFields !== 1 ? 'es' : ''} para confirmar` : undefined}>
            {isConfirming ? <Loader2 size={11} className="animate-spin" /> : hasErrors ? <AlertTriangle size={11} /> : <ShieldCheck size={11} />}
            {isConfirming ? 'Guardando...' : hasErrors ? `${validation.redFields} error${validation.redFields !== 1 ? 'es' : ''}` : `Confirmar (${validation.yellowFields})`}
        </motion.button>
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 rounded-xl border overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm"
        >
            {/* Header row: name */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {clientName || 'Cliente sin nombre'}
                </p>
                <p className="text-[10px] text-slate-400 truncate hidden sm:block">
                    {companyName || 'Comercializadora'} · {tariffLabel}
                </p>
            </div>

            {/* Savings strip */}
            {(livePreview || livePreviewLoading) && (
                <div className="px-4 py-2.5 bg-emerald-50/60 dark:bg-emerald-950/20 border-b border-emerald-100/60 dark:border-emerald-900/40">
                    {livePreviewLoading ? (
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                            <Loader2 size={12} className="animate-spin" />
                            <span className="text-[11px] font-medium">Calculando ahorro...</span>
                        </div>
                    ) : livePreview && (
                        <div className="flex items-center gap-5 flex-wrap">
                            {currentAnnualCost && currentAnnualCost > 0 && (
                                <>
                                    <div>
                                        <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider leading-none mb-0.5">Paga ahora</p>
                                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300 tabular-nums leading-tight">
                                            {FMT_EUR(currentAnnualCost)}<span className="text-[9px] font-normal text-slate-400">/año</span>
                                        </p>
                                    </div>
                                    <ArrowRight size={12} className="text-slate-300 dark:text-slate-600 shrink-0" />
                                </>
                            )}
                            <div>
                                <p className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider leading-none mb-0.5">Ahorro anual</p>
                                <p className="text-base font-bold text-emerald-700 dark:text-emerald-300 tabular-nums leading-tight">
                                    {FMT_EUR(livePreview.annualSaving)}
                                    {savingsPct !== null && <span className="text-[10px] font-semibold text-emerald-500 ml-1">({savingsPct}%)</span>}
                                </p>
                            </div>
                            {bestAnnualCost && (
                                <>
                                    <ArrowRight size={12} className="text-slate-300 dark:text-slate-600 shrink-0" />
                                    <div>
                                        <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider leading-none mb-0.5">Con mejor tarifa</p>
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums leading-tight">
                                            {FMT_EUR(bestAnnualCost)}<span className="text-[9px] font-normal text-slate-400">/año</span>
                                        </p>
                                    </div>
                                </>
                            )}
                            <div className="flex items-center gap-1.5 ml-auto">
                                <TrendingDown size={12} className="text-emerald-600 dark:text-emerald-400" />
                                <div className="text-right">
                                    <p className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider leading-none">Mejor tarifa</p>
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[180px] leading-tight">
                                        {livePreview.bestName}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Validation bar */}
            <div className="flex items-center justify-between px-4 py-2 gap-4">
                <div className="flex items-center gap-2.5 flex-1">
                    <div className="flex gap-px flex-1 h-1 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                        {validation.greenFields > 0 && (
                            <div className="bg-emerald-400 rounded-full transition-all duration-500"
                                style={{ width: `${(validation.greenFields / validation.totalFields) * 100}%` }} />
                        )}
                        {validation.yellowFields > 0 && (
                            <div className="bg-amber-400 rounded-full transition-all duration-500"
                                style={{ width: `${(validation.yellowFields / validation.totalFields) * 100}%` }} />
                        )}
                        {validation.redFields > 0 && (
                            <div className="bg-red-400 rounded-full transition-all duration-500"
                                style={{ width: `${(validation.redFields / validation.totalFields) * 100}%` }} />
                        )}
                    </div>
                    <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                        {validation.greenFields}/{validation.totalFields} campos OK
                    </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
                    <Clock size={9} />
                    <span>~{estimatedReviewTime < 60 ? `${estimatedReviewTime}s` : `${Math.ceil(estimatedReviewTime / 60)}min`} revisión</span>
                </div>
            </div>
        </motion.div>
    );
}
