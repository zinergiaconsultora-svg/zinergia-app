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

    return (
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl border overflow-hidden bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 border-slate-200 dark:border-slate-800"
        >
            <div className="p-5">
                {/* Row 1: Client info + validation status */}
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="min-w-0">
                        <p className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">
                            {clientName || 'Cliente sin nombre'}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                            {companyName || 'Comercializadora'} · {tariffLabel}
                        </p>
                    </div>

                    {/* Smart confirm button */}
                    <div className="shrink-0">
                        <AnimatePresence mode="wait">
                            {confirmed ? (
                                <motion.div key="done"
                                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-bold"
                                >
                                    <CheckCircle2 size={14} />
                                    Datos confirmados
                                </motion.div>
                            ) : allGreen ? (
                                <motion.button key="go"
                                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                    onClick={onConfirm} disabled={isConfirming}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-60 shadow-lg shadow-emerald-500/20"
                                >
                                    {isConfirming ? (
                                        <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                        <ShieldCheck size={13} />
                                    )}
                                    {isConfirming ? 'Guardando...' : 'Todo correcto — confirmar'}
                                </motion.button>
                            ) : (
                                <motion.button key="review"
                                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                    onClick={onConfirm} disabled={isConfirming || hasErrors}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-60 ${
                                        hasErrors
                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                            : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-emerald-700 dark:hover:bg-emerald-400'
                                    }`}
                                    title={hasErrors ? `Resuelve ${validation.redFields} error${validation.redFields !== 1 ? 'es' : ''} para confirmar` : undefined}
                                >
                                    {isConfirming ? (
                                        <Loader2 size={13} className="animate-spin" />
                                    ) : hasErrors ? (
                                        <AlertTriangle size={13} />
                                    ) : (
                                        <ShieldCheck size={13} />
                                    )}
                                    {isConfirming ? 'Guardando...'
                                        : hasErrors ? `${validation.redFields} error${validation.redFields !== 1 ? 'es' : ''} — revisar`
                                        : `Confirmar (${validation.yellowFields} aviso${validation.yellowFields !== 1 ? 's' : ''})`
                                    }
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Row 2: Value proposition (savings) */}
                {(livePreview || livePreviewLoading) && (
                    <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-100 dark:border-emerald-900 p-4">
                        {livePreviewLoading ? (
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                <Loader2 size={14} className="animate-spin" />
                                <span className="text-xs font-medium">Calculando ahorro potencial...</span>
                            </div>
                        ) : livePreview && (
                            <div className="flex items-center gap-4 flex-wrap">
                                {/* Current cost */}
                                {currentAnnualCost && currentAnnualCost > 0 ? (
                                    <>
                                        <div className="text-center">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Paga ahora</p>
                                            <p className="text-lg font-black text-slate-600 dark:text-slate-300 tabular-nums">
                                                {FMT_EUR(currentAnnualCost)}
                                                <span className="text-[9px] font-medium text-slate-400 ml-1">/año</span>
                                            </p>
                                        </div>
                                        <ArrowRight size={16} className="text-slate-300 dark:text-slate-600 shrink-0" />
                                    </>
                                ) : null}

                                {/* Savings */}
                                <div className="text-center">
                                    <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-0.5">
                                        Ahorro anual
                                    </p>
                                    <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                                        {FMT_EUR(livePreview.annualSaving)}
                                        {savingsPct !== null && (
                                            <span className="text-xs font-bold text-emerald-500 ml-1.5">
                                                ({savingsPct}%)
                                            </span>
                                        )}
                                    </p>
                                </div>

                                {bestAnnualCost && (
                                    <>
                                        <ArrowRight size={16} className="text-slate-300 dark:text-slate-600 shrink-0" />
                                        <div className="text-center">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Con mejor tarifa</p>
                                            <p className="text-lg font-black text-slate-700 dark:text-slate-200 tabular-nums">
                                                {FMT_EUR(bestAnnualCost)}
                                                <span className="text-[9px] font-medium text-slate-400 ml-1">/año</span>
                                            </p>
                                        </div>
                                    </>
                                )}

                                {/* Best tariff name */}
                                <div className="flex items-center gap-2 ml-auto">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                                        <TrendingDown size={14} className="text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Mejor tarifa</p>
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">
                                            {livePreview.bestName}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Row 3: Validation meter + review time */}
                <div className="flex items-center justify-between mt-3 gap-4">
                    {/* Field validation bar */}
                    <div className="flex items-center gap-3 flex-1">
                        <div className="flex gap-0.5 flex-1 h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
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

                    {/* Estimated review time */}
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
                        <Clock size={10} />
                        <span>~{estimatedReviewTime < 60 ? `${estimatedReviewTime}s` : `${Math.ceil(estimatedReviewTime / 60)}min`} revisión</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
