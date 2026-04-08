'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useSimulatorContext } from '../contexts/SimulatorContext';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { InvoiceData } from '@/types/crm';
import { SimulatorUpload } from './SimulatorUpload';
import { SimulatorBatchUpload } from './SimulatorBatchUpload';
import { SimulatorForm } from './SimulatorForm';
import { SimulatorResults } from './SimulatorResults';
import { SimulatorSkeleton } from './SimulatorSkeleton';
import { LoadingOverlay } from './LoadingOverlay';

export const SimulatorView = () => {
    const [batchMode, setBatchMode] = useState(false);
    const [powerTypeOverride, setPowerTypeOverride] = useState<'2.0' | '3.0' | '3.1' | null>(null);
    const {
        step,
        isAnalyzing,
        isMockMode,
        invoiceData,
        originalInvoiceData,
        ocrJobId,
        ocrDataConfirmed,
        setInvoiceData,
        uploadError,
        results,
        loadingMessage,
        optimizationRecommendations,
        opportunities,
        handleFileUpload,
        handleDrop,
        handleDragOver,
        runComparison,
        reset: handleReset,
        goBackToStep1,
        pdfUrl,
        clientProfile,
        savedProposalId,
        confirmOcrData,
    } = useSimulatorContext();

    const updateInvoiceField = <K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) => {
        setInvoiceData({ ...invoiceData, [key]: value });
    };

    // Memoize power type calculation to prevent recalculation on every render
    const powerType = useMemo(() => {
        // 0. Manual override wins over everything
        if (powerTypeOverride) return powerTypeOverride;

        // 1. Prioritize explicit detection from OCR
        if (invoiceData.detected_power_type) return invoiceData.detected_power_type;

        // 2. Intelligent fallback based on Tariff Name (Common in Spain)
        const tariff = (invoiceData.tariff_name || '').toUpperCase();
        if (tariff.includes('3.1') || tariff.includes('6.1') || tariff.includes('6.2')) return '3.1';
        if (tariff.includes('3.0')) return '3.0';
        if (tariff.includes('2.0') || tariff.includes('2.1')) return '2.0';

        // 3. Last resort: Infer from presence of values
        const hasP4P5P6 = invoiceData.power_p4 > 0 || invoiceData.power_p5 > 0 || invoiceData.power_p6 > 0;
        const hasP3 = invoiceData.power_p3 > 0;

        if (hasP4P5P6) return '3.1';
        if (hasP3) return '3.0'; // 3.0TD has 6 periods but 3 are most common in low tension
        return '2.0';
    }, [powerTypeOverride, invoiceData.detected_power_type, invoiceData.tariff_name, invoiceData.power_p3, invoiceData.power_p4, invoiceData.power_p5, invoiceData.power_p6]);

    return (
        <div className="min-h-screen relative overflow-hidden">
            {/* Background con gradiente orgánico */}
            <div className="fixed inset-0 gradient-organic -z-10" />
            <AmbientBackground />

            <div className="relative z-10 px-3 sm:px-4 pt-4 pb-20 overflow-x-hidden">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="max-w-4xl mx-auto text-center mb-8"
                >
                    {/* Guide link — top right */}
                    <div className="flex justify-end mb-3">
                        <Link
                            href="/dashboard/simulator/guia"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-emerald-600 transition-colors border border-slate-200 hover:border-emerald-300 px-3 py-1.5 rounded-full bg-white/60 hover:bg-white shadow-sm"
                        >
                            <span className="w-4 h-4 rounded-full bg-slate-200 hover:bg-emerald-100 flex items-center justify-center text-[9px] font-black">?</span>
                            Guía de uso
                        </Link>
                    </div>
                    <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-4 tracking-tight leading-tight">
                        Simulador de <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">Facturas</span>
                    </h1>
                    <p className="text-sm md:text-base text-slate-500 max-w-2xl mx-auto font-body leading-relaxed">
                        Sube tu factura, extrae los datos con IA y descubre las mejores tarifas del mercado. Ahorra hasta un <span className="font-semibold text-emerald-600">40%</span> en tu factura de luz.
                    </p>
                </motion.div>

                <AnimatePresence mode="wait">

                    {/* PASO 1: Subir Factura — modo individual */}
                    {step === 1 && !isAnalyzing && !batchMode && (
                        <SimulatorUpload
                            onFileUpload={handleFileUpload}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            isAnalyzing={isAnalyzing}
                            uploadError={uploadError}
                            onBatchMode={() => setBatchMode(true)}
                        />
                    )}

                    {/* PASO 1: Modo lote */}
                    {step === 1 && !isAnalyzing && batchMode && (
                        <SimulatorBatchUpload
                            onLoadInvoice={(data) => {
                                setInvoiceData(data);
                                setBatchMode(false);
                            }}
                            onExit={() => setBatchMode(false)}
                        />
                    )}

                    {/* SKELETON: Mostrando durante el análisis OCR */}
                    {step === 1 && isAnalyzing && (
                        <SimulatorSkeleton />
                    )}

                    {/* PASO 2: Revisión de Datos */}
                    {step === 2 && (
                        <>
                            <SimulatorForm
                                data={invoiceData}
                                onUpdate={updateInvoiceField}
                                onCompare={runComparison}
                                onBack={goBackToStep1}
                                isAnalyzing={isAnalyzing}
                                loadingMessage={loadingMessage}
                                powerType={powerType}
                                onPowerTypeOverride={setPowerTypeOverride}
                                pdfUrl={pdfUrl}
                                isMockMode={isMockMode}
                                originalData={originalInvoiceData}
                                ocrJobId={ocrJobId}
                                ocrDataConfirmed={ocrDataConfirmed}
                                onConfirmOcrData={confirmOcrData}
                            />
                            {/* OVERLAY: Mostrando durante la comparación */}
                            <LoadingOverlay
                                isVisible={isAnalyzing}
                                message={loadingMessage}
                            />
                        </>
                    )}

                    {/* PASO 3: Resultados */}
                    {step === 3 && results.length > 0 && (
                        <SimulatorResults
                            results={results}
                            isMockMode={isMockMode}
                            onReset={handleReset}
                            powerType={powerType}
                            optimizationRecommendations={optimizationRecommendations}
                            opportunities={opportunities}
                            invoiceData={invoiceData}
                            clientProfile={clientProfile}
                            savedProposalId={savedProposalId}
                        />
                    )}

                </AnimatePresence>
            </div>
        </div>
    );
};
