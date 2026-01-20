'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { crmService } from '@/services/crmService';
import { Client } from '@/types/crm';
import {
    Users,
    TrendingUp,
    Target,
    ArrowUpRight,
    ArrowRight,
    Plus,
    Home,
    Layers,
    Bell,
    Wallet,
    GraduationCap
} from 'lucide-react';
import { motion } from 'framer-motion';
// import { ZinergiaLogo } from '@/components/ui/ZinergiaLogo';
import { formatCurrency } from '@/lib/utils/format';
import { LeaderboardWidget } from '@/features/gamification/components/LeaderboardWidget';
import { AchievementsWidget } from '@/features/gamification/components/AchievementsWidget';
import { NotificationsPopover } from '@/features/crm/components/NotificationsPopover';
import { SavingsTrendChart, PipelinePieChart } from './DashboardCharts';
import { DashboardSkeleton } from '@/components/ui/DashboardSkeleton';

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
    const [notifications, setNotifications] = useState([
        { id: '1', type: 'success' as const, title: 'Comisión Aprobada', message: 'La venta de "Restaurante El Molino" ha sido validada.', created_at: new Date().toISOString(), read: false },
        { id: '2', type: 'info' as const, title: 'Nuevo Recurso', message: 'Se ha añadido "Tarifas 2026 Q1" a la Academy.', created_at: new Date(Date.now() - 3600000).toISOString(), read: false },
        { id: '3', type: 'warning' as const, title: 'Documentación Pendiente', message: 'Falta el CIF del cliente "Panadería Central".', created_at: new Date(Date.now() - 7200000).toISOString(), read: true },
    ]);

    const MONTHLY_GOAL = 10000;

    useEffect(() => {
        async function loadStats() {
            try {
                const data = await crmService.getDashboardStats();
                setStats({ ...DEFAULT_STATS, ...data } as DashboardStats);
            } catch (error) {
                console.warn('Dashboard stats partial load or failure:', error);
                // We don't throw, we interpret the partial state (likely defaults)
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

    if (loading) {
        return <DashboardSkeleton />;
    }

    return (
        <div className="min-h-screen bg-[#FAFAFA] text-slate-600 font-sans selection:bg-indigo-100 overflow-x-hidden relative">

            {/* --- CLEAN BACKGROUND WITH GLASS BLOB LAYERS --- */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                {/* Stronger Blooms for Glass Effect */}
                <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-indigo-200/40 rounded-full blur-[100px] mix-blend-multiply opacity-60 animate-pulse duration-[8s]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-emerald-100/60 rounded-full blur-[100px] mix-blend-multiply opacity-60"></div>
                <div className="absolute top-[40%] left-[30%] w-[40vw] h-[40vw] bg-violet-100/50 rounded-full blur-[80px] mix-blend-multiply"></div>
            </div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                // ULTRA DENSE PADDING
                className="max-w-[1600px] mx-auto px-4 py-4 md:px-6 md:py-6 pb-20 md:pb-6 relative z-10 flex flex-col gap-4 md:gap-5"
            >

                {/* 1. HEADER (Compact & Minimalist) */}
                <div className="flex items-center justify-between gap-4 relative">
                    {/* Empty left side or could hold page title if needed in future, currently kept for spacing balance */}
                    <div className="w-0"></div>

                    {/* Mobile Status Pill (Visible on small screens) */}
                    <div className="md:hidden flex items-center gap-3">
                        <button className="relative p-1.5 text-slate-500 hover:text-indigo-600" onClick={() => setIsNotifOpen(!isNotifOpen)}>
                            <Bell size={18} />
                            {unreadCount > 0 && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full border border-white"></span>}
                        </button>
                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-white/60 border border-indigo-100/50 rounded-full backdrop-blur-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span className="text-[9px] font-medium tracking-widest uppercase text-slate-400">Online</span>
                        </div>
                    </div>

                    {/* Desktop Status & Actions */}
                    <div className="hidden md:flex items-center gap-3">
                        <div className="relative">
                            <button
                                className="p-2 rounded-full bg-white/60 border border-slate-100 hover:bg-white text-slate-500 hover:text-indigo-600 transition-all shadow-sm"
                                onClick={() => setIsNotifOpen(!isNotifOpen)}
                            >
                                <Bell size={18} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full"></span>
                                )}
                            </button>
                            <NotificationsPopover
                                isOpen={isNotifOpen}
                                onClose={() => setIsNotifOpen(false)}
                                notifications={notifications}
                                onMarkAsRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
                                onMarkAllAsRead={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                                onDismiss={(id) => setNotifications(prev => prev.filter(n => n.id !== id))}
                            />
                        </div>

                        <div className="h-5 w-[1px] bg-slate-200"></div>

                        <div className="flex items-center gap-2">
                            <div className="text-right">
                                <p className="text-sm font-semibold text-slate-700">{stats.user?.full_name}</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white shadow-md flex items-center justify-center font-medium text-xs ring-2 ring-white">
                                {firstName[0]}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile Popover Position Fix */}
                <div className="md:hidden">
                    <NotificationsPopover
                        isOpen={isNotifOpen}
                        onClose={() => setIsNotifOpen(false)}
                        notifications={notifications}
                        onMarkAsRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
                        onMarkAllAsRead={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                        onDismiss={(id) => setNotifications(prev => prev.filter(n => n.id !== id))}
                    />
                </div>

                {/* 2. HERO GREETING (Minimalist) */}
                <div className="flex flex-col gap-1 md:gap-2">
                    <motion.h1
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="text-xl md:text-2xl font-medium text-slate-800 tracking-tight"
                    >
                        Hola, <span className="text-indigo-600">{firstName}.</span>
                    </motion.h1>
                </div>

                {/* 3. PRIMARY KPIs (Grid 2x2 on Mobile, 4x1 Desktop) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 pb-4 border-b border-indigo-100/50">
                    <GlassKpiCard
                        label="Ahorro Detectado"
                        value={formatCurrency(stats.financials.total_detected)}
                        icon={TrendingUp}
                        delay={0.2}
                    />
                    <GlassKpiCard
                        label="Objetivo Mensual"
                        value={`${goalProgress}%`}
                        icon={Target}
                        delay={0.3}
                        subValue={formatCurrency(MONTHLY_GOAL)}
                        progress={goalProgress}
                    />
                    <GlassKpiCard
                        label="Pipeline Activo"
                        value={formatCurrency(stats.financials.pipeline)}
                        icon={Layers}
                        delay={0.4}
                    />
                    {/* New Academy KPI / Quick Link - Compressed */}
                    <div
                        onClick={() => router.push('/dashboard/academy')}
                        className="col-span-1 cursor-pointer group flex flex-col justify-center gap-1 p-3 md:p-4 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl text-white shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95 h-full"
                    >
                        <div className="flex items-center gap-1.5 mb-1 text-indigo-200">
                            <GraduationCap size={14} strokeWidth={1.5} />
                            <span className="text-[10px] font-medium uppercase tracking-wider">Academia</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <div className="text-xl md:text-2xl font-medium tracking-tight text-white">
                                4 Nuevos
                            </div>
                        </div>
                        <div className="mt-auto text-[10px] font-medium text-indigo-100 flex items-center gap-1 group-hover:gap-2 transition-all">
                            Ir a Formación <ArrowRight size={10} />
                        </div>
                    </div>
                </div>

                {/* 4. CONTENT SECTIONS (Ultra Dense Grid) */}
                <div className="flex flex-col gap-4 lg:gap-5">

                    {/* TOP ROW: Trend (8) + Pipeline (4) */}
                    <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-5">
                        {/* A. Trend Chart */}
                        <div className="lg:col-span-8 flex flex-col gap-2">
                            <SectionHeader title="Tendencia" link="Reporte" />
                            <div className="h-[140px] md:h-[160px] w-full bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 shadow-[0_2px_10px_rgba(0,0,0,0.01)] p-2 overflow-hidden relative group transition-all hover:bg-white/50">
                                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent opacity-50"></div>
                                <SavingsTrendChart />
                            </div>
                        </div>

                        {/* B. Pipeline Status */}
                        <div className="lg:col-span-4 flex flex-col gap-2">
                            <SectionHeader title="Distribución" />
                            <div className="p-2 bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 shadow-[0_2px_10px_rgba(0,0,0,0.01)] relative group hover:bg-white/50 transition-all h-[140px] md:h-[160px] flex flex-col justify-center">
                                <div className="scale-90 origin-center h-[100px]">
                                    <PipelinePieChart active={activeDeals} won={wonDeals} lost={lostDeals} />
                                </div>
                                <div className="mt-1 flex justify-between border-t border-slate-200/30 pt-1 px-2">
                                    <div>
                                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0">Conv.</p>
                                        <p className="text-sm font-medium text-emerald-600">{stats.financials.conversion_rate}%</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0">Vol.</p>
                                        <p className="text-sm font-medium text-slate-800">{stats.recentProposals.length}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* BOTTOM ROW: Leaderboard (4) + Achievements (4) + Activity (4) */}
                    <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-5">

                        {/* C. Leaderboard */}
                        <div className="lg:col-span-4 flex flex-col gap-2">
                            <SectionHeader title="Top Performers" />
                            <div className="flex-1 min-h-[140px]">
                                <LeaderboardWidget />
                            </div>
                        </div>

                        {/* D. Achievements */}
                        <div className="lg:col-span-4 flex flex-col gap-2">
                            <SectionHeader title="Logros" />
                            <div className="flex-1 min-h-[140px]">
                                <AchievementsWidget />
                            </div>
                        </div>

                        {/* E. Activity Feed */}
                        <div className="lg:col-span-4 flex flex-col gap-2">
                            <SectionHeader title="Actividad Reciente" />
                            <div className="flex flex-col gap-1.5 h-full">
                                {stats.recentProposals.slice(0, 3).map((proposal, i) => (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        key={proposal.id}
                                        className="group flex flex-col justify-between p-1.5 bg-white/40 backdrop-blur-sm rounded-xl border border-white/40 hover:bg-white/80 hover:shadow-sm hover:border-white/80 transition-all cursor-pointer gap-0.5 flex-1"
                                        onClick={() => router.push(`/dashboard/proposals/${proposal.id}`)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium border shadow-sm
                                                ${proposal.status === 'accepted' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-white border-white/60 text-slate-400'}`}>
                                                {i + 1}
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-medium text-slate-700 group-hover:text-indigo-600 transition-colors">{proposal.client_name}</h4>
                                                <p className="text-[8px] text-slate-400">Ref: {proposal.id.substring(0, 6)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pl-7">
                                            <div className="text-left">
                                                <p className="text-[10px] font-bold text-slate-700">{formatCurrency(proposal.annual_savings)}</p>
                                                <p className="text-[8px] text-slate-400">{new Date(proposal.created_at).toLocaleDateString()}</p>
                                            </div>
                                            <div className="w-4 h-4 rounded-full bg-white/0 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-all">
                                                <ArrowUpRight size={10} />
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                    </div>

                </div>

            </motion.div>

            {/* 4. FLOATING DOCK (Smaller & Compact) */}
            <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-auto px-4">
                <div className="flex items-center justify-center gap-1 md:gap-2 p-1.5 bg-white/70 backdrop-blur-2xl border border-white/40 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-slate-200/20">

                    <DockItem icon={<Home size={18} />} label="Inicio" active />
                    <DockItem icon={<Users size={18} />} label="Clientes" onClick={() => router.push('/dashboard/clients')} />
                    <DockItem icon={<Plus size={20} />} label="Crear" highlight onClick={() => router.push('/dashboard/comparator')} />
                    <DockItem icon={<Wallet size={18} />} label="Cartera" onClick={() => router.push('/dashboard/wallet')} />
                    <DockItem icon={<Layers size={18} />} label="Red" onClick={() => router.push('/dashboard/network')} />

                </div>
            </div>

        </div>
    );
}

// -- SUBCOMPONENTS FOR CLEANER CODE & REUSE --

function SectionHeader({ title, link }: { title: string, link?: string }) {
    return (
        <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold text-slate-700 tracking-tight flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                {title}
            </h3>
            {link && <button className="text-[9px] font-bold text-indigo-500 bg-indigo-50/50 hover:bg-indigo-100 px-2 py-0.5 rounded-full transition tracking-wide uppercase">{link}</button>}
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
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="flex flex-col gap-0.5 p-3 md:p-0 bg-white/40 md:bg-transparent backdrop-blur-md md:backdrop-blur-none rounded-2xl md:rounded-none border border-white/50 md:border-none shadow-sm md:shadow-none min-h-[80px]"
        >
            <div className="flex items-center gap-1.5 mb-1 text-slate-400">
                <Icon size={14} strokeWidth={1.5} />
                <span className="text-[10px] font-medium uppercase tracking-wider line-clamp-1">{label}</span>
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
                <div className="text-xl lg:text-2xl font-normal tracking-tight text-slate-800">
                    {value}
                </div>
                {subValue && <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{subValue}</span>}
            </div>
            {progress !== undefined && (
                <div className="w-full h-1 bg-white/50 mt-2 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1.2, ease: "circOut", delay: delay + 0.2 }}
                        className="h-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.4)]"
                    ></motion.div>
                </div>
            )}
        </motion.div>
    );
}

function DockItem({ icon, active, highlight, onClick }: { icon: React.ReactNode, label: string, active?: boolean, highlight?: boolean, onClick?: () => void }) {
    return (
        <div
            onClick={onClick}
            className={`
                group relative flex flex-col items-center justify-center w-10 h-10 md:w-11 md:h-11 rounded-xl cursor-pointer transition-all duration-300
                ${active ? 'bg-white shadow-sm text-slate-900 border border-slate-100' : 'text-slate-400 hover:text-slate-600 hover:bg-white/40'}
                ${highlight ? '!bg-indigo-600 !text-white !border-indigo-500 shadow-md shadow-indigo-500/20 hover:!scale-105' : ''}
            `}
        >
            {icon}
        </div>
    );
}
