'use client';

import React, { useMemo } from 'react';
import { EnergyStage, ENERGY_STAGES, ENERGY_PIPELINE_ORDER, type ClientEnergyData } from '@/types/energy';
import { FileSearch, Send, FileSignature, ArrowRightLeft, CheckCircle2, RefreshCw, UserPlus, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';

const STAGE_ICONS: Record<string, React.ElementType> = {
    UserPlus, FileSearch, Send, FileSignature, ArrowRightLeft, CheckCircle2, RefreshCw,
};

interface Props {
    energyData: ClientEnergyData[];
    onRefresh: () => void;
}

const euroFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
});

function daysSince(dateStr?: string): number {
    if (!dateStr) return 0;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

export default function EnergyPipelineView({ energyData }: Props) {
    const router = useRouter();

    const grouped = useMemo(() => {
        const map = new Map<EnergyStage, ClientEnergyData[]>();
        ENERGY_PIPELINE_ORDER.forEach(s => map.set(s, []));
        for (const item of energyData) {
            const list = map.get(item.energyStage);
            if (list) list.push(item);
        }
        return map;
    }, [energyData]);

    return (
        <div className="flex gap-3 overflow-x-auto pb-8 pt-2 snap-x px-2">
            {ENERGY_PIPELINE_ORDER.map(stage => {
                const config = ENERGY_STAGES[stage];
                const items = grouped.get(stage) ?? [];
                const Icon = STAGE_ICONS[config.icon] ?? UserPlus;
                const columnValue = items.reduce((sum, c) => sum + (c.averageMonthlyBill || 0), 0);

                return (
                    <div
                        key={stage}
                        className="flex-1 min-w-[240px] max-w-[290px] shrink-0 flex flex-col snap-start"
                    >
                        {/* Column header */}
                        <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200/60 dark:border-slate-800">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${config.bg}`}>
                                    <Icon size={12} className={config.color} strokeWidth={2.5} />
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                                    {config.label}
                                </span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                                {items.length}
                            </span>
                        </div>
                        {columnValue > 0 && (
                            <div className="mb-2 text-[10px] font-semibold text-slate-400">
                                {euroFormatter.format(columnValue)}/mes
                            </div>
                        )}

                        {/* Cards */}
                        <div className="flex flex-col gap-2 min-h-[400px]">
                            {items.length === 0 ? (
                                <div className="h-20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 text-[10px] font-medium">
                                    —
                                </div>
                            ) : items.map(item => {
                                const days = daysSince(item.updatedAt);
                                const isUrgent = days >= 7 && stage !== 'activa';

                                return (
                                    <div
                                        key={item.clientId}
                                        onClick={() => router.push(`/dashboard/clients/${item.clientId}`)}
                                        className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm border cursor-pointer hover:shadow-md hover:-translate-y-[1px] transition-all duration-200 group flex flex-col gap-1.5 relative overflow-hidden ${
                                            isUrgent
                                                ? 'border-red-200 dark:border-red-800/50'
                                                : 'border-slate-200/70 dark:border-slate-800 hover:border-indigo-300/50 dark:hover:border-indigo-500/50'
                                        }`}
                                    >
                                        {isUrgent && <div className="h-0.5 w-full bg-red-400" />}

                                        <div className="px-3 pb-2.5 pt-2 flex flex-col gap-1.5">
                                            {/* Name + phone */}
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="text-[12px] font-semibold text-slate-800 dark:text-slate-100 leading-tight truncate flex-1 min-w-0">
                                                    {item.clientName}
                                                </div>
                                                {item.phone && (
                                                    <a
                                                        href={`tel:${item.phone}`}
                                                        onClick={e => e.stopPropagation()}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 hover:bg-emerald-100"
                                                        aria-label={`Llamar a ${item.clientName}`}
                                                    >
                                                        <Phone size={10} strokeWidth={2.5} />
                                                    </a>
                                                )}
                                            </div>

                                            {/* Tags */}
                                            <div className="flex gap-1 flex-wrap">
                                                {item.currentSupplier && (
                                                    <span className="text-[8px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-1 py-0.5 rounded truncate max-w-[90px]">
                                                        {item.currentSupplier}
                                                    </span>
                                                )}
                                                {item.cups && (
                                                    <span className="text-[8px] text-slate-400 font-mono px-1 py-0.5 rounded bg-slate-50 dark:bg-slate-800/50 truncate max-w-[70px]" title={item.cups}>
                                                        {item.cups.slice(0, 6)}…
                                                    </span>
                                                )}
                                            </div>

                                            {/* Footer */}
                                            <div className="flex justify-between items-end pt-1 border-t border-slate-100 dark:border-slate-800">
                                                {item.averageMonthlyBill ? (
                                                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                                                        {euroFormatter.format(item.averageMonthlyBill)}/mes
                                                    </span>
                                                ) : <span />}

                                                {days > 0 && stage !== 'activa' && (
                                                    <span className={`text-[8px] font-semibold ${isUrgent ? 'text-red-500' : 'text-slate-400'}`}>
                                                        {days}d
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
