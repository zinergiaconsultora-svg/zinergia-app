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
        reset
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
                        <motion.h1 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, duration: 0.6 }}
                            className="font-display text-3xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 text-center tracking-tight leading-tight"
                        >
                            Comencemos con la{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-energy-600 to-amber-500">
                                Factura.
                            </span>
                        </motion.h1>
                        <motion.p 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2, duration: 0.6 }}
                            className="text-base md:text-lg text-slate-600 mb-12 text-center max-w-2xl font-body leading-relaxed"
                        >
                            Sube el PDF de la última factura eléctrica. Nuestra IA extraerá los datos y detectará oportunidades de ahorro al instante.
                        </motion.p>

                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                            className="w-full max-w-2xl relative group"
                        >
                            {/* Glow effect mejorado */}
                            <div className="absolute inset-0 bg-gradient-to-r from-energy-200/60 to-amber-200/60 rounded-[3rem] blur-3xl opacity-60 group-hover:opacity-100 transition duration-700"></div>
                            
                            <motion.label 
                                whileHover={{ scale: 1.01 }}
                                className="relative block min-h-[350px] glass-premium rounded-[2.5rem] border-2 border-dashed border-energy-300 hover:border-energy-500 cursor-pointer transition-all flex flex-col items-center justify-center p-8 md:p-12 overflow-hidden shadow-lg hover:shadow-2xl"
                            >
                                <input 
                                    id="invoice-upload-comparator"
                                    type="file" 
                                    accept=".pdf" 
                                    className="hidden" 
                                    onChange={handleFileUpload} 
                                    disabled={isAnalyzing}
                                    aria-label="Subir factura en formato PDF"
                                />

                                {isAnalyzing ? (
                                    <div className="flex flex-col items-center text-center">
                                        <motion.div 
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                            className="w-16 h-16 border-4 border-energy-200 border-t-energy-600 rounded-full mb-6"
                                            aria-hidden="true"
                                        ></motion.div>
                                        <p className="text-lg font-semibold text-slate-700 font-display">Analizando documento...</p>
                                        <p className="text-sm text-slate-500 mt-2 font-body">Extrayendo potencias y consumos</p>
                                    </div>
                                ) : (
                                    <>
                                        <motion.div 
                                            initial={{ scale: 0.8 }}
                                            animate={{ scale: 1 }}
                                            transition={{ delay: 0.4 }}
                                            className="w-20 h-20 bg-gradient-to-br from-energy-100 to-amber-100 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300 shadow-lg"
                                        >
                                            <Upload className="w-8 h-8 text-energy-600" aria-hidden="true" />
                                        </motion.div>
                                        <h3 className="font-display text-xl font-semibold text-slate-800 mb-2">Arrastra tu PDF aquí</h3>
                                        <p className="text-slate-500 mb-8 text-center font-body">o haz clic para explorar archivos</p>
                                        <div className="px-6 py-2 bg-gradient-to-r from-energy-50 to-amber-50 rounded-full text-xs font-bold text-energy-700 uppercase tracking-widest border border-energy-200 shadow-sm">
                                            Soporta Endesa, Iberdrola, Naturgy +12
                                        </div>
                                    </>
                                )}
                            </motion.label>
                        </motion.div>

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
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, duration: 0.6 }}
                            className="text-center mb-12"
                        >
                            <h2 className="font-display text-3xl md:text-4xl font-bold text-slate-900 mb-3">
                                Verifica los <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">Datos</span>
                            </h2>
                            <p className="text-slate-500 mb-6 font-body">Confirma que la extracción ha sido correcta antes de calcular.</p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                            className="glass-premium rounded-[2rem] shadow-lg hover:shadow-xl transition-shadow duration-300 border border-white/60 overflow-hidden"
                        >
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

                             <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.8 }}
                                className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end"
                             >
                                 <motion.button
                                     whileHover={{ scale: 1.02, translateY: -2 }}
                                     whileTap={{ scale: 0.98 }}
                                     onClick={runAnalysis}
                                     disabled={isAnalyzing}
                                     aria-busy={isAnalyzing}
                                     className="group relative w-full md:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-4 rounded-xl font-display font-bold text-lg shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none transition-all overflow-hidden"
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
                                             ></motion.div>
                                             <span className="sr-only">Calculando ahorro</span>
                                             <span className="font-body">{loadingMessage}</span>
                                         </div>
                                     ) : (
                                         <div className="flex items-center gap-3 relative z-10">
                                             <span>Calcular Ahorro</span>
                                             <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                                         </div>
                                     )}
                                 </motion.button>
                             </motion.div>
                        </div>
                    </motion.div>
                )}

                {/* STEP 4: PROPOSAL (The "Wow" Result) */}
                {step === 4 && results.length > 0 && (
                    <motion.div
                        key="s4"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                        className="pb-20 relative z-10 px-4"
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-center mb-12"
                        >
                            <h2 className="font-display text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                                Propuesta <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">Generada</span>
                            </h2>
                            <p className="text-slate-500 mb-10 font-body">
                                Hemos encontrado una oportunidad de ahorro significativa para ti.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="max-w-4xl mx-auto"
                        >
                            <DigitalProposalCard
                                result={results[0]}
                                onReset={reset}
                                onEmail={() => setIsEmailModalOpen(true)}
                            />

                            <EmailModal
                                isOpen={isEmailModalOpen}
                                onClose={() => setIsEmailModalOpen(false)}
                                result={results[0]}
                            />
                        </motion.div>
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
    );
};
