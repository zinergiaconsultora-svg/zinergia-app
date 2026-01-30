'use client';

import React from 'react';
import { Upload, CheckCircle2, XCircle, RefreshCw, ArrowRight, ChevronLeft, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSimulator } from '../hooks/useSimulator';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { InvoiceData } from '@/types/crm';
import { DigitalProposalCard } from '@/features/comparator/components/DigitalProposalCard';

export const SimulatorView = () => {
    const {
        step,
        setStep,
        isAnalyzing,
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
        const hasP4P5P6 = data.power_p4 > 0 || data.power_p5 > 0 || data.power_p6 > 0;
        const hasP1P2P3 = data.power_p1 > 0 || data.power_p2 > 0 || data.power_p3 > 0;
        
        if (hasP4P5P6) return '3.1';
        if (hasP1P2P3) return '3.0';
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
                    {step === 1 && (
                        <motion.div
                            key="s1"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="max-w-4xl mx-auto"
                        >
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-slate-900 mb-2">Sube tu Factura</h2>
                                <p className="text-sm text-slate-500">Arrastra o selecciona tu factura en PDF para extraer los datos automáticamente</p>
                            </div>

                            {/* Error de upload */}
                            <AnimatePresence>
                                {uploadError && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        className="mb-6 bg-red-50 border-2 border-red-200 rounded-2xl p-6 flex items-center gap-4"
                                    >
                                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <XCircle className="w-6 h-6 text-red-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-red-700 mb-1">Error al procesar</h3>
                                            <p className="text-sm text-red-600">{uploadError}</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Zona de arrastrar factura - Diseño Premium */}
                            {!isAnalyzing && !uploadError && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    className="relative max-w-2xl mx-auto"
                                >
                                    {/* Glow effect */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-200/50 to-teal-200/50 rounded-[3rem] blur-3xl opacity-50 group-hover:opacity-75 transition-opacity duration-500" />
                                    
                                    <motion.div 
                                        whileHover={{ scale: 1.02 }}
                                        transition={{ duration: 0.3 }}
                                        className="relative glass-premium rounded-[2.5rem] border-2 border-dashed border-emerald-200 hover:border-emerald-400 transition-all min-h-[400px] flex flex-col items-center justify-center p-12 cursor-pointer overflow-hidden"
                                        role="button"
                                        tabIndex={0}
                                        aria-label="Zona de carga de factura. Arrastra tu factura PDF aquí o haz clic para seleccionar."
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                document.getElementById('invoice-upload-simulator')?.click();
                                            }
                                        }}
                                    >
                                        {/* Gradiente orgánico sutil */}
                                        <div className="absolute inset-0 gradient-energy opacity-30" />
                                        
                                        <label className="relative z-10 cursor-pointer w-full h-full flex flex-col items-center justify-center">
                                            <input
                                                id="invoice-upload-simulator"
                                                type="file"
                                                accept=".pdf"
                                                className="hidden"
                                                onChange={handleFileUpload}
                                                disabled={isAnalyzing}
                                                aria-label="Subir factura en formato PDF"
                                            />
                                            <motion.div 
                                                initial={{ scale: 0.8, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                transition={{ delay: 0.2, duration: 0.5 }}
                                                className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-3xl flex items-center justify-center mb-8 shadow-lg"
                                            >
                                                <Upload className="w-8 h-8 text-emerald-600" aria-hidden="true" />
                                            </motion.div>
                                            <h3 className="font-display text-2xl font-semibold text-slate-800 mb-3">Arrastra tu factura aquí</h3>
                                            <p className="text-slate-500 mb-8 text-center font-body">o haz clic para explorar archivos (solo PDF)</p>
                                            <div className="px-6 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-full text-xs font-bold text-emerald-700 uppercase tracking-widest border border-emerald-200 shadow-sm">
                                                Compatible con tarifas 2.0, 3.0 y 3.1
                                            </div>
                                        </label>
                                    </motion.div>
                                </motion.div>
                            )}
                        </motion.div>
                    )}

                    {/* PASO 2: Revisión de Datos */}
                    {step === 2 && (
                        <motion.div
                            key="s2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="max-w-4xl mx-auto"
                        >
                            {/* Header con botón volver */}
                            <div className="flex items-center justify-between mb-6">
                                <button
                                    onClick={goBackToStep1}
                                    className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium text-sm transition-colors"
                                >
                                    <ChevronLeft size={16} />
                                    Subir otra factura
                                </button>
                                <div className="text-right">
                                    <h2 className="text-xl font-bold text-slate-900">Datos de la Factura</h2>
                                    <p className="text-xs text-slate-500">
                                        Tipo de Potencia: <span className="font-semibold text-indigo-600">{powerType}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Resumen de detección */}
                            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100 mb-6">
                                <div className="flex items-center justify-center gap-4">
                                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                                        <Zap className="w-6 h-6 text-indigo-600" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-bold text-indigo-900 mb-1">TIPO DE POTENCIA DETECTADA</p>
                                        <p className="text-3xl font-bold text-slate-900">
                                            {powerType === '2.0' && '⚡ 2.0TD'}
                                            {powerType === '3.0' && '⚡⚡ 3.0TD'}
                                            {powerType === '3.1' && '⚡⚡⚡ 3.1TD'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Datos administrativos - Glass Premium */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1, duration: 0.5 }}
                                className="glass-premium rounded-2xl border border-white/50 shadow-lg hover:shadow-xl transition-all duration-300 p-6 mb-4"
                            >
                                <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2 font-display">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Datos Administrativos
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="client-name" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Titular</label>
                                        <input
                                            id="client-name"
                                            name="client-name"
                                            type="text"
                                            value={invoiceData.client_name || ''}
                                            onChange={(e) => updateInvoiceField('client_name', e.target.value)}
                                            className="w-full bg-slate-50/50 border border-slate-100/50 rounded-lg text-xs font-semibold text-slate-700 px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-400 transition-all"
                                            autoComplete="name"
                                            spellCheck={false}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="company-name" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Comercializadora</label>
                                        <input
                                            id="company-name"
                                            name="company-name"
                                            type="text"
                                            value={invoiceData.company_name || ''}
                                            onChange={(e) => updateInvoiceField('company_name', e.target.value)}
                                            className="w-full bg-slate-50/50 border border-slate-100/50 rounded-lg text-xs font-semibold text-slate-700 px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-400 transition-all"
                                            autoComplete="organization"
                                            spellCheck={false}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="tariff-name" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tarifa</label>
                                        <input
                                            id="tariff-name"
                                            name="tariff-name"
                                            type="text"
                                            value={invoiceData.tariff_name || ''}
                                            onChange={(e) => updateInvoiceField('tariff_name', e.target.value)}
                                            className="w-full bg-slate-50/50 border border-slate-100/50 rounded-lg text-xs font-semibold text-slate-700 px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-400 transition-all"
                                            autoComplete="off"
                                            spellCheck={false}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="cups" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">CUPS</label>
                                        <input
                                            id="cups"
                                            name="cups"
                                            type="text"
                                            value={invoiceData.cups || ''}
                                            onChange={(e) => updateInvoiceField('cups', e.target.value)}
                                            className="w-full bg-slate-50/50 border border-slate-100/50 rounded-lg text-xs font-semibold text-slate-700 px-3 py-2 font-mono focus:ring-2 focus:ring-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-400 transition-all"
                                            autoComplete="off"
                                            spellCheck={false}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="invoice-number" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nº Factura</label>
                                        <input
                                            id="invoice-number"
                                            name="invoice-number"
                                            type="text"
                                            value={invoiceData.invoice_number || ''}
                                            onChange={(e) => updateInvoiceField('invoice_number', e.target.value)}
                                            className="w-full bg-slate-50/50 border border-slate-100/50 rounded-lg text-xs font-semibold text-slate-700 px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-400 transition-all"
                                            autoComplete="off"
                                            spellCheck={false}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="invoice-date" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fecha</label>
                                        <input
                                            id="invoice-date"
                                            name="invoice-date"
                                            type="text"
                                            value={invoiceData.invoice_date || ''}
                                            onChange={(e) => updateInvoiceField('invoice_date', e.target.value)}
                                            className="w-full bg-slate-50/50 border border-slate-100/50 rounded-lg text-xs font-semibold text-slate-700 px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-400 transition-all"
                                            autoComplete="off"
                                            spellCheck={false}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="period-days" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Días</label>
                                        <input
                                            id="period-days"
                                            name="period-days"
                                            type="number"
                                            inputMode="decimal"
                                            min="1"
                                            max="365"
                                            value={invoiceData.period_days || 30}
                                            onChange={(e) => updateInvoiceField('period_days', parseInt(e.target.value) || 30)}
                                            className="w-full bg-slate-50/50 border border-slate-100/50 rounded-lg text-xs font-semibold text-slate-700 px-3 py-2 text-center focus:ring-2 focus:ring-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-400 transition-all"
                                        />
                                    </div>
                                </div>
                            </motion.div>

                            {/* Datos técnicos - Grid mejorado */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2, duration: 0.5 }}
                                    className="glass-premium rounded-2xl border border-white/50 shadow-lg hover:shadow-xl transition-all duration-300 p-6"
                                >
                                    <h3 className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-4 flex items-center gap-2 font-display">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Potencias (kW)
                                    </h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[1, 2, 3, 4, 5, 6].filter(p => {
                                            if (powerType === '2.0') return p <= 2;
                                            if (powerType === '3.0') return p <= 3;
                                            return true;
                                        }).map(p => {
                                            const field = `power_p${p}` as keyof InvoiceData;
                                            const value = invoiceData[field];
                                            return (
                                                <div key={`pow${p}`} className="text-center">
                                                    <label htmlFor={`power-p${p}`} className="block text-[8px] font-bold text-slate-400">P{p}</label>
                                                    <input
                                                        id={`power-p${p}`}
                                                        name={`power-p${p}`}
                                                        type="number"
                                                        inputMode="decimal"
                                                        step="0.01"
                                                        min="0"
                                                        value={typeof value === 'number' ? value : 0}
                                                        onChange={(e) => updateInvoiceField(field, parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-700 py-1 text-center focus:ring-2 focus:ring-orange-400 focus-visible:ring-2 focus-visible:ring-orange-400 transition-all"
                                                        aria-label={`Potencia período P${p} en kW`}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3, duration: 0.5 }}
                                    className="glass-premium rounded-2xl border border-white/50 shadow-lg hover:shadow-xl transition-all duration-300 p-6"
                                >
                                    <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2 font-display">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Consumo Energía (kWh)
                                    </h3>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <div className="w-1 h-1 rounded-full bg-indigo-500"></div> Consumo Energía
                                    </h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[1, 2, 3, 4, 5, 6].filter(p => {
                                            if (powerType === '2.0') return p <= 2;
                                            if (powerType === '3.0') return p <= 3;
                                            return true;
                                        }).map(p => {
                                            const field = `energy_p${p}` as keyof InvoiceData;
                                            const value = invoiceData[field];
                                            return (
                                                <div key={`ene${p}`} className="text-center">
                                                    <label htmlFor={`energy-p${p}`} className="block text-[8px] font-bold text-slate-400">P{p}</label>
                                                    <input
                                                        id={`energy-p${p}`}
                                                        name={`energy-p${p}`}
                                                        type="number"
                                                        inputMode="decimal"
                                                        step="0.01"
                                                        min="0"
                                                        value={typeof value === 'number' ? value : 0}
                                                        onChange={(e) => updateInvoiceField(field, parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-700 py-1 text-center focus:ring-2 focus:ring-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-400 transition-all"
                                                        aria-label={`Consumo energía período P${p} en kWh`}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            </div>

                            {/* Botón de acción - Diseño Premium */}
                            <div className="flex justify-end">
                                <motion.button
                                    whileHover={{ scale: 1.02, translateY: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={runComparison}
                                    disabled={isAnalyzing}
                                    aria-busy={isAnalyzing}
                                    className="group relative bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-4 rounded-2xl font-display font-bold text-lg shadow-lg shadow-emerald-600/30 flex items-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none transition-all overflow-hidden"
                                >
                                    {/* Shine effect */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                                    
                                    {isAnalyzing ? (
                                        <div className="flex items-center gap-3 relative z-10">
                                            <motion.div 
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" 
                                                aria-hidden="true"
                                            />
                                            <span className="sr-only">Procesando comparación</span>
                                            <span className="font-body">{loadingMessage}</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 relative z-10">
                                            <span>Comparativa de Tarifas</span>
                                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                                        </div>
                                    )}
                                </motion.button>
                            </div>
                        </motion.div>
                    )}

                    {/* PASO 3: Resultados */}
                    {step === 3 && results.length > 0 && (
                        <motion.div
                            key="s3"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                        >
                            {/* Header mejorado */}
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center justify-between mb-6"
                            >
                                <button
                                    onClick={handleReset}
                                    className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-medium text-sm transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg px-2 py-1 font-display"
                                    aria-label="Comenzar nueva simulación"
                                >
                                    <ChevronLeft size={16} aria-hidden="true" />
                                    Nueva simulación
                                </button>
                                <div className="text-right">
                                    <h2 className="font-display text-2xl font-bold text-slate-900">Propuestas de Ahorro</h2>
                                    <p className="text-sm text-slate-500 font-body">
                                        Las 3 mejores opciones para tu tarifa <span className="font-semibold text-emerald-600">{powerType}</span>
                                    </p>
                                </div>
                            </motion.div>

                            {/* Grid de resultados con stagger */}
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2, duration: 0.6 }}
                                className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start"
                            >
                                {results.slice(0, 3).map((result, idx) => (
                                    <motion.div
                                        key={result.offer.id}
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.15, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                                    >
                                        <DigitalProposalCard
                                            result={idx === 0 ? result : { ...result, optimization_result: undefined }}
                                            title={idx === 0 ? "Mejor Opción Ahorro" : "Alternativa Competitiva"}
                                            isSecondary={idx > 0}
                                            onReset={handleReset}
                                            onEmail={() => {}}
                                        />
                                    </motion.div>
                                ))}
                            </motion.div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>
        </div>
    );
};
