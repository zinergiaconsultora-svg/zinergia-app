'use client';

import React from 'react';
import { Upload, Zap, ArrowRight, TrendingUp, ChevronLeft, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { DigitalProposalCard } from './DigitalProposalCard';
import { EmailModal } from './EmailModal';
import { ConsumptionChart } from './ConsumptionChart';
import { CompanyScanner } from './CompanyScanner';
import { PowerOptimizer } from './PowerOptimizer';
import { useComparator } from '../hooks/useComparator';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { InvoiceData } from '@/types/crm';

export const ComparatorView = () => {
    const router = useRouter();
    const {
        step,
        setStep,
        isAnalyzing,
        results,
        clientName,
        setClientName,
        isEmailModalOpen,
        setIsEmailModalOpen,
        loadingMessage,
        invoiceData,
        setInvoiceData,
        handleFileUpload,
        runAnalysis,
        handleReset
    } = useComparator();

    return (
        <div className="max-w-[1200px] mx-auto min-h-[800px] relative pb-20">
            <AmbientBackground />

            {/* --- WIZARD HEADER --- */}
            <div className="flex items-center justify-between mb-12 relative z-10 px-4 pt-6">
                <button
                    onClick={() => step > 1 ? setStep(step - 1) : router.push('/dashboard')}
                    className="w-10 h-10 rounded-xl bg-white/60 backdrop-blur-xl border border-white/60 flex items-center justify-center hover:bg-slate-50 transition-colors"
                    aria-label="Volver"
                    title="Volver"
                >
                    <ChevronLeft className="text-slate-500" size={20} />
                </button>

                {/* Progress Dots */}
                <div className="flex gap-3">
                    {[1, 2, 3, 4].map(s => (
                        <div key={s} className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${step >= s ? 'bg-energy-600 w-8' : 'bg-slate-200'}`}></div>
                    ))}
                </div>

                <div className="w-10"></div>{/* Spacer */}
            </div>

            <AnimatePresence mode="wait">

                {/* STEP 1: UPLOAD (Clean & Simple) */}
                {step === 1 && (
                    <motion.div
                        key="s1"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="flex flex-col items-center justify-center pt-4 relative z-10 px-4"
                    >
                        <h1 className="text-3xl md:text-5xl font-light text-slate-900 mb-6 text-center tracking-tight leading-tight">
                            Comencemos con la <span className="font-bold text-energy-600">Factura.</span>
                        </h1>
                        <p className="text-base md:text-lg text-slate-500 mb-12 text-center max-w-xl font-light leading-relaxed">
                            Sube el PDF de la última factura eléctrica. Nuestra IA extraerá los datos y detectará oportunidades de ahorro al instante.
                        </p>

                        <div className="w-full max-w-2xl relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-energy-100 to-orange-100 rounded-[3rem] blur-xl opacity-50 group-hover:opacity-100 transition duration-700"></div>

                            <label className="relative block min-h-[350px] bg-white/80 backdrop-blur-xl rounded-[2.5rem] border-2 border-dashed border-energy-200 hover:border-energy-400 cursor-pointer transition-all flex flex-col items-center justify-center p-8 md:p-12 overflow-hidden shadow-sm hover:shadow-xl">
                                <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={isAnalyzing} />

                                {isAnalyzing ? (
                                    <div className="flex flex-col items-center text-center">
                                        <div className="w-16 h-16 border-4 border-energy-100 border-t-energy-500 rounded-full animate-spin mb-6"></div>
                                        <p className="text-lg font-medium text-slate-700">Analizando documento...</p>
                                        <p className="text-sm text-slate-400 mt-2">Extrayendo potencias y consumos</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-20 h-20 bg-energy-50 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                                            <Upload className="w-8 h-8 text-energy-600" />
                                        </div>
                                        <h3 className="text-xl font-medium text-slate-800 mb-2">Arrastra tu PDF aquí</h3>
                                        <p className="text-slate-400 mb-8 text-center">o haz clic para explorar archivos</p>
                                        <div className="px-6 py-2 bg-slate-50 rounded-full text-xs font-bold text-slate-400 uppercase tracking-widest border border-slate-100/50">
                                            Soporta Endesa, Iberdrola, Naturgy +12
                                        </div>
                                    </>
                                )}
                            </label>
                        </div>

                        <button onClick={() => setStep(2)} className="mt-8 text-sm text-slate-400 hover:text-energy-600 underline font-medium transition-colors">
                            No tengo factura, introducir datos manualmente
                        </button>
                    </motion.div>
                )}

                {/* STEP 2: VERIFICATION (Minimalist Form) */}
                {step === 2 && (
                    <motion.div
                        key="s2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="max-w-4xl mx-auto px-4 relative z-10"
                    >
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-light text-slate-900 mb-3">Verifica los Datos</h2>
                            <p className="text-slate-500 mb-6">Confirma que la extracción ha sido correcta antes de calcular.</p>
                            <CompanyScanner />
                        </div>

                        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-sm border border-white/60 overflow-hidden">
                            {/* Client Info */}
                            <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row gap-6 items-center">
                                <div className="flex-1 w-full">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Cliente / Titular</label>
                                    <input
                                        type="text"
                                        value={clientName}
                                        onChange={(e) => setClientName(e.target.value)}
                                        placeholder="Nombre del Cliente"
                                        className="w-full text-xl font-medium text-slate-800 placeholder:text-slate-300 border-none p-0 focus:ring-0 bg-transparent"
                                    />
                                </div>
                                <div className="flex gap-4">
                                    <div className="px-6 py-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-700 font-medium text-sm flex items-center gap-2">
                                        <Check size={16} /> Datos Validados
                                    </div>
                                </div>
                            </div>

                            {/* Data Grid */}
                            <div className="p-6 md:p-8 grid md:grid-cols-2 gap-12">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                                        <Zap size={16} className="text-energy-500" /> Potencias (kW)
                                    </h3>
                                    <PowerOptimizer
                                        data={invoiceData}
                                        onUpdate={(newData) => setInvoiceData(newData)}
                                    />
                                </div>

                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                                        <TrendingUp size={16} className="text-emerald-500" /> Perfil de Consumo (kWh)
                                    </h3>
                                    {/* Visual Chart */}
                                    <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100/50 mb-4">
                                        <ConsumptionChart data={invoiceData} />
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[1, 2, 3, 4, 5, 6].map(p => (
                                            <div key={`e${p}`} className="bg-slate-50/50 rounded-xl p-3 border border-slate-100/50 focus-within:bg-white focus-within:border-energy-200 transition-colors">
                                                <label className="block text-[10px] font-bold text-slate-400 mb-1">P{p}</label>
                                                <input
                                                    type="number"
                                                    value={invoiceData[`energy_p${p}` as keyof InvoiceData]}
                                                    onChange={(e) => setInvoiceData({ ...invoiceData, [`energy_p${p}`]: parseFloat(e.target.value) || 0 })}
                                                    className="w-full bg-transparent font-bold text-slate-700 border-none p-0 text-sm focus:ring-0"
                                                    aria-label={`Consumo P${p}`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                                <button
                                    onClick={runAnalysis}
                                    disabled={isAnalyzing}
                                    className="w-full md:w-auto bg-slate-900 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 flex items-center justify-center gap-3 active:scale-95"
                                >
                                    {isAnalyzing ? (
                                        <div className="flex items-center gap-3">
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            <span className="animate-pulse">{loadingMessage}</span>
                                        </div>
                                    ) : (
                                        <>
                                            Calcular Ahorro <ArrowRight size={20} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* STEP 4: PROPOSAL (The "Wow" Result) */}
                {step === 4 && results.length > 0 && (
                    <motion.div
                        key="s4"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="pb-20 relative z-10 px-4"
                    >
                        <h2 className="text-center text-3xl font-light text-slate-900 mb-2">Propuesta Generada</h2>
                        <p className="text-center text-slate-500 mb-10">Hemos encontrado una oportunidad de ahorro significativa.</p>

                        <DigitalProposalCard
                            result={results[0]}
                            onReset={handleReset}
                            onEmail={() => setIsEmailModalOpen(true)}
                        />

                        <EmailModal
                            isOpen={isEmailModalOpen}
                            onClose={() => setIsEmailModalOpen(false)}
                            result={results[0]}
                        />
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
    );
};
