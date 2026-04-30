'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, FileText, CheckCircle2, XCircle, Loader2,
    X, ArrowRight, Layers, Trash2,
} from 'lucide-react';
import { useBatchSimulator, BatchItem } from '../hooks/useBatchSimulator';
import { InvoiceData } from '@/types/crm';

interface SimulatorBatchUploadProps {
    onLoadInvoice: (data: InvoiceData) => void;
    onExit: () => void;
}

const STATUS_CONFIG = {
    queued:     { icon: FileText,    label: 'En cola',      color: 'text-slate-400',   bg: 'bg-slate-50',   ring: 'border-slate-200' },
    uploading:  { icon: Loader2,     label: 'Subiendo…',    color: 'text-blue-500',    bg: 'bg-blue-50',    ring: 'border-blue-200' },
    processing: { icon: Loader2,     label: 'Procesando…',  color: 'text-amber-500',   bg: 'bg-amber-50',   ring: 'border-amber-200' },
    completed:  { icon: CheckCircle2,label: 'Listo',        color: 'text-emerald-500', bg: 'bg-emerald-50', ring: 'border-emerald-200' },
    failed:     { icon: XCircle,     label: 'Error',        color: 'text-red-500',     bg: 'bg-red-50',     ring: 'border-red-200' },
} as const;

function QueueRow({ item, onSimulate, onRemove }: {
    item: BatchItem;
    onSimulate: (data: InvoiceData) => void;
    onRemove: (id: string) => void;
}) {
    const cfg = STATUS_CONFIG[item.status];
    const Icon = cfg.icon;
    const spinning = item.status === 'uploading' || item.status === 'processing';
    const clientName = item.data?.client_name;
    const cups = item.data?.cups;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            className={`flex items-center gap-3 p-3 rounded-xl border ${cfg.ring} ${cfg.bg} transition-colors`}
        >
            <Icon size={18} className={`shrink-0 ${cfg.color} ${spinning ? 'animate-spin' : ''}`} />

            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{item.file.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
                    {clientName && <span className="text-[10px] text-emerald-600 font-medium truncate">→ {clientName}</span>}
                    {cups && !clientName && <span className="text-[10px] text-slate-400 font-mono truncate">{cups.slice(0, 18)}…</span>}
                    {item.error && <span className="text-[10px] text-red-500 truncate" title={item.error}>{item.error.slice(0, 50)}</span>}
                </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
                {item.status === 'completed' && item.data && (
                    <button
                        type="button"
                        onClick={() => onSimulate(item.data!)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 transition-colors"
                    >
                        Simular <ArrowRight size={10} />
                    </button>
                )}
                {(item.status === 'completed' || item.status === 'failed') && (
                    <button
                        type="button"
                        onClick={() => onRemove(item.localId)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-white transition-colors"
                        title="Eliminar"
                    >
                        <X size={13} />
                    </button>
                )}
            </div>
        </motion.div>
    );
}

export const SimulatorBatchUpload: React.FC<SimulatorBatchUploadProps> = ({ onLoadInvoice, onExit }) => {
    const { items, addFiles, removeItem, clearCompleted, pendingCount } = useBatchSimulator();
    const [isDragging, setIsDragging] = useState(false);

    const handleFiles = useCallback((files: FileList | File[]) => {
        const pdfs = Array.from(files).filter(f => f.type === 'application/pdf').slice(0, 20);
        if (pdfs.length > 0) addFiles(pdfs);
    }, [addFiles]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    const completedCount = items.filter(it => it.status === 'completed').length;
    const failedCount = items.filter(it => it.status === 'failed').length;
    const totalCount = items.length;

    return (
        <motion.div
            key="batch"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            className="max-w-2xl mx-auto"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                        <Layers size={16} className="text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">Procesamiento en lote</h3>
                        <p className="text-[10px] text-slate-400">Hasta 20 facturas simultáneas · 2 en paralelo</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onExit}
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors font-medium"
                >
                    ← Modo individual
                </button>
            </div>

            {/* Drop zone */}
            <div
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 mb-4 cursor-pointer
                    ${isDragging ? 'border-indigo-400 bg-indigo-50 scale-[1.01]' : 'border-slate-200 bg-white/70 hover:border-indigo-300 hover:bg-indigo-50/30'}`}
            >
                <label htmlFor="batch-upload" className="flex flex-col items-center gap-2 py-8 cursor-pointer">
                    <input
                        id="batch-upload"
                        type="file"
                        accept=".pdf"
                        multiple
                        className="sr-only"
                        onChange={e => e.target.files && handleFiles(e.target.files)}
                    />
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors
                        ${isDragging ? 'bg-indigo-500' : 'bg-indigo-100'}`}>
                        <Upload size={22} className={isDragging ? 'text-white' : 'text-indigo-500'} />
                    </div>
                    <p className="text-sm font-bold text-slate-700">
                        {isDragging ? 'Suelta los PDFs' : 'Arrastra varios PDFs aquí'}
                    </p>
                    <p className="text-xs text-slate-400">o haz clic para seleccionar · máx. 20 archivos</p>
                </label>
            </div>

            {/* Queue */}
            <AnimatePresence>
                {items.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-2"
                    >
                        {/* Stats bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] font-medium">
                                <span className="text-slate-500">{totalCount} archivo{totalCount !== 1 ? 's' : ''}</span>
                                {pendingCount > 0 && (
                                    <span className="flex items-center gap-1 text-amber-600">
                                        <Loader2 size={10} className="animate-spin" />
                                        {pendingCount} procesando
                                    </span>
                                )}
                                {completedCount > 0 && <span className="text-emerald-600">{completedCount} listos</span>}
                                {failedCount > 0 && <span className="text-red-500">{failedCount} fallidos</span>}
                            </div>
                            {(completedCount > 0 || failedCount > 0) && (
                                <button
                                    type="button"
                                    onClick={clearCompleted}
                                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <Trash2 size={10} /> Limpiar finalizados
                                </button>
                            )}
                        </div>

                        {/* Progress bar */}
                        {totalCount > 0 && (
                            <div className="w-full h-1 rounded-full bg-slate-100 mb-3 overflow-hidden">
                                <motion.div
                                    className="h-full bg-emerald-500 rounded-full"
                                    animate={{ width: `${(completedCount / totalCount) * 100}%` }}
                                    transition={{ duration: 0.4 }}
                                />
                            </div>
                        )}

                        {/* Item list */}
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                            <AnimatePresence initial={false}>
                                {items.map(item => (
                                    <QueueRow
                                        key={item.localId}
                                        item={item}
                                        onSimulate={onLoadInvoice}
                                        onRemove={removeItem}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>

                        {/* All done CTA */}
                        {completedCount > 0 && pendingCount === 0 && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center text-xs text-slate-400 pt-2"
                            >
                                Haz clic en <span className="font-bold text-emerald-600">Simular</span> en cualquier factura para ver la comparativa de tarifas
                            </motion.p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};
