'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getOcrJobsByClient, type OcrJobRecord } from '@/app/actions/ocr-jobs';
import { detectAnomalies } from '@/lib/anomalyDetector';
import { AnomalySummaryBadge, AnomalyPanel } from '@/components/AnomalyPanel';
import { InvoiceData } from '@/types/crm';
import { Receipt, ChevronDown, ChevronUp, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface InvoiceRow {
    job: OcrJobRecord;
    data: InvoiceData;
    anomalies: ReturnType<typeof detectAnomalies>;
}

// Mini sparkline de barras — SVG inline, sin dependencias
function SparkBars({ values }: { values: number[] }) {
    if (values.length < 2) return null;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const W = 80;
    const H = 28;
    const gap = 3;
    const barW = Math.max(4, (W - gap * (values.length - 1)) / values.length);

    return (
        <svg width={W} height={H} className="shrink-0">
            {values.map((v, i) => {
                const h = Math.max(3, ((v - min) / range) * (H - 4) + 3);
                const x = i * (barW + gap);
                const isLast = i === values.length - 1;
                return (
                    <rect
                        key={i}
                        x={x}
                        y={H - h}
                        width={barW}
                        height={h}
                        rx={2}
                        className={isLast ? 'fill-indigo-500' : 'fill-slate-200'}
                    />
                );
            })}
        </svg>
    );
}

function TrendBadge({ values }: { values: number[] }) {
    if (values.length < 2) return null;
    const last = values[values.length - 1];
    const prev = values[values.length - 2];
    const pct = ((last - prev) / prev) * 100;
    if (Math.abs(pct) < 1) {
        return <span className="flex items-center gap-0.5 text-[10px] text-slate-400"><Minus size={10} /> sin cambio</span>;
    }
    const up = pct > 0;
    return (
        <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${up ? 'text-red-500' : 'text-emerald-500'}`}>
            {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {up ? '+' : ''}{pct.toFixed(0)}%
        </span>
    );
}

export default function InvoiceHistoryPanel({ clientId }: { clientId: string }) {
    const router = useRouter();
    const [rows, setRows] = useState<InvoiceRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const jobs = await getOcrJobsByClient(clientId);
            setRows(
                jobs
                    .filter(j => j.extracted_data)
                    .map(j => {
                        const data = { ...j.extracted_data } as unknown as InvoiceData;
                        return { job: j, data, anomalies: detectAnomalies(data) };
                    })
            );
        } catch {
            // silencioso — la sección simplemente no aparece
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => { load(); }, [load]);

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                    <Receipt size={18} className="text-slate-300" />
                    <h3 className="text-lg font-medium text-slate-900">Historial de Facturas</h3>
                </div>
                <div className="space-y-2">
                    {[1, 2].map(i => (
                        <div key={i} className="h-14 bg-white/40 rounded-[1.5rem] animate-pulse border border-white/60" />
                    ))}
                </div>
            </div>
        );
    }

    if (rows.length === 0) return null;

    const amounts = rows
        .map(r => r.data.total_amount)
        .filter((v): v is number => typeof v === 'number')
        .reverse(); // cronológico

    const handleComparar = (data: InvoiceData) => {
        const payload = { ...data } as Record<string, unknown>;
        delete payload._confidence;
        sessionStorage.setItem('pendingInvoiceData', JSON.stringify({ data: payload, isMock: false }));
        router.push('/dashboard/comparator');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                    <Receipt size={18} className="text-indigo-500" />
                    <h3 className="text-lg font-medium text-slate-900">Historial de Facturas</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                        {rows.length} analizada{rows.length > 1 ? 's' : ''}
                    </span>
                </div>

                {/* Sparkline + tendencia (si ≥2 facturas) */}
                {amounts.length >= 2 && (
                    <div className="flex items-center gap-2">
                        <TrendBadge values={amounts} />
                        <SparkBars values={amounts} />
                    </div>
                )}
            </div>

            <div className="space-y-2">
                {rows.map(({ job, data, anomalies }) => {
                    const isOpen = expanded === job.id;
                    const invoiceDate = data.invoice_date
                        ? new Date(data.invoice_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
                        : new Date(job.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
                    const hasCritical = anomalies.some(a => a.severity === 'critical');

                    return (
                        <div
                            key={job.id}
                            className={`bg-white/60 backdrop-blur-xl border rounded-[1.75rem] overflow-hidden transition-all ${hasCritical ? 'border-red-100' : 'border-white/60'}`}
                        >
                            {/* Fila colapsada */}
                            <button
                                type="button"
                                onClick={() => setExpanded(isOpen ? null : job.id)}
                                className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/40 transition-colors"
                            >
                                {/* Fecha + archivo */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-semibold text-slate-700">{invoiceDate}</span>
                                        {data.tariff_name && (
                                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{data.tariff_name}</span>
                                        )}
                                        <AnomalySummaryBadge anomalies={anomalies} />
                                    </div>
                                    {data.period_days && (
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                            {data.period_days} días · {job.file_name || 'factura'}
                                        </p>
                                    )}
                                </div>

                                {/* Importe */}
                                {data.total_amount != null && (
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-bold text-slate-800">
                                            {data.total_amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                                        </p>
                                        <p className="text-[9px] text-slate-400 uppercase tracking-wider">total</p>
                                    </div>
                                )}

                                <div className="shrink-0 text-slate-400">
                                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                            </button>

                            {/* Panel expandido */}
                            {isOpen && (
                                <div className="px-4 pb-4 space-y-3 border-t border-slate-100/60">
                                    {/* Campos clave */}
                                    <div className="pt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                                        {[
                                            { label: 'Titular', value: data.client_name },
                                            { label: 'CUPS', value: data.cups, mono: true },
                                            { label: 'Comercializadora', value: data.company_name },
                                            { label: 'Potencia P1', value: data.power_p1 != null ? `${data.power_p1} kW` : null },
                                            { label: 'Energía P1', value: data.energy_p1 != null ? `${data.energy_p1.toLocaleString('es-ES')} kWh` : null },
                                            { label: 'Subtotal', value: data.subtotal != null ? `${data.subtotal.toFixed(2)}€` : null },
                                        ].filter(f => f.value).map(({ label, value, mono }) => (
                                            <div key={label}>
                                                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
                                                <p className={`text-xs text-slate-700 ${mono ? 'font-mono' : 'font-medium'}`}>{value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Anomalías */}
                                    <AnomalyPanel anomalies={anomalies} compact />

                                    {/* Acción */}
                                    <button
                                        type="button"
                                        onClick={() => handleComparar(data)}
                                        className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors"
                                    >
                                        Cargar en comparador
                                        <ArrowRight size={12} />
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
