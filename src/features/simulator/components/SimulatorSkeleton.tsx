'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ScanSearch, Brain, CheckCircle2, Zap } from 'lucide-react';

const PHASES = [
    { icon: FileText,     label: 'Cargando documento...',           duration: 2500 },
    { icon: ScanSearch,   label: 'Extrayendo texto del PDF...',     duration: 3500 },
    { icon: Brain,        label: 'Interpretando datos con IA...',   duration: 0    }, // stays until done
    { icon: CheckCircle2, label: 'Validando campos extraídos...',   duration: 0    },
    { icon: Zap,          label: 'Preparando formulario...',        duration: 0    },
];

export const SimulatorSkeleton = () => {
    const [phase, setPhase] = useState(0);

    useEffect(() => {
        const timers: ReturnType<typeof setTimeout>[] = [];
        let elapsed = 0;
        for (let i = 0; i < PHASES.length - 1; i++) {
            const d = PHASES[i].duration;
            if (d === 0) break;
            elapsed += d;
            const idx = i + 1;
            timers.push(setTimeout(() => setPhase(idx), elapsed));
        }
        return () => timers.forEach(clearTimeout);
    }, []);

    const PhaseIcon = PHASES[phase].icon;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-4xl mx-auto relative"
        >
            {/* Overlay con fases animadas */}
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-3xl backdrop-blur-sm bg-white/40 dark:bg-slate-900/40">
                <div className="bg-white dark:bg-slate-800 px-8 py-7 rounded-2xl shadow-2xl flex flex-col items-center border border-indigo-100 dark:border-indigo-900/50 max-w-sm w-full">

                    {/* Icono animado */}
                    <div className="relative w-16 h-16 mb-5 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-t-2 border-indigo-400 animate-spin" />
                        <div className="absolute inset-2 rounded-full border-r-2 border-teal-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={phase}
                                initial={{ opacity: 0, scale: 0.6 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.6 }}
                                transition={{ duration: 0.2 }}
                            >
                                <PhaseIcon className="w-6 h-6 text-indigo-500" />
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Texto de fase */}
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 text-center">
                        Analizando Factura
                    </h3>
                    <AnimatePresence mode="wait">
                        <motion.p
                            key={phase}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.25 }}
                            className="text-sm text-slate-500 dark:text-slate-400 text-center mb-5"
                        >
                            {PHASES[phase].label}
                        </motion.p>
                    </AnimatePresence>

                    {/* Stepper de fases */}
                    <div className="flex items-center gap-1.5">
                        {PHASES.map((p, i) => {
                            const StepIcon = p.icon;
                            const done = i < phase;
                            const active = i === phase;
                            return (
                                <React.Fragment key={i}>
                                    <motion.div
                                        animate={active ? { scale: [1, 1.15, 1] } : {}}
                                        transition={{ duration: 0.8, repeat: Infinity }}
                                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                                            done    ? 'bg-emerald-500 text-white'
                                            : active ? 'bg-indigo-500 text-white'
                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                                        }`}
                                        title={p.label}
                                    >
                                        <StepIcon size={12} />
                                    </motion.div>
                                    {i < PHASES.length - 1 && (
                                        <div className={`h-px flex-1 w-4 transition-colors ${done ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>

                </div>
            </div>

            {/* Skeleton de fondo (borroso) */}
            <div className="opacity-40 blur-[2px] pointer-events-none">
                <div className="flex items-center justify-between mb-6">
                    <div className="w-32 h-4 bg-slate-200 rounded animate-pulse" />
                    <div className="text-right">
                        <div className="w-40 h-6 bg-slate-200 rounded mb-2 ml-auto animate-pulse" />
                        <div className="w-24 h-3 bg-slate-200 rounded ml-auto animate-pulse" />
                    </div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-6 flex justify-center gap-4">
                    <div className="w-12 h-12 bg-slate-200 rounded-full animate-pulse" />
                    <div className="space-y-2">
                        <div className="w-32 h-3 bg-slate-200 rounded animate-pulse" />
                        <div className="w-24 h-8 bg-slate-200 rounded animate-pulse" />
                    </div>
                </div>
                <div className="bg-white/50 rounded-2xl border border-white/50 p-6 mb-4">
                    <div className="w-40 h-4 bg-slate-200 rounded mb-4 animate-pulse" />
                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                            <div key={i} className="space-y-2">
                                <div className="w-20 h-2 bg-slate-200 rounded animate-pulse" />
                                <div className="w-full h-10 bg-slate-100 rounded animate-pulse" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {[1, 2].map((i) => (
                        <div key={i} className="bg-white/50 rounded-2xl border border-white/50 p-6">
                            <div className="w-32 h-4 bg-slate-200 rounded mb-4 animate-pulse" />
                            <div className="grid grid-cols-3 gap-2">
                                {[1, 2, 3, 4, 5, 6].map((j) => (
                                    <div key={j} className="space-y-1">
                                        <div className="w-8 h-2 bg-slate-200 rounded mx-auto animate-pulse" />
                                        <div className="w-full h-8 bg-slate-100 rounded animate-pulse" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end">
                    <div className="w-48 h-14 bg-emerald-100/50 rounded-2xl animate-pulse" />
                </div>
            </div>
        </motion.div>
    );
};
