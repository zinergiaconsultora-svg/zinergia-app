'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle, Award, BarChart3, ChevronDown, ChevronRight,
    Info, Leaf, TrendingDown, Zap, ClipboardList,
} from 'lucide-react';
import type { AnnualConsolidatedProfile, Season } from '@/lib/aletheia/annualConsolidation';
import type { AuditFinding, AnnualAuditResult, PowerOptimizationPeriod } from '@/lib/aletheia/annualAudit';

interface Props {
    cups: string;
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

const CONFIDENCE_CONFIG = {
    estimacion: { label: 'Estimación', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', bar: 'bg-amber-400' },
    fiable:     { label: 'Fiable',     bg: 'bg-blue-50',  text: 'text-blue-700',  border: 'border-blue-200',  bar: 'bg-blue-500' },
    certificado:{ label: 'Certificado',bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200',bar: 'bg-emerald-500' },
} as const;

const SEVERITY_CONFIG = {
    critical: { dot: 'bg-red-500',    bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700' },
    high:     { dot: 'bg-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
    medium:   { dot: 'bg-amber-400',  bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700' },
    info:     { dot: 'bg-blue-400',   bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700' },
} as const;

const CATEGORY_ICON = {
    potencia:    Zap,
    reactiva:    AlertTriangle,
    tarifa:      BarChart3,
    facturacion: ClipboardList,
    estacional:  Leaf,
} as const;

const SEASON_LABEL: Record<Season, string> = {
    invierno: 'Invierno', primavera: 'Primavera', verano: 'Verano', otoño: 'Otoño',
};

const MONTH_ABBR = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function fmtEur(n: number) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function formatMonth(ym: string) {
    const [year, m] = ym.split('-');
    return `${MONTH_ABBR[parseInt(m, 10)]} ${year.slice(2)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfidenceBadge({ level, score, months }: {
    level: AnnualConsolidatedProfile['confidenceLevel'];
    score: number;
    months: number;
}) {
    const cfg = CONFIDENCE_CONFIG[level];
    return (
        <div className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${cfg.bg} ${cfg.border}`}>
            <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${cfg.text}`}>
                        Nivel de análisis · {cfg.label}
                    </span>
                    <span className={`text-[10px] font-semibold ${cfg.text}`}>{months} factura{months !== 1 ? 's' : ''}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/60 overflow-hidden">
                    <motion.div
                        className={`h-full rounded-full ${cfg.bar}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${score}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                </div>
            </div>
        </div>
    );
}

function SeasonalBar({ months }: { months: AnnualConsolidatedProfile['months'] }) {
    if (months.length === 0) return null;
    const maxEnergy = Math.max(...months.map(m => m.totalEnergy));
    const monthMap = new Map(months.map(m => [m.month, m]));

    // Build a 12-month grid, filling gaps with null
    const currentYear = new Date().getFullYear();
    const grid = Array.from({ length: 12 }, (_, i) => {
        const m = String(i + 1).padStart(2, '0');
        const ym1 = `${currentYear}-${m}`;
        const ym2 = `${currentYear - 1}-${m}`;
        return monthMap.get(ym1) ?? monthMap.get(ym2) ?? null;
    });

    return (
        <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Curva de consumo anual</p>
            <div className="flex items-end gap-px h-14">
                {grid.map((month, i) => {
                    const pct = month ? Math.max(8, (month.totalEnergy / maxEnergy) * 100) : 0;
                    const isPresent = !!month;
                    return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                            <div className="w-full flex items-end justify-center" style={{ height: '44px' }}>
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${pct}%` }}
                                    transition={{ delay: i * 0.03, duration: 0.5, ease: 'easeOut' }}
                                    className={`w-full rounded-sm ${isPresent ? 'bg-indigo-400' : 'bg-slate-100'}`}
                                    title={month ? `${formatMonth(month.month)}: ${Math.round(month.totalEnergy)} kWh` : MONTH_ABBR[i + 1]}
                                />
                            </div>
                            <span className="text-[8px] text-slate-300">{MONTH_ABBR[i + 1][0]}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function PowerOptimizationTable({ periods }: { periods: PowerOptimizationPeriod[] }) {
    return (
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-xs min-w-[420px]">
                <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        <th className="px-3 py-1.5 text-left">Periodo</th>
                        <th className="px-3 py-1.5 text-right">Actual (kW)</th>
                        <th className="px-3 py-1.5 text-right">Pico real (kW)</th>
                        <th className="px-3 py-1.5 text-right">Óptimo (kW)</th>
                        <th className="px-3 py-1.5 text-right">Ahorro/año</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {periods.map(p => (
                        <tr key={p.period}>
                            <td className="px-3 py-2 font-bold text-slate-700">{p.period}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-500">{p.contracted.toFixed(1)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                                {p.realPeak.toFixed(1)}
                                {p.isFromMaximeter && <span className="ml-1 text-[9px] text-emerald-600">↑real</span>}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-700">{p.optimal}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-700">
                                {p.savingsEur > 0 ? fmtEur(p.savingsEur) : '—'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function FindingCard({ finding, powerPeriods, defaultOpen = false }: {
    finding: AuditFinding;
    powerPeriods?: PowerOptimizationPeriod[] | null;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const sev = SEVERITY_CONFIG[finding.severity];
    const Icon = CATEGORY_ICON[finding.category];

    return (
        <motion.div
            layout
            className={`rounded-xl border overflow-hidden ${sev.border}`}
        >
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:brightness-[0.98] transition-all ${sev.bg}`}
            >
                <div className={`mt-0.5 rounded-lg p-1.5 shrink-0 ${sev.badge}`}>
                    <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold ${sev.text}`}>{finding.title}</span>
                        {finding.annualSavingsEur > 0 && (
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-full px-2 py-0.5">
                                {fmtEur(finding.annualSavingsEur)}/año
                            </span>
                        )}
                        <span className={`text-[9px] font-semibold uppercase tracking-wide rounded-full px-1.5 py-0.5 ${sev.badge}`}>
                            {finding.severity === 'info' ? 'info' : finding.severity === 'medium' ? 'medio' : finding.severity === 'high' ? 'alto' : 'crítico'}
                        </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-600 leading-relaxed">{finding.description}</p>
                </div>
                <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform mt-0.5 ${open ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 pt-2 bg-white border-t border-slate-100 space-y-3">
                            {/* Action CTA */}
                            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <p className="text-xs font-semibold text-slate-700">{finding.actionLabel}</p>
                            </div>

                            {/* Detail */}
                            <p className="text-[11px] text-slate-600 leading-relaxed">{finding.actionDetail}</p>

                            {/* Supporting data */}
                            {finding.supportingData && Object.keys(finding.supportingData).length > 0 && (
                                <div className="grid grid-cols-2 gap-px bg-slate-100 rounded-lg overflow-hidden">
                                    {Object.entries(finding.supportingData).map(([k, v]) => (
                                        <div key={k} className="bg-white px-3 py-2">
                                            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{k}</p>
                                            <p className="text-xs font-semibold text-slate-800 mt-0.5">{v}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Power optimization table */}
                            {finding.category === 'potencia' && powerPeriods && powerPeriods.length > 0 && (
                                <PowerOptimizationTable periods={powerPeriods} />
                            )}

                            {/* Confidence */}
                            <p className="text-[9px] text-slate-400">
                                Confianza: <span className="font-semibold capitalize">{finding.confidence}</span>
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AnnualAuditView({ cups }: Props) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{ profile: AnnualConsolidatedProfile; audit: AnnualAuditResult } | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(false);

        import('@/app/actions/annualAudit').then(({ getAnnualAuditAction }) =>
            getAnnualAuditAction(cups)
        ).then(result => {
            if (cancelled) return;
            setData(result);
            setLoading(false);
        }).catch(() => {
            if (!cancelled) { setError(true); setLoading(false); }
        });

        return () => { cancelled = true; };
    }, [cups]);

    // Only show if we have ≥2 months of data — single invoice is already covered by ConsumptionProfileCard
    if (loading) {
        return (
            <div className="mb-8 rounded-2xl border border-slate-100 bg-white p-5 flex items-center gap-3 text-xs text-slate-400">
                <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin shrink-0" />
                Analizando histórico de facturas del suministro…
            </div>
        );
    }

    if (error || !data || data.profile.monthsCovered < 2) return null;

    const { profile, audit } = data;
    const { confidenceLevel: level, confidenceScore: score, monthsCovered, missingSeasons } = profile;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
        >
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-semibold text-slate-900">Auditoría Anual</h3>
                <span className="text-xs text-slate-400 ml-1">{monthsCovered} facturas · mismo suministro</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,280px)_1fr] gap-4">

                {/* Left: confidence + seasonal bar + totals */}
                <div className="flex flex-col gap-3">
                    <ConfidenceBadge level={level} score={score} months={monthsCovered} />

                    <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-4">
                        <SeasonalBar months={profile.months} />

                        {/* Annual aggregates */}
                        <div className="grid grid-cols-2 gap-px bg-slate-100 rounded-lg overflow-hidden">
                            <div className="bg-white px-3 py-2">
                                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Consumo anual</p>
                                <p className="text-sm font-black tabular-nums text-slate-900">
                                    {Math.round(profile.totalEnergyKwh).toLocaleString('es-ES')} kWh
                                </p>
                            </div>
                            <div className="bg-white px-3 py-2">
                                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Gasto anual</p>
                                <p className="text-sm font-black tabular-nums text-slate-900">
                                    {fmtEur(profile.annualTotalAmount)}
                                </p>
                            </div>
                            {profile.annualReactiveCost > 0 && (
                                <div className="bg-white px-3 py-2">
                                    <p className="text-[9px] font-bold uppercase tracking-wide text-amber-500">Reactiva/año</p>
                                    <p className="text-sm font-black tabular-nums text-amber-700">
                                        {fmtEur(profile.annualReactiveCost)}
                                    </p>
                                </div>
                            )}
                            {profile.annualExcessPowerCost > 0 && (
                                <div className="bg-white px-3 py-2">
                                    <p className="text-[9px] font-bold uppercase tracking-wide text-red-500">Excesos pot./año</p>
                                    <p className="text-sm font-black tabular-nums text-red-700">
                                        {fmtEur(profile.annualExcessPowerCost)}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Seasonal ratio */}
                        {profile.seasonalRatio.ratio > 1.3 && (
                            <div className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                                <span className="font-semibold text-slate-700">Estacionalidad {profile.seasonalRatio.ratio.toFixed(1)}x</span>
                                {' — '}pico en <span className="font-medium">{SEASON_LABEL[profile.seasonalRatio.peakSeason]}</span>,
                                mínimo en <span className="font-medium">{SEASON_LABEL[profile.seasonalRatio.valleySeason]}</span>.
                            </div>
                        )}

                        {/* Missing seasons hint */}
                        {missingSeasons.length > 0 && (
                            <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
                                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span>
                                    Pide facturas de <strong>{missingSeasons.map(s => SEASON_LABEL[s]).join(', ')}</strong> para subir el análisis a nivel Certificado.
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: audit findings */}
                <div className="flex flex-col gap-3">
                    {/* Total savings strip */}
                    {audit.totalQuantifiedSavings > 0 && (
                        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                            <TrendingDown className="w-5 h-5 text-emerald-600 shrink-0" />
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Ahorro total identificado</p>
                                <p className="text-xl font-black tabular-nums text-emerald-800">
                                    {fmtEur(audit.totalQuantifiedSavings)}<span className="text-sm font-semibold text-emerald-600">/año</span>
                                </p>
                            </div>
                        </div>
                    )}

                    {audit.findings.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-400">
                            No se detectaron oportunidades de optimización adicionales.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {audit.findings.map((finding, i) => (
                                <FindingCard
                                    key={finding.id}
                                    finding={finding}
                                    powerPeriods={finding.category === 'potencia' ? audit.powerOptimizationByPeriod : null}
                                    defaultOpen={i === 0}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
