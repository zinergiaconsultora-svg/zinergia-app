'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getForecastAction, type ForecastResult } from '@/app/actions/forecast';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { TrendingUp, Lock, Sparkles, Calendar, ArrowRight, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/utils/format';

function KpiCard({ label, value, sub, icon: Icon, color }: {
    label: string;
    value: string;
    sub?: string;
    icon: React.ElementType;
    color: string;
}) {
    return (
        <div className={`bg-white rounded-2xl border p-5 flex items-start gap-4 shadow-sm ${color}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color.replace('border-', 'bg-').replace('-200', '-100')}`}>
                <Icon size={18} className={color.replace('border-', 'text-').replace('-200', '-600')} />
            </div>
            <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
                {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

const PROBABILITY_LABEL: Record<number, { label: string; color: string }> = {
    0.4: { label: 'Alta', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    0.3: { label: 'Media', color: 'text-amber-600 bg-amber-50 border-amber-200' },
    0.2: { label: 'Baja', color: 'text-slate-500 bg-slate-50 border-slate-200' },
    0.1: { label: 'Baja', color: 'text-slate-400 bg-slate-50 border-slate-200' },
    1: { label: 'Ganada', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
};

function ProbabilityBadge({ prob }: { prob: number }) {
    const cfg = PROBABILITY_LABEL[prob] ?? { label: `${Math.round(prob * 100)}%`, color: 'text-slate-500 bg-slate-50 border-slate-200' };
    return (
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${cfg.color}`}>
            {cfg.label}
        </span>
    );
}

// Custom tooltip for the chart
function CustomTooltip({ active, payload, label }: {
    active?: boolean;
    payload?: { value: number; name: string }[];
    label?: string;
}) {
    if (!active || !payload?.length) return null;
    const actual = payload.find(p => p.name === 'actual')?.value ?? 0;
    const projected = payload.find(p => p.name === 'projected')?.value ?? 0;
    const value = actual || projected;
    const isProj = projected > 0;

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
            <p className="font-semibold text-slate-700 mb-1">{label}</p>
            <p className={`font-bold ${isProj ? 'text-indigo-500' : 'text-emerald-600'}`}>
                {isProj ? '~' : ''}{formatCurrency(value)}
                <span className="text-slate-400 font-normal ml-1">{isProj ? 'estimado' : 'real'}</span>
            </p>
        </div>
    );
}

export default function ForecastView() {
    const router = useRouter();
    const [data, setData] = useState<ForecastResult | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getForecastAction().then(setData).catch(console.error).finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="space-y-6 max-w-5xl mx-auto px-4 py-8">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
                ))}
            </div>
        );
    }

    if (!data) return null;

    const { chart, kpis, pipeline, agent_rate } = data;

    return (
        <div className="space-y-8 max-w-5xl mx-auto px-4 sm:px-6 py-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-1">Forecast de Ingresos</h1>
                <p className="text-slate-500 text-sm">
                    Proyección basada en tu pipeline activo · comisión estimada {Math.round(agent_rate * 100)}% del ahorro anual
                </p>
            </div>

            {/* KPI Cards */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
                <KpiCard
                    label="Ingreso garantizado"
                    value={formatCurrency(kpis.secured)}
                    sub="Comisiones aprobadas"
                    icon={Lock}
                    color="border-emerald-200"
                />
                <KpiCard
                    label="Estimado pipeline"
                    value={formatCurrency(kpis.estimated)}
                    sub="Ajustado por probabilidad"
                    icon={Sparkles}
                    color="border-indigo-200"
                />
                <KpiCard
                    label="Próximo mes"
                    value={formatCurrency(kpis.next_month)}
                    sub="Estimación conservadora"
                    icon={Calendar}
                    color="border-amber-200"
                />
                <KpiCard
                    label="Conv. (30d)"
                    value={`${kpis.conversion_rate}%`}
                    sub="Propuestas aceptadas"
                    icon={TrendingUp}
                    color="border-slate-200"
                />
            </motion.div>

            {/* Chart */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
            >
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-sm font-bold text-slate-800">Ingresos reales vs proyectados</h2>
                        <p className="text-[11px] text-slate-400 mt-0.5">Últimos 6 meses + próximos 3 meses estimados</p>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-semibold text-slate-500">
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded bg-emerald-400 inline-block" />
                            Real
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded bg-indigo-300 inline-block" />
                            Estimado
                        </span>
                    </div>
                </div>
                <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chart} barSize={28} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis
                                dataKey="month"
                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(0)}k`}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                            <ReferenceLine
                                x={chart.find(c => c.isProjection)?.month}
                                stroke="#e2e8f0"
                                strokeDasharray="4 4"
                                label={{ value: 'Hoy', position: 'top', fontSize: 9, fill: '#94a3b8' }}
                            />
                            <Bar dataKey="actual" name="actual" radius={[6, 6, 0, 0]}>
                                {chart.map((entry, i) => (
                                    <Cell key={i} fill={entry.isProjection ? '#c7d2fe' : '#34d399'} />
                                ))}
                            </Bar>
                            <Bar dataKey="projected" name="projected" radius={[6, 6, 0, 0]}>
                                {chart.map((entry, i) => (
                                    <Cell key={i} fill="#818cf8" fillOpacity={0.7} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </motion.div>

            {/* Pipeline Table */}
            {pipeline.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                >
                    <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-bold text-slate-800">Pipeline activo</h2>
                            <p className="text-[11px] text-slate-400 mt-0.5">Propuestas en proceso y su comisión estimada</p>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            <Info size={11} />
                            Ajustado por probabilidad de cierre
                        </div>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {pipeline.map(item => (
                            <div
                                key={item.id}
                                onClick={() => router.push(`/dashboard/proposals/${item.id}`)}
                                className="flex items-center gap-4 px-4 sm:px-6 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors group"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                                            {item.client_name}
                                        </span>
                                        <ProbabilityBadge prob={item.probability} />
                                        {item.days_sent !== null && (
                                            <span className="text-[10px] text-slate-400">{item.days_sent}d enviada</span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                        Ahorro anual: {formatCurrency(item.annual_savings)}
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-sm font-bold text-indigo-600">
                                        ~{formatCurrency(item.commission_estimate)}
                                    </p>
                                    <p className="text-[9px] text-slate-400 uppercase tracking-wider">comisión est.</p>
                                </div>
                                <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0" />
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
        </div>
    );
}
