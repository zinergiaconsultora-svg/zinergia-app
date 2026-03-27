'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getOcrJobHistory, retryOcrJob, type OcrJobRecord } from '@/app/actions/ocr-jobs';
import { RefreshCw, CheckCircle2, XCircle, Loader2, FileText, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG = {
    processing: {
        icon: Loader2,
        label: 'Procesando',
        color: 'text-amber-500',
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        animate: true,
    },
    completed: {
        icon: CheckCircle2,
        label: 'Completado',
        color: 'text-emerald-500',
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        animate: false,
    },
    failed: {
        icon: XCircle,
        label: 'Fallido',
        color: 'text-red-500',
        bg: 'bg-red-50 dark:bg-red-900/20',
        animate: false,
    },
} as const;

export default function OcrJobsPanel() {
    const [jobs, setJobs] = useState<OcrJobRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [retrying, setRetrying] = useState<string | null>(null);

    const fetchJobs = useCallback(async () => {
        try {
            const data = await getOcrJobHistory(15);
            setJobs(data);
        } catch (err) {
            console.error('Error fetching OCR jobs:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchJobs(); }, [fetchJobs]);

    // Poll para jobs en processing cada 5s
    useEffect(() => {
        const hasProcessing = jobs.some(j => j.status === 'processing');
        if (!hasProcessing) return;

        const interval = setInterval(fetchJobs, 5000);
        return () => clearInterval(interval);
    }, [jobs, fetchJobs]);

    const handleRetry = useCallback(async (jobId: string) => {
        setRetrying(jobId);
        try {
            const result = await retryOcrJob(jobId);
            if (result.success) {
                toast.success('Job re-encolado correctamente');
                await fetchJobs();
            } else {
                toast.error(result.message);
            }
        } catch {
            toast.error('Error al reintentar el job');
        } finally {
            setRetrying(null);
        }
    }, [fetchJobs]);

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    if (loading) {
        return (
            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-slate-700/40 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <FileText size={18} className="text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Jobs OCR</h3>
                </div>
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-14 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-white/40 dark:border-slate-700/40 p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <FileText size={18} className="text-indigo-500" />
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Historial OCR</h3>
                </div>
                <button
                    onClick={fetchJobs}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    title="Actualizar"
                >
                    <RefreshCw size={14} />
                </button>
            </div>

            {jobs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No hay jobs de OCR registrados</p>
            ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {jobs.map(job => {
                        const config = STATUS_CONFIG[job.status];
                        const Icon = config.icon;
                        const clientName = job.extracted_data?.client_name as string | undefined;

                        return (
                            <div
                                key={job.id}
                                className={`flex items-center gap-3 p-3 rounded-xl ${config.bg} border border-slate-100 dark:border-slate-700/50`}
                            >
                                <Icon
                                    size={18}
                                    className={`${config.color} shrink-0 ${config.animate ? 'animate-spin' : ''}`}
                                />

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                                            {job.file_name || 'Sin nombre'}
                                        </span>
                                        <span className={`text-[10px] font-medium ${config.color}`}>
                                            {config.label}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                        {formatDate(job.created_at)}
                                        {clientName && (
                                            <span className="ml-2 text-emerald-500">→ {clientName}</span>
                                        )}
                                        {job.error_message && (
                                            <span className="ml-2 text-red-400 truncate" title={job.error_message}>
                                                ⚠ {job.error_message.slice(0, 60)}
                                            </span>
                                        )}
                                        {(job.attempts ?? 0) > 1 && (
                                            <span className="ml-2 text-amber-400">({job.attempts} intentos)</span>
                                        )}
                                    </div>
                                </div>

                                {/* Retry button for failed jobs */}
                                {job.status === 'failed' && (
                                    <button
                                        onClick={() => handleRetry(job.id)}
                                        disabled={retrying === job.id}
                                        className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors shrink-0"
                                        title="Reintentar"
                                    >
                                        {retrying === job.id ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <RotateCcw size={14} />
                                        )}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
