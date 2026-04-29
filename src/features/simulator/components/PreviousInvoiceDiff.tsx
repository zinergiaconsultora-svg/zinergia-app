'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

interface PreviousInvoiceDiffProps {
    prevEnergy: number;
    currentEnergy: number;
    prevAmount: number | null;
    currentAmount: number | null;
    prevDate: string | null;
}

function DiffCell({ label, prev, current, unit, invert }: {
    label: string; prev: number; current: number; unit: string; invert?: boolean;
}) {
    if (prev <= 0) return null;
    const delta = current - prev;
    const pct = Math.round((delta / prev) * 100);
    const isUp = delta > 0;
    const isGood = invert ? isUp : !isUp;

    return (
        <div className="text-center">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
            <div className="flex items-center justify-center gap-1.5">
                <span className="text-xs text-slate-400 tabular-nums line-through">
                    {Math.round(prev)} {unit}
                </span>
                <span className="text-xs text-slate-300">→</span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                    {Math.round(current)} {unit}
                </span>
            </div>
            <div className={`flex items-center justify-center gap-0.5 mt-0.5 text-[10px] font-bold ${
                isGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            }`}>
                {Math.abs(pct) < 2 ? (
                    <><Minus size={10} /><span>=</span></>
                ) : isUp ? (
                    <><TrendingUp size={10} /><span>+{pct}%</span></>
                ) : (
                    <><TrendingDown size={10} /><span>{pct}%</span></>
                )}
            </div>
        </div>
    );
}

export default function PreviousInvoiceDiff({
    prevEnergy, currentEnergy, prevAmount, currentAmount, prevDate,
}: PreviousInvoiceDiffProps) {
    if (prevEnergy <= 0 || currentEnergy <= 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="rounded-xl border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 overflow-hidden"
        >
            <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={12} className="text-indigo-500" />
                <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                    Comparativa vs anterior
                    {prevDate && <span className="font-normal text-indigo-400 ml-1">({prevDate})</span>}
                </span>
            </div>
            <div className="flex items-center justify-around gap-4">
                <DiffCell label="Consumo" prev={prevEnergy} current={currentEnergy} unit="kWh" />
                {prevAmount !== null && currentAmount !== null && currentAmount > 0 && (
                    <DiffCell label="Importe" prev={prevAmount} current={currentAmount} unit="€" invert />
                )}
            </div>
        </motion.div>
    );
}
