'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
    isVisible: boolean;
    message: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isVisible, message }) => {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm rounded-3xl"
                >
                    <div className="text-center p-8 bg-white/90 rounded-2xl shadow-xl border border-emerald-100">
                        <div className="relative w-16 h-16 mx-auto mb-4">
                            <div className="absolute inset-0 border-4 border-emerald-100 rounded-full" />
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full shadow-lg shadow-emerald-500/20"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                            </div>
                        </div>
                        <motion.p
                            key={message}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="text-lg font-bold text-slate-800 font-display min-w-[240px]"
                        >
                            {message}
                        </motion.p>
                        <p className="text-sm text-slate-500 mt-2 font-body">
                            Esto tomará unos segundos...
                        </p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
