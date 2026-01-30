'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { crmService } from '@/services/crmService';
import { Client } from '@/types/crm';
import {
    TrendingUp,
    Target,
    Layers,
    ArrowRight,
    Bell,
    GraduationCap,
    ArrowUpRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { formatCurrency } from '@/lib/utils/format';
import { DashboardSkeleton } from '@/components/ui/DashboardSkeleton';
import { useSimulator } from '@/features/simulator/hooks/useSimulator';
import { Upload, Sparkles } from 'lucide-react';

const LeaderboardWidget = dynamic(() => import('@/features/gamification/components/LeaderboardWidget').then(mod => mod.LeaderboardWidget), { loading: () => <div className="h-64 bg-slate-100/50 animate-pulse rounded-2xl" /> });
const AchievementsWidget = dynamic(() => import('@/features/gamification/components/AchievementsWidget').then(mod => mod.AchievementsWidget));
const NotificationsPopover = dynamic(() => import('@/features/crm/components/NotificationsPopover').then(mod => mod.NotificationsPopover), { ssr: false });
const SavingsTrendChart = dynamic(() => import('./DashboardCharts').then(mod => mod.SavingsTrendChart), { loading: () => <div className="h-full w-full bg-slate-100/20 animate-pulse rounded-lg" /> });
const PipelinePieChart = dynamic(() => import('./DashboardCharts').then(mod => mod.PipelinePieChart), { loading: () => <div className="h-full w-full bg-slate-100/20 animate-pulse rounded-full" /> });

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

export default function DashboardView() {
    const router = useRouter();
    const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
    const [loading, setLoading] = useState(true);
    const [isNotifOpen, setIsNotifOpen] = useState(false);

    const {
        handleFileUpload,
        handleDrop,
        handleDragOver,
        isAnalyzing
    } = useSimulator();
    const [notifications, setNotifications] = useState([
        { id: '1', type: 'success' as const, title: 'Comisión Aprobada', message: 'La venta de "Restaurante El Molino" ha sido validada.', created_at: new Date().toISOString(), read: false },
        { id: '2', type: 'info' as const, title: 'Nuevo Recurso', message: 'Se ha añadido "Tarifas 2026 Q1" a la Academy.', created_at: new Date(Date.now() - 3600000).toISOString(), read: false },
    ]);

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

    const goalProgress = Math.min(Math.round((stats.financials.month_savings / MONTHLY_GOAL) * 100), 100);
    const firstName = stats.user?.full_name?.split(' ')[0] || 'Consultor';
    const unreadCount = notifications.filter(n => !n.read).length;

    // Chart Calculations
    const wonDeals = stats.recentProposals.filter(p => p.status === 'accepted').length;
    const activeDeals = stats.recentProposals.filter(p => p.status === 'sent' || p.status === 'draft').length;
    const lostDeals = stats.recentProposals.filter(p => p.status === 'rejected').length;

    if (loading) return <DashboardSkeleton />;

    return (
        <div className="h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 font-sans overflow-hidden flex flex-col relative selection:bg-indigo-100">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-indigo-200/30 dark:bg-indigo-900/20 rounded-full blur-[80px] mix-blend-multiply dark:mix-blend-screen opacity-50"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[30vw] h-[30vw] bg-emerald-100/50 dark:bg-emerald-900/20 rounded-full blur-[80px] mix-blend-multiply dark:mix-blend-screen opacity-50"></div>
            </div>

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="flex-1 flex flex-col p-4 md:p-6 gap-6 md:gap-8 max-w-[1700px] mx-auto w-full z-10"
            >
                {/* 0. HERO UPLOAD SECTION (Imposing & Professional) */}
                <motion.div
                    variants={item}
                    className="relative w-full group"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-emerald-500/10 to-teal-500/10 blur-3xl opacity-50 rounded-[3rem]" />

                    <div className="relative glass-premium rounded-[2.5rem] border border-white/20 shadow-2xl overflow-hidden p-8 md:p-12 flex flex-col lg:flex-row items-center gap-10">
                        {/* Shimmer Effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                        <div className="flex-1 text-center lg:text-left">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-energy-50 text-energy-600 text-[10px] font-bold uppercase tracking-widest mb-4 border border-energy-100 italic">
                                <Sparkles size={12} /> IA Power Detection
                            </div>
                            <h2 className="text-2xl md:text-3xl lg:text-4xl font-display font-bold text-slate-800 dark:text-white leading-tight mb-4 tracking-tight">
                                Optimiza tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-energy-600 to-energy-400">Energía</span> en segundos
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-lg max-w-xl mx-auto lg:mx-0 font-body">
                                Sube tu factura PDF y deja que nuestra ingeniería detecte el mayor ahorro posible para tus clientes.
                            </p>
                        </div>

                        <div className="w-full lg:w-[450px] shrink-0">
                            <label className="block w-full h-full cursor-pointer group/upload">
                                <input
                                    type="file"
                                    accept=".pdf"
                                    className="hidden"
                                    onChange={(e) => {
                                        handleFileUpload(e);
                                        router.push('/dashboard/simulator');
                                    }}
                                    disabled={isAnalyzing}
                                />
                                <div
                                    onDrop={(e) => {
                                        handleDrop(e);
                                        router.push('/dashboard/simulator');
                                    }}
                                    onDragOver={handleDragOver}
                                    className="relative glass-premium border-2 border-dashed border-indigo-200/50 hover:border-indigo-400/50 transition-all rounded-3xl p-8 flex flex-col items-center justify-center bg-white/40 hover:bg-white/60 shadow-lg"
                                >
                                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm mb-4 group-hover/upload:scale-110 transition-transform">
                                        <Upload size={28} />
                                    </div>
                                    <div className="text-lg font-bold text-slate-800 dark:text-white mb-1">Cargar Nueva Factura</div>
                                    <div className="text-xs text-slate-400 font-medium text-center">Arrastra aquí o haz clic para subir tu PDF</div>
                                </div>
                            </label>
                        </div>
                    </div>
                </motion.div>


                {/* 1. HEADER ROW (Highly Compact) */}
                <motion.div variants={item} className="flex items-center justify-between shrink-0 h-10">
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-xl font-semibold text-slate-800 dark:text-white tracking-tight">
                            Hola, <span className="text-indigo-600 dark:text-indigo-400">{firstName}.</span>
                        </h1>
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium hidden md:inline-block">
                            Tu rendimiento hoy está al 100%.
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Notifications */}
                        <div className="relative">
                            <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors relative" onClick={() => setIsNotifOpen(!isNotifOpen)}>
                                <Bell size={18} />
                                {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full ring-1 ring-white"></span>}
                            </button>
                            {isNotifOpen && (
                                <NotificationsPopover
                                    isOpen={isNotifOpen}
                                    onClose={() => setIsNotifOpen(false)}
                                    notifications={notifications}
                                    onMarkAsRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
                                    onMarkAllAsRead={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                                    onDismiss={(id) => setNotifications(prev => prev.filter(n => n.id !== id))}
                                />
                            )}
                        </div>
                        {/* User Avatar */}
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-indigo-100">
                            {firstName[0]}
                        </div>
                    </div>
                </motion.div>

                {/* 2. KPIs ROW (Fixed Height ~80px) */}
                <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 shrink-0 h-[80px]">
                    <GlassKpiCard label="Ahorro Detectado" value={formatCurrency(stats.financials.total_detected)} icon={TrendingUp} delay={0.1} />
                    <GlassKpiCard label="Objetivo Mensual" value={`${goalProgress}%`} subValue={formatCurrency(MONTHLY_GOAL)} icon={Target} progress={goalProgress} delay={0.2} />
                    <GlassKpiCard label="Pipeline Activo" value={formatCurrency(stats.financials.pipeline)} icon={Layers} delay={0.3} />
                    {/* Compact Academy Card */}
                    <div onClick={() => router.push('/dashboard/academy')} className="cursor-pointer group flex items-center justify-between px-5 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl text-white shadow-lg shadow-indigo-200 transition-all hover:shadow-indigo-300 hover:scale-[1.02] active:scale-[0.98]">
                        <div>
                            <div className="text-[10px] font-medium text-indigo-200 uppercase tracking-wider mb-0.5">Academia</div>
                            <div className="text-xl font-bold flex items-center gap-2">
                                4 Nuevos <ArrowRight size={14} className="opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                            </div>
                        </div>
                        <GraduationCap size={24} className="text-indigo-200/50 group-hover:text-indigo-100 transition-colors" />
                    </div>
                </motion.div>

                {/* 3. MAIN BENTO GRID (Fills remaining height) */}
                <motion.div variants={item} className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">

                    {/* LEFT COLUMN (Charts) - 6 Cols */}
                    <div className="lg:col-span-8 flex flex-col gap-4 min-h-0 h-full">
                        {/* Top: Trend Chart */}
                        <div className="flex-[3] min-h-0 bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm p-3 relative flex flex-col group hover:bg-white/80 transition-colors">
                            <SectionHeader title="Tendencia de Ahorro" link="Ver Reporte" />
                            <div className="flex-1 w-full min-h-0 mt-1 relative">
                                <SavingsTrendChart />
                            </div>
                        </div>

                        {/* Bottom: Split (Pipeline + Activity) */}
                        <div className="flex-[2] min-h-0 grid grid-cols-2 gap-4">
                            {/* Pipeline */}
                            <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm p-3 flex flex-col hover:bg-white/80 transition-colors">
                                <SectionHeader title="Distribución" />
                                <div className="flex-1 flex items-center justify-center relative min-h-0">
                                    <div className="h-full w-full max-h-[140px] flex items-center justify-center">
                                        <PipelinePieChart active={activeDeals} won={wonDeals} lost={lostDeals} />
                                    </div>
                                </div>
                                <div className="flex justify-between border-t border-slate-100 pt-2 mt-1">
                                    <div className="text-center">
                                        <div className="text-[9px] uppercase text-slate-400 font-bold">Conv.</div>
                                        <div className="text-xs font-bold text-emerald-600">{stats.financials.conversion_rate}%</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-[9px] uppercase text-slate-400 font-bold">Total</div>
                                        <div className="text-xs font-bold text-slate-700">{stats.recentProposals.length}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Activity (Compact List) */}
                            <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl border border-white/60 dark:border-white/5 shadow-sm p-3 flex flex-col hover:bg-white/80 dark:hover:bg-slate-800/60 transition-colors overflow-hidden">
                                <SectionHeader title="Actividad Reciente" />
                                <div className="flex-1 overflow-y-auto mt-2 space-y-2 pr-1 custom-scrollbar">
                                    {stats.recentProposals.slice(0, 5).map((proposal) => (
                                        <div key={proposal.id} onClick={() => router.push(`/dashboard/proposals/${proposal.id}`)} className="flex items-center justify-between p-2 rounded-lg bg-white/50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500/30 cursor-pointer group transition-all">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className={`w-1.5 h-1.5 rounded-full ${proposal.status === 'accepted' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                                                <div className="min-w-0">
                                                    <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{proposal.client_name}</div>
                                                    <div className="text-[9px] text-slate-400">{formatCurrency(proposal.annual_savings)}</div>
                                                </div>
                                            </div>
                                            <ArrowUpRight size={12} className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-500" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN (Gamification) - 4 Cols */}
                    <div className="lg:col-span-4 flex flex-col gap-4 min-h-0 h-full">
                        {/* Leaderboard - Flex Grow to fill space */}
                        <div className="flex-[3] min-h-0 bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm p-0 overflow-hidden flex flex-col">
                            <div className="p-3 pb-0">
                                <SectionHeader title="Top Performers" />
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 pt-2 custom-scrollbar">
                                <LeaderboardWidget />
                            </div>
                        </div>

                        {/* Achievements - Smaller fixed height or flex */}
                        <div className="flex-[2] min-h-0 bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm p-0 overflow-hidden flex flex-col">
                            <div className="p-3 pb-0">
                                <SectionHeader title="Logros" />
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 pt-2 custom-scrollbar">
                                <AchievementsWidget />
                            </div>
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
            {link && <button className="text-[9px] font-medium text-indigo-400 hover:text-indigo-600 transition-colors uppercase tracking-wider">{link}</button>}
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
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay }} className="flex flex-col justify-between p-3 bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm transition-all hover:shadow-md">
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
