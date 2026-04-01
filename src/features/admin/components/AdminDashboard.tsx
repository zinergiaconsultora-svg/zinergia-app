'use client';

import React, { useState } from 'react';
import {
    Building2,
    Users,
    Coins,
    FileCheck,
    TrendingUp,
    Shield,
    Activity,
    Zap,
    Receipt,
    ArrowRight,
    BadgePercent
} from 'lucide-react';
import type { AdminStats, FranchiseWithAgents, AgentProfile } from '@/app/actions/admin';
import FranchiseList from './FranchiseList';

interface AdminDashboardProps {
    stats: AdminStats;
    franchises: FranchiseWithAgents[];
    unassignedAgents: AgentProfile[];
}

function KpiCard({
    label,
    value,
    subtitle,
    icon: Icon,
    accentColor = 'indigo',
}: {
    label: string;
    value: string | number;
    subtitle?: string;
    icon: React.ElementType;
    accentColor?: 'indigo' | 'emerald' | 'amber' | 'rose';
}) {
    const colorMap = {
        indigo: {
            bg: 'bg-indigo-500/10',
            border: 'border-indigo-500/20',
            icon: 'text-indigo-400',
            glow: 'shadow-indigo-500/5',
        },
        emerald: {
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/20',
            icon: 'text-emerald-400',
            glow: 'shadow-emerald-500/5',
        },
        amber: {
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/20',
            icon: 'text-amber-400',
            glow: 'shadow-amber-500/5',
        },
        rose: {
            bg: 'bg-rose-500/10',
            border: 'border-rose-500/20',
            icon: 'text-rose-400',
            glow: 'shadow-rose-500/5',
        },
    };

    const c = colorMap[accentColor];

    return (
        <div className={`relative rounded-2xl ${c.bg} border ${c.border} p-5 backdrop-blur-sm shadow-xl ${c.glow} transition-all hover:scale-[1.02] hover:shadow-2xl`}>
            <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${c.icon}`} />
                </div>
                {subtitle && (
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        {subtitle}
                    </span>
                )}
            </div>
            <p className="text-3xl font-black text-white tracking-tight">{value}</p>
            <p className="text-xs font-medium text-slate-400 mt-1">{label}</p>
        </div>
    );
}

export default function AdminDashboard({ stats, franchises, unassignedAgents }: AdminDashboardProps) {
    const [showFranchises, setShowFranchises] = useState(true);

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-white">Panel de Control</h1>
                    <p className="text-sm text-slate-400">Vista global del sistema Zinergia</p>
                </div>
            </div>

            {/* Acciones rápidas admin */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a href="/dashboard/tariffs" className="group flex items-center gap-4 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 p-5 hover:bg-indigo-600/20 hover:border-indigo-500/40 transition-all">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                        <Receipt className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">Gestión de Tarifas</p>
                        <p className="text-xs text-slate-400">Editar precios, añadir productos y configurar comisiones</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-1 transition-transform shrink-0" />
                </a>
                <a href="/dashboard/tariffs#commissions" className="group flex items-center gap-4 rounded-2xl bg-violet-600/10 border border-violet-500/20 p-5 hover:bg-violet-600/20 hover:border-violet-500/40 transition-all">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                        <BadgePercent className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">% Comisión Colaboradores</p>
                        <p className="text-xs text-slate-400">Ajustar el porcentaje que reciben los comerciales</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-violet-400 group-hover:translate-x-1 transition-transform shrink-0" />
                </a>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    label="Franquicias Activas"
                    value={stats.activeFranchises}
                    subtitle={`${stats.totalFranchises} total`}
                    icon={Building2}
                    accentColor="indigo"
                />
                <KpiCard
                    label="Agentes Registrados"
                    value={stats.totalAgents}
                    icon={Users}
                    accentColor="emerald"
                />
                <KpiCard
                    label="Comisiones Totales"
                    value={`${stats.totalCommissionValue.toFixed(0)} €`}
                    subtitle={`${stats.commissionsPaid} pagadas`}
                    icon={Coins}
                    accentColor="amber"
                />
                <KpiCard
                    label="Cierres Mensuales"
                    value={stats.billingCyclesClosed}
                    icon={FileCheck}
                    accentColor="rose"
                />
            </div>

            {/* Commission Distribution */}
            <div className="rounded-2xl bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm p-6">
                <div className="flex items-center gap-3 mb-5">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-lg font-bold text-white">Distribución de Comisiones</h2>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                        <p className="text-2xl font-black text-amber-400">{stats.commissionsPending}</p>
                        <p className="text-xs text-slate-400 mt-1">Pendientes</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                        <p className="text-2xl font-black text-indigo-400">{stats.commissionsCleared}</p>
                        <p className="text-xs text-slate-400 mt-1">Aprobadas</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                        <p className="text-2xl font-black text-emerald-400">{stats.commissionsPaid}</p>
                        <p className="text-xs text-slate-400 mt-1">Pagadas</p>
                    </div>
                </div>
            </div>

            {/* Franchise Section */}
            <div className="rounded-2xl bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm overflow-hidden">
                <button
                    onClick={() => setShowFranchises(!showFranchises)}
                    className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-800/30 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <Zap className="w-5 h-5 text-indigo-400" />
                        <h2 className="text-lg font-bold text-white">Gestión de Franquicias</h2>
                        <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">
                            {franchises.length}
                        </span>
                    </div>
                    <TrendingUp className={`w-4 h-4 text-slate-500 transition-transform ${showFranchises ? 'rotate-180' : ''}`} />
                </button>

                {showFranchises && (
                    <div className="px-6 pb-6">
                        <FranchiseList
                            franchises={franchises}
                            unassignedAgents={unassignedAgents}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
