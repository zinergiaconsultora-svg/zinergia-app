'use client';

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { logger } from '@/lib/utils/logger';
import {
    Zap, ChevronLeft, ArrowRight, User, Building2, Hash,
    Calendar, MapPin, Activity, AlertCircle, AlertTriangle,
    CheckCircle2, ShieldCheck, ScanSearch, ChevronDown,
    TrendingUp, TrendingDown, Sparkles, Eye, EyeOff,
    Link2, UserCheck, Loader2, Info, Target,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { InvoiceData } from '@/types/crm';
import { Input } from '@/components/ui/primitives/Input';
import { DemoModeAlert } from '@/components/ui/DemoModeAlert';
import { PdfViewerWrapper } from './PdfViewerWrapper';
import type { PdfViewerHandle, ConfidenceField } from './PdfViewer';
import { computeOpportunityScore } from '@/lib/utils/opportunity-score';

// ── Props ─────────────────────────────────────────────────────────────────────

interface SimulatorFormProps {
    data: InvoiceData;
    onUpdate: <K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) => void;
    onCompare: () => void;
    onBack: () => void;
    isAnalyzing: boolean;
    loadingMessage: string;
    powerType: string;
    onPowerTypeOverride?: (type: '2.0' | '3.0' | '3.1') => void;
    pdfUrl?: string | null;
    isMockMode?: boolean;
    originalData?: InvoiceData | null;
    ocrJobId?: string | null;
    ocrDataConfirmed?: boolean;
    onConfirmOcrData?: () => Promise<{ correctedFieldsCount: number }>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const SimulatorForm: React.FC<SimulatorFormProps> = ({
    data, onUpdate, onCompare, onBack, isAnalyzing, loadingMessage,
    powerType, onPowerTypeOverride, pdfUrl, isMockMode = false,
    originalData: _originalData, ocrDataConfirmed = false, onConfirmOcrData,
}) => {
    const [isConfirming, setIsConfirming] = useState(false);
    const [localConfirmed, setLocalConfirmed] = useState(false);
    const [showPdf, setShowPdf] = useState(true);
    const [alertsExpanded, setAlertsExpanded] = useState(true);
    const [showTariffOverride, setShowTariffOverride] = useState(false);
    const pdfViewerRef = useRef<PdfViewerHandle>(null);

    // ── Correcciones automáticas ──────────────────────────────────────────────
    const [suggestions, setSuggestions] = useState<Record<string, unknown>>({});
    const [suggestionsApplied, setSuggestionsApplied] = useState(false);
    useEffect(() => {
        if (!data.company_name || isMockMode) return;
        setSuggestions({});
        setSuggestionsApplied(false);
        let cancelled = false;
        import('@/app/actions/ocr-confirm').then(({ getSuggestedCorrections }) => {
            getSuggestedCorrections(data.company_name!).then(r => {
                if (!cancelled && Object.keys(r).length > 0) setSuggestions(r);
            }).catch(() => { logger.warn('OCR suggestion failed') });
        });
        return () => { cancelled = true; };
    }, [data.company_name, isMockMode]);

    const applySuggestions = () => {
        for (const [field, value] of Object.entries(suggestions)) {
            onUpdate(field as keyof InvoiceData, value as InvoiceData[keyof InvoiceData]);
        }
        setSuggestionsApplied(true);
        setSuggestions({});
    };

    // ── Comparativa factura anterior ──────────────────────────────────────────
    const [prevInvoice, setPrevInvoice] = useState<{ totalEnergyKwh: number; totalAmountEur: number | null; invoiceDate: string | null } | null>(null);
    useEffect(() => {
        if (!data.cups || !data.invoice_date || isMockMode) return;
        setPrevInvoice(null);
        let cancelled = false;
        import('@/app/actions/ocr-jobs').then(({ getPreviousInvoiceData }) => {
            getPreviousInvoiceData(data.cups!, data.invoice_date!).then(r => {
                if (!cancelled) setPrevInvoice(r);
            }).catch(() => { logger.warn('OCR suggestion failed') });
        });
        return () => { cancelled = true; };
    }, [data.cups, data.invoice_date, isMockMode]);

    const totalEnergyNow = useMemo(() =>
        [1, 2, 3, 4, 5, 6].reduce((s, p) => s + ((data[`energy_p${p}` as keyof InvoiceData] as number) || 0), 0),
    [data]);

    // ── Duplicado ─────────────────────────────────────────────────────────────
    const [duplicateInfo, setDuplicateInfo] = useState<{ createdAt: string; invoiceNumber: string | null } | null>(null);
    useEffect(() => {
        if (!data.cups || !data.invoice_date || isMockMode) return;
        setDuplicateInfo(null);
        let cancelled = false;
        import('@/app/actions/ocr-jobs').then(({ checkDuplicateInvoice }) => {
            checkDuplicateInvoice(data.cups!, data.invoice_date!).then(r => {
                if (!cancelled) setDuplicateInfo(r ? { createdAt: r.createdAt, invoiceNumber: r.invoiceNumber } : null);
            }).catch(() => { logger.warn('OCR suggestion failed') });
        });
        return () => { cancelled = true; };
    }, [data.cups, data.invoice_date, isMockMode]);

    // ── Vinculación automática al cliente por CUPS ────────────────────────────
    const [cupsClient, setCupsClient] = useState<{ id: string; name: string } | null>(null);
    const [cupsClientDismissed, setCupsClientDismissed] = useState(false);
    useEffect(() => {
        const cups = data.cups;
        if (!cups || cups.length < 20 || isMockMode) { setCupsClient(null); return; }
        setCupsClientDismissed(false);
        let cancelled = false;
        import('@/app/actions/crm').then(({ findClientByCups }) => {
            findClientByCups(cups).then(r => {
                if (!cancelled) setCupsClient(r);
            }).catch(() => { logger.warn('OCR suggestion failed') });
        });
        return () => { cancelled = true; };
    }, [data.cups, isMockMode]);

    // ── Sparkline histórico de consumo ────────────────────────────────────────
    interface EnergyMonth { month: string; totalEnergy: number; }
    const [energyHistory, setEnergyHistory] = useState<EnergyMonth[]>([]);
    useEffect(() => {
        const cups = data.cups;
        if (!cups || cups.length < 20 || isMockMode) { setEnergyHistory([]); return; }
        let cancelled = false;
        import('@/app/actions/ocr-jobs').then(({ getCupsEnergyHistory }) => {
            getCupsEnergyHistory(cups, 12).then(r => {
                if (!cancelled) setEnergyHistory(r);
            }).catch(() => { logger.warn('OCR suggestion failed') });
        });
        return () => { cancelled = true; };
    }, [data.cups, isMockMode]);

    // ── Live tariff preview ───────────────────────────────────────────────────
    interface LivePreview { bestName: string; annualSaving: number; }
    const [livePreview, setLivePreview] = useState<LivePreview | null>(null);
    const [livePreviewLoading, setLivePreviewLoading] = useState(false);
    const livePreviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const triggerLivePreview = useCallback(() => {
        if (livePreviewTimer.current) clearTimeout(livePreviewTimer.current);
        const hasEnergy = [1,2,3,4,5,6].some(p => (data[`energy_p${p}` as keyof InvoiceData] as number) > 0);
        const hasPower  = [1,2,3,4,5,6].some(p => (data[`power_p${p}` as keyof InvoiceData] as number) > 0);
        if (!hasEnergy || !hasPower || isMockMode) { setLivePreview(null); return; }

        setLivePreviewLoading(true);
        livePreviewTimer.current = setTimeout(async () => {
            try {
                const { calculateSavingsAction } = await import('@/app/actions/compare');
                const result = await calculateSavingsAction(data);
                const offers = result?.offers ?? [];
                if (offers.length === 0) { setLivePreview(null); return; }
                const best = offers.reduce((a: { annual_saving?: number; name?: string }, b: { annual_saving?: number; name?: string }) =>
                    (b.annual_saving ?? 0) > (a.annual_saving ?? 0) ? b : a
                );
                setLivePreview({
                    bestName: best.name ?? 'Mejor tarifa',
                    annualSaving: best.annual_saving ?? 0,
                });
            } catch {
                setLivePreview(null);
            } finally {
                setLivePreviewLoading(false);
            }
        }, 1800);
    }, [data, isMockMode]);

    useEffect(() => {
        triggerLivePreview();
        return () => { if (livePreviewTimer.current) clearTimeout(livePreviewTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.energy_p1, data.energy_p2, data.energy_p3, data.energy_p4, data.energy_p5, data.energy_p6,
        data.power_p1, data.power_p2, data.power_p3, data.power_p4, data.power_p5, data.power_p6,
        data.period_days]);

    // ── Historial de correcciones por campo ───────────────────────────────────
    interface FieldStat { field: string; count: number; mostFrequentValue: string | null; }
    const [fieldStats, setFieldStats] = useState<FieldStat[]>([]);
    useEffect(() => {
        if (!data.company_name || isMockMode) { setFieldStats([]); return; }
        let cancelled = false;
        import('@/app/actions/ocr-confirm').then(({ getFieldCorrectionStats }) => {
            getFieldCorrectionStats(data.company_name!).then(r => {
                if (!cancelled) setFieldStats(r);
            }).catch(() => { logger.warn('OCR suggestion failed') });
        });
        return () => { cancelled = true; };
    }, [data.company_name, isMockMode]);

    const getFieldStat = useCallback((field: string) =>
        fieldStats.find(s => s.field === field), [fieldStats]);

    // ── Score de oportunidad ──────────────────────────────────────────────────
    const opportunityScore = useMemo(() =>
        computeOpportunityScore(data), [data]);

    // ── Sincronizar confirmación local ────────────────────────────────────────
    React.useEffect(() => {
        if (!ocrDataConfirmed) setLocalConfirmed(false);
    }, [ocrDataConfirmed]);

    const handleConfirm = async () => {
        if (isConfirming) return;
        setIsConfirming(true);
        setTimeout(() => {
            setIsConfirming(false);
            setLocalConfirmed(true);
            toast.success('Datos confirmados. ¡Gracias!');
            if (onConfirmOcrData) onConfirmOcrData().catch(() => { logger.warn('OCR suggestion failed') });
        }, 600);
    };

    // ── Confianza OCR ─────────────────────────────────────────────────────────
    const getConfidence = (field: string): number | null => {
        const conf = (data as unknown as Record<string, unknown>)._confidence as Record<string, number> | undefined;
        if (!conf || conf[field] === undefined) return null;
        return conf[field];
    };
    const isLowConfidence = (f: string) => { const c = getConfidence(f); return c !== null && c < 0.7; };
    const lowConfWarn = (f: string) => { const c = getConfidence(f); return (c !== null && c < 0.7) ? `Confianza ${Math.round(c * 100)}% — revisa este dato` : undefined; };

    const globalConfidence = useMemo(() => {
        const conf = (data as unknown as Record<string, unknown>)._confidence as Record<string, number> | undefined;
        if (!conf) return null;
        const vals = Object.values(conf).filter((v): v is number => typeof v === 'number');
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }, [data]);

    const lowConfidenceCount = useMemo(() => {
        const conf = (data as unknown as Record<string, unknown>)._confidence as Record<string, number> | undefined;
        if (!conf) return 0;
        return Object.values(conf).filter((v): v is number => typeof v === 'number' && v < 0.7).length;
    }, [data]);

    // ── Validaciones cruzadas ─────────────────────────────────────────────────
    const crossFieldIssues = useMemo(() => {
        const issues: Array<{ severity: 'error' | 'warning'; message: string }> = [];
        if (data.dni_cif) {
            const c = data.dni_cif.trim().toUpperCase();
            const ok = /^[0-9]{8}[TRWAGMYFPDXBNJZSQVHLCKE]$/.test(c)
                || /^[XYZ][0-9]{7}[TRWAGMYFPDXBNJZSQVHLCKE]$/.test(c)
                || /^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/.test(c);
            if (!ok) issues.push({ severity: 'warning', message: `"${c}" no coincide con NIF, NIE ni CIF español` });
        }
        if (data.cups) {
            if (!data.cups.startsWith('ES')) {
                issues.push({ severity: 'error', message: 'CUPS debe comenzar con "ES" — probable error OCR' });
            } else if (!/^ES[0-9]{16}[A-Z0-9]{2}([A-Z0-9]{2})?$/.test(data.cups)) {
                issues.push({ severity: 'warning', message: 'Estructura de CUPS inusual — verifica los caracteres finales' });
            }
        }
        const hasP456Energy = [4, 5, 6].some(p => (data[`energy_p${p}` as keyof InvoiceData] as number) > 0);
        const hasP456Power  = [4, 5, 6].some(p => (data[`power_p${p}` as keyof InvoiceData] as number) > 0);
        if (powerType === '2.0' && (hasP456Energy || hasP456Power)) {
            issues.push({ severity: 'warning', message: 'Tarifa 2.0TD con valores en P4-P6 — posible error OCR' });
        }
        if (data.period_days > 0 && data.period_days < 20) {
            issues.push({ severity: 'warning', message: `Período de ${data.period_days} días es inusualmente corto` });
        } else if (data.period_days > 45) {
            issues.push({ severity: 'warning', message: `Período de ${data.period_days} días — ¿factura bimestral?` });
        }
        return issues;
    }, [data, powerType]);

    // ── Periodos visibles ─────────────────────────────────────────────────────
    const visibleEnergyPeriods = useMemo(() =>
        [1, 2, 3, 4, 5, 6].filter(p => powerType === '2.0' ? p <= 3 : true), [powerType]);
    const visiblePowerPeriods = useMemo(() =>
        [1, 2, 3, 4, 5, 6].filter(p => powerType === '2.0' ? p <= 2 : true), [powerType]);

    const isCupsValid = data.cups?.length === 20 || data.cups?.length === 22;
    const hasEnergyValues = [1,2,3,4,5,6].some(p => (data[`energy_p${p}` as keyof InvoiceData] as number) > 0);
    const hasPowerValues  = [1,2,3,4,5,6].some(p => (data[`power_p${p}` as keyof InvoiceData] as number) > 0);

    const locate = (value: string | number | undefined) => {
        if (!pdfUrl || value === undefined || value === null) return;
        pdfViewerRef.current?.locate(String(value));
    };

    // ── Alertas consolidadas ──────────────────────────────────────────────────
    const allAlerts = useMemo(() => {
        const list: Array<{ type: 'info' | 'warning' | 'error' | 'success' | 'learned'; message: React.ReactNode; action?: React.ReactNode }> = [];

        if (prevInvoice && totalEnergyNow > 0) {
            const delta = totalEnergyNow - prevInvoice.totalEnergyKwh;
            const pct = prevInvoice.totalEnergyKwh > 0 ? Math.round((delta / prevInvoice.totalEnergyKwh) * 100) : 0;
            const up = delta > 0;
            list.push({
                type: 'info',
                message: (
                    <span>
                        <span className="font-bold">Factura anterior</span>
                        {prevInvoice.invoiceDate && <span className="opacity-70"> · {prevInvoice.invoiceDate}</span>}
                        {' — '}
                        <span className={`font-bold ${up ? 'text-red-600' : 'text-emerald-600'}`}>
                            {up ? <TrendingUp size={12} className="inline mr-0.5" /> : <TrendingDown size={12} className="inline mr-0.5" />}
                            {up ? '+' : ''}{pct}% ({up ? '+' : ''}{Math.round(delta)} kWh)
                        </span>
                        <span className="opacity-60 ml-2 text-xs">ant: {Math.round(prevInvoice.totalEnergyKwh)} kWh{prevInvoice.totalAmountEur !== null ? ` · ${prevInvoice.totalAmountEur.toFixed(2)} €` : ''}</span>
                    </span>
                ),
            });
        }

        if (!suggestionsApplied && Object.keys(suggestions).length > 0) {
            list.push({
                type: 'learned',
                message: (
                    <span>
                        <span className="font-bold">Correcciones aprendidas</span> — {Object.keys(suggestions).length} campo{Object.keys(suggestions).length > 1 ? 's' : ''} mejorable{Object.keys(suggestions).length > 1 ? 's' : ''} para {data.company_name}
                    </span>
                ),
                action: (
                    <button type="button" onClick={applySuggestions}
                        className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 transition-colors">
                        Aplicar
                    </button>
                ),
            });
        }

        if (duplicateInfo) {
            list.push({
                type: 'warning',
                message: (
                    <span>
                        <span className="font-bold">Posible duplicado</span> — misma factura del mismo mes ya procesada el{' '}
                        {new Date(duplicateInfo.createdAt).toLocaleDateString('es-ES')}
                        {duplicateInfo.invoiceNumber ? ` (${duplicateInfo.invoiceNumber})` : ''}
                    </span>
                ),
            });
        }

        if (lowConfidenceCount >= 3) {
            list.push({
                type: 'warning',
                message: (
                    <span>
                        <span className="font-bold">{lowConfidenceCount} campos con baja confianza OCR</span> — revísalos antes de continuar
                    </span>
                ),
            });
        }

        for (const issue of crossFieldIssues) {
            list.push({ type: issue.severity === 'error' ? 'error' : 'warning', message: issue.message });
        }

        return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prevInvoice, totalEnergyNow, suggestions, suggestionsApplied, duplicateInfo, lowConfidenceCount, crossFieldIssues, data.company_name]);

    const alertColors = {
        info:    { bg: 'bg-indigo-50 border-indigo-200',    icon: 'text-indigo-500',  text: 'text-indigo-800' },
        warning: { bg: 'bg-amber-50 border-amber-200',      icon: 'text-amber-500',   text: 'text-amber-800' },
        error:   { bg: 'bg-red-50 border-red-200',          icon: 'text-red-500',     text: 'text-red-800' },
        success: { bg: 'bg-emerald-50 border-emerald-200',  icon: 'text-emerald-500', text: 'text-emerald-800' },
        learned: { bg: 'bg-emerald-50 border-emerald-200',  icon: 'text-emerald-500', text: 'text-emerald-800' },
    };

    const hasErrors = allAlerts.some(a => a.type === 'error');
    const hasWarnings = allAlerts.some(a => a.type === 'warning');

    // ── Confidence fields para el panel del PDF ──────────────────────────────
    const confidenceFieldsForPdf = useMemo((): ConfidenceField[] => {
        const conf = (data as unknown as Record<string, unknown>)._confidence as Record<string, number> | undefined;
        if (!conf) return [];
        const LABELS: Record<string, string> = {
            client_name: 'Titular', cups: 'CUPS', dni_cif: 'DNI/CIF',
            company_name: 'Comercializadora', invoice_number: 'Nº Factura',
            invoice_date: 'Fecha', supply_address: 'Dirección',
            total_amount: 'Total €', tariff_name: 'Tarifa',
        };
        return Object.entries(conf)
            .filter(([k]) => LABELS[k] && data[k as keyof InvoiceData])
            .map(([k, score]) => ({
                label: LABELS[k],
                value: String(data[k as keyof InvoiceData] ?? ''),
                score,
            }))
            .sort((a, b) => a.score - b.score); // primero los de menor confianza
    }, [data]);

    // ── OCR Score ring ────────────────────────────────────────────────────────
    const scoreColor = globalConfidence === null ? 'text-slate-400'
        : globalConfidence >= 0.9 ? 'text-emerald-500'
        : globalConfidence >= 0.7 ? 'text-amber-500' : 'text-red-500';
    const ringColor = globalConfidence === null ? 'stroke-slate-200'
        : globalConfidence >= 0.9 ? 'stroke-emerald-400'
        : globalConfidence >= 0.7 ? 'stroke-amber-400' : 'stroke-red-400';
    const circumference = 2 * Math.PI * 16;
    const dashOffset = globalConfidence !== null
        ? circumference * (1 - globalConfidence) : circumference;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <motion.div
            key="simulator-form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="max-w-6xl mx-auto pb-12"
        >
            <DemoModeAlert show={isMockMode} />

            {/* ── Top bar ─────────────────────────────────────────────────── */}
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
                        <button type="button" onClick={() => setShowPdf(v => !v)}
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
                                onClick={handleConfirm} disabled={isConfirming}
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

            {/* ── Alert panel ─────────────────────────────────────────────── */}
            <AnimatePresence>
                {allAlerts.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mb-6"
                    >
                        <div className={`rounded-2xl border overflow-hidden ${
                            hasErrors ? 'border-red-200 bg-red-50/50'
                            : hasWarnings ? 'border-amber-200 bg-amber-50/30'
                            : 'border-slate-200 bg-white/50'
                        }`}>
                            {/* Panel header */}
                            <button type="button" onClick={() => setAlertsExpanded(v => !v)}
                                className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-black/[0.02] transition-colors">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle size={13} className={hasErrors ? 'text-red-500' : hasWarnings ? 'text-amber-500' : 'text-slate-400'} />
                                    <span className="text-xs font-bold text-slate-600">
                                        {allAlerts.length} aviso{allAlerts.length > 1 ? 's' : ''} del análisis
                                    </span>
                                    {allAlerts.some(a => a.type === 'learned') && (
                                        <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-100 px-1.5 py-px rounded-full">
                                            <Sparkles size={8} /> Aprendido
                                        </span>
                                    )}
                                </div>
                                <ChevronDown size={13} className={`text-slate-400 transition-transform ${alertsExpanded ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Alert rows */}
                            <AnimatePresence>
                                {alertsExpanded && (
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: 'auto' }}
                                        exit={{ height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="border-t border-black/5 divide-y divide-black/5">
                                            {allAlerts.map((alert, i) => {
                                                const c = alertColors[alert.type];
                                                const Icon = alert.type === 'error' ? AlertTriangle
                                                    : alert.type === 'learned' ? Sparkles
                                                    : alert.type === 'info' ? Activity
                                                    : AlertTriangle;
                                                return (
                                                    <div key={i} className={`flex items-center gap-2.5 px-4 py-2.5 ${c.bg}`}>
                                                        <Icon size={12} className={`${c.icon} shrink-0`} />
                                                        <p className={`text-xs flex-1 ${c.text}`}>{alert.message}</p>
                                                        {alert.action}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Main grid ───────────────────────────────────────────────── */}
            <div className={`grid grid-cols-1 gap-6 ${showPdf && pdfUrl ? 'xl:grid-cols-[1fr_1fr]' : 'lg:grid-cols-[1fr_340px]'}`}>

                {/* PDF panel */}
                {showPdf && pdfUrl && (
                    <motion.div
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        className="xl:sticky xl:top-4 h-[50vw] min-h-[320px] xl:h-[820px]"
                    >
                        <PdfViewerWrapper
                            ref={pdfViewerRef}
                            url={pdfUrl}
                            className="h-full"
                            confidenceFields={confidenceFieldsForPdf}
                        />
                    </motion.div>
                )}

                {/* Form columns */}
                <div className={`grid gap-6 ${showPdf && pdfUrl ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[1fr_300px]'}`}>

                    {/* Left: fields */}
                    <div className="space-y-5">

                        {/* Tariff card */}
                        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden">
                            <div className="flex items-center gap-4 p-4">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                                    <Zap size={18} className="text-emerald-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Tarifa detectada</p>
                                    <p className="text-base font-bold text-white truncate">
                                        {powerType === '2.0' && 'Tensión Baja 2.0TD'}
                                        {powerType === '3.0' && 'Empresa 3.0TD'}
                                        {powerType === '3.1' && 'Alta Tensión 3.1TD'}
                                        {data.tariff_name && <span className="ml-2 text-slate-400 text-sm font-normal">· {data.tariff_name}</span>}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">IA</span>
                                    {onPowerTypeOverride && (
                                        <button
                                            type="button"
                                            onClick={() => setShowTariffOverride(v => !v)}
                                            className="text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-1 rounded-lg transition-colors"
                                        >
                                            {showTariffOverride ? 'Cerrar' : 'Cambiar'}
                                        </button>
                                    )}
                                </div>
                            </div>
                            {/* Override picker */}
                            <AnimatePresence>
                                {showTariffOverride && onPowerTypeOverride && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden border-t border-white/10"
                                    >
                                        <div className="px-4 py-3 flex items-center gap-2">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mr-1">Forzar tipo:</span>
                                            {(['2.0', '3.0', '3.1'] as const).map(t => (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    onClick={() => { onPowerTypeOverride(t); setShowTariffOverride(false); }}
                                                    className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all ${
                                                        powerType === t
                                                            ? 'bg-emerald-500 border-emerald-400 text-white'
                                                            : 'bg-white/5 border-white/15 text-slate-300 hover:bg-white/10 hover:text-white'
                                                    }`}
                                                >
                                                    {t}TD
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Contract data */}
                        <section>
                            <SectionLabel color="bg-emerald-500" label="Datos del Contrato" />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-2xl bg-white/70 border border-slate-100 shadow-sm">
                                <Input label="Titular / Cliente"
                                    labelBadge={<><ConfidencePill value={getConfidence('client_name')} /><CorrectionBadge stat={getFieldStat('client_name')} /></>}
                                    icon={<User size={15} />}
                                    value={data.client_name ?? ''} onChange={e => onUpdate('client_name', e.target.value)}
                                    placeholder="Nombre completo"
                                    warning={lowConfWarn('client_name') ?? (data.client_name && data.client_name.length < 5 ? 'Nombre muy corto' : undefined)}
                                    action={pdfUrl && data.client_name ? <LocateButton onClick={() => locate(data.client_name)} lowConfidence={isLowConfidence('client_name')} /> : undefined}
                                />
                                <Input label="CIF / DNI"
                                    labelBadge={<><ConfidencePill value={getConfidence('dni_cif')} /><CorrectionBadge stat={getFieldStat('dni_cif')} /></>}
                                    icon={<Hash size={15} />}
                                    value={data.dni_cif ?? ''} onChange={e => onUpdate('dni_cif', e.target.value)}
                                    placeholder="Identificación"
                                    warning={lowConfWarn('dni_cif')}
                                    action={pdfUrl && data.dni_cif ? <LocateButton onClick={() => locate(data.dni_cif)} lowConfidence={isLowConfidence('dni_cif')} /> : undefined}
                                />
                                <Input label="Comercializadora"
                                    labelBadge={<><ConfidencePill value={getConfidence('company_name')} /><CorrectionBadge stat={getFieldStat('company_name')} /></>}
                                    icon={<Building2 size={15} />}
                                    value={data.company_name ?? ''} onChange={e => onUpdate('company_name', e.target.value)}
                                    placeholder="Endesa, Iberdrola…"
                                    warning={lowConfWarn('company_name')}
                                    action={pdfUrl && data.company_name ? <LocateButton onClick={() => locate(data.company_name)} lowConfidence={isLowConfidence('company_name')} /> : undefined}
                                />
                                <Input label="Nº Factura"
                                    labelBadge={<ConfidencePill value={getConfidence('invoice_number')} />}
                                    icon={<Hash size={15} />}
                                    value={data.invoice_number ?? ''} onChange={e => onUpdate('invoice_number', e.target.value)}
                                    warning={lowConfWarn('invoice_number') ?? (!data.invoice_number ? 'No encontrado' : undefined)}
                                    action={pdfUrl && data.invoice_number ? <LocateButton onClick={() => locate(data.invoice_number)} lowConfidence={isLowConfidence('invoice_number')} /> : undefined}
                                />
                            </div>
                        </section>

                        {/* Supply point */}
                        <section>
                            <SectionLabel color="bg-blue-500" label="Punto de Suministro" />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-2xl bg-white/70 border border-slate-100 shadow-sm">

                                {/* CUPS client link banner */}
                                <AnimatePresence>
                                    {cupsClient && !cupsClientDismissed && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="sm:col-span-2 overflow-hidden"
                                        >
                                            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 mb-1">
                                                <UserCheck size={14} className="text-indigo-500 shrink-0" />
                                                <p className="text-xs text-indigo-700 flex-1">
                                                    <span className="font-bold">{cupsClient.name}</span>
                                                    <span className="text-indigo-500 ml-1.5">— cliente en tu CRM</span>
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => { onUpdate('client_name', cupsClient.name as InvoiceData['client_name']); setCupsClientDismissed(true); toast.success(`Vinculado a ${cupsClient.name}`); }}
                                                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-bold hover:bg-indigo-700 transition-colors"
                                                >
                                                    <Link2 size={9} /> Vincular
                                                </button>
                                                <button type="button" onClick={() => setCupsClientDismissed(true)} aria-label="Descartar" className="text-indigo-300 hover:text-indigo-500 transition-colors text-sm leading-none">×</button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="sm:col-span-2">
                                    <Input label="CUPS"
                                        labelBadge={<ConfidencePill value={getConfidence('cups')} />}
                                        icon={<Activity size={15} />}
                                        value={data.cups ?? ''} className="font-mono"
                                        error={!isCupsValid && data.cups ? 'Longitud sospechosa' : undefined}
                                        warning={lowConfWarn('cups') ?? (isCupsValid && !data.cups?.startsWith('ES') ? 'Debe empezar por ES' : undefined)}
                                        onChange={e => onUpdate('cups', e.target.value.toUpperCase())}
                                        action={pdfUrl && data.cups ? <LocateButton onClick={() => locate(data.cups)} lowConfidence={isLowConfidence('cups')} /> : undefined}
                                    />
                                    {/* Sparkline histórico de consumo */}
                                    <AnimatePresence>
                                        {energyHistory.length >= 2 && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="mt-2 overflow-hidden"
                                            >
                                                <EnergySparkline history={energyHistory} currentEnergy={totalEnergyNow} />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <Input label="Dirección"
                                    labelBadge={<ConfidencePill value={getConfidence('supply_address')} />}
                                    icon={<MapPin size={15} />}
                                    value={data.supply_address ?? ''} onChange={e => onUpdate('supply_address', e.target.value)}
                                    warning={lowConfWarn('supply_address') ?? (data.supply_address && data.supply_address.length < 10 ? 'Parece incompleta' : undefined)}
                                    action={pdfUrl && data.supply_address ? <LocateButton onClick={() => locate(data.supply_address)} lowConfidence={isLowConfidence('supply_address')} /> : undefined}
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <Input label="Días" type="number" icon={<Calendar size={15} />}
                                        value={data.period_days} onChange={e => onUpdate('period_days', parseInt(e.target.value) || 30)} />
                                    <Input label="Fecha"
                                        labelBadge={<ConfidencePill value={getConfidence('invoice_date')} />}
                                        icon={<Calendar size={15} />}
                                        value={data.invoice_date ?? ''} onChange={e => onUpdate('invoice_date', e.target.value)}
                                        warning={lowConfWarn('invoice_date')}
                                        action={pdfUrl && data.invoice_date ? <LocateButton onClick={() => locate(data.invoice_date)} lowConfidence={isLowConfidence('invoice_date')} /> : undefined}
                                    />
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Right: energy/power + CTA */}
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
                </div>
            </div>
        </motion.div>
    );
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ color, label }: { color: string; label: string }) {
    return (
        <div className="flex items-center gap-2 mb-2 px-1">
            <div className={`w-1 h-4 ${color} rounded-full`} />
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest">{label}</h3>
        </div>
    );
}

interface PeriodTableProps {
    periods: number[];
    prefix: string;
    data: InvoiceData;
    onUpdate: <K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) => void;
    accent: 'emerald' | 'amber' | 'purple';
    missingAlert?: string;
    placeholder?: string;
}

const ACCENT = {
    emerald: { badge: 'text-emerald-700 bg-emerald-100', border: 'border-emerald-200 focus:border-emerald-500' },
    amber:   { badge: 'text-amber-700 bg-amber-100',     border: 'border-amber-200 focus:border-amber-500' },
    purple:  { badge: 'text-purple-700 bg-purple-100',   border: 'border-purple-200 focus:border-purple-500' },
};

function PeriodTable({ periods, prefix, data, onUpdate, accent, missingAlert, placeholder }: PeriodTableProps) {
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

interface LocateButtonProps { onClick: () => void; lowConfidence?: boolean; }

const LocateButton: React.FC<LocateButtonProps> = ({ onClick, lowConfidence }) => (
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

const ConfidencePill: React.FC<{ value: number | null }> = ({ value }) => {
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

interface CorrectionBadgeProps {
    stat?: { count: number; mostFrequentValue: string | null };
}

const CorrectionBadge: React.FC<CorrectionBadgeProps> = ({ stat }) => {
    if (!stat || stat.count === 0) return null;
    return (
        <div className="group relative inline-flex items-center">
            <button type="button" aria-label="Información de corrección" className="flex items-center gap-0.5 text-amber-400 hover:text-amber-600 transition-colors">
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

interface SparklineProps {
    history: { month: string; totalEnergy: number }[];
    currentEnergy: number;
}

const EnergySparkline: React.FC<SparklineProps> = ({ history, currentEnergy }) => {
    const W = 260, H = 40, PAD = 4;
    const all = [...history];
    // Incluir el mes actual si tiene energía y es distinto al último
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
                {/* Fill area */}
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
                {/* Line */}
                <path d={pathD} fill="none" stroke="rgb(99,102,241)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                {/* Dots */}
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
