'use client';

import React from 'react';
import { Upload, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SimulatorUploadProps {
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    isAnalyzing: boolean;
    uploadError: string | null;
}

export const SimulatorUpload: React.FC<SimulatorUploadProps> = ({
    onFileUpload,
    onDrop,
    onDragOver,
    isAnalyzing,
    uploadError
}) => {
    return (
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
                    onDrop={onDrop}
                    onDragOver={onDragOver}
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
                                onChange={onFileUpload}
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
    );
};
