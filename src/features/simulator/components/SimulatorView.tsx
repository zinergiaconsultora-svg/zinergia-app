'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { useSimulatorContext } from '../contexts/SimulatorContext';
import { InvoiceData } from '@/types/crm';
import { SimulatorUpload } from './SimulatorUpload';
import { SimulatorSegmentStep } from './SimulatorSegmentStep';
import { SimulatorBatchUpload } from './SimulatorBatchUpload';
import { SimulatorForm } from './SimulatorForm';
import { SimulatorResults } from './SimulatorResults';
import { SimulatorSkeleton } from './SimulatorSkeleton';
import { LoadingOverlay } from './LoadingOverlay';
import { inferInvoicePowerType } from '@/lib/invoices/normalization';

export const SimulatorView = () => {
    const [batchMode, setBatchMode] = useState(false);
    const [powerTypeOverride, setPowerTypeOverride] = useState<'2.0' | '3.0' | '3.1' | null>(null);
    const {
        step,
        segment,
        setSegment,
        clearSegment,
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
        supervisedRecommendation,
        handleFileUpload,
        handleDrop,
        handleDragOver,
        runComparison,
        reset: handleReset,
        goBackToStep1,
        pdfUrl,
        clientProfile,
        savedProposalId,
        persistenceWarning,
        confirmOcrData,
    } = useSimulatorContext();

    const updateInvoiceField = <K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) => {
        setInvoiceData({ ...invoiceData, [key]: value });
    };

    const powerType = powerTypeOverride ?? inferInvoicePowerType(invoiceData);

    return (
        <div className="min-h-screen relative overflow-hidden">
            {/* Background con gradiente orgánico */}
            <div className="fixed inset-0 gradient-organic -z-10" />

            <div className="relative z-10 px-3 sm:px-4 pt-4 pb-20 overflow-x-hidden">
                <div className="max-w-4xl mx-auto text-center mb-8">
                    {/* Acciones — top right */}
                    <div className="flex justify-end gap-2 mb-3">
                        <Link
                            href="/dashboard/comparar-multiple"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-energy-600 hover:border-energy-200/40 hover:scale-105 transition-all duration-300 border border-white/20 px-4 py-2 rounded-full glass-premium bg-white/40 shadow-floating-light hover:shadow-floating-medium"
                        >
                            <span className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500">+</span>
                            Comparar varias
                        </Link>
                        <Link
                            href="/dashboard/simulator/guia"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 hover:border-emerald-200/40 hover:scale-105 transition-all duration-300 border border-white/20 px-4 py-2 rounded-full glass-premium bg-white/40 shadow-floating-light hover:shadow-floating-medium"
                        >
                            <span className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500">?</span>
                            Guía de uso
                        </Link>
                    </div>
                    <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-4 tracking-tight leading-tight">
                        Simulador de <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">Facturas</span>
                    </h1>
                    <p className="text-sm md:text-base text-slate-500 max-w-2xl mx-auto font-body leading-relaxed">
                        Sube tu factura, extrae los datos con IA y descubre las mejores tarifas del mercado. Ahorra hasta un <span className="font-semibold text-emerald-600">40%</span> en tu factura de luz.
                    </p>
                </div>

                <AnimatePresence mode="wait">

                    {/* PASO 0: Tipo de cliente (Residencial / PYME) — antes de subir */}
                    {step === 1 && !isAnalyzing && !batchMode && !segment && (
                        <SimulatorSegmentStep onSelect={setSegment} />
                    )}

                    {/* PASO 1: Subir Factura — modo individual (requiere segmento) */}
                    {step === 1 && !isAnalyzing && !batchMode && segment && (
                        <SimulatorUpload
                            onFileUpload={handleFileUpload}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            isAnalyzing={isAnalyzing}
                            uploadError={uploadError}
                            onBatchMode={() => setBatchMode(true)}
                            segment={segment}
                            onChangeSegment={clearSegment}
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
                            persistenceWarning={persistenceWarning}
                            supervisedRecommendation={supervisedRecommendation}
                        />
                    )}

                </AnimatePresence>
            </div>
        </div>
    );
};
