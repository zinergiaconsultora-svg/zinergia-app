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
import { ZinergiaLogo } from '@/components/ui/ZinergiaLogo';
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
                // SAFETY PADDING FOR MOBILE: pb-40 ensures scrolling past the Floating Dock
                className="max-w-[1600px] mx-auto px-6 py-8 md:px-8 md:py-10 pb-40 relative z-10 flex flex-col gap-10 md:gap-12"
            >

                {/* 1. HEADER (Mobile Adjusted) */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
                    <div className="flex items-center justify-between w-full md:w-auto">
                        <ZinergiaLogo className="relative w-32 md:w-36 text-slate-800" />

                        {/* Mobile Status Pill (Visible on small screens) */}
                        <div className="md:hidden flex items-center gap-4">
                            <button className="relative p-2 text-slate-500 hover:text-indigo-600" onClick={() => setIsNotifOpen(!isNotifOpen)}>
                                <Bell size={20} />
                                {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>}
                            </button>
                            <div className="flex items-center gap-2 px-3 py-1 bg-white/60 border border-indigo-100/50 rounded-full backdrop-blur-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                <span className="text-[10px] font-medium tracking-widest uppercase text-slate-400">Online</span>
                            </div>
                        </div>
                    </div>

                    {/* Desktop Status & Actions */}
                    <div className="hidden md:flex items-center gap-6">
                        <div className="relative">
                            <button
                                className="p-3 rounded-full bg-white/60 border border-slate-100 hover:bg-white text-slate-500 hover:text-indigo-600 transition-all shadow-sm"
                                onClick={() => setIsNotifOpen(!isNotifOpen)}
                            >
                                <Bell size={20} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-0 right-0 w-3 h-3 bg-rose-500 border-2 border-white rounded-full"></span>
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

                        <div className="flex items-center gap-2 px-3 py-1 bg-white/60 border border-slate-200/50 rounded-full backdrop-blur-sm shadow-sm transition-all hover:bg-white/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span className="text-[10px] font-medium tracking-widest uppercase text-slate-400">Sistema Activo</span>
                        </div>

                        <div className="h-6 w-[1px] bg-slate-200"></div>

                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <p className="text-sm font-medium text-slate-700">{stats.user?.full_name}</p>
                                <p className="text-[10px] uppercase tracking-wider text-indigo-500 font-medium">{stats.user?.role}</p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-white/80 border border-slate-100 shadow-sm flex items-center justify-center text-indigo-600 font-medium text-sm backdrop-blur-sm ring-2 ring-white/50">
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

                {/* 2. HERO GREETING (Mobile Left Aligned) */}
                <div className="flex flex-col gap-3">
                    <motion.h1
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="text-3xl md:text-5xl font-light text-slate-800 tracking-tight"
                    >
                        Hola, <span className="text-indigo-600 font-normal border-b-2 border-indigo-100 pb-1">{firstName}.</span>
                    </motion.h1>
                    <motion.p
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-lg text-slate-500 font-light leading-relaxed max-w-2xl"
                    >
                        Resumen del día: <strong className="text-slate-700 font-medium">+{stats.new} nuevos clientes</strong> y un cierre estimado del <strong className="text-emerald-600 font-medium">{stats.financials.conversion_rate}%</strong> en tu pipeline.
                    </motion.p>
                </div>

                {/* 3. PRIMARY KPIs (Stacked Flex Column on Mobile) */}
                <div className="flex flex-col md:grid md:grid-cols-4 gap-6 md:gap-6 pb-8 md:pb-12 border-b border-indigo-100/50">
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
                    {/* New Academy KPI / Quick Link */}
                    <div
                        onClick={() => router.push('/dashboard/academy')}
                        className="cursor-pointer group flex flex-col gap-1 p-6 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl text-white shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95"
                    >
                        <div className="flex items-center gap-2 mb-2 text-indigo-200">
                            <GraduationCap size={16} strokeWidth={1.5} />
                            <span className="text-xs font-medium uppercase tracking-wider">Academia</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <div className="text-3xl font-medium tracking-tight text-white">
                                4 Nuevos
                            </div>
                        </div>
                        <div className="mt-auto text-xs font-medium text-indigo-100 flex items-center gap-1 group-hover:gap-2 transition-all">
                            Ir a Formación <ArrowRight size={12} />
                        </div>
                    </div>
                </div>

                {/* 4. CONTENT SECTIONS (Flex Column Stacking) */}
                <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 lg:gap-12">

                    {/* A. Trend Chart (Glass Container) */}
                    <div className="flex flex-col gap-4 lg:col-span-8">
                        <SectionHeader title="Tendencia de Ahorro" link="Ver Reporte" />
                        <div className="h-[300px] w-full bg-white/40 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-4 md:p-6 overflow-hidden relative group transition-all hover:bg-white/50 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                            {/* Inner Glass Highlight */}
                            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent opacity-50"></div>
                            <SavingsTrendChart />
                        </div>
                    </div>

                    {/* B. Pipeline Status & Stats */}
                    <div className="flex flex-col gap-4 lg:col-span-4">
                        <SectionHeader title="Distribución" />
                        <div className="p-6 bg-white/40 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_4px_20px_rgba(0,0,0,0.02)] relative group hover:bg-white/50 transition-all">
                            <PipelinePieChart active={activeDeals} won={wonDeals} lost={lostDeals} />

                            <div className="mt-6 flex justify-between border-t border-slate-200/30 pt-4">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Conversión</p>
                                    <p className="text-xl font-medium text-emerald-600">{stats.financials.conversion_rate}%</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Volumen</p>
                                    <p className="text-xl font-medium text-slate-800">{stats.recentProposals.length}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* C. Leaderboard & Achievements */}
                    <div className="flex flex-col gap-6 lg:col-span-4 lg:row-start-2">
                        {/* Leaderboard */}
                        <div className="flex-1 min-h-[400px]">
                            <SectionHeader title="Top Performers" />
                            <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] border border-white/60 shadow-[0_4px_20px_rgba(0,0,0,0.02)] overflow-hidden h-full">
                                <LeaderboardWidget />
                            </div>
                        </div>

                        {/* Achievements */}
                        <div className="h-auto">
                            <AchievementsWidget />
                        </div>
                    </div>

                    {/* D. Activity Feed */}
                    <div className="flex flex-col gap-4 lg:col-span-8 lg:row-start-2">
                        <SectionHeader title="Actividad Reciente" />
                        <div className="flex flex-col gap-3">
                            {stats.recentProposals.slice(0, 4).map((proposal, i) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    key={proposal.id}
                                    className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/40 backdrop-blur-sm rounded-2xl border border-white/40 hover:bg-white/80 hover:shadow-md hover:border-white/80 transition-all cursor-pointer gap-4 sm:gap-0"
                                    onClick={() => router.push(`/dashboard/proposals/${proposal.id}`)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border shadow-sm
                                            ${proposal.status === 'accepted' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-white border-white/60 text-slate-400'}`}>
                                            {i + 1}
                                        </div>
                                        <div>
                                            <h4 className="text-base font-medium text-slate-700 group-hover:text-indigo-600 transition-colors">{proposal.client_name}</h4>
                                            <p className="text-xs text-slate-400">Ref: {proposal.id.substring(0, 6)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pl-14 sm:pl-0">
                                        <div className="text-left sm:text-right">
                                            <p className="text-sm font-medium text-slate-700">{formatCurrency(proposal.annual_savings)}</p>
                                            <p className="text-[10px] text-slate-400">{new Date(proposal.created_at).toLocaleDateString()}</p>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-white/0 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-all">
                                            <ArrowUpRight size={18} />
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                </div>

            </motion.div>

            {/* 4. FLOATING DOCK (Mobile Safe & Centered) */}
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-[340px] md:max-w-fit px-4 md:px-0">
                <div className="flex items-center justify-between md:justify-center gap-1 md:gap-3 p-2 bg-white/70 backdrop-blur-2xl border border-white/40 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-slate-200/20">

                    <DockItem icon={<Home size={20} />} label="Inicio" active />
                    <DockItem icon={<Users size={20} />} label="Clientes" onClick={() => router.push('/dashboard/clients')} />
                    <DockItem icon={<Plus size={24} />} label="Crear" highlight onClick={() => router.push('/dashboard/comparator')} />
                    <DockItem icon={<Wallet size={20} />} label="Cartera" onClick={() => router.push('/dashboard/wallet')} />
                    <DockItem icon={<Layers size={20} />} label="Red" onClick={() => router.push('/dashboard/network')} />

                </div>
            </div>

        </div>
    );
}

// -- SUBCOMPONENTS FOR CLEANER CODE & REUSE --

function SectionHeader({ title, link }: { title: string, link?: string }) {
    return (
        <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-medium text-slate-800 tracking-tight flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                {title}
            </h3>
            {link && <button className="text-[10px] font-bold text-indigo-500 bg-indigo-50/50 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition tracking-wide uppercase">{link}</button>}
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
            className="flex flex-col gap-1 p-6 md:p-0 bg-white/40 md:bg-transparent backdrop-blur-md md:backdrop-blur-none rounded-3xl md:rounded-none border border-white/50 md:border-none shadow-sm md:shadow-none"
        >
            <div className="flex items-center gap-2 mb-2 text-slate-400">
                <Icon size={16} strokeWidth={1.5} />
                <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
            </div>
            <div className="flex items-baseline gap-3">
                <div className="text-4xl lg:text-5xl font-normal tracking-tight text-slate-800">
                    {value}
                </div>
                {subValue && <span className="text-sm font-medium text-slate-400 uppercase tracking-widest">{subValue}</span>}
            </div>
            {progress !== undefined && (
                <div className="w-full h-1 bg-white/50 mt-4 rounded-full overflow-hidden">
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
                group relative flex flex-col items-center justify-center w-12 h-12 rounded-2xl cursor-pointer transition-all duration-300
                ${active ? 'bg-white shadow-sm text-slate-900 border border-slate-100' : 'text-slate-400 hover:text-slate-600 hover:bg-white/40'}
                ${highlight ? '!bg-indigo-600 !text-white !border-indigo-500 shadow-md shadow-indigo-500/20 hover:!scale-105' : ''}
            `}
        >
            {icon}
            {/* Mobile Tooltip (Optional or hidden to reuse space) - kept hidden for cleaner dock */}
            {active && <span className="absolute -bottom-2 w-1 h-1 bg-indigo-500 rounded-full"></span>}
        </div>
    );
}
