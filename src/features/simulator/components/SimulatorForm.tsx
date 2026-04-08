'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
    Zap,
    ChevronLeft,
    ArrowRight,
    User,
    Building2,
    Hash,
    Calendar,
    MapPin,
    Activity,
    Info,
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    ShieldCheck,
    ScanSearch,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { InvoiceData } from '@/types/crm';
import { Card } from '@/components/ui/primitives/Card';
import { Input } from '@/components/ui/primitives/Input';
import { DemoModeAlert } from '@/components/ui/DemoModeAlert';
import { PdfViewerWrapper } from './PdfViewerWrapper';
import type { PdfViewerHandle } from './PdfViewer';

interface SimulatorFormProps {
    data: InvoiceData;
    onUpdate: <K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) => void;
    onCompare: () => void;
    onBack: () => void;
    isAnalyzing: boolean;
    loadingMessage: string;
    powerType: string;
    pdfUrl?: string | null;
    isMockMode?: boolean;
    // Fase 2: corrección humana
    originalData?: InvoiceData | null;
    ocrJobId?: string | null;
    ocrDataConfirmed?: boolean;
    onConfirmOcrData?: () => Promise<{ correctedFieldsCount: number }>;
}

export const SimulatorForm: React.FC<SimulatorFormProps> = ({
    data,
    onUpdate,
    onCompare,
    onBack,
    isAnalyzing,
    loadingMessage,
    powerType,
    pdfUrl,
    isMockMode = false,
    originalData: _originalData,
    ocrJobId,
    ocrDataConfirmed = false,
    onConfirmOcrData,
}) => {
    const [isConfirming, setIsConfirming] = useState(false);
    const [localConfirmed, setLocalConfirmed] = useState(false);
    const pdfViewerRef = useRef<PdfViewerHandle>(null);

    // Detección de factura duplicada (mismo CUPS + mismo mes)
    const [duplicateInfo, setDuplicateInfo] = useState<{ createdAt: string; invoiceNumber: string | null } | null>(null);
    useEffect(() => {
        if (!data.cups || !data.invoice_date || isMockMode) return;
        setDuplicateInfo(null); // Reset on change
        let cancelled = false;
        import('@/app/actions/ocr-jobs').then(({ checkDuplicateInvoice }) => {
            checkDuplicateInvoice(data.cups!, data.invoice_date!).then(result => {
                if (!cancelled) setDuplicateInfo(result ? { createdAt: result.createdAt, invoiceNumber: result.invoiceNumber } : null);
            }).catch(() => {});
        });
        return () => { cancelled = true; };
    }, [data.cups, data.invoice_date, isMockMode]);

    /** Localiza un valor en el PDF. Solo actúa si hay PDF cargado. */
    const locate = (value: string | number | undefined) => {
        if (!pdfUrl || value === undefined || value === null) return;
        pdfViewerRef.current?.locate(String(value));
    };

    // Cuando el contexto detecta que los datos cambiaron (UPDATE_INVOICE_FIELDS
    // resetea ocrDataConfirmed a false), sincronizar el estado local para que
    // el botón "Confirmar datos" reaparezca después de una edición post-confirmación.
    React.useEffect(() => {
        if (!ocrDataConfirmed) {
            setLocalConfirmed(false);
        }
    }, [ocrDataConfirmed]);

    const handleConfirm = async () => {
        if (isConfirming) return;
        setIsConfirming(true);

        // Feedback inmediato — no esperar a la server action
        setTimeout(() => {
            setIsConfirming(false);
            setLocalConfirmed(true);
            toast.success('Datos confirmados. ¡Gracias!');
            if (onConfirmOcrData) {
                // Guardar en segundo plano, sin bloquear la UI
                onConfirmOcrData().catch(() => {});
            }
        }, 600);
    };

    /** Devuelve el valor de confianza OCR 0-1 para un campo, o null si no está disponible. */
    const getConfidence = (field: string): number | null => {
        const conf = (data as unknown as Record<string, unknown>)._confidence as Record<string, number> | undefined;
        if (!conf || conf[field] === undefined) return null;
        return conf[field];
    };

    /** True si la confianza OCR del campo es inferior a 0.7. */
    const isLowConfidence = (field: string): boolean => {
        const c = getConfidence(field);
        return c !== null && c < 0.7;
    };

    /** Warning text con porcentaje incluido para campos de baja confianza. */
    const lowConfWarn = (field: string): string | undefined => {
        const c = getConfidence(field);
        if (c !== null && c < 0.7) return `Confianza ${Math.round(c * 100)}% — revisa este dato`;
        return undefined;
    };

    /** Score global OCR: media de todos los campos con dato de confianza. */
    const globalConfidence = useMemo(() => {
        const conf = (data as unknown as Record<string, unknown>)._confidence as Record<string, number> | undefined;
        if (!conf) return null;
        const vals = Object.values(conf).filter((v): v is number => typeof v === 'number');
        if (vals.length === 0) return null;
        return vals.reduce((a, b) => a + b, 0) / vals.length;
    }, [data]);

    /** Número de campos con confianza OCR < 0.7. */
    const lowConfidenceCount = useMemo(() => {
        const conf = (data as unknown as Record<string, unknown>)._confidence as Record<string, number> | undefined;
        if (!conf) return 0;
        return Object.values(conf).filter((v): v is number => typeof v === 'number' && v < 0.7).length;
    }, [data]);

    // Toggle for PDF View
    const [showPdf, setShowPdf] = React.useState(true);

    const visibleEnergyPeriods = useMemo(() => {
        return [1, 2, 3, 4, 5, 6].filter(p => (powerType === '2.0' ? p <= 3 : powerType === '3.0' ? p <= 6 : true));
    }, [powerType]);

    const visiblePowerPeriods = useMemo(() => {
        return [1, 2, 3, 4, 5, 6].filter(p => (powerType === '2.0' ? p <= 2 : powerType === '3.0' ? p <= 6 : true));
    }, [powerType]);

    // Basic validation for visual feedback
    const isCupsValid = data.cups?.length === 20 || data.cups?.length === 22;
    const hasEnergyValues = [1, 2, 3, 4, 5, 6].some(p => (data[`energy_p${p}` as keyof InvoiceData] as number) > 0);
    const hasPowerValues = [1, 2, 3, 4, 5, 6].some(p => (data[`power_p${p}` as keyof InvoiceData] as number) > 0);

    /** Validaciones cruzadas entre campos: formato, coherencia tarifa/períodos, sanidad fechas. */
    const crossFieldIssues = useMemo(() => {
        const issues: Array<{ severity: 'error' | 'warning'; message: string }> = [];

        // ── DNI/CIF/NIE format ────────────────────────────────────────────────
        if (data.dni_cif) {
            const clean = data.dni_cif.trim().toUpperCase();
            const isNIF = /^[0-9]{8}[TRWAGMYFPDXBNJZSQVHLCKE]$/.test(clean);
            const isNIE = /^[XYZ][0-9]{7}[TRWAGMYFPDXBNJZSQVHLCKE]$/.test(clean);
            const isCIF = /^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/.test(clean);
            if (!isNIF && !isNIE && !isCIF) {
                issues.push({ severity: 'warning', message: `"${clean}" no coincide con formato NIF, NIE ni CIF español` });
            }
        }

        // ── CUPS estructura ───────────────────────────────────────────────────
        if (data.cups) {
            if (!data.cups.startsWith('ES')) {
                issues.push({ severity: 'error', message: 'CUPS debe comenzar con "ES" — probable error OCR' });
            } else if (!/^ES[0-9]{16}[A-Z0-9]{2}([A-Z0-9]{2})?$/.test(data.cups)) {
                issues.push({ severity: 'warning', message: 'Estructura de CUPS inusual — verifica los caracteres finales' });
            }
        }

        // ── Coherencia tarifa / períodos ──────────────────────────────────────
        const hasHighPeriodEnergy = [4, 5, 6].some(p => (data[`energy_p${p}` as keyof InvoiceData] as number) > 0);
        const hasHighPeriodPower  = [4, 5, 6].some(p => (data[`power_p${p}` as keyof InvoiceData] as number) > 0);
        if (powerType === '2.0' && (hasHighPeriodEnergy || hasHighPeriodPower)) {
            issues.push({ severity: 'warning', message: 'Tarifa 2.0TD detectada, pero hay valores en P4-P6 — posible error OCR en tarifa o en períodos' });
        }

        // ── Sanidad período de facturación ────────────────────────────────────
        if (data.period_days > 0 && data.period_days < 20) {
            issues.push({ severity: 'warning', message: `Período de ${data.period_days} días es inusualmente corto para una factura mensual` });
        } else if (data.period_days > 45) {
            issues.push({ severity: 'warning', message: `Período de ${data.period_days} días es largo — ¿factura bimestral?` });
        }

        return issues;
    }, [data, powerType]);

    return (
        <motion.div
            key="simulator-form"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="max-w-5xl mx-auto pb-12"
        >
            <DemoModeAlert show={isMockMode} />

            {/* Header & Navigation */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <motion.button
                    whileHover={{ x: -4 }}
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-bold text-sm transition-all group"
                >
                    <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    SUBIR OTRA FACTURA
                </motion.button>

                <div className="flex items-center gap-4 bg-white/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/60 shadow-sm">
                    {/* Toggle panel PDF */}
                    {pdfUrl && (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowPdf(!showPdf)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${showPdf ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500 hover:text-emerald-600'}`}
                        >
                            {showPdf ? 'Ocultar factura' : 'Ver factura'}
                        </motion.button>
                    )}

                    {/* Confirm OCR data button */}
                    {(ocrDataConfirmed || localConfirmed) ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                            <ShieldCheck size={14} />
                            Datos confirmados
                        </div>
                    ) : (
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={handleConfirm}
                            disabled={isConfirming}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-emerald-700 transition-colors disabled:opacity-60"
                        >
                            {isConfirming ? (
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                    className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full"
                                />
                            ) : (
                                <ShieldCheck size={14} />
                            )}
                            Confirmar datos
                        </motion.button>
                    )}

                    {globalConfidence !== null && (
                        <div className="text-center hidden sm:block">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Calidad OCR</p>
                            <div className="flex items-center gap-1.5">
                                <div
                                    className="w-14 h-1.5 bg-slate-200 rounded-full overflow-hidden"
                                    style={{ '--bar-w': `${Math.round(globalConfidence * 100)}%` } as React.CSSProperties}
                                >
                                    <div className={`h-full rounded-full transition-all [width:var(--bar-w)] ${globalConfidence >= 0.9 ? 'bg-emerald-500' : globalConfidence >= 0.7 ? 'bg-amber-400' : 'bg-red-400'}`} />
                                </div>
                                <span className={`text-xs font-black tabular-nums ${globalConfidence >= 0.9 ? 'text-emerald-600' : globalConfidence >= 0.7 ? 'text-amber-500' : 'text-red-500'}`}>
                                    {Math.round(globalConfidence * 100)}%
                                </span>
                            </div>
                        </div>
                    )}
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado Auditoría</p>
                        <p className="text-sm font-bold text-slate-900 flex items-center gap-2 justify-end">
                            {data.detected_power_type ? 'Validado por IA' : 'Revisión Manual'}
                            <CheckCircle2 size={14} className="text-emerald-500" />
                        </p>
                    </div>
                </div>
            </div>

            {/* Banner: factura duplicada detectada */}
            {duplicateInfo && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3"
                >
                    <AlertTriangle size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-orange-800 font-medium">
                        <span className="font-bold">Posible factura duplicada</span> — ya existe una extracción de este CUPS
                        {duplicateInfo.invoiceNumber ? ` (factura ${duplicateInfo.invoiceNumber})` : ''} del mismo mes, procesada el{' '}
                        {new Date(duplicateInfo.createdAt).toLocaleDateString('es-ES')}.
                        Verifica que no estás analizando la misma factura dos veces.
                    </p>
                </motion.div>
            )}

            {/* Banner: alerta cuando hay múltiples campos con baja confianza OCR */}
            {lowConfidenceCount >= 3 && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3"
                >
                    <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800 font-medium">
                        <span className="font-bold">{lowConfidenceCount} campos con confianza baja</span> — el OCR no pudo leer estos datos con precisión. Revísalos antes de continuar para obtener resultados más exactos.
                    </p>
                </motion.div>
            )}

            <div className={`grid grid-cols-1 ${showPdf && pdfUrl ? 'xl:grid-cols-2 gap-8' : 'lg:grid-cols-12 gap-8'}`}>

                {/* PDF PREVIEW PANEL */}
                {showPdf && pdfUrl && (
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="sticky top-4 h-[800px]"
                    >
                        <PdfViewerWrapper
                            ref={pdfViewerRef}
                            url={pdfUrl}
                            className="h-full"
                        />
                    </motion.div>
                )}

                {/* Left Column: Analysis & Groups (Adjusted Span) */}
                <div className={showPdf && pdfUrl ? 'space-y-8' : 'lg:col-span-8 space-y-8'}>

                    {/* Detection Summary Card */}
                    <Card className="relative overflow-hidden border-2 border-emerald-100 bg-white/80">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -translate-y-1/2 translate-x-1/2 rounded-full" />

                        <div className="flex flex-col md:flex-row md:items-center gap-6 relative z-10">
                            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                <Zap className="w-8 h-8 text-white animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Diagnóstico Inicial</h3>
                                <div className="flex items-end gap-3">
                                    <p className="text-4xl font-extrabold text-slate-900 tracking-tight">
                                        {powerType === '2.0' && 'Tensión Baja 2.0TD'}
                                        {powerType === '3.0' && 'Empresa 3.0TD'}
                                        {powerType === '3.1' && 'Alta Tensión 3.1TD'}
                                    </p>
                                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded uppercase mb-2">Detectado</span>
                                </div>
                                <p className="text-sm text-slate-500 mt-2 flex items-center gap-1.5 font-medium">
                                    <Info size={14} className="text-emerald-500" />
                                    Tarifa detectada: <span className="text-slate-900 font-bold">{data.tariff_name}</span>
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Cross-field validation alerts */}
                    {crossFieldIssues.length > 0 && (
                        <div className="space-y-2">
                            {crossFieldIssues.map((issue, i) => (
                                <div
                                    key={i}
                                    className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium ${
                                        issue.severity === 'error'
                                            ? 'bg-red-50 border border-red-200 text-red-800'
                                            : 'bg-amber-50 border border-amber-200 text-amber-800'
                                    }`}
                                >
                                    <AlertTriangle size={14} className={`flex-shrink-0 mt-0.5 ${issue.severity === 'error' ? 'text-red-500' : 'text-amber-500'}`} />
                                    {issue.message}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Group 1: Identity & Contract */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 px-2">
                            <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Datos del Contrato</h2>
                        </div>
                        <Card className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/60">
                            <Input
                                label="Titular / Cliente"
                                labelBadge={<ConfidencePill value={getConfidence('client_name')} />}
                                icon={<User size={16} />}
                                value={data.client_name}
                                onChange={(e) => onUpdate('client_name', e.target.value)}
                                placeholder="Nombre completo"
                                warning={
                                    lowConfWarn('client_name') ??
                                    (data.client_name && data.client_name.length < 5 ? 'Nombre muy corto (¿OCR incompleto?)' : undefined)
                                }
                                action={pdfUrl && data.client_name ? <LocateButton onClick={() => locate(data.client_name)} lowConfidence={isLowConfidence('client_name')} /> : undefined}
                            />
                            <Input
                                label="CIF / DNI"
                                labelBadge={<ConfidencePill value={getConfidence('dni_cif')} />}
                                icon={<Hash size={16} />}
                                value={data.dni_cif}
                                onChange={(e) => onUpdate('dni_cif', e.target.value)}
                                placeholder="Identificación"
                                warning={
                                    lowConfWarn('dni_cif') ??
                                    (data.dni_cif && !/^[0-9A-Z]{9}$/.test(data.dni_cif) ? 'Formato inusual' : undefined)
                                }
                                action={pdfUrl && data.dni_cif ? <LocateButton onClick={() => locate(data.dni_cif)} lowConfidence={isLowConfidence('dni_cif')} /> : undefined}
                            />
                            <Input
                                label="Comercializadora Actual"
                                labelBadge={<ConfidencePill value={getConfidence('company_name')} />}
                                icon={<Building2 size={16} />}
                                value={data.company_name}
                                onChange={(e) => onUpdate('company_name', e.target.value)}
                                placeholder="Ej: Endesa, Iberdrola..."
                                warning={lowConfWarn('company_name')}
                                action={pdfUrl && data.company_name ? <LocateButton onClick={() => locate(data.company_name)} lowConfidence={isLowConfidence('company_name')} /> : undefined}
                            />
                            <Input
                                label="Nº de Factura"
                                labelBadge={<ConfidencePill value={getConfidence('invoice_number')} />}
                                icon={<Hash size={16} />}
                                value={data.invoice_number}
                                onChange={(e) => onUpdate('invoice_number', e.target.value)}
                                warning={
                                    lowConfWarn('invoice_number') ??
                                    (!data.invoice_number ? 'Dato no encontrado en el PDF' : undefined)
                                }
                                action={pdfUrl && data.invoice_number ? <LocateButton onClick={() => locate(data.invoice_number)} lowConfidence={isLowConfidence('invoice_number')} /> : undefined}
                            />
                        </Card>
                    </div>

                    {/* Group 2: Supply Info */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 px-2">
                            <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Punto de Suministro</h2>
                        </div>
                        <Card className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/60">
                            <div className="md:col-span-2">
                                <Input
                                    label="CUPS"
                                    labelBadge={<ConfidencePill value={getConfidence('cups')} />}
                                    icon={<Activity size={16} />}
                                    value={data.cups}
                                    error={!isCupsValid && data.cups ? 'Longitud de CUPS sospechosa' : undefined}
                                    warning={
                                        lowConfWarn('cups') ??
                                        (isCupsValid && !data.cups?.startsWith('ES') ? 'CUPS debe empezar por ES' : undefined)
                                    }
                                    onChange={(e) => onUpdate('cups', e.target.value.toUpperCase())}
                                    className="font-mono"
                                    action={pdfUrl && data.cups ? <LocateButton onClick={() => locate(data.cups)} lowConfidence={isLowConfidence('cups')} /> : undefined}
                                />
                            </div>
                            <Input
                                label="Dirección de Suministro"
                                labelBadge={<ConfidencePill value={getConfidence('supply_address')} />}
                                icon={<MapPin size={16} />}
                                value={data.supply_address}
                                onChange={(e) => onUpdate('supply_address', e.target.value)}
                                warning={
                                    lowConfWarn('supply_address') ??
                                    (data.supply_address && data.supply_address.length < 10 ? 'Dirección incompleta' : undefined)
                                }
                                action={pdfUrl && data.supply_address ? <LocateButton onClick={() => locate(data.supply_address)} lowConfidence={isLowConfidence('supply_address')} /> : undefined}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Días Factura"
                                    type="number"
                                    icon={<Calendar size={16} />}
                                    value={data.period_days}
                                    onChange={(e) => onUpdate('period_days', parseInt(e.target.value) || 30)}
                                />
                                <Input
                                    label="Fecha"
                                    labelBadge={<ConfidencePill value={getConfidence('invoice_date')} />}
                                    icon={<Calendar size={16} />}
                                    value={data.invoice_date}
                                    onChange={(e) => onUpdate('invoice_date', e.target.value)}
                                    warning={lowConfWarn('invoice_date')}
                                    action={pdfUrl && data.invoice_date ? <LocateButton onClick={() => locate(data.invoice_date)} lowConfidence={isLowConfidence('invoice_date')} /> : undefined}
                                />
                            </div>
                        </Card>
                    </div>

                </div>

                {/* Right Column: Values & Metrics */}
                <div className={showPdf && pdfUrl ? 'space-y-8' : 'lg:col-span-4 space-y-8'}>

                    {/* Energy Sectors */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 px-2">
                            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Consumo (kWh)</h2>
                        </div>
                        <Card className="bg-emerald-50/30 border border-emerald-100 shadow-sm">
                            <div className="space-y-3">
                                {visibleEnergyPeriods.map(p => {
                                    const field = `energy_p${p}` as keyof InvoiceData;
                                    return (
                                        <div key={`energy-${p}`} className="flex items-center justify-between gap-4">
                                            <span className="text-xs font-black text-emerald-600 bg-emerald-100 px-2 py-1 rounded w-8 text-center">P{p}</span>
                                            <input
                                                type="number"
                                                aria-label={`Energía P${p}`}
                                                value={data[field] as number}
                                                onChange={(e) => onUpdate(field, parseFloat(e.target.value) || 0)}
                                                className="flex-1 bg-transparent border-b border-emerald-200 focus:border-emerald-500 focus:outline-none text-right font-bold text-slate-800 text-sm py-1"
                                            />
                                        </div>
                                    );
                                })}
                                {!hasEnergyValues && (
                                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-orange-600 bg-orange-50 p-2 rounded-lg">
                                        <AlertCircle size={14} />
                                        SIN CONSUMO DETECTADO
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* Power Sectors */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 px-2">
                            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Potencias (kW)</h2>
                        </div>
                        <Card className="bg-amber-50/30 border border-amber-100 shadow-sm">
                            <div className="space-y-3">
                                {visiblePowerPeriods.map(p => {
                                    const field = `power_p${p}` as keyof InvoiceData;
                                    return (
                                        <div key={`power-${p}`} className="flex items-center justify-between gap-4">
                                            <span className="text-xs font-black text-amber-600 bg-amber-100 px-2 py-1 rounded w-8 text-center">P{p}</span>
                                            <input
                                                type="number"
                                                aria-label={`Potencia P${p}`}
                                                value={data[field] as number}
                                                onChange={(e) => onUpdate(field, parseFloat(e.target.value) || 0)}
                                                className="flex-1 bg-transparent border-b border-amber-200 focus:border-amber-500 focus:outline-none text-right font-bold text-slate-800 text-sm py-1"
                                            />
                                        </div>
                                    );
                                })}
                                {!hasPowerValues && (
                                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-red-600 bg-red-50 p-2 rounded-lg">
                                        <AlertCircle size={14} />
                                        FALTA POTENCIA CONTRATADA
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* Maximeter (Demandas Máximas) */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 px-2">
                            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Maxímetro (kW)</h2>
                            <span className="text-[10px] uppercase font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Opcional</span>
                        </div>
                        <Card className="bg-purple-50/30 border border-purple-100 shadow-sm">
                            <div className="space-y-3">
                                {visiblePowerPeriods.map(p => {
                                    const field = `max_demand_p${p}` as keyof InvoiceData;
                                    return (
                                        <div key={`max-demand-${p}`} className="flex items-center justify-between gap-4">
                                            <span className="text-xs font-black text-purple-600 bg-purple-100 px-2 py-1 rounded w-8 text-center">P{p}</span>
                                            <input
                                                type="number"
                                                aria-label={`Max Demand P${p}`}
                                                value={data[field] as number || ''}
                                                onChange={(e) => onUpdate(field, parseFloat(e.target.value) || 0)}
                                                placeholder="0.00"
                                                className="flex-1 bg-transparent border-b border-purple-200 focus:border-purple-500 focus:outline-none text-right font-bold text-slate-800 text-sm py-1 placeholder:text-slate-300"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    </div>

                    {/* Final Action */}
                    <motion.button
                        whileHover={{ scale: 1.02, translateY: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onCompare}
                        disabled={isAnalyzing || !hasEnergyValues || !hasPowerValues}
                        className="w-full relative bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 rounded-[2rem] font-display font-bold text-xl shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale transition-all overflow-hidden group mt-6"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />

                        {isAnalyzing ? (
                            <div className="flex items-center gap-3">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    className="w-6 h-6 border-3 border-white/20 border-t-white rounded-full"
                                />
                                <span>{loadingMessage}</span>
                            </div>
                        ) : (
                            <>
                                <span>Ejecutar Comparativa</span>
                                <ArrowRight size={22} className="group-hover:translate-x-1.5 transition-transform" />
                            </>
                        )}
                    </motion.button>
                </div>
            </div>
        </motion.div>
    );
};

// ── LocateButton ──────────────────────────────────────────────────────────────

interface LocateButtonProps {
    onClick: () => void;
    lowConfidence?: boolean;
}

/**
 * Botón pequeño que aparece en el trailing de un Input cuando hay PDF cargado.
 * Al pulsarlo, el PdfViewer busca y resalta el valor del campo en el documento.
 * Si el campo tiene baja confianza OCR, el icono pulsa en naranja para llamar la atención.
 */
const LocateButton: React.FC<LocateButtonProps> = ({ onClick, lowConfidence }) => (
    <motion.button
        type="button"
        onClick={onClick}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        title="Localizar en la factura"
        className={`p-1 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
            lowConfidence
                ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50 animate-pulse'
                : 'text-slate-300 hover:text-emerald-600 hover:bg-emerald-50'
        }`}
    >
        <ScanSearch size={14} />
    </motion.button>
);

// ── ConfidencePill ────────────────────────────────────────────────────────────

/**
 * Badge de confianza OCR renderizado inline junto al label de un campo.
 * Verde ≥90%, ámbar 70-89%, rojo <70%.
 * Se pasa como labelBadge al componente Input.
 */
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

