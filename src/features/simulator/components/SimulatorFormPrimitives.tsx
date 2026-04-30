'use client';

import React from 'react';
import { AlertCircle, Info, ScanSearch } from 'lucide-react';
import { motion } from 'framer-motion';
import { InvoiceData } from '@/types/crm';

// ── SectionLabel ──────────────────────────────────────────────────────────────

export function SectionLabel({ color, label }: { color: string; label: string }) {
    return (
        <div className="flex items-center gap-2 mb-2 px-1">
            <div className={`w-1 h-4 ${color} rounded-full`} />
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest">{label}</h3>
        </div>
    );
}

// ── PeriodTable ───────────────────────────────────────────────────────────────

export interface PeriodTableProps {
    periods: number[];
    prefix: string;
    data: InvoiceData;
    onUpdate: <K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) => void;
    accent: 'emerald' | 'amber' | 'purple';
    missingAlert?: string;
    placeholder?: string;
}

export const ACCENT = {
    emerald: { badge: 'text-emerald-700 bg-emerald-100', border: 'border-emerald-200 focus:border-emerald-500' },
    amber:   { badge: 'text-amber-700 bg-amber-100',     border: 'border-amber-200 focus:border-amber-500' },
    purple:  { badge: 'text-purple-700 bg-purple-100',   border: 'border-purple-200 focus:border-purple-500' },
};

export function PeriodTable({ periods, prefix, data, onUpdate, accent, missingAlert, placeholder }: PeriodTableProps) {
    const c = ACCENT[accent];
    return (
        <div className="rounded-2xl bg-white/70 border border-slate-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-50">
                {periods.map(p => {
                    const field = `${prefix}${p}` as keyof InvoiceData;
                    const val = (data[field] as number) || 0;
                    return (
                        <div key={p} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/60 transition-colors">
                            <span className={`text-[10px] font-black w-7 text-center py-0.5 rounded ${c.badge}`}>P{p}</span>
                            <input
                                type="number"
                                aria-label={`${prefix}${p}`}
                                value={val || ''}
                                placeholder={placeholder ?? '0'}
                                onChange={e => onUpdate(field, (parseFloat(e.target.value) || 0) as InvoiceData[typeof field])}
                                className={`flex-1 bg-transparent border-b ${c.border} focus:outline-none text-right font-bold text-slate-800 text-sm py-0.5 placeholder:text-slate-300`}
                            />
                        </div>
                    );
                })}
            </div>
            {missingAlert && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 border-t border-orange-100">
                    <AlertCircle size={12} className="text-orange-500 shrink-0" />
                    <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wide">{missingAlert}</span>
                </div>
            )}
        </div>
    );
}

// ── LocateButton ──────────────────────────────────────────────────────────────

export interface LocateButtonProps { onClick: () => void; lowConfidence?: boolean; }

export const LocateButton: React.FC<LocateButtonProps> = ({ onClick, lowConfidence }) => (
    <motion.button type="button" onClick={onClick}
        whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
        title="Localizar en la factura"
        className={`p-1 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
            lowConfidence
                ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50 animate-pulse'
                : 'text-slate-300 hover:text-emerald-600 hover:bg-emerald-50'
        }`}
    >
        <ScanSearch size={13} />
    </motion.button>
);

// ── ConfidencePill ────────────────────────────────────────────────────────────

export const ConfidencePill: React.FC<{ value: number | null }> = ({ value }) => {
    if (value === null) return null;
    const pct = Math.round(value * 100);
    const cls = value >= 0.9
        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
        : value >= 0.7
            ? 'text-amber-600 bg-amber-50 border-amber-200'
            : 'text-red-600 bg-red-50 border-red-200';
    return (
        <span className={`inline-flex items-center px-1.5 py-px rounded border normal-case tracking-normal font-black text-[9px] tabular-nums ${cls}`}>
            {pct}%
        </span>
    );
};

// ── CorrectionBadge ───────────────────────────────────────────────────────────

export interface CorrectionBadgeProps {
    stat?: { count: number; mostFrequentValue: string | null };
}

export const CorrectionBadge: React.FC<CorrectionBadgeProps> = ({ stat }) => {
    if (!stat || stat.count === 0) return null;
    return (
        <div className="group relative inline-flex items-center">
            <button type="button" className="flex items-center gap-0.5 text-amber-400 hover:text-amber-600 transition-colors">
                <Info size={10} />
                <span className="text-[9px] font-black tabular-nums">{stat.count}</span>
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-44 z-30 hidden group-hover:block pointer-events-none">
                <div className="bg-slate-900 rounded-lg p-2.5 shadow-xl text-left">
                    <p className="text-[9px] font-bold text-amber-400 mb-1">
                        Corregido {stat.count} {stat.count === 1 ? 'vez' : 'veces'}
                    </p>
                    {stat.mostFrequentValue && (
                        <p className="text-[9px] text-slate-300">
                            Valor usual: <span className="font-mono font-bold">{stat.mostFrequentValue}</span>
                        </p>
                    )}
                </div>
                <div className="w-2 h-2 bg-slate-900 rotate-45 mx-auto -mt-1" />
            </div>
        </div>
    );
};

// ── EnergySparkline ───────────────────────────────────────────────────────────

export interface SparklineProps {
    history: { month: string; totalEnergy: number }[];
    currentEnergy: number;
}

export const EnergySparkline: React.FC<SparklineProps> = ({ history, currentEnergy }) => {
    const W = 260, H = 40, PAD = 4;
    const all = [...history];
    const lastMonth = all[all.length - 1]?.month ?? '';
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (currentEnergy > 0 && thisMonth !== lastMonth) {
        all.push({ month: thisMonth, totalEnergy: currentEnergy });
    }
    if (all.length < 2) return null;

    const maxE = Math.max(...all.map(d => d.totalEnergy));
    const minE = Math.min(...all.map(d => d.totalEnergy));
    const range = maxE - minE || 1;
    const step = (W - PAD * 2) / (all.length - 1);

    const points = all.map((d, i) => ({
        x: PAD + i * step,
        y: H - PAD - ((d.totalEnergy - minE) / range) * (H - PAD * 2),
        d,
        isCurrent: d.month === thisMonth,
    }));

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const lastP = points[points.length - 1];

    return (
        <div className="flex items-center gap-2 px-2 py-2 rounded-xl bg-blue-50/60 border border-blue-100">
            <svg width={W} height={H} className="shrink-0 overflow-visible">
                <defs>
                    <linearGradient id="spk-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(99,102,241)" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="rgb(99,102,241)" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path
                    d={`${pathD} L${lastP.x.toFixed(1)},${H} L${PAD},${H} Z`}
                    fill="url(#spk-fill)"
                />
                <path d={pathD} fill="none" stroke="rgb(99,102,241)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                {points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={p.isCurrent ? 3.5 : 2}
                        fill={p.isCurrent ? 'rgb(99,102,241)' : 'white'}
                        stroke="rgb(99,102,241)" strokeWidth="1.5"
                    />
                ))}
            </svg>
            <div className="shrink-0 text-right">
                <p className="text-[8px] text-blue-400 font-bold uppercase tracking-wide leading-none mb-0.5">{all.length} meses</p>
                <p className="text-[10px] font-black text-blue-700 tabular-nums">{Math.round(maxE).toLocaleString('es-ES')} kWh</p>
                <p className="text-[8px] text-blue-400">máx</p>
            </div>
        </div>
    );
};
