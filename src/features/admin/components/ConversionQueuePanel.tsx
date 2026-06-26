'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getConversionQueue, type ConversionOpportunity } from '@/app/actions/conversion-queue';
import { ArrowRight, RefreshCw, Clock, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';

function priorityConfig(annualEstimate: number) {
    if (annualEstimate >= 2400)
        return { dot: 'bg-rose-500', ring: 'border-rose-200 hover:border-rose-400', badge: 'bg-rose-50 text-rose-700 border-rose-200' };
    if (annualEstimate >= 800)
        return { dot: 'bg-amber-400', ring: 'border-amber-200 hover:border-amber-400', badge: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { dot: 'bg-slate-300', ring: 'border-slate-100 hover:border-slate-300', badge: 'bg-slate-50 text-slate-600 border-slate-200' };
}

export default function ConversionQueuePanel() {
    const router = useRouter();
    const [opps, setOpps] = useState<ConversionOpportunity[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getConversionQueue(30);
            setOpps(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    function handleAnalyze(opp: ConversionOpportunity) {
        const payload = { ...opp.extractedData };
        delete payload._confidence;
        sessionStorage.setItem('pendingInvoiceData', JSON.stringify({ data: payload, isMock: false }));
        router.push('/dashboard/comparator');
    }

    if (loading) {
        return (
            <div className="space-y-2">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-12 bg-slate-100/80 dark:bg-slate-700/30 rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    if (opps.length === 0) {
        return (
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50/60 border border-emerald-100 px-4 py-3.5">
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                <div>
                    <p className="text-sm font-semibold text-slate-700">Cola vacía</p>
                    <p className="text-xs text-slate-400">Todas las facturas analizadas tienen propuesta asignada.</p>
                </div>
            </div>
        );
    }

    const totalAnnual = opps.reduce((s, o) => s + o.annualEstimate, 0);
    const highPriority = opps.filter(o => o.annualEstimate >= 2400).length;

    return (
        <div className="flex flex-col gap-3">
            {/* Strip resumen */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="text-center">
                        <span className="text-2xl font-black text-slate-800">{opps.length}</span>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold leading-tight">pendientes</p>
                    </div>
                    <div className="w-px h-8 bg-slate-100" />
                    <div className="text-center">
                        <span className="text-2xl font-black text-indigo-600">{formatCurrency(totalAnnual)}</span>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold leading-tight">facturación/año</p>
                    </div>
                    {highPriority > 0 && (
                        <>
                            <div className="w-px h-8 bg-slate-100" />
                            <div className="text-center">
                                <span className="text-2xl font-black text-rose-500">{highPriority}</span>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold leading-tight">alta prioridad</p>
                            </div>
                        </>
                    )}
                </div>
                <button
                    type="button"
                    onClick={load}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    title="Actualizar"
                >
                    <RefreshCw size={14} />
                </button>
            </div>

            {/* Lista de oportunidades */}
            <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-0.5">
                {opps.map((opp) => {
                    const { dot, ring, badge } = priorityConfig(opp.annualEstimate);
                    return (
                        <div
                            key={opp.jobId}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800/50 border ${ring} transition-all group cursor-default`}
                        >
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                                        {opp.clientName}
                                    </span>
                                    <span className={`text-[10px] font-bold px-1.5 py-px rounded border shrink-0 ${badge}`}>
                                        {opp.currentTariff}
                                    </span>
                                    {opp.daysAgo === 0 && (
                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-px shrink-0">
                                            <Clock size={8} /> Hoy
                                        </span>
                                    )}
                                    {opp.daysAgo >= 14 && (
                                        <span className="text-[10px] text-amber-500 font-medium shrink-0">{opp.daysAgo}d sin procesar</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    {opp.agentName && (
                                        <span className="text-[11px] text-slate-400 truncate">{opp.agentName}</span>
                                    )}
                                    <span className="text-[10px] text-slate-200 dark:text-slate-600">·</span>
                                    <span className="text-[10px] font-mono text-slate-400 truncate">{opp.cups.slice(0, 22)}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {opp.annualEstimate > 0 && (
                                    <div className="text-right hidden sm:block">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                            {formatCurrency(opp.annualEstimate)}
                                        </span>
                                        <span className="text-[9px] text-slate-400 block leading-none">/año</span>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => handleAnalyze(opp)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors whitespace-nowrap"
                                >
                                    Analizar <ArrowRight size={12} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
