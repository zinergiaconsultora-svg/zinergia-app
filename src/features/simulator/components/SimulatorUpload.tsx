'use client';

import React, { useState } from 'react';
import {
    Upload, RefreshCw, Clock, WifiOff, FileX, AlertTriangle,
    ShieldCheck, Brain, Zap, FileText, Layers,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Error diagnosis ───────────────────────────────────────────────────────────

interface ErrorDiagnosis {
    icon: React.ElementType;
    title: string;
    description: string;
    suggestion: string;
    severity: 'timeout' | 'rejected' | 'format' | 'generic';
    badge: string;
}

function diagnoseError(msg: string): ErrorDiagnosis {
    const m = msg.toLowerCase();
    if (m.includes('timeout') || m.includes('5 minutos') || m.includes('no respondió')) {
        return { icon: Clock, title: 'Tiempo de espera agotado', description: msg, badge: 'Timeout',
            suggestion: 'El servicio OCR tardó demasiado. Puede estar arrancando — espera 30s e inténtalo de nuevo.', severity: 'timeout' };
    }
    if (m.includes('n8n') || m.includes('webhook') || m.includes('rechazó')) {
        return { icon: WifiOff, title: 'Error de conexión', description: msg, badge: 'Conexión',
            suggestion: 'El motor OCR no está disponible. Verifica que el flujo N8N esté activo.', severity: 'rejected' };
    }
    if (m.includes('pdf') || m.includes('format') || m.includes('archivo')) {
        return { icon: FileX, title: 'Formato no válido', description: msg, badge: 'Formato',
            suggestion: 'Asegúrate de subir un PDF válido. Archivos escaneados o protegidos pueden fallar.', severity: 'format' };
    }
    return { icon: AlertTriangle, title: 'Error al procesar', description: msg, badge: 'Error',
        suggestion: 'Inténtalo de nuevo. Si el problema persiste, contacta con soporte.', severity: 'generic' };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface SimulatorUploadProps {
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    isAnalyzing: boolean;
    uploadError: string | null;
    onBatchMode?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const FEATURES = [
    { icon: Brain,      label: 'Extracción inteligente',   desc: 'IA lee todos los campos' },
    { icon: ShieldCheck, label: 'Validación automática',   desc: 'Confianza campo a campo' },
    { icon: Zap,        label: 'Tarifas al instante',      desc: 'Comparativa en segundos' },
    { icon: FileText,   label: '2.0 · 3.0 · 3.1 TD',      desc: 'Todas las tarifas' },
];

export const SimulatorUpload: React.FC<SimulatorUploadProps> = ({
    onFileUpload, onDrop, onDragOver, isAnalyzing, uploadError, onBatchMode,
}) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        onDragOver(e);
        setIsDragging(true);
    };
    const handleDragLeave = () => setIsDragging(false);
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        onDrop(e);
        setIsDragging(false);
    };

    return (
        <motion.div
            key="s1"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
            className="max-w-3xl mx-auto"
        >
            {/* Error card */}
            <AnimatePresence>
                {uploadError && (
                    <motion.div
                        key="err"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="mb-5 overflow-hidden"
                    >
                        {(() => {
                            const dx = diagnoseError(uploadError);
                            const DxIcon = dx.icon;
                            return (
                                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex gap-3.5">
                                    <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                                        <DxIcon size={16} className="text-red-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-sm font-bold text-red-800">{dx.title}</span>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-red-500 bg-red-100 border border-red-200 px-1.5 py-px rounded">
                                                {dx.badge}
                                            </span>
                                        </div>
                                        <p className="text-xs text-red-500 font-mono truncate mb-1.5" title={dx.description}>
                                            {dx.description.length > 100 ? dx.description.slice(0, 97) + '…' : dx.description}
                                        </p>
                                        <p className="text-xs text-red-700 font-medium flex items-center gap-1.5">
                                            <RefreshCw size={10} className="shrink-0" />
                                            {dx.suggestion}
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Batch mode link */}
            {!isAnalyzing && onBatchMode && (
                <div className="flex justify-end mb-3">
                    <button
                        type="button"
                        onClick={onBatchMode}
                        className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-indigo-600 transition-colors font-medium"
                    >
                        <Layers size={12} />
                        Procesar varias facturas a la vez
                    </button>
                </div>
            )}

            {/* Drop zone */}
            {!isAnalyzing && (
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className="relative"
                >
                    {/* Ambient glow */}
                    <div className={`absolute inset-x-8 -bottom-4 h-16 rounded-full blur-2xl transition-all duration-500 ${
                        isDragging ? 'bg-emerald-300/60' : 'bg-emerald-200/40'
                    }`} />

                    <label
                        htmlFor="invoice-upload-simulator"
                        className={`relative flex flex-col items-center cursor-pointer rounded-3xl border-2 border-dashed transition-all duration-300 overflow-hidden
                            ${isDragging
                                ? 'border-emerald-400 bg-emerald-50/80 scale-[1.01]'
                                : uploadError
                                    ? 'border-slate-200 bg-white/60'
                                    : 'border-emerald-200 bg-white/70 hover:border-emerald-400 hover:bg-emerald-50/40'
                            }`}
                    >
                        <input
                            id="invoice-upload-simulator"
                            type="file"
                            accept=".pdf"
                            className="sr-only"
                            onChange={onFileUpload}
                            disabled={isAnalyzing}
                            aria-label="Subir factura en formato PDF"
                        />

                        {/* Top section */}
                        <div className="w-full px-8 pt-10 pb-8 flex flex-col items-center text-center">
                            {/* Icon */}
                            <motion.div
                                animate={isDragging ? { scale: 1.1, rotate: -6 } : { scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 300 }}
                                className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-lg transition-colors ${
                                    isDragging ? 'bg-emerald-500' : 'bg-gradient-to-br from-emerald-100 to-teal-100'
                                }`}
                            >
                                <Upload size={26} className={isDragging ? 'text-white' : 'text-emerald-600'} />
                            </motion.div>

                            <h3 className="text-xl font-bold text-slate-800 mb-1.5">
                                {isDragging ? 'Suelta para analizar' : uploadError ? 'Vuelve a intentarlo' : 'Arrastra tu factura aquí'}
                            </h3>
                            <p className="text-sm text-slate-500 mb-5">
                                {isDragging ? 'Listo para procesar con IA' : 'o haz clic para seleccionar un PDF'}
                            </p>

                            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-900 text-white text-xs font-bold shadow-sm">
                                <FileText size={11} />
                                Solo archivos PDF
                            </span>
                        </div>

                        {/* Divider */}
                        <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

                        {/* Feature grid */}
                        <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-y divide-slate-100">
                            {FEATURES.map((f, i) => {
                                const FIcon = f.icon;
                                return (
                                    <div key={i} className="flex flex-col items-center gap-1 px-4 py-4">
                                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center mb-1">
                                            <FIcon size={13} className="text-slate-500" />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-700 text-center leading-tight">{f.label}</span>
                                        <span className="text-[9px] text-slate-400 text-center">{f.desc}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </label>
                </div>
            )}
        </motion.div>
    );
};
