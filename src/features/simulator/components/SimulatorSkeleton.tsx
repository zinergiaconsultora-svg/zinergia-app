'use client';

import React from 'react';
import { motion } from 'framer-motion';

export const SimulatorSkeleton = () => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-4xl mx-auto"
        >
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
        </motion.div>
    );
};
