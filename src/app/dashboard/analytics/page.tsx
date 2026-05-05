'use client';

import React, { useState, useEffect } from 'react';
import {
    BarChart2,
    TrendingUp,
    Users,
    Target,
    Loader2,
    ArrowUpRight,
    ArrowDownRight,
} from 'lucide-react';
import { FunnelStep, MonthlyMetric } from '@/types/crm';
import { analyticsService } from '@/services/crm/analytics';
import { ErrorState } from '@/components/ui/ErrorState';

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    new: { label: 'Nuevos', color: 'text-blue-600', bg: 'bg-blue-500' },
    contacted: { label: 'Contactados', color: 'text-amber-600', bg: 'bg-amber-500' },
    in_process: { label: 'En proceso', color: 'text-violet-600', bg: 'bg-violet-500' },
    won: { label: 'Ganados', color: 'text-emerald-600', bg: 'bg-emerald-500' },
    lost: { label: 'Perdidos', color: 'text-red-500', bg: 'bg-red-400' },
};

function formatMonth(m: string): string {
    const [y, mm] = m.split('-');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${months[parseInt(mm) - 1]} ${y.slice(2)}`;
}

export default function AnalyticsPage() {
    const [funnel, setFunnel] = useState<FunnelStep[]>([]);
    const [monthly, setMonthly] = useState<MonthlyMetric[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [funnelData, monthlyData] = await Promise.all([
                analyticsService.getConversionFunnel(),
                analyticsService.getMonthlyMetrics(6),
            ]);
            setFunnel(funnelData);
            setMonthly(monthlyData);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al cargar las métricas');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const totalClients = funnel.reduce((s, f) => s + f.count, 0);
    const wonStep = funnel.find(f => f.status === 'won');
    const lostStep = funnel.find(f => f.status === 'lost');
    const conversionRate = wonStep?.percentage ?? 0;
    const lossRate = lostStep?.percentage ?? 0;

    const latestMonth = monthly[monthly.length - 1];
    const prevMonth = monthly[monthly.length - 2];

    const savingsTrend = latestMonth && prevMonth
        ? latestMonth.total_savings > prevMonth.total_savings
        : null;

    if (error) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <ErrorState title="Error al cargar analytics" description={error} retry={loadData} />
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
                <p className="text-sm text-slate-500 mt-1">Métricas de tu pipeline y rendimiento</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-blue-500" />
                        <div>
                            <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Total Clientes</div>
                            <div className="text-xl font-bold text-slate-900">{totalClients}</div>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                        <Target className="w-5 h-5 text-emerald-500" />
                        <div>
                            <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Conversión</div>
                            <div className="text-xl font-bold text-slate-900">{conversionRate.toFixed(1)}%</div>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                        <TrendingUp className="w-5 h-5 text-emerald-600" />
                        <div>
                            <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Ahorro Total</div>
                            <div className="text-xl font-bold text-slate-900">
                                {latestMonth ? `${latestMonth.total_savings.toFixed(0)}€` : '0€'}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                        <BarChart2 className="w-5 h-5 text-violet-500" />
                        <div>
                            <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Pérdida</div>
                            <div className="text-xl font-bold text-slate-900">{lossRate.toFixed(1)}%</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Funnel */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h2 className="text-sm font-bold text-slate-900 mb-5">Funnel de Conversión</h2>
                    {funnel.length === 0 ? (
                        <p className="text-center text-slate-400 text-sm py-8">Sin datos suficientes</p>
                    ) : (
                        <div className="space-y-3">
                            {funnel.map((step) => {
                                const conf = STATUS_LABELS[step.status] || { label: step.status, color: 'text-slate-600', bg: 'bg-slate-400' };
                                return (
                                    <div key={step.status}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`text-xs font-semibold ${conf.color}`}>{conf.label}</span>
                                            <span className="text-xs text-slate-500">{step.count} ({step.percentage}%)</span>
                                        </div>
                                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${conf.bg} rounded-full transition-all duration-500`}
                                                style={{ width: `${Math.max(step.percentage, 2)}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Monthly Trend */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h2 className="text-sm font-bold text-slate-900 mb-5">Tendencia Mensual</h2>
                    {monthly.length === 0 ? (
                        <p className="text-center text-slate-400 text-sm py-8">Sin datos suficientes</p>
                    ) : (
                        <div className="space-y-2">
                            <div className="grid grid-cols-6 gap-1 text-[9px] text-slate-400 font-semibold uppercase px-1">
                                <span>Mes</span>
                                <span className="text-center">Nuevos</span>
                                <span className="text-center">Ganados</span>
                                <span className="text-center">Perdidos</span>
                                <span className="text-center">Enviadas</span>
                                <span className="text-right">Ahorro</span>
                            </div>
                            {monthly.map((m) => (
                                <div key={m.month} className="grid grid-cols-6 gap-1 items-center px-1 py-2 rounded-lg hover:bg-slate-50 transition-colors text-xs">
                                    <span className="font-semibold text-slate-700">{formatMonth(m.month)}</span>
                                    <span className="text-center text-blue-600">{m.new_clients}</span>
                                    <span className="text-center text-emerald-600 font-semibold">{m.won_clients}</span>
                                    <span className="text-center text-red-500">{m.lost_clients}</span>
                                    <span className="text-center text-slate-600">{m.proposals_sent}</span>
                                    <span className="text-right text-emerald-700 font-semibold">
                                        {m.total_savings > 0 ? `${m.total_savings.toFixed(0)}€` : '—'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {latestMonth && prevMonth && (
                        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                                {savingsTrend ? (
                                    <ArrowUpRight size={14} className="text-emerald-500" />
                                ) : (
                                    <ArrowDownRight size={14} className="text-red-400" />
                                )}
                                <span className="text-[10px] text-slate-500">
                                    Ahorro vs mes anterior: {savingsTrend ? '+' : ''}
                                    {prevMonth.total_savings > 0
                                        ? `${(((latestMonth.total_savings - prevMonth.total_savings) / prevMonth.total_savings) * 100).toFixed(0)}%`
                                        : 'N/A'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
