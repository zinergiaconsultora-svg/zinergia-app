'use client';

import React, { useMemo, useState, useRef } from 'react';
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

    // Returns true if the field has low confidence (< 0.7) from OCR
    const isLowConfidence = (field: string): boolean => {
        const conf = (data as unknown as Record<string, unknown>)._confidence as Record<string, number> | undefined;
        if (!conf || conf[field] === undefined) return false;
        return conf[field] < 0.7;
    };

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

                    <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado Auditoría</p>
                        <p className="text-sm font-bold text-slate-900 flex items-center gap-2 justify-end">
                            {data.detected_power_type ? 'Validado por IA' : 'Revisión Manual'}
                            <CheckCircle2 size={14} className="text-emerald-500" />
                        </p>
                    </div>
                </div>
            </div>

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

                    {/* Group 1: Identity & Contract */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 px-2">
                            <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Datos del Contrato</h2>
                        </div>
                        <Card className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/60">
                            <Input
                                label="Titular / Cliente"
                                icon={<User size={16} />}
                                value={data.client_name}
                                onChange={(e) => onUpdate('client_name', e.target.value)}
                                placeholder="Nombre completo"
                                warning={
                                    isLowConfidence('client_name') ? 'Confianza baja — revisa este dato' :
                                    (data.client_name && data.client_name.length < 5 ? 'Nombre muy corto (¿OCR incompleto?)' : undefined)
                                }
                                action={pdfUrl && data.client_name ? <LocateButton onClick={() => locate(data.client_name)} lowConfidence={isLowConfidence('client_name')} /> : undefined}
                            />
                            <Input
                                label="CIF / DNI"
                                icon={<Hash size={16} />}
                                value={data.dni_cif}
                                onChange={(e) => onUpdate('dni_cif', e.target.value)}
                                placeholder="Identificación"
                                warning={
                                    isLowConfidence('dni_cif') ? 'Confianza baja — revisa este dato' :
                                    (data.dni_cif && !/^[0-9A-Z]{9}$/.test(data.dni_cif) ? 'Formato inusual' : undefined)
                                }
                                action={pdfUrl && data.dni_cif ? <LocateButton onClick={() => locate(data.dni_cif)} lowConfidence={isLowConfidence('dni_cif')} /> : undefined}
                            />
                            <Input
                                label="Comercializadora Actual"
                                icon={<Building2 size={16} />}
                                value={data.company_name}
                                onChange={(e) => onUpdate('company_name', e.target.value)}
                                placeholder="Ej: Endesa, Iberdrola..."
                                warning={isLowConfidence('company_name') ? 'Confianza baja — revisa este dato' : undefined}
                                action={pdfUrl && data.company_name ? <LocateButton onClick={() => locate(data.company_name)} lowConfidence={isLowConfidence('company_name')} /> : undefined}
                            />
                            <Input
                                label="Nº de Factura"
                                icon={<Hash size={16} />}
                                value={data.invoice_number}
                                onChange={(e) => onUpdate('invoice_number', e.target.value)}
                                warning={
                                    isLowConfidence('invoice_number') ? 'Confianza baja — revisa este dato' :
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
                                    icon={<Activity size={16} />}
                                    value={data.cups}
                                    error={!isCupsValid && data.cups ? 'Longitud de CUPS sospechosa' : undefined}
                                    warning={
                                        isLowConfidence('cups') ? 'Confianza baja — revisa este dato' :
                                        (isCupsValid && !data.cups?.startsWith('ES') ? 'CUPS debe empezar por ES' : undefined)
                                    }
                                    onChange={(e) => onUpdate('cups', e.target.value.toUpperCase())}
                                    className="font-mono"
                                    action={pdfUrl && data.cups ? <LocateButton onClick={() => locate(data.cups)} lowConfidence={isLowConfidence('cups')} /> : undefined}
                                />
                            </div>
                            <Input
                                label="Dirección de Suministro"
                                icon={<MapPin size={16} />}
                                value={data.supply_address}
                                onChange={(e) => onUpdate('supply_address', e.target.value)}
                                warning={
                                    isLowConfidence('supply_address') ? 'Confianza baja — revisa este dato' :
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
                                    icon={<Calendar size={16} />}
                                    value={data.invoice_date}
                                    onChange={(e) => onUpdate('invoice_date', e.target.value)}
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

