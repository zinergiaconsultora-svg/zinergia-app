'use client';

import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from 'next/navigation';
import { crmService } from '@/services/crmService';
import { Client } from '@/types/crm';
import {
    TrendingUp,
    Target,
    Layers,
    ArrowUpRight,
    Zap,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { formatCurrency } from '@/lib/utils/format';
import { DashboardSkeleton } from '@/components/ui/DashboardSkeleton';

const SavingsTrendChart = dynamic(() =>
    import('./DashboardCharts').then(m => ({ default: m.SavingsTrendChart })),
    { loading: () => <div className="h-full w-full bg-slate-100/20 animate-pulse rounded-lg" /> }
);
const PipelinePieChart = dynamic(() =>
    import('./DashboardCharts').then(m => ({ default: m.PipelinePieChart })),
    { loading: () => <div className="h-full w-full bg-slate-100/20 animate-pulse rounded-full" /> }
);
const SmartAlertsStrip = dynamic(() => import('./SmartAlertsStrip'), { ssr: false });
const MyDayPanel = dynamic(() => import('@/features/crm/components/MyDayPanel'), {
    ssr: false,
    loading: () => <div className="h-[300px] bg-slate-100/50 animate-pulse rounded-2xl" />,
});

interface DashboardStats {
    user?: {
        full_name: string;
        role: string;
        avatar_url?: string;
    };
    total: number;
    active: number;
    pending: number;
    new: number;
    growth: string;
    recent: Client[];
    recentProposals: {
        id: string;
        client_name: string;
        annual_savings: number;
        status: string;
        created_at: string;
    }[];
    savingsTrend?: { name: string; value: number }[];
    pendingActions: {
        id: string;
        client_name: string;
        type: 'documentation_needed';
    }[];
    financials: {
        total_detected: number;
        pipeline: number;
        secured: number;
        conversion_rate: number;
        month_savings: number;
        monthly_goal: number;
    };
}

const DEFAULT_STATS: DashboardStats = {
    user: { full_name: 'Consultor', role: 'agent' },
    total: 0,
    active: 0,
    pending: 0,
    new: 0,
    growth: '0%',
    recent: [],
    recentProposals: [],
    pendingActions: [],
    financials: {
        total_detected: 0,
        pipeline: 0,
        secured: 0,
        conversion_rate: 0,
        month_savings: 0,
        monthly_goal: 10000
    }
};

const DEFAULT_MONTHLY_GOAL = 10000;

export default function DashboardView() {
    const router = useRouter();
    const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadStats() {
            try {
                const data = await crmService.getDashboardStats();
                setStats({ ...DEFAULT_STATS, ...data } as DashboardStats);
            } catch (error) {
                console.warn('Dashboard stats partial load:', error);
            } finally {
                setLoading(false);
            }
        }
        loadStats();
    }, []);

    const monthlyGoal = stats.financials.monthly_goal || DEFAULT_MONTHLY_GOAL;

    const goalProgress = useMemo(() =>
        Math.min(Math.round((stats.financials.month_savings / monthlyGoal) * 100), 100),
        [stats.financials.month_savings, monthlyGoal]
    );

    const firstName = useMemo(() =>
        stats.user?.full_name?.split(' ')[0] || 'Consultor',
        [stats.user?.full_name]
    );

    const { wonDeals, activeDeals, lostDeals } = useMemo(() => {
        return stats.recentProposals.reduce((acc, p) => {
            if (p.status === 'accepted') acc.wonDeals++;
            else if (p.status === 'sent' || p.status === 'draft') acc.activeDeals++;
            else if (p.status === 'rejected') acc.lostDeals++;
            return acc;
        }, { wonDeals: 0, activeDeals: 0, lostDeals: 0 });
    }, [stats.recentProposals]);

    if (loading) return <DashboardSkeleton />;

    return (
        <div className="w-full text-slate-600 font-sans overflow-x-hidden selection:bg-indigo-100">

            <div className="flex flex-col gap-3 lg:gap-4 max-w-[1700px] mx-auto w-full">
                {/* HEADER (mobile + desktop unified, compact) */}
                <div className="flex items-center justify-between px-4 lg:px-0 pt-3 lg:pt-0">
                    <div>
                        <h1 className="font-display text-2xl lg:text-[2.2rem] font-medium text-slate-900 tracking-[-0.03em] leading-tight">
                            Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-energy-500 to-purple-600">{firstName}.</span>
                        </h1>
                        <p className="text-[13px] text-slate-500 mt-1 font-normal">
                            Tu cartera priorizada para hoy.
                        </p>
                    </div>
                </div>

                {/* Smart alerts */}
                <div className="px-4 lg:px-0">
                    <SmartAlertsStrip />
                </div>

                {/* KPIs */}
                <div className="px-4 lg:px-0">
                    {/* Mobile: horizontal scroll */}
                    <div className="flex gap-2.5 overflow-x-auto pb-1 lg:hidden scrollbar-none snap-x snap-mandatory">
                        <KpiChip label="Ahorro encontrado" value={formatCurrency(stats.financials.total_detected)} />
                        <KpiChip label={`Meta ${goalProgress}%`} value={formatCurrency(monthlyGoal)} progress={goalProgress} />
                        <KpiChip label="En seguimiento" value={formatCurrency(stats.financials.pipeline)} />
                        <Link href="/dashboard/tariffs" className="snap-start shrink-0 bg-energy-50/30 rounded-2xl border border-energy-100/30 px-4 py-2.5 min-w-[140px] flex items-center gap-2 active:bg-energy-100 hover:scale-105 transition-all">
                            <Zap size={16} className="text-energy-500 shrink-0" />
                            <div>
                                <p className="text-[11px] text-energy-600 font-bold">Precios</p>
                                <p className="text-[10px] text-energy-400">Precios y comisiones</p>
                            </div>
                        </Link>
                    </div>
                    {/* Desktop: grid */}
                    <div className="hidden lg:grid grid-cols-4 gap-3">
                        <KpiCard label="Ahorro Encontrado" value={formatCurrency(stats.financials.total_detected)} icon={TrendingUp} />
                        <KpiCard label="Meta del Mes" value={`${goalProgress}%`} subValue={formatCurrency(monthlyGoal)} icon={Target} progress={goalProgress} />
                        <KpiCard label="En Seguimiento" value={formatCurrency(stats.financials.pipeline)} icon={Layers} />
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => router.push('/dashboard/tariffs')}
                            onKeyDown={(e) => { if (e.key === 'Enter') router.push('/dashboard/tariffs'); }}
                            className="flex items-center justify-between gap-2 px-4 py-2.5 bg-energy-50/20 rounded-2xl border border-energy-100/30 hover:bg-energy-50/40 hover:scale-[1.02] hover:shadow-floating-light transition-all duration-300 cursor-pointer"
                        >
                            <div>
                                <div className="text-sm font-semibold text-energy-600 leading-tight font-bold">Precios</div>
                                <div className="text-[9px] text-energy-400 font-normal mt-0.5">tarifas y comisiones</div>
                            </div>
                            <Zap size={16} strokeWidth={1.5} className="text-energy-500 shrink-0" />
                        </div>
                    </div>
                </div>

                {/* MAIN BENTO GRID — denso, ajustado a pantalla */}
                <div className="px-4 lg:px-0 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 lg:auto-rows-[minmax(0,1fr)]">

                    {/* Ahorro encontrado */}
                    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-7 glass-premium rounded-3xl p-5 flex flex-col hover:shadow-floating-medium transition-all duration-300">
                        <SectionHeader title="Ahorro Encontrado" link="Ver informe" linkHref="/dashboard/analytics" />
                        <div className="mt-2 h-[150px] lg:h-[160px] w-full">
                            <SavingsTrendChart data={stats.savingsTrend ?? []} />
                        </div>
                    </motion.div>

                    {/* Estado de propuestas */}
                    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="lg:col-span-5 glass-premium rounded-3xl p-5 flex flex-col hover:shadow-floating-medium transition-all duration-300">
                        <SectionHeader title="Estado de Propuestas" />
                        <div className="flex items-center gap-3 mt-1 flex-1">
                            <div className="h-[120px] w-[120px] shrink-0">
                                <PipelinePieChart active={activeDeals} won={wonDeals} lost={lostDeals} />
                            </div>
                            <div className="flex-1 grid grid-cols-2 gap-2">
                                <MiniStat label="Conversión" value={`${stats.financials.conversion_rate}%`} accent="emerald" />
                                <MiniStat label="Propuestas" value={String(stats.recentProposals.length)} />
                                <MiniStat label="Activas" value={String(activeDeals)} />
                                <MiniStat label="Ganadas" value={String(wonDeals)} accent="emerald" />
                            </div>
                        </div>
                    </motion.div>

                    {/* Mi cartera hoy */}
                    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-7">
                        <MyDayPanel />
                    </motion.div>

                    {/* Últimos movimientos */}
                    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="lg:col-span-5 glass-premium rounded-3xl p-5 flex flex-col max-h-[320px] hover:shadow-floating-medium transition-all duration-300">
                        <SectionHeader title="Últimos Movimientos" link="Abrir propuestas" linkHref="/dashboard/proposals" />
                        <div className="flex-1 overflow-y-auto mt-2 space-y-1.5 pr-1">
                            {stats.recentProposals.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-6">Sin actividad reciente</p>
                            ) : (
                                stats.recentProposals.map((proposal) => (
                                    <div key={proposal.id} onClick={() => router.push(`/dashboard/proposals/${proposal.id}`)} className="flex items-center justify-between p-2.5 rounded-2xl bg-white/40 border border-slate-100 hover:border-energy-300 hover:bg-white hover:shadow-floating-light cursor-pointer group transition-all duration-200">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className={`w-2 h-2 rounded-full shrink-0 ${proposal.status === 'accepted' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                            <div className="min-w-0">
                                                <div className="text-xs font-medium text-slate-700 truncate group-hover:text-energy-600">{proposal.client_name}</div>
                                    <div className="text-[11px] text-slate-500 font-medium">{formatCurrency(proposal.annual_savings)}</div>
                                            </div>
                                        </div>
                                        <ArrowUpRight size={14} className="text-slate-300 group-hover:text-energy-500 shrink-0" />
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>

                </div>
            </div>
        </div>
    );
}

function SectionHeader({ title, link, linkHref }: { title: string; link?: string; linkHref?: string }) {
    return (
        <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-display font-medium tracking-[-0.015em] text-slate-800">
                {title}
            </h3>
            {link && linkHref && (
                <Link href={linkHref} className="text-[11px] font-semibold text-[11px] font-bold text-energy-500 hover:text-energy-700 transition-colors">
                    {link}
                </Link>
            )}
        </div>
    );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: 'emerald' }) {
    return (
        <div className="rounded-2xl bg-white/30 border border-slate-100/50 px-2.5 py-1.5 backdrop-blur-sm shadow-floating-light">
            <div className="text-[11px] text-slate-500 font-medium truncate">{label}</div>
            <div className={`text-[15px] font-display font-medium tracking-[-0.015em] ${accent === 'emerald' ? 'text-emerald-600' : 'text-slate-800'}`}>{value}</div>
        </div>
    );
}

function KpiChip({ label, value, progress }: { label: string; value: string; progress?: number }) {
    return (
        <div className="snap-start shrink-0 glass-premium rounded-3xl px-4 py-3 shadow-floating-light min-w-[140px]">
            <p className="text-[12px] text-slate-500 font-medium mb-1">{label}</p>
            <p className="text-lg font-display font-medium tracking-[-0.02em] text-slate-900">{value}</p>
            {progress !== undefined && (
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
                    <div className="h-full bg-gradient-to-r from-energy-500 to-purple-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
            )}
        </div>
    );
}

interface KpiCardProps {
    label: string;
    value: string;
    icon: React.ElementType;
    subValue?: string;
    progress?: number;
}

function KpiCard({ label, value, icon: Icon, subValue, progress }: KpiCardProps) {
    return (
        <div className="flex flex-col justify-between p-3 glass-premium rounded-3xl hover:border-energy-200/40 hover:shadow-floating-medium hover:-translate-y-0.5 transition-all duration-300 cursor-default">
            <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-medium tracking-[-0.005em] opacity-90">{label}</span>
                <Icon size={13} strokeWidth={1.5} className="opacity-70" />
            </div>
            <div>
                <div className="flex items-baseline gap-1.5">
                    <span className="text-[1.4rem] font-display font-medium text-slate-900 tracking-[-0.025em]">{value}</span>
                    {subValue && <span className="text-[11px] text-slate-500 font-normal">{subValue}</span>}
                </div>
                {progress !== undefined && (
                    <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-energy-500 to-purple-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                )}
            </div>
        </div>
    );
}
