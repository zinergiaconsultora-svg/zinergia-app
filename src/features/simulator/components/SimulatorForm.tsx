'use client';

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { InvoiceData } from '@/types/crm';
import { DemoModeAlert } from '@/components/ui/DemoModeAlert';
import { PdfViewerWrapper } from './PdfViewerWrapper';
import type { PdfViewerHandle, ConfidenceField } from './PdfViewer';
import { computeOpportunityScore } from '@/lib/utils/opportunity-score';
import SimulatorTopBar from './SimulatorTopBar';
import SimulatorAlertPanel, { AlertItem } from './SimulatorAlertPanel';
import SimulatorContractFields from './SimulatorContractFields';
import SimulatorEnergyFields from './SimulatorEnergyFields';
import SimulatorHeroValue from './SimulatorHeroValue';

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
    originalData: _originalData, ocrJobId: _ocrJobId, ocrDataConfirmed = false, onConfirmOcrData,
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
            }).catch(() => {});
        });
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            }).catch(() => {});
        });
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            }).catch(() => {});
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
            }).catch(() => {});
        });
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            }).catch(() => {});
        });
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            }).catch(() => {});
        });
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            if (onConfirmOcrData) onConfirmOcrData().catch(() => {});
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

    // ── Validaciones cruzadas (smart business rules) ───────────────────────────
    interface CrossFieldIssue {
        severity: 'error' | 'warning';
        message: string;
        suggestion?: { label: string; field: keyof InvoiceData; value: InvoiceData[keyof InvoiceData] };
    }
    const crossFieldIssues = useMemo((): CrossFieldIssue[] => {
        const issues: CrossFieldIssue[] = [];

        // CIF/NIF validation with auto-fix suggestion
        if (data.dni_cif) {
            const c = data.dni_cif.trim().toUpperCase();
            const ok = /^[0-9]{8}[TRWAGMYFPDXBNJZSQVHLCKE]$/.test(c)
                || /^[XYZ][0-9]{7}[TRWAGMYFPDXBNJZSQVHLCKE]$/.test(c)
                || /^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/.test(c);
            if (!ok) {
                const stripped = c.replace(/[-.\s]/g, '');
                const fixedOk = /^[0-9]{8}[TRWAGMYFPDXBNJZSQVHLCKE]$/.test(stripped)
                    || /^[XYZ][0-9]{7}[TRWAGMYFPDXBNJZSQVHLCKE]$/.test(stripped)
                    || /^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/.test(stripped);
                issues.push({
                    severity: 'warning',
                    message: `"${c}" no coincide con NIF, NIE ni CIF español`,
                    suggestion: fixedOk && stripped !== c
                        ? { label: `Aplicar ${stripped}`, field: 'dni_cif', value: stripped }
                        : undefined,
                });
            }
        }

        // CUPS validation
        if (data.cups) {
            if (!data.cups.startsWith('ES')) {
                issues.push({ severity: 'error', message: 'CUPS debe comenzar con "ES" — probable error OCR' });
            } else if (!/^ES[0-9]{16}[A-Z0-9]{2}([A-Z0-9]{2})?$/.test(data.cups)) {
                issues.push({ severity: 'warning', message: 'Estructura de CUPS inusual — verifica los caracteres finales' });
            }
        }

        // Tariff ↔ P4-P6 coherence
        const hasP456Energy = [4, 5, 6].some(p => (data[`energy_p${p}` as keyof InvoiceData] as number) > 0);
        const hasP456Power  = [4, 5, 6].some(p => (data[`power_p${p}` as keyof InvoiceData] as number) > 0);
        if (powerType === '2.0' && (hasP456Energy || hasP456Power)) {
            issues.push({ severity: 'warning', message: 'Tarifa 2.0TD con valores en P4-P6 — posible error OCR' });
        }

        // Period length
        if (data.period_days > 0 && data.period_days < 20) {
            issues.push({ severity: 'warning', message: `Período de ${data.period_days} días es inusualmente corto` });
        } else if (data.period_days > 45) {
            issues.push({ severity: 'warning', message: `Período de ${data.period_days} días — ¿factura bimestral? Verifica que el consumo no esté duplicado` });
        }

        // Power ↔ consumption coherence
        const totalPower = [1, 2, 3].reduce((s, p) => s + ((data[`power_p${p}` as keyof InvoiceData] as number) || 0), 0);
        const avgPower = totalPower / 3;
        const annualizedEnergy = data.period_days > 0 ? (totalEnergyNow / data.period_days) * 365 : 0;
        if (avgPower > 0 && annualizedEnergy > 0) {
            const hoursAtFull = annualizedEnergy / avgPower;
            if (hoursAtFull > 7000) {
                issues.push({
                    severity: 'warning',
                    message: `Potencia ${avgPower.toFixed(1)} kW con ~${Math.round(annualizedEnergy)} kWh/año — consumo muy alto para esta potencia. ¿Potencia real mayor?`,
                });
            }
        }

        // Tariff ↔ power coherence (2.0TD should be ≤15 kW)
        const maxPower = Math.max(
            ...([1, 2, 3, 4, 5, 6].map(p => (data[`power_p${p}` as keyof InvoiceData] as number) || 0))
        );
        if (powerType === '2.0' && maxPower > 15) {
            issues.push({
                severity: 'warning',
                message: `Potencia máxima ${maxPower} kW — debería ser tarifa 3.0TD (límite 2.0TD es 15 kW)`,
            });
        }
        if (powerType === '3.0' && maxPower <= 15 && maxPower > 0) {
            issues.push({
                severity: 'warning',
                message: `Potencia ≤15 kW en tarifa 3.0TD — podría ser más barata como 2.0TD`,
            });
        }

        // Consumption jump vs previous invoice
        if (prevInvoice && totalEnergyNow > 0 && prevInvoice.totalEnergyKwh > 0) {
            const delta = totalEnergyNow - prevInvoice.totalEnergyKwh;
            const pct = Math.abs(delta / prevInvoice.totalEnergyKwh) * 100;
            if (pct > 40) {
                issues.push({
                    severity: 'warning',
                    message: `Consumo ${delta > 0 ? 'subió' : 'bajó'} un ${Math.round(pct)}% vs factura anterior — verifica datos OCR o cambio real`,
                });
            }
        }

        return issues;
    }, [data, powerType, totalEnergyNow, prevInvoice]);

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
    const allAlerts = useMemo((): AlertItem[] => {
        const list: AlertItem[] = [];

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
            list.push({
                type: issue.severity === 'error' ? 'error' : 'warning',
                message: issue.message,
                action: issue.suggestion ? (
                    <button type="button"
                        onClick={() => {
                            onUpdate(issue.suggestion!.field, issue.suggestion!.value);
                            toast.success('Corrección aplicada');
                        }}
                        className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-600 text-white text-[10px] font-bold hover:bg-amber-700 transition-colors"
                    >
                        {issue.suggestion.label}
                    </button>
                ) : undefined,
            });
        }

        return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prevInvoice, totalEnergyNow, suggestions, suggestionsApplied, duplicateInfo, lowConfidenceCount, crossFieldIssues, data.company_name]);

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
            .sort((a, b) => a.score - b.score);
    }, [data]);

    // ── Validation summary for Hero ─────────────────────────────────────────
    const validationSummary = useMemo(() => {
        const CRITICAL_FIELDS = ['cups', 'power_p1', 'power_p2', 'energy_p1', 'energy_p2', 'company_name', 'tariff_name'];
        const ALL_FIELDS = ['cups', 'client_name', 'dni_cif', 'company_name', 'invoice_number',
            'tariff_name', 'supply_address', 'invoice_date',
            'power_p1', 'power_p2', 'power_p3', 'energy_p1', 'energy_p2', 'energy_p3'];
        const conf = (data as unknown as Record<string, unknown>)._confidence as Record<string, number> | undefined;
        let green = 0, yellow = 0, red = 0;
        for (const f of ALL_FIELDS) {
            const c = conf?.[f];
            const isCritical = CRITICAL_FIELDS.includes(f);
            if (c === undefined || c === null) {
                if (data[f as keyof InvoiceData]) green++;
                else if (isCritical) red++;
                else yellow++;
            } else if (c >= 0.9) green++;
            else if (c >= 0.7) yellow++;
            else red++;
        }
        const errorCount = crossFieldIssues.filter(i => i.severity === 'error').length;
        return {
            totalFields: ALL_FIELDS.length,
            greenFields: green,
            yellowFields: yellow,
            redFields: red + errorCount,
            alertCount: allAlerts.length,
            errorCount,
        };
    }, [data, crossFieldIssues, allAlerts]);

    const estimatedReviewTime = useMemo(() => {
        const base = 15;
        const perYellow = 10;
        const perRed = 20;
        return base + (validationSummary.yellowFields * perYellow) + (validationSummary.redFields * perRed);
    }, [validationSummary]);

    const currentAnnualCostEstimate = useMemo(() => {
        if (data.total_amount && data.period_days > 0) {
            return (data.total_amount / data.period_days) * 365;
        }
        return null;
    }, [data.total_amount, data.period_days]);

    const tariffLabel = powerType === '2.0' ? 'Tensión Baja 2.0TD'
        : powerType === '3.0' ? 'Empresa 3.0TD'
        : 'Alta Tensión 3.1TD';

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

            <SimulatorTopBar
                onBack={onBack}
                pdfUrl={pdfUrl}
                showPdf={showPdf}
                onTogglePdf={() => setShowPdf(v => !v)}
                hasEnergyValues={hasEnergyValues}
                hasPowerValues={hasPowerValues}
                opportunityScore={opportunityScore}
                globalConfidence={globalConfidence}
                circumference={circumference}
                dashOffset={dashOffset}
                ringColor={ringColor}
                scoreColor={scoreColor}
                ocrDataConfirmed={ocrDataConfirmed}
                localConfirmed={localConfirmed}
                isConfirming={isConfirming}
                onConfirm={handleConfirm}
            />

            <SimulatorHeroValue
                clientName={data.client_name ?? null}
                companyName={data.company_name ?? null}
                tariffLabel={tariffLabel}
                livePreview={livePreview}
                livePreviewLoading={livePreviewLoading}
                currentAnnualCost={currentAnnualCostEstimate}
                validation={validationSummary}
                ocrDataConfirmed={ocrDataConfirmed}
                localConfirmed={localConfirmed}
                isConfirming={isConfirming}
                onConfirm={handleConfirm}
                estimatedReviewTime={estimatedReviewTime}
            />

            <SimulatorAlertPanel
                alerts={allAlerts}
                expanded={alertsExpanded}
                onToggle={() => setAlertsExpanded(v => !v)}
            />

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
                    <SimulatorContractFields
                        data={data}
                        onUpdate={onUpdate}
                        powerType={powerType}
                        onPowerTypeOverride={onPowerTypeOverride}
                        pdfUrl={pdfUrl}
                        getConfidence={getConfidence}
                        isLowConfidence={isLowConfidence}
                        lowConfWarn={lowConfWarn}
                        locate={locate}
                        getFieldStat={getFieldStat}
                        isCupsValid={isCupsValid}
                        energyHistory={energyHistory}
                        totalEnergyNow={totalEnergyNow}
                        cupsClient={cupsClient}
                        cupsClientDismissed={cupsClientDismissed}
                        onDismissCupsClient={() => setCupsClientDismissed(true)}
                        showTariffOverride={showTariffOverride}
                        onToggleTariffOverride={() => setShowTariffOverride(v => !v)}
                    />

                    <SimulatorEnergyFields
                        data={data}
                        onUpdate={onUpdate}
                        visibleEnergyPeriods={visibleEnergyPeriods}
                        visiblePowerPeriods={visiblePowerPeriods}
                        hasEnergyValues={hasEnergyValues}
                        hasPowerValues={hasPowerValues}
                        livePreview={livePreview}
                        livePreviewLoading={livePreviewLoading}
                        isAnalyzing={isAnalyzing}
                        loadingMessage={loadingMessage}
                        onCompare={onCompare}
                    />
                </div>
            </div>
        </motion.div>
    );
};
