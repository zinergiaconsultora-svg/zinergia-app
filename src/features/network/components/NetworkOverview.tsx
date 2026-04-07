import React from 'react';
import { Users, Building2, TrendingUp, Sparkles, ArrowUpRight, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/utils/format';

interface NetworkStatsProps {
    stats: {
        totalAgents: number;
        activeFranchises: number;
        totalVolumen: number;
        monthlyGrowth: number;
    };
}

export const NetworkOverview: React.FC<NetworkStatsProps> = ({ stats }) => {
    const royalty = stats.totalVolumen * 0.1;
    const growth = stats.monthlyGrowth;

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">

            {/* Agentes */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0 }}
                className="relative bg-white rounded-2xl border border-slate-100 p-5 shadow-sm overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
            >
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-indigo-50 rounded-full opacity-60 group-hover:scale-125 transition-transform duration-500" />
                <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
                            <Users size={18} className="text-indigo-500" strokeWidth={2} />
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Red</span>
                    </div>
                    <p className="text-3xl font-black text-slate-900 tracking-tight mb-1">{stats.totalAgents}</p>
                    <p className="text-xs font-semibold text-slate-400">Colaboradores activos</p>
                </div>
            </motion.div>

            {/* Franquicias */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 }}
                className="relative bg-white rounded-2xl border border-slate-100 p-5 shadow-sm overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
            >
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-violet-50 rounded-full opacity-60 group-hover:scale-125 transition-transform duration-500" />
                <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
                            <Building2 size={18} className="text-violet-500" strokeWidth={2} />
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Estructura</span>
                    </div>
                    <p className="text-3xl font-black text-slate-900 tracking-tight mb-1">{stats.activeFranchises}</p>
                    <p className="text-xs font-semibold text-slate-400">Franquicias activas</p>
                </div>
            </motion.div>

            {/* Volumen */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700 p-5 shadow-lg overflow-hidden group hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
            >
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-indigo-500/20 rounded-full blur-xl group-hover:bg-indigo-500/30 transition-colors duration-500" />
                <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
                            <TrendingUp size={18} className="text-emerald-400" strokeWidth={2} />
                        </div>
                        {growth !== 0 ? (
                            <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${growth > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                <ArrowUpRight size={10} className={growth < 0 ? 'rotate-180' : ''} />
                                {Math.abs(growth)}%
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-400">
                                <Minus size={10} /> 0%
                            </div>
                        )}
                    </div>
                    <p className="text-2xl font-black text-white tracking-tight mb-1">{formatCurrency(stats.totalVolumen)}</p>
                    <p className="text-xs font-semibold text-slate-400">Volumen total red</p>
                </div>
            </motion.div>

            {/* Royalty */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                className="relative bg-white rounded-2xl border border-slate-100 p-5 shadow-sm overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
            >
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-amber-50 rounded-full opacity-60 group-hover:scale-125 transition-transform duration-500" />
                <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
                            <Sparkles size={18} className="text-amber-500" strokeWidth={2} />
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Est. 10%</span>
                    </div>
                    <p className="text-3xl font-black text-slate-900 tracking-tight mb-1">{formatCurrency(royalty)}</p>
                    <p className="text-xs font-semibold text-slate-400">Royalty estimado</p>
                </div>
            </motion.div>

        </div>
    );
};
