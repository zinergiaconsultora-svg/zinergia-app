'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Building2,
    Users,
    Coins,
    FileCheck,
    ChevronDown,
    Zap,
    Receipt,
    BadgePercent,
    Layers,
    ArrowUpRight
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { AdminStats, FranchiseWithAgents, AgentProfile } from '@/app/actions/admin';
import FranchiseList from './FranchiseList';
import { formatCurrency } from '@/lib/utils/format';

const OcrJobsPanel = dynamic(() => import('@/features/crm/components/OcrJobsPanel'), {
    ssr: false,
    loading: () => <div className="h-full bg-slate-100/50 dark:bg-slate-800/30 animate-pulse rounded-2xl" />,
});

interface AdminDashboardProps {
    stats: AdminStats;
    franchises: FranchiseWithAgents[];
    unassignedAgents: AgentProfile[];
}

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1
        }
    }
};

const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

interface KpiCardProps {
    label: string;
    value: string;
    icon: React.ElementType;
    subValue?: string;
    href?: string;
    delay?: number;
}

function GlassKpiCard({ label, value, icon: Icon, subValue, href, delay = 0 }: KpiCardProps) {
    const CardContent = (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay }} className="flex flex-col justify-between p-4 bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-white/80 dark:border-white/10 shadow-lg hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 h-full">
            <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</span>
                <Icon size={16} strokeWidth={1.5} className="opacity-80 text-indigo-500 dark:text-indigo-400" />
            </div>
            <div>
                <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{value}</span>
                </div>
                {subValue && <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide mt-1 block">{subValue}</span>}
            </div>
        </motion.div>
    );

    return href ? <Link href={href} className="block h-full cursor-pointer">{CardContent}</Link> : CardContent;
}

function SectionHeader({ title, icon: Icon, link }: { title: string; icon?: React.ElementType; link?: string }) {
    return (
        <div className="flex items-center justify-between px-1 mb-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                {Icon && <Icon size={14} className="text-indigo-400 dark:text-indigo-500" />}
                {title}
            </h3>
            {link && <button type="button" className="text-[9px] font-medium text-indigo-400 hover:text-indigo-600 transition-colors uppercase tracking-wider">{link}</button>}
        </div>
    );
}

export default function AdminDashboard({ stats, franchises, unassignedAgents }: AdminDashboardProps) {
    const [showFranchises, setShowFranchises] = useState(true);

    return (
        <div className="w-full text-slate-600 dark:text-slate-300 font-sans overflow-x-hidden flex flex-col relative selection:bg-indigo-100">
            {/* Background Effects */}
            <div className="hidden lg:block fixed inset-0 pointer-events-none z-[-1]">
                <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-indigo-200/50 dark:bg-indigo-900/20 rounded-full blur-[80px] mix-blend-multiply dark:mix-blend-screen opacity-50"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[30vw] h-[30vw] bg-emerald-100/50 dark:bg-emerald-900/20 rounded-full blur-[80px] mix-blend-multiply dark:mix-blend-screen opacity-50"></div>
            </div>

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="flex-1 flex flex-col px-0 gap-6 w-full z-10"
            >
                {/* Header Row */}
                <motion.div variants={item} className="flex flex-col gap-1 mb-2">
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                        Vista Global del Sistema
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-2xl">
                        Monitoriza la actividad en tiempo real, liquidaciones de comisiones y el rendimiento de la red comercial de Zinergia de un vistazo.
                    </p>
                </motion.div>

                {/* KPI Grid */}
                <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <GlassKpiCard
                        label="Franquicias"
                        value={stats.activeFranchises.toString()}
                        subValue={`${stats.totalFranchises} registradas`}
                        icon={Building2}
                        delay={0.1}
                    />
                    <GlassKpiCard
                        label="Agentes Activos"
                        value={stats.totalAgents.toString()}
                        subValue={`En la red Zinergia`}
                        icon={Users}
                        delay={0.2}
                    />
                    <GlassKpiCard
                        label="Comisiones (Pagadas)"
                        value={stats.commissionsPaid.toString()}
                        subValue="Liquidaciones abonadas"
                        icon={FileCheck}
                        href="/dashboard/tariffs?tab=commissions"
                        delay={0.3}
                    />
                    <GlassKpiCard
                        label="V. Comisiones Generado"
                        value={formatCurrency(stats.totalCommissionValue)}
                        subValue={`${stats.commissionsPending} pendientes`}
                        icon={Coins}
                        href="/dashboard/tariffs?tab=commissions"
                        delay={0.4}
                    />
                </motion.div>

                {/* BENTO GRID ROW */}
                <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    
                    {/* Col 1: Accesos Rápidos (1/3) */}
                    <div className="lg:col-span-1 flex flex-col gap-4">
                        <Link href="/dashboard/tariffs" className="flex-1 group rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl border border-white/80 dark:border-white/10 shadow-lg p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-center">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center border border-indigo-100 dark:border-indigo-500/20">
                                    <Receipt className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <ArrowUpRight className="w-5 h-5 text-indigo-400 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-indigo-600 transition-all" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Gestión de Tarifas</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Configura precios P1-P6 y fija las reglas comerciales base para luz y gas.</p>
                        </Link>

                        <Link href="/dashboard/tariffs?tab=commissions" className="flex-1 group rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl border border-white/80 dark:border-white/10 shadow-lg p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-center">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center border border-emerald-100 dark:border-emerald-500/20">
                                    <BadgePercent className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <ArrowUpRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-emerald-600 transition-all" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Reglas de Comisión</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Ajusta los repartos y porcentajes fijos para la red de agentes y comerciales.</p>
                        </Link>
                    </div>

                    {/* Col 2 & 3: Global OCR Jobs (2/3) */}
                    <div className="lg:col-span-2 flex flex-col h-[400px]">
                        <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-white/80 dark:border-white/10 shadow-lg px-4 pt-4 pb-0 flex-1 flex flex-col hover:shadow-xl transition-all relative overflow-hidden">
                            <SectionHeader title="Actividad Global de Subidas (OCR)" icon={Layers} />
                            <div className="flex-1 relative w-full h-full -mx-4 px-4 overflow-hidden [&>div]:h-full [&>div]:flex [&>div]:flex-col [&>div>div:last-child]:flex-1 [&>div>div:last-child]:overflow-auto pb-4">
                                <OcrJobsPanel />
                            </div>
                        </div>
                    </div>

                </motion.div>

                {/* Franchise List Section */}
                <motion.div variants={item} className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-white/80 dark:border-white/10 shadow-lg overflow-hidden my-4 hover:shadow-xl transition-all">
                    <button
                        type="button"
                        onClick={() => setShowFranchises(!showFranchises)}
                        className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <Zap className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Gestión de Arquitectura Comercial</h2>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showFranchises ? 'rotate-180' : ''}`} />
                    </button>

                    {showFranchises && (
                        <div className="px-6 pb-6 border-t border-slate-100 dark:border-slate-800/50 pt-4">
                            <FranchiseList franchises={franchises} unassignedAgents={unassignedAgents} />
                        </div>
                    )}
                </motion.div>

            </motion.div>
        </div>
    );
}
