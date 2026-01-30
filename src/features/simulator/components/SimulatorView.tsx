'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSimulator } from '../hooks/useSimulator';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { InvoiceData } from '@/types/crm';
import { SimulatorUpload } from './SimulatorUpload';
import { SimulatorForm } from './SimulatorForm';
import { SimulatorResults } from './SimulatorResults';
import { SimulatorSkeleton } from './SimulatorSkeleton';
import { LoadingOverlay } from './LoadingOverlay';

export const SimulatorView = () => {
    const {
        step,
        isAnalyzing,
        isMockMode,
        invoiceData,
        setInvoiceData,
        uploadError,
        results,
        loadingMessage,
        handleFileUpload,
        handleDrop,
        handleDragOver,
        runComparison,
        reset: handleReset,
        goBackToStep1
    } = useSimulator();

    const updateInvoiceField = <K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) => {
        setInvoiceData(prev => ({ ...prev, [key]: value }));
    };

    const getPowerType = (data: InvoiceData): string => {
        // 1. Prioritize explicit detection from OCR
        if (data.detected_power_type) return data.detected_power_type;

        // 2. Intelligent fallback based on Tariff Name (Common in Spain)
        const tariff = (data.tariff_name || '').toUpperCase();
        if (tariff.includes('3.1') || tariff.includes('6.1') || tariff.includes('6.2')) return '3.1';
        if (tariff.includes('3.0')) return '3.0';
        if (tariff.includes('2.0') || tariff.includes('2.1')) return '2.0';

        // 3. Last resort: Infer from presence of values
        const hasP4P5P6 = data.power_p4 > 0 || data.power_p5 > 0 || data.power_p6 > 0;
        const hasP3 = data.power_p3 > 0;

        if (hasP4P5P6) return '3.1';
        if (hasP3) return '3.0'; // 3.0TD has 6 periods but 3 are most common in low tension
        return '2.0';
    };

    const powerType = getPowerType(invoiceData);

    return (
        <div className="min-h-screen relative overflow-hidden">
            {/* Background con gradiente orgánico */}
            <div className="fixed inset-0 gradient-organic noise-overlay -z-10" />
            <AmbientBackground />

            <div className="relative z-10 px-4 pt-4 pb-20">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="max-w-4xl mx-auto text-center mb-8"
                >
                    <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-4 tracking-tight leading-tight">
                        Simulador de <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">Facturas</span>
                    </h1>
                    <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto font-body leading-relaxed">
                        Sube tu factura, extrae los datos con IA y descubre las mejores tarifas del mercado. Ahorra hasta un <span className="font-semibold text-emerald-600">40%</span> en tu factura de luz.
                    </p>
                </motion.div>

                <AnimatePresence mode="wait">

                    {/* PASO 1: Subir Factura */}
                    {step === 1 && !isAnalyzing && (
                        <SimulatorUpload
                            onFileUpload={handleFileUpload}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            isAnalyzing={isAnalyzing}
                            uploadError={uploadError}
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
                        />
                    )}

                </AnimatePresence>
            </div>
        </div>
    );
};
