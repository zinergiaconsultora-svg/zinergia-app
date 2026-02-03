import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4"
                    >
                        <div className="bg-white/90 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl w-full max-w-md pointer-events-auto overflow-hidden">
                            <div className="flex justify-between items-center p-6 border-b border-slate-200/50">
                                <h3 className="text-xl font-display font-semibold text-slate-900">{title}</h3>
                                <button
                                    onClick={onClose}
                                    className="p-1 rounded-full hover:bg-slate-100 transition-colors text-slate-500"
                                    aria-label="Cerrar modal"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6">
                                {children}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
