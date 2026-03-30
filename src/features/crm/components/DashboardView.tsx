'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { crmService } from '@/services/crmService';
import { Client } from '@/types/crm';
import { getNotificationsAction, AppNotification } from '@/app/actions/notifications';
import {
    TrendingUp,
    Target,
    Layers,
    Bell,
    ArrowUpRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { formatCurrency } from '@/lib/utils/format';
import { DashboardSkeleton } from '@/components/ui/DashboardSkeleton';
import { QuickUploadZone } from './QuickUploadZone';


const NotificationsPopover = dynamic(() =>
    import('@/features/crm/components/NotificationsPopover').then(m => ({ default: m.NotificationsPopover })),
    { ssr: false }
);
const OcrJobsPanel = dynamic(() => import('./OcrJobsPanel'), {
    ssr: false,
    loading: () => <div className="h-32 bg-slate-100/50 animate-pulse rounded-2xl" />,
});

const SavingsTrendChart = dynamic(() =>
    import('./DashboardCharts').then(m => ({ default: m.SavingsTrendChart })),
    { loading: () => <div className="h-full w-full bg-slate-100/20 animate-pulse rounded-lg" /> }
);
const PipelinePieChart = dynamic(() =>
    import('./DashboardCharts').then(m => ({ default: m.PipelinePieChart })),
    { loading: () => <div className="h-full w-full bg-slate-100/20 animate-pulse rounded-full" /> }
);

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
        month_savings: 0
    }
};

// Animation variants - defined outside component to prevent recreation
const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2
        }
    }
};

const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

const MONTHLY_GOAL = 10000;

export default function DashboardView() {
    const router = useRouter();
    const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
    const [loading, setLoading] = useState(true);
    const [isNotifOpen, setIsNotifOpen] = useState(false);

    const [notifications, setNotifications] = useState<AppNotification[]>([]);

    useEffect(() => {
        getNotificationsAction()
            .then(data => setNotifications(data))
            .catch(() => { /* non-fatal — bell stays empty */ });
    }, []);

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

    // Memoized calculations
    const goalProgress = useMemo(() =>
        Math.min(Math.round((stats.financials.month_savings / MONTHLY_GOAL) * 100), 100),
        [stats.financials.month_savings]
    );

    const firstName = useMemo(() =>
        stats.user?.full_name?.split(' ')[0] || 'Consultor',
        [stats.user?.full_name]
    );

    const unreadCount = useMemo(() =>
        notifications.filter(n => !n.read).length,
        [notifications]
    );

    // Chart Calculations - optimized to single pass O(n) instead of O(3n)
    const { wonDeals, activeDeals, lostDeals } = useMemo(() => {
        return stats.recentProposals.reduce((acc, p) => {
            if (p.status === 'accepted') acc.wonDeals++;
            else if (p.status === 'sent' || p.status === 'draft') acc.activeDeals++;
            else if (p.status === 'rejected') acc.lostDeals++;
            return acc;
        }, { wonDeals: 0, activeDeals: 0, lostDeals: 0 });
    }, [stats.recentProposals]);

    // Callbacks for notification handlers
    const handleMarkAsRead = useCallback((id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }, []);

    const handleMarkAllAsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    const handleDismiss = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    if (loading) return <DashboardSkeleton />;

    return (
        <div className="w-full bg-white lg:bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 font-sans overflow-x-hidden flex flex-col relative selection:bg-indigo-100">
            {/* Background Effects — desktop only */}
            <div className="hidden lg:block fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-indigo-200/30 dark:bg-indigo-900/20 rounded-full blur-[80px] mix-blend-multiply dark:mix-blend-screen opacity-50"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[30vw] h-[30vw] bg-emerald-100/50 dark:bg-emerald-900/20 rounded-full blur-[80px] mix-blend-multiply dark:mix-blend-screen opacity-50"></div>
            </div>

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="flex-1 flex flex-col px-0 md:px-6 md:py-4 gap-0 md:gap-8 max-w-[1700px] mx-auto w-full z-10"
            >
                {/* 0. MOBILE HEADER — iOS style */}
                <motion.div variants={item} className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-[#e5e5ea]">
                    <div>
                        <p className="text-[11px] text-[#8e8e93] font-medium uppercase tracking-wide">Bienvenido</p>
                        <h1 className="text-lg font-semibold text-slate-900">{firstName}</h1>
                    </div>
                    <div className="relative">
                        <button type="button" className="p-2 text-[#8e8e93] relative active:bg-slate-100 rounded-xl transition-colors" onClick={() => setIsNotifOpen(!isNotifOpen)}>
                            <Bell size={20} />
                            {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>}
                        </button>
                        {isNotifOpen && (
                            <NotificationsPopover
                                isOpen={isNotifOpen}
                                onClose={() => setIsNotifOpen(false)}
                                notifications={notifications}
                                onMarkAsRead={handleMarkAsRead}
                                onMarkAllAsRead={handleMarkAllAsRead}
                                onDismiss={handleDismiss}
                            />
                        )}
                    </div>
                </motion.div>

                {/* 1. DESKTOP HEADER ROW */}
                <motion.div variants={item} className="hidden lg:flex items-center justify-between shrink-0 mb-2">
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-xl font-semibold text-slate-800 dark:text-white tracking-tight">
                            Hola, <span className="text-indigo-600 dark:text-indigo-400">{firstName}.</span>
                        </h1>
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                            Tu rendimiento hoy está al 100%.
                        </span>
                    </div>
                </motion.div>

                {/* 2. HERO UPLOAD — desktop only with glass effect */}
                <motion.div variants={item} className="hidden lg:block relative w-full group">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-emerald-500/10 to-teal-500/10 blur-3xl opacity-50 rounded-[3rem]" />
                    <div className="relative glass-premium rounded-[2.5rem] border border-white/20 shadow-2xl overflow-hidden p-8 lg:p-12 flex flex-col lg:flex-row items-center gap-10">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        <div className="flex-1 text-center lg:text-left">
                            <h2 className="text-3xl lg:text-4xl font-display font-bold text-slate-800 dark:text-white leading-tight mb-4 tracking-tight">
                                Optimiza tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-energy-600 to-energy-400">Energía</span> en segundos
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-lg max-w-xl mx-auto lg:mx-0 font-body">
                                Sube tu factura PDF y deja que nuestra ingeniería detecte el mayor ahorro posible para tus clientes.
                            </p>
                        </div>
                        <QuickUploadZone />
                    </div>
                </motion.div>

                {/* 3. MOBILE UPLOAD — iOS card style */}
                <motion.div variants={item} className="lg:hidden mx-4 mt-3 mb-2">
                    <QuickUploadZone />
                </motion.div>

                {/* 2. KPIs — iOS grouped list en móvil, grid en desktop */}
                <motion.div variants={item} className="mx-4 lg:mx-0 mt-4 lg:mt-0">
                    {/* Mobile: horizontal scroll KPI chips */}
                    <div className="flex gap-3 overflow-x-auto pb-1 lg:hidden scrollbar-none snap-x snap-mandatory">
                        <div className="snap-start shrink-0 bg-white rounded-2xl border border-[#e5e5ea] px-4 py-3 min-w-[140px] shadow-sm">
                            <p className="text-[11px] text-[#8e8e93] font-medium mb-1">Ahorro detectado</p>
                            <p className="text-lg font-bold text-slate-900">{formatCurrency(stats.financials.total_detected)}</p>
                        </div>
                        <div className="snap-start shrink-0 bg-white rounded-2xl border border-[#e5e5ea] px-4 py-3 min-w-[140px] shadow-sm">
                            <p className="text-[11px] text-[#8e8e93] font-medium mb-1">Objetivo {goalProgress}%</p>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 mb-1">
                                {/* width is dynamic — inline style required */}
                                <div className="h-1.5 bg-energy-500 rounded-full transition-all" style={{ width: `${goalProgress}%` }} />
                            </div>
                            <p className="text-xs text-slate-500">{formatCurrency(MONTHLY_GOAL)}</p>
                        </div>
                        <div className="snap-start shrink-0 bg-white rounded-2xl border border-[#e5e5ea] px-4 py-3 min-w-[140px] shadow-sm">
                            <p className="text-[11px] text-[#8e8e93] font-medium mb-1">Pipeline activo</p>
                            <p className="text-lg font-bold text-slate-900">{formatCurrency(stats.financials.pipeline)}</p>
                        </div>
                    </div>
                    {/* Desktop: original grid */}
                    <div className="hidden lg:grid grid-cols-3 gap-4">
                        <GlassKpiCard label="Ahorro Detectado" value={formatCurrency(stats.financials.total_detected)} icon={TrendingUp} delay={0.1} />
                        <GlassKpiCard label="Objetivo Mensual" value={`${goalProgress}%`} subValue={formatCurrency(MONTHLY_GOAL)} icon={Target} progress={goalProgress} delay={0.2} />
                        <GlassKpiCard label="Pipeline Activo" value={formatCurrency(stats.financials.pipeline)} icon={Layers} delay={0.3} />
                    </div>
                </motion.div>

                {/* 3. MAIN BENTO GRID (Balanced Layout without gaps) */}
                <motion.div variants={item} className="flex flex-col gap-4">
                    
                    {/* ROW 1: Charts (Trend 2/3 + Pipeline 1/3) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Trend Chart (col-span-2) */}
                        <div className="lg:col-span-2 bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm p-4 flex flex-col group hover:bg-white/80 transition-colors">
                            <SectionHeader title="Tendencia de Ahorro" link="Ver Reporte" />
                            <div className="mt-2 h-[220px]">
                                <SavingsTrendChart data={stats.savingsTrend ?? []} />
                            </div>
                        </div>

                        {/* Pipeline Chart (col-span-1) */}
                        <div className="lg:col-span-1 bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm p-4 flex flex-col hover:bg-white/80 transition-colors">
                            <SectionHeader title="Distribución de Pipeline" />
                            <div className="flex-1 relative min-h-[160px] flex items-center justify-center mt-2">
                                <div className="h-full w-full max-h-[160px]">
                                    <PipelinePieChart active={activeDeals} won={wonDeals} lost={lostDeals} />
                                </div>
                            </div>
                            <div className="flex justify-between border-t border-slate-100 pt-3 mt-2">
                                <div className="text-center">
                                    <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Conversión</div>
                                    <div className="text-sm font-bold text-emerald-600">{stats.financials.conversion_rate}%</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Total Propuestas</div>
                                    <div className="text-sm font-bold text-slate-700">{stats.recentProposals.length}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ROW 2: Lists (Recent Activity 1/2 + OCR Jobs 1/2) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[400px]">
                        {/* Recent Activity */}
                        <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-white/80 dark:border-white/10 shadow-lg hover:shadow-xl hover:-translate-y-1 p-4 flex flex-col transition-all duration-300 overflow-hidden h-full">
                            <SectionHeader title="Actividad Reciente" />
                            <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-2 custom-scrollbar">
                                {stats.recentProposals.map((proposal) => (
                                    <div key={proposal.id} onClick={() => router.push(`/dashboard/proposals/${proposal.id}`)} className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-md hover:bg-white cursor-pointer group transition-all duration-300">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-2 h-2 rounded-full ${proposal.status === 'accepted' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{proposal.client_name}</div>
                                                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{formatCurrency(proposal.annual_savings)}</div>
                                            </div>
                                        </div>
                                        <ArrowUpRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-500" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* OCR Jobs History Wrapper */}
                        <div className="h-full flex flex-col [&>div]:h-full [&>div]:flex [&>div]:flex-col [&>div>div:last-child]:flex-1 [&>div>div:last-child]:overflow-auto">
                            <OcrJobsPanel />
                        </div>
                    </div>

                </motion.div>

            </motion.div>
        </div>
    );
}

// -- Components --

function SectionHeader({ title, link }: { title: string, link?: string }) {
    return (
        <div className="flex items-center justify-between pl-1">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <span className="w-1 h-1 bg-indigo-400 rounded-full opacity-60"></span>
                {title}
            </h3>
            {link && <button type="button" className="text-[9px] font-medium text-indigo-400 hover:text-indigo-600 transition-colors uppercase tracking-wider">{link}</button>}
        </div>
    );
}

interface KpiCardProps {
    label: string;
    value: string;
    icon: React.ElementType;
    subValue?: string;
    progress?: number;
    delay?: number;
}

function GlassKpiCard({ label, value, icon: Icon, subValue, progress, delay = 0 }: KpiCardProps) {
    return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay }} className="flex flex-col justify-between p-3 bg-white/70 backdrop-blur-xl rounded-2xl border border-white/80 shadow-lg hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 cursor-default">
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
                        <div
                            className="h-full bg-indigo-500/80 rounded-full transition-all duration-500"
                            style={{
                                width: `${progress}%`
                            } as React.CSSProperties}
                        ></div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
