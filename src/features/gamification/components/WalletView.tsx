'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
    Wallet,
    TrendingUp,
    Clock,
    ArrowUpRight,
    CreditCard,
    DollarSign,
    CheckCircle2,
    Calendar,
    Briefcase
} from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { AmbientBackground } from '@/components/ui/AmbientBackground';

export default function WalletView() {
    const {
        commissions,
        loading,
        userRole,
        userId,
        pendingBalance,
        availableBalance,
        totalEarned,
        franchisePersonal,
        franchiseNetwork,
        handleSimulateSale
    } = useWallet();

    const nextPayoutDate = new Date();
    nextPayoutDate.setDate(15); // Hypothetical payout on the 15th
    if (nextPayoutDate < new Date()) nextPayoutDate.setMonth(nextPayoutDate.getMonth() + 1);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-energy-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20 relative">
            <AmbientBackground />

            {/* Header */}
            <div className="flex items-end justify-between relative z-10">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Wallet className="text-energy-600" />
                        Mi Cartera
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Gestión de comisiones y pagos.</p>
                </div>
                <button
                    onClick={handleSimulateSale}
                    className="px-3 py-1.5 text-xs font-mono font-bold text-slate-400 border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-energy-600 transition-colors"
                >
                    DEV: SIMULAR VENTA
                </button>
            </div>

            {/* Main Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">

                {/* 1. The Super-Premium Black Card (Full width on mobile if needed, but col-1 is standard) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="md:col-span-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[28px] p-6 text-white shadow-2xl shadow-slate-900/20 relative overflow-hidden flex flex-col justify-between min-h-[220px] group border border-slate-700/50"
                >
                    {/* Glossy Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50 pointer-events-none"></div>
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-energy-500 rounded-full blur-[80px] opacity-20 group-hover:opacity-30 transition-opacity"></div>

                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-8">
                            <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-xl border border-white/10 shrink-0">
                                <CreditCard size={20} className="text-white" />
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-500/30 backdrop-blur-sm">
                                    Wallet Activa
                                </span>
                            </div>
                        </div>
                        <div>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Saldo Disponible</p>
                            <h2 className="text-4xl lg:text-5xl font-black tracking-tighter text-white tabular-nums">
                                {formatCurrency(availableBalance)}
                            </h2>
                            {userRole === 'franchise' && (
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-medium">
                                    <span title="Tus Ventas">Personal: <span className="text-white">{formatCurrency(franchisePersonal)}</span></span>
                                    <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                                    <span title="Comisiones de Red">Red: <span className="text-emerald-400">+{formatCurrency(franchiseNetwork)}</span></span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="relative z-10 mt-auto pt-6 flex items-center justify-between border-t border-white/10">
                        <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Próximo Pago</p>
                            <p className="text-sm font-medium text-white shadow-black/50 drop-shadow-sm">
                                {formatDate(nextPayoutDate.toISOString(), { month: 'long', day: 'numeric' })}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">
                                {userRole === 'franchise' ? 'Franquicia' : 'Agente'}
                            </p>
                            <div className="flex items-center gap-1.5 justify-end">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
                                <p className="text-xs font-mono text-slate-200 truncate max-w-[80px]" title={userId}>
                                    ID-{userId.slice(0, 4)}
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* 2. Stats Grid - Clean & Minimal */}
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 h-full">

                    {/* Pending */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white/70 backdrop-blur-xl p-6 rounded-[24px] border border-white/60 shadow-sm flex flex-col justify-center relative overflow-hidden group min-h-[160px]"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Clock size={80} className="text-amber-500 transform rotate-12" />
                        </div>
                        <div className="flex items-center gap-3 mb-3 relative z-10">
                            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                                <Clock size={20} />
                            </div>
                            <span className="text-sm font-bold text-slate-500 uppercase tracking-wide">Pendiente</span>
                        </div>
                        <p className="text-3xl font-black text-slate-900 tracking-tight relative z-10">{formatCurrency(pendingBalance)}</p>
                        <div className="mt-2 flex items-center gap-2 relative z-10">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            <p className="text-xs text-slate-400 font-medium">Validación en curso</p>
                        </div>
                    </motion.div>

                    {/* Total Earned */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white/70 backdrop-blur-xl p-6 rounded-[24px] border border-white/60 shadow-sm flex flex-col justify-center relative overflow-hidden group min-h-[160px]"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <TrendingUp size={80} className="text-energy-600 transform -rotate-6" />
                        </div>
                        <div className="flex items-center gap-3 mb-3 relative z-10">
                            <div className="p-2.5 bg-energy-50 text-energy-600 rounded-xl">
                                <TrendingUp size={20} />
                            </div>
                            <span className="text-sm font-bold text-slate-500 uppercase tracking-wide">Ingresos Totales</span>
                        </div>
                        <p className="text-3xl font-black text-slate-900 tracking-tight relative z-10">{formatCurrency(totalEarned)}</p>
                        <p className="text-xs text-emerald-600 font-bold mt-2 flex items-center gap-1 bg-emerald-50 w-fit px-2 py-0.5 rounded-full relative z-10">
                            <ArrowUpRight size={12} />
                            +12% crecimiento
                        </p>
                    </motion.div>

                    {/* Quick Action: Request Payout */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="sm:col-span-2 bg-gradient-to-r from-energy-600 to-energy-700 p-1 rounded-[24px] shadow-lg shadow-energy-600/20"
                    >
                        <div className="bg-white rounded-[22px] p-4 flex flex-col sm:flex-row sm:items-center justify-between h-full gap-4 sm:gap-0">
                            <div className="flex items-center gap-4 pl-2">
                                <div className="bg-energy-50 p-3 rounded-2xl text-energy-600">
                                    <DollarSign size={24} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 leading-tight">Solicitar Retiro</h3>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">Transferencia inmediata a su cuenta</p>
                                </div>
                            </div>
                            <button
                                disabled={availableBalance === 0}
                                className="w-full sm:w-auto bg-slate-900 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 text-center"
                            >
                                Retirar Fondos
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Recent Transactions List */}
            <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-sm border border-white/60 overflow-hidden relative z-10">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900">Movimientos Recientes</h3>
                    <button className="text-xs font-bold text-energy-600 hover:text-energy-800">Ver todo</button>
                </div>

                <div className="divide-y divide-slate-50">
                    {commissions.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 text-sm">
                            No hay movimientos registrados aún.
                        </div>
                    ) : (
                        commissions.map((comm) => (
                            <div key={comm.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${comm.status === 'paid' ? 'bg-green-100 text-green-600' :
                                        comm.status === 'cleared' ? 'bg-energy-100 text-energy-600' :
                                            'bg-slate-100 text-slate-500'
                                        }`}>
                                        {comm.status === 'paid' ? <CheckCircle2 size={18} /> :
                                            comm.status === 'cleared' ? <Wallet size={18} /> :
                                                <Clock size={18} />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">Comisión Venta #{comm.proposal_id.substring(0, 6)}</p>
                                        <p className="text-xs text-slate-500 flex items-center gap-2">
                                            <span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(comm.created_at)}</span>
                                            {comm.proposals?.clients?.name && <span className="flex items-center gap-1"><Briefcase size={10} /> {comm.proposals.clients.name}</span>}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-slate-900">+{formatCurrency(comm.agent_commission)}</p>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${comm.status === 'paid' ? 'bg-green-100 text-green-700' :
                                        comm.status === 'cleared' ? 'bg-brand-blue/10 text-brand-blue' :
                                            'bg-amber-100 text-amber-700'
                                        }`}>
                                        {comm.status === 'cleared' ? 'Disponible' : comm.status === 'paid' ? 'Pagado' : 'Pendiente'}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
