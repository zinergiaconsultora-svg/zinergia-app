'use client';

import React, { useEffect, useState } from 'react';
import { Users, TrendingUp, Target, Wallet, ArrowUpRight, Zap, Building2, BarChart3, CheckCircle2, Clock } from 'lucide-react';
import { getFranchiseOverviewAction, FranchiseOverview, AgentStat } from '@/app/actions/franchise';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { AnimatedSparkline } from '@/components/ui/AnimatedSparkline';

const FMT_EUR = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

function KpiCard({ icon, label, value, sub, color, sparklineColor, hero = false }: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    sub?: string;
    color: string;
    sparklineColor?: string;
    hero?: boolean;
}) {
    return (
        <Card variant={hero ? 'hero' : 'elevated'} interactive className="p-5">
            <div className={`flex items-center gap-2 mb-3 ${color}`}>
                {icon}
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white leading-none">{value}</div>
            {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
            {sparklineColor && <AnimatedSparkline color={sparklineColor} delay={0.3} className="mt-3" />}
        </Card>
    );
}

function ConversionBar({ value }: { value: number }) {
    const pct = Math.min(value, 100);
    const color = pct >= 50 ? 'bg-emerald-500' : pct >= 25 ? 'bg-amber-400' : 'bg-red-400';
    return (
        <div className="flex items-center gap-2 min-w-[80px]">
            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">{pct}%</span>
        </div>
    );
}

function AgentRow({ agent, rank }: { agent: AgentStat; rank: number }) {
    const initials = (agent.full_name ?? agent.email)
        .split(/\s+/)
        .slice(0, 2)
        .map(w => w[0]?.toUpperCase() ?? '')
        .join('');

    const colors = ['bg-indigo-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
    const avatarColor = colors[rank % colors.length];

    return (
        <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl ${avatarColor} text-white flex items-center justify-center text-xs font-bold shrink-0`}>
                        {initials || '?'}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {agent.full_name ?? agent.email}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{agent.email}</p>
                    </div>
                </div>
            </td>
            <td className="px-4 py-3 text-center">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{agent.clients_total}</span>
            </td>
            <td className="px-4 py-3 text-center">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                    {agent.clients_active}
                </span>
            </td>
            <td className="px-4 py-3 text-center">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                    {agent.clients_won}
                </span>
            </td>
            <td className="px-4 py-3 text-center">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{agent.proposals_total}</span>
            </td>
            <td className="px-4 py-3 text-center">
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{agent.proposals_accepted}</span>
            </td>
            <td className="px-4 py-3">
                <ConversionBar value={agent.conversion_rate} />
            </td>
            <td className="px-4 py-3 text-right">
                {agent.best_saving > 0
                    ? <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{FMT_EUR(agent.best_saving)}</span>
                    : <span className="text-xs text-slate-300">—</span>
                }
            </td>
        </tr>
    );
}

export default function FranchiseDashboard() {
    const [data, setData] = useState<FranchiseOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getFranchiseOverviewAction()
            .then(setData)
            .catch(e => setError(e instanceof Error ? e.message : 'Error'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-400">
                <p>{error ?? 'Sin datos'}</p>
            </div>
        );
    }

    const { agents, totals, franchise_name } = data;
    const conversionPct = totals.proposals > 0
        ? Math.round((totals.accepted / totals.proposals) * 100)
        : 0;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 relative overflow-hidden font-sans">
            <AmbientBackground />

            <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12 py-10 relative z-10 space-y-8">

                {/* Header */}
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-300/30">
                                <Building2 size={16} />
                            </div>
                            <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-widest">
                                Panel Franquicia
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                            {franchise_name}<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-500">.</span>
                        </h1>
                        <p className="text-sm text-slate-400 mt-1">{agents.length} agente{agents.length !== 1 ? 's' : ''} activo{agents.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <KpiCard
                        icon={<Users size={16} />}
                        label="Clientes"
                        value={totals.clients}
                        color="text-indigo-500"
                        sparklineColor="#6366f1"
                    />
                    <KpiCard
                        icon={<Target size={16} />}
                        label="Pipeline"
                        value={FMT_EUR(totals.pipeline_value)}
                        sub="factura/mes en proceso"
                        color="text-violet-500"
                        sparklineColor="#8b5cf6"
                        hero
                    />
                    <KpiCard
                        icon={<BarChart3 size={16} />}
                        label="Propuestas"
                        value={totals.proposals}
                        color="text-slate-500"
                    />
                    <KpiCard
                        icon={<CheckCircle2 size={16} />}
                        label="Conversión"
                        value={`${conversionPct}%`}
                        sub={`${totals.accepted} firmadas`}
                        color="text-emerald-500"
                        sparklineColor="#10b981"
                    />
                    <KpiCard
                        icon={<Wallet size={16} />}
                        label="Comisiones pendientes"
                        value={FMT_EUR(totals.commissions_pending)}
                        color="text-amber-500"
                    />
                </div>

                {/* Agent performance table */}
                <div className="bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <TrendingUp size={16} className="text-indigo-500" />
                            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Rendimiento por agente</h2>
                        </div>
                        <span className="text-xs text-slate-400">{agents.length} agentes</span>
                    </div>

                    {agents.length === 0 ? (
                        <EmptyState
                            icon={Users}
                            tone="indigo"
                            title="Sin agentes en la franquicia"
                            description="Cuando inviten agentes a unirse, aparecerán aquí con su rendimiento y conversión en tiempo real."
                            action={{ label: 'Invitar a un agente', href: '/dashboard/network', icon: ArrowUpRight }}
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-50/50 dark:bg-slate-800/50">
                                    <tr>
                                        {['Agente', 'Clientes', 'En proceso', 'Ganados', 'Propuestas', 'Firmadas', 'Conversión', 'Mejor ahorro'].map(h => (
                                            <th key={h} className={`px-4 py-3 font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider ${h === 'Agente' ? 'text-left' : 'text-center'}`}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {agents.map((agent, i) => (
                                        <AgentRow key={agent.id} agent={agent} rank={i} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Top performers highlight */}
                {agents.length > 0 && (() => {
                    const topByClients = [...agents].sort((a, b) => b.clients_total - a.clients_total)[0];
                    const topBySavings = [...agents].sort((a, b) => b.best_saving - a.best_saving)[0];
                    const topByConversion = [...agents].filter(a => a.proposals_total >= 3).sort((a, b) => b.conversion_rate - a.conversion_rate)[0];

                    return (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                                { label: 'Mayor cartera', agent: topByClients, stat: `${topByClients.clients_total} clientes`, icon: <Users size={14} />, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' },
                                { label: 'Mejor ahorro logrado', agent: topBySavings, stat: FMT_EUR(topBySavings.best_saving), icon: <Zap size={14} />, color: 'text-energy-600 bg-energy-50 dark:bg-energy-900/20' },
                                topByConversion
                                    ? { label: 'Mejor conversión', agent: topByConversion, stat: `${topByConversion.conversion_rate}%`, icon: <ArrowUpRight size={14} />, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' }
                                    : null,
                            ].filter(Boolean).map((item, i) => item && (
                                <div key={i} className="bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-2xl p-4 shadow-sm flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
                                        {item.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</p>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{item.agent.full_name ?? item.agent.email}</p>
                                        <p className="text-xs text-slate-500">{item.stat}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                })()}

                {/* Tip for no agents */}
                {agents.length === 0 && (
                    <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800/40 rounded-2xl p-6 text-center">
                        <Clock size={24} className="mx-auto text-indigo-400 mb-2" />
                        <p className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">Invita agentes desde el panel de red para ver su rendimiento aquí</p>
                    </div>
                )}
            </div>
        </div>
    );
}
