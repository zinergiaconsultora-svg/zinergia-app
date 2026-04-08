'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BrainCircuit, TrendingUp, AlertTriangle } from 'lucide-react';
import type { OcrCompanyStats } from '@/app/actions/ocr-confirm';

const FIELD_LABELS: Record<string, string> = {
    client_name: 'Titular', dni_cif: 'CIF/DNI', company_name: 'Comercializadora',
    invoice_number: 'Nº Factura', cups: 'CUPS', supply_address: 'Dirección',
    invoice_date: 'Fecha', tariff_name: 'Tarifa',
};

function ConfBar({ value, colorClass }: { value: number; colorClass: string }) {
    return (
        <div className="flex items-center gap-2 min-w-0">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(value * 100)}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={`h-full rounded-full ${colorClass}`}
                />
            </div>
            <span className="text-[10px] font-black tabular-nums text-slate-500 w-8 text-right">
                {Math.round(value * 100)}%
            </span>
        </div>
    );
}

export default function OcrAccuracyPanel() {
    const [stats, setStats] = useState<OcrCompanyStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        import('@/app/actions/ocr-confirm').then(({ getOcrAccuracyStats }) => {
            getOcrAccuracyStats()
                .then(data => { setStats(data); setLoading(false); })
                .catch(() => setLoading(false));
        });
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (stats.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400 gap-2">
                <BrainCircuit size={28} className="opacity-40" />
                <p className="text-sm font-medium">Sin ejemplos de entrenamiento todavía</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[560px]">
                <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                        <th className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 pr-4">Comercializadora</th>
                        <th className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 pr-4 text-center">Ejemplos</th>
                        <th className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 pr-4 w-36">Confianza OCR</th>
                        <th className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2 pr-4 w-36">Tasa corrección</th>
                        <th className="text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2">Campo más corregido</th>
                    </tr>
                </thead>
                <tbody>
                    {stats.map((row, i) => {
                        const confColor = row.avg_confidence >= 0.9
                            ? 'bg-emerald-500' : row.avg_confidence >= 0.7
                            ? 'bg-amber-400' : 'bg-red-400';
                        const corrColor = row.correction_rate <= 0.1
                            ? 'bg-emerald-500' : row.correction_rate <= 0.3
                            ? 'bg-amber-400' : 'bg-red-400';
                        return (
                            <motion.tr
                                key={row.company_name}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                            >
                                <td className="py-2.5 pr-4">
                                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{row.company_name}</span>
                                </td>
                                <td className="py-2.5 pr-4 text-center">
                                    <span className="text-xs font-black text-slate-600 dark:text-slate-300 tabular-nums">{row.total_examples}</span>
                                    {row.validated_count > 0 && (
                                        <span className="ml-1 text-[9px] text-emerald-600 font-bold">({row.validated_count} val.)</span>
                                    )}
                                </td>
                                <td className="py-2.5 pr-4">
                                    {row.avg_confidence > 0
                                        ? <ConfBar value={row.avg_confidence} colorClass={confColor} />
                                        : <span className="text-[10px] text-slate-300">—</span>
                                    }
                                </td>
                                <td className="py-2.5 pr-4">
                                    <ConfBar value={row.correction_rate} colorClass={corrColor} />
                                </td>
                                <td className="py-2.5">
                                    {row.most_corrected_field ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                                            <AlertTriangle size={9} />
                                            {FIELD_LABELS[row.most_corrected_field] ?? row.most_corrected_field}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                            <TrendingUp size={9} />
                                            Sin correcciones
                                        </span>
                                    )}
                                </td>
                            </motion.tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
