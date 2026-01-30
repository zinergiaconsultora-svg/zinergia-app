'use client';

import React from 'react';
import { Zap, ChevronLeft, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { InvoiceData } from '@/types/crm';

interface SimulatorFormProps {
    data: InvoiceData;
    onUpdate: <K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) => void;
    onCompare: () => void;
    onBack: () => void;
    isAnalyzing: boolean;
    loadingMessage: string;
    powerType: string;
}

export const SimulatorForm: React.FC<SimulatorFormProps> = ({
    data,
    onUpdate,
    onCompare,
    onBack,
    isAnalyzing,
    loadingMessage,
    powerType
}) => {
    return (
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
                    onClick={onBack}
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
                            value={data.client_name || ''}
                            onChange={(e) => onUpdate('client_name', e.target.value)}
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
                            value={data.company_name || ''}
                            onChange={(e) => onUpdate('company_name', e.target.value)}
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
                            value={data.tariff_name || ''}
                            onChange={(e) => onUpdate('tariff_name', e.target.value)}
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
                            value={data.cups || ''}
                            onChange={(e) => onUpdate('cups', e.target.value)}
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
                            value={data.invoice_number || ''}
                            onChange={(e) => onUpdate('invoice_number', e.target.value)}
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
                            value={data.invoice_date || ''}
                            onChange={(e) => onUpdate('invoice_date', e.target.value)}
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
                            value={data.period_days || 30}
                            onChange={(e) => onUpdate('period_days', parseInt(e.target.value) || 30)}
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
                            const value = data[field];
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
                                        onChange={(e) => onUpdate(field, parseFloat(e.target.value) || 0)}
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
                    <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3, 4, 5, 6].filter(p => {
                            if (powerType === '2.0') return p <= 2;
                            if (powerType === '3.0') return p <= 3;
                            return true;
                        }).map(p => {
                            const field = `energy_p${p}` as keyof InvoiceData;
                            const value = data[field];
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
                                        onChange={(e) => onUpdate(field, parseFloat(e.target.value) || 0)}
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
                    onClick={onCompare}
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
    );
};
