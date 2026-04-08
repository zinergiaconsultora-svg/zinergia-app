'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getOcrJobHistory, retryOcrJob, type OcrJobRecord } from '@/app/actions/ocr-jobs';
import { computeExampleQualityScore } from '@/lib/utils/ocr-quality';
import { RefreshCw, CheckCircle2, XCircle, Loader2, FileText, RotateCcw, ArrowRight, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { detectAnomalies } from '@/lib/anomalyDetector';
import { AnomalySummaryBadge, AnomalyPanel } from '@/components/AnomalyPanel';
import { InvoiceData } from '@/types/crm';

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

// Campos a mostrar en el panel de confianza
const CONFIDENCE_FIELDS: { key: string; label: string }[] = [
    { key: 'client_name', label: 'Titular' },
    { key: 'cups', label: 'CUPS' },
    { key: 'dni_cif', label: 'DNI/CIF' },
    { key: 'total_amount', label: 'Total' },
    { key: 'tariff_name', label: 'Tarifa' },
    { key: 'power_p1', label: 'Potencia P1' },
    { key: 'energy_p1', label: 'Energía P1' },
];

function ConfidenceDot({ score }: { score?: number }) {
    if (score === undefined) return null;
    const color = score >= 0.85
        ? 'bg-emerald-400'
        : score >= 0.6
            ? 'bg-amber-400'
            : 'bg-red-400';
    return (
        <span
            className={`inline-block w-2 h-2 rounded-full ${color} shrink-0`}
            title={`Confianza: ${Math.round(score * 100)}%`}
        />
    );
}

function JobDetail({ job }: { job: OcrJobRecord }) {
    const router = useRouter();
    const data = job.extracted_data;
    const confidence = data?._confidence as Record<string, number> | null | undefined;
    const hasLowConfidence = confidence
        ? Object.values(confidence).some(s => s < 0.85)
        : false;

    const handleComparar = () => {
        if (!data) return;
        const invoicePayload = { ...data };
        delete invoicePayload._confidence;
        sessionStorage.setItem('pendingInvoiceData', JSON.stringify({ data: invoicePayload, isMock: false }));
        router.push('/dashboard/comparator');
    };

    if (!data) return null;

    // Detectar anomalías sobre los datos extraídos
    const invoicePayloadForAnomalies = { ...data } as unknown as InvoiceData;
    const anomalies = detectAnomalies(invoicePayloadForAnomalies);

    return (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50 space-y-1.5">
            {/* Botón comparar */}
            <button
                type="button"
                onClick={handleComparar}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            >
                Comparar tarifas
                <ArrowRight size={12} />
            </button>

            {/* Aviso de baja confianza */}
            {hasLowConfidence && (
                <p className="text-[10px] text-amber-500 flex items-center gap-1">
                    <span>⚠</span>
                    Algunos campos tienen baja confianza — verifica antes de continuar
                </p>
            )}

            {/* Panel de anomalías (modo compacto) */}
            <AnomalyPanel anomalies={anomalies} compact />

            {/* Campos con confidence scores */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {CONFIDENCE_FIELDS.map(({ key, label }) => {
                    const value = data[key];
                    const score = confidence?.[key];
                    if (!value && value !== 0) return null;
                    const isLow = score !== undefined && score < 0.85;
                    return (
                        <div key={key} className="flex items-center gap-1 min-w-0">
                            {confidence && <ConfidenceDot score={score} />}
                            <span className="text-[10px] text-slate-400 shrink-0">{label}:</span>
                            <span className={`text-[10px] truncate font-medium ${isLow ? 'text-amber-500' : 'text-slate-600 dark:text-slate-300'}`}>
                                {typeof value === 'number' ? value.toLocaleString('es-ES') : String(value)}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function OcrJobsPanel() {
    const [jobs, setJobs] = useState<OcrJobRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [retrying, setRetrying] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

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

    // Realtime: escucha cambios en ocr_jobs — sin polling
    useEffect(() => {
        const supabase = createClient();

        const channel = supabase
            .channel('ocr_jobs_realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'ocr_jobs' },
                (payload) => {
                    if (payload.eventType === 'UPDATE') {
                        const updated = payload.new as OcrJobRecord;
                        setJobs(prev =>
                            prev.map(j => j.id === updated.id ? { ...j, ...updated } : j)
                        );
                        if (updated.status === 'completed') {
                            const clientName = (updated.extracted_data as Record<string, unknown>)?.client_name as string | undefined;
                            toast.success(`OCR completado${clientName ? `: ${clientName}` : ''}`, {
                                action: {
                                    label: 'Ver',
                                    onClick: () => setExpanded(updated.id),
                                }
                            });
                        } else if (updated.status === 'failed') {
                            toast.error(`OCR fallido: ${updated.error_message || 'Error desconocido'}`);
                        }
                    } else if (payload.eventType === 'INSERT') {
                        setJobs(prev => [payload.new as OcrJobRecord, ...prev].slice(0, 15));
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

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
            <div className="bg-white/90 dark:bg-slate-900/60 backdrop-blur-2xl rounded-3xl border border-white/80 dark:border-slate-700/50 shadow-lg shadow-slate-200/50 dark:shadow-none p-5 flex flex-col h-full hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
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
        <div className="bg-white/90 dark:bg-slate-900/60 backdrop-blur-2xl rounded-3xl border border-white/80 dark:border-slate-700/50 shadow-lg shadow-slate-200/50 dark:shadow-none p-5 flex flex-col h-full hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <FileText size={18} className="text-indigo-500" />
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Historial OCR</h3>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Tiempo real activo" />
                </div>
                <button
                    type="button"
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
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {jobs.map(job => {
                        const config = STATUS_CONFIG[job.status];
                        const Icon = config.icon;
                        const clientName = job.extracted_data?.client_name as string | undefined;
                        const isExpanded = expanded === job.id;
                        const isCompleted = job.status === 'completed' && job.extracted_data;
                        const jobAnomalies = isCompleted
                            ? detectAnomalies(job.extracted_data as unknown as InvoiceData)
                            : [];

                        return (
                            <div
                                key={job.id}
                                className={`p-3 rounded-xl ${config.bg} border border-slate-100 dark:border-slate-700/50 transition-all`}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon
                                        size={18}
                                        className={`${config.color} shrink-0 ${config.animate ? 'animate-spin' : ''}`}
                                    />

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                                                {job.file_name || 'Sin nombre'}
                                            </span>
                                            <span className={`text-[10px] font-medium ${config.color} shrink-0`}>
                                                {config.label}
                                            </span>
                                            {isCompleted && (() => {
                                                const qs = computeExampleQualityScore({
                                                    extracted_fields: job.extracted_data ?? null,
                                                    is_validated: false,
                                                    corrected_fields: null,
                                                });
                                                const cls = qs >= 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                                                    : qs >= 60 ? 'text-amber-600 bg-amber-50 border-amber-200'
                                                    : 'text-red-600 bg-red-50 border-red-200';
                                                return (
                                                    <span className={`inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-px rounded border shrink-0 tabular-nums ${cls}`} title="Calidad del ejemplo de entrenamiento">
                                                        <Star size={8} />
                                                        {qs}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                            <span className="text-[10px] text-slate-400">
                                                {formatDate(job.created_at)}
                                                {clientName && clientName !== 'Cliente Desconocido' && (
                                                    <span className="ml-2 text-emerald-500 font-medium">→ {clientName}</span>
                                                )}
                                                {job.error_message && (
                                                    <span className="ml-2 text-red-400 truncate" title={job.error_message}>
                                                        ⚠ {job.error_message.slice(0, 60)}
                                                    </span>
                                                )}
                                                {(job.attempts ?? 0) > 1 && (
                                                    <span className="ml-2 text-amber-400">({job.attempts} intentos)</span>
                                                )}
                                            </span>
                                            {!isExpanded && <AnomalySummaryBadge anomalies={jobAnomalies} />}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                        {/* Expandir para ver detalle + confidence */}
                                        {isCompleted && (
                                            <button
                                                type="button"
                                                onClick={() => setExpanded(isExpanded ? null : job.id)}
                                                className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                                                title={isExpanded ? 'Contraer' : 'Ver detalles'}
                                            >
                                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                        )}

                                        {/* Retry para jobs fallidos */}
                                        {job.status === 'failed' && (
                                            <button
                                                type="button"
                                                onClick={() => handleRetry(job.id)}
                                                disabled={retrying === job.id}
                                                className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
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
                                </div>

                                {/* Panel expandible con datos + botón comparar */}
                                {isExpanded && isCompleted && (
                                    <JobDetail job={job} />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
