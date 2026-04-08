'use client';

import React from 'react';
import { Upload, XCircle, RefreshCw, Clock, WifiOff, FileX, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Diagnóstico de error ──────────────────────────────────────────────────────

interface ErrorDiagnosis {
    icon: React.ElementType;
    title: string;
    description: string;
    suggestion: string;
    severity: 'timeout' | 'rejected' | 'format' | 'generic';
}

function diagnoseError(msg: string): ErrorDiagnosis {
    const m = msg.toLowerCase();
    if (m.includes('timeout') || m.includes('5 minutos') || m.includes('no respondió')) {
        return {
            icon: Clock,
            title: 'Tiempo de espera agotado',
            description: msg,
            suggestion: 'El servicio de análisis tardó demasiado. Puede estar arrancando — inténtalo de nuevo en 30 segundos.',
            severity: 'timeout',
        };
    }
    if (m.includes('n8n') || m.includes('webhook') || m.includes('rechazó')) {
        return {
            icon: WifiOff,
            title: 'Error de conexión con el analizador',
            description: msg,
            suggestion: 'El motor OCR no está disponible. Verifica que el flujo N8N esté activo y vuelve a intentarlo.',
            severity: 'rejected',
        };
    }
    if (m.includes('pdf') || m.includes('format') || m.includes('archivo')) {
        return {
            icon: FileX,
            title: 'Formato de archivo no válido',
            description: msg,
            suggestion: 'Asegúrate de subir un archivo PDF válido. Archivos escaneados o protegidos pueden fallar.',
            severity: 'format',
        };
    }
    return {
        icon: AlertTriangle,
        title: 'Error al procesar la factura',
        description: msg,
        suggestion: 'Vuelve a intentarlo. Si el problema persiste, contacta con soporte.',
        severity: 'generic',
    };
}

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

            {/* Error de upload — diagnóstico detallado */}
            <AnimatePresence>
                {uploadError && (
                    <motion.div
                        initial={{ opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        className="mb-6"
                    >
                        {(() => {
                            const dx = diagnoseError(uploadError);
                            const DxIcon = dx.icon;
                            return (
                                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 flex gap-4">
                                    <div className="w-11 h-11 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <DxIcon className="w-5 h-5 text-red-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-bold text-red-700 text-sm">{dx.title}</h3>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-100 px-2 py-0.5 rounded shrink-0">
                                                {dx.severity === 'timeout' ? 'Timeout' : dx.severity === 'rejected' ? 'Conexión' : dx.severity === 'format' ? 'Formato' : 'Error'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-red-500 mt-1 mb-2 font-mono truncate" title={dx.description}>
                                            {dx.description.length > 120 ? dx.description.slice(0, 117) + '…' : dx.description}
                                        </p>
                                        <p className="text-xs text-red-700 font-medium flex items-center gap-1.5">
                                            <RefreshCw size={11} className="flex-shrink-0" />
                                            {dx.suggestion}
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Zona de arrastrar factura — visible también tras un error para reintentar */}
            {!isAnalyzing && (
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
