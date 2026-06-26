'use client';

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { crmService } from '@/services/crmService';
import { Client } from '@/types/crm';
import {
    TrendingUp,
    Target,
    Layers,
    ArrowUpRight,
    Zap,
    Upload,
    Users,
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
const RenewalsPanel = dynamic(() => import('@/features/renewals/components/RenewalsPanel'), {
    ssr: false,
    loading: () => <div className="h-64 bg-slate-100/50 animate-pulse rounded-2xl" />,
});
const AgendaToday = dynamic(() => import('@/features/crm/components/AgendaToday'), {
    ssr: false,
    loading: () => <div className="h-48 bg-slate-100/50 animate-pulse rounded-2xl" />,
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
                    <h1 className="text-base lg:text-lg font-semibold text-slate-800 tracking-tight">
                        Hola, <span className="text-indigo-600">{firstName}.</span>
                    </h1>
                </div>

                {/* ── Acciones primarias del comercial ── */}
                <div className="px-4 lg:px-0 grid grid-cols-2 gap-2.5">
                    <Link
                        href="/dashboard/simulator"
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-200"
                    >
                        <Upload size={18} className="shrink-0" />
                        <div className="min-w-0">
                            <p className="text-sm font-bold leading-tight">Nueva Factura</p>
                            <p className="text-[10px] text-indigo-200 leading-tight">Subir y analizar</p>
                        </div>
                    </Link>
                    <Link
                        href="/dashboard/clients"
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40 active:scale-[0.98] transition-all"
                    >
                        <Users size={18} className="shrink-0 text-indigo-400" />
                        <div className="min-w-0">
                            <p className="text-sm font-bold leading-tight">Nuevo Cliente</p>
                            <p className="text-[10px] text-slate-400 leading-tight">Añadir a cartera</p>
                        </div>
                    </Link>
                </div>

                {/* Smart alerts */}
                <div className="px-4 lg:px-0">
                    <SmartAlertsStrip />
                </div>

                {/* KPIs */}
                <div className="px-4 lg:px-0">
                    {/* Mobile: horizontal scroll */}
                    <div className="flex gap-2.5 overflow-x-auto pb-1 lg:hidden scrollbar-none snap-x snap-mandatory">
                        <KpiChip label="Ahorro detectado" value={formatCurrency(stats.financials.total_detected)} />
                        <KpiChip label={`Objetivo ${goalProgress}%`} value={formatCurrency(monthlyGoal)} progress={goalProgress} />
                        <KpiChip label="Pipeline activo" value={formatCurrency(stats.financials.pipeline)} />
                        <Link href="/dashboard/tariffs" className="snap-start shrink-0 bg-indigo-50 rounded-xl border border-indigo-100 px-4 py-2.5 min-w-[140px] flex items-center gap-2 active:bg-indigo-100 transition-colors">
                            <Zap size={16} className="text-indigo-500 shrink-0" />
                            <div>
                                <p className="text-[11px] text-indigo-600 font-semibold">Ver Tarifas</p>
                                <p className="text-[10px] text-indigo-400">Precios y comisiones</p>
                            </div>
                        </Link>
                    </div>
                    {/* Desktop: grid */}
                    <div className="hidden lg:grid grid-cols-4 gap-3">
                        <KpiCard label="Ahorro Detectado" value={formatCurrency(stats.financials.total_detected)} icon={TrendingUp} />
                        <KpiCard label="Objetivo Mensual" value={`${goalProgress}%`} subValue={formatCurrency(monthlyGoal)} icon={Target} progress={goalProgress} />
                        <KpiCard label="Pipeline Activo" value={formatCurrency(stats.financials.pipeline)} icon={Layers} />
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => router.push('/dashboard/tariffs')}
                            onKeyDown={(e) => { if (e.key === 'Enter') router.push('/dashboard/tariffs'); }}
                            className="flex items-center justify-between gap-2 px-4 py-2.5 bg-indigo-50/80 rounded-xl border border-indigo-100 hover:bg-indigo-100/60 transition-colors cursor-pointer"
                        >
                            <div>
                                <div className="text-sm font-semibold text-indigo-700 leading-tight">Ver precios</div>
                                <div className="text-[9px] text-indigo-400 font-normal mt-0.5">y comisiones →</div>
                            </div>
                            <Zap size={16} strokeWidth={1.5} className="text-indigo-400 shrink-0" />
                        </div>
                    </div>
                </div>

                {/* MAIN BENTO GRID — denso, ajustado a pantalla */}
                <div className="px-4 lg:px-0 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 lg:auto-rows-[minmax(0,1fr)]">

                    {/* Tendencia de Ahorro — 7 cols */}
                    <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-4 flex flex-col">
                        <SectionHeader title="Tendencia de Ahorro" link="Ver Analytics" linkHref="/dashboard/analytics" />
                        <div className="mt-2 h-[150px] lg:h-[160px] w-full">
                            <SavingsTrendChart data={stats.savingsTrend ?? []} />
                        </div>
                    </div>

                    {/* Distribución de Pipeline — 5 cols */}
                    <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-4 flex flex-col">
                        <SectionHeader title="Distribución de Pipeline" />
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
                    </div>

                    {/* Mi Agenda Hoy — 4 cols */}
                    <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-4 flex flex-col max-h-[300px]">
                        <SectionHeader title="Mi Agenda Hoy" link="Tareas" linkHref="/dashboard/tasks" />
                        <div className="mt-2 flex-1 overflow-y-auto pr-1">
                            <AgendaToday />
                        </div>
                    </div>

                    {/* Radar de Renovaciones — 4 cols */}
                    <div id="renewals" className="lg:col-span-4 scroll-mt-24 bg-white rounded-2xl border border-slate-200 p-4 flex flex-col max-h-[300px]">
                        <RenewalsPanel />
                    </div>

                    {/* Actividad Reciente — 4 cols */}
                    <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-4 flex flex-col max-h-[300px]">
                        <SectionHeader title="Actividad Reciente" link="Ver Propuestas" linkHref="/dashboard/proposals" />
                        <div className="flex-1 overflow-y-auto mt-2 space-y-1.5 pr-1">
                            {stats.recentProposals.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-6">Sin actividad reciente</p>
                            ) : (
                                stats.recentProposals.map((proposal) => (
                                    <div key={proposal.id} onClick={() => router.push(`/dashboard/proposals/${proposal.id}`)} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-300 hover:bg-white cursor-pointer group transition-colors">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className={`w-2 h-2 rounded-full shrink-0 ${proposal.status === 'accepted' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                            <div className="min-w-0">
                                                <div className="text-xs font-medium text-slate-700 truncate group-hover:text-indigo-600">{proposal.client_name}</div>
                                                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{formatCurrency(proposal.annual_savings)}</div>
                                            </div>
                                        </div>
                                        <ArrowUpRight size={14} className="text-slate-300 group-hover:text-indigo-500 shrink-0" />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

function SectionHeader({ title, link, linkHref }: { title: string; link?: string; linkHref?: string }) {
    return (
        <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {title}
            </h3>
            {link && linkHref && (
                <Link href={linkHref} className="text-[10px] font-medium text-indigo-500 hover:text-indigo-700 transition-colors uppercase tracking-wider">
                    {link}
                </Link>
            )}
        </div>
    );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: 'emerald' }) {
    return (
        <div className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5">
            <div className="text-[9px] uppercase text-slate-400 font-bold tracking-wider truncate">{label}</div>
            <div className={`text-sm font-bold ${accent === 'emerald' ? 'text-emerald-600' : 'text-slate-700'}`}>{value}</div>
        </div>
    );
}

function KpiChip({ label, value, progress }: { label: string; value: string; progress?: number }) {
    return (
        <div className="snap-start shrink-0 bg-white rounded-2xl border border-slate-200 px-4 py-3 min-w-[140px]">
            <p className="text-[11px] text-slate-400 font-medium mb-1">{label}</p>
            <p className="text-lg font-bold text-slate-900">{value}</p>
            {progress !== undefined && (
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
                    <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
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
        <div className="flex flex-col justify-between p-3 bg-white rounded-2xl border border-slate-200 hover:border-indigo-200 transition-colors cursor-default">
            <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[9px] font-medium uppercase tracking-widest opacity-80">{label}</span>
                <Icon size={13} strokeWidth={1.5} className="opacity-70" />
            </div>
            <div>
                <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-medium text-slate-700 tracking-tight">{value}</span>
                    {subValue && <span className="text-[9px] text-slate-400 font-normal tracking-wide">{subValue}</span>}
                </div>
                {progress !== undefined && (
                    <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                        <div className="h-full bg-indigo-500/80 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                )}
            </div>
        </div>
    );
}
