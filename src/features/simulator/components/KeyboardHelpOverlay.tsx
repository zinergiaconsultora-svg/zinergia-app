'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';
import { SHORTCUTS } from '../hooks/useKeyboardNav';

interface KeyboardHelpOverlayProps {
    show: boolean;
    onClose: () => void;
}

export function KeyboardHelpOverlay({ show, onClose }: KeyboardHelpOverlayProps) {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={e => e.stopPropagation()}
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-sm mx-4"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Keyboard size={16} className="text-slate-500" />
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Atajos de teclado</h3>
                            </div>
                            <button type="button" onClick={onClose}
                                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <X size={14} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="space-y-2">
                            {SHORTCUTS.map((s, i) => (
                                <div key={i} className="flex items-center justify-between py-1.5">
                                    <span className="text-xs text-slate-600 dark:text-slate-400">{s.desc}</span>
                                    <div className="flex items-center gap-1">
                                        {s.keys.map((k, j) => (
                                            <React.Fragment key={j}>
                                                {j > 0 && <span className="text-[9px] text-slate-300">+</span>}
                                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-sm">
                                                    {k}
                                                </kbd>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export function KeyboardHint() {
    return (
        <div className="fixed bottom-4 right-4 z-40">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 dark:bg-slate-100/80 text-white dark:text-slate-900 text-[10px] font-bold backdrop-blur-sm shadow-lg">
                <Keyboard size={11} />
                <span>Atajos activos</span>
                <kbd className="px-1 py-px text-[9px] font-mono bg-white/20 dark:bg-black/20 rounded">?</kbd>
            </div>
        </div>
    );
}
