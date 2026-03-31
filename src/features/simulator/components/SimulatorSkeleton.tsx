'use client';

import React from 'react';
import { motion } from 'framer-motion';

export const SimulatorSkeleton = () => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-4xl mx-auto relative"
        >
            {/* INFORMATIVE OVERLAY TO REDUCE WAIT UNCERTAINTY */}
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-3xl backdrop-blur-sm bg-white/40 dark:bg-slate-900/40">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl flex flex-col items-center border border-indigo-100 dark:border-indigo-900/50 max-w-sm w-full animate-float-slow">
                    <div className="relative w-16 h-16 mb-4">
                        <div className="absolute inset-0 rounded-full border-t-2 border-indigo-500 animate-spin"></div>
                        <div className="absolute inset-2 rounded-full border-r-2 border-teal-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                        <svg className="absolute inset-4 text-indigo-500 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 text-center">Analizando Factura</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center animate-pulse">
                        Extrayendo datos con IA. Esto puede tardar unos segundos...
                    </p>
                </div>
            </div>

            <div className="opacity-40 blur-[2px] pointer-events-none">
                {/* Header Skeleton */}
                <div className="flex items-center justify-between mb-6">
                    <div className="w-32 h-4 bg-slate-200 rounded animate-pulse" />
                    <div className="text-right">
                        <div className="w-40 h-6 bg-slate-200 rounded mb-2 ml-auto animate-pulse" />
                        <div className="w-24 h-3 bg-slate-200 rounded ml-auto animate-pulse" />
                    </div>
                </div>

                {/* Power Type Badge Skeleton */}
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-6 flex justify-center gap-4">
                    <div className="w-12 h-12 bg-slate-200 rounded-full animate-pulse" />
                    <div className="space-y-2">
                        <div className="w-32 h-3 bg-slate-200 rounded animate-pulse" />
                        <div className="w-24 h-8 bg-slate-200 rounded animate-pulse" />
                    </div>
                </div>

                {/* Admin Data Skeleton */}
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

                {/* Technical Data Grid Skeleton */}
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

                {/* Action Button Skeleton */}
                <div className="flex justify-end">
                    <div className="w-48 h-14 bg-emerald-100/50 rounded-2xl animate-pulse" />
                </div>
            </div>
        </motion.div>
    );
};
