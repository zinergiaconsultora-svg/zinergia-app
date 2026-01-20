import React from 'react';
import { Users, Building2, TrendingUp, DollarSign } from 'lucide-react';
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
    const cards = [
        {
            title: 'Agentes Totales',
            value: stats.totalAgents,
            icon: Users,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10'
        },
        {
            title: 'Franquicias Activas',
            value: stats.activeFranchises,
            icon: Building2,
            color: 'text-purple-500',
            bg: 'bg-purple-500/10'
        },
        {
            title: 'Volumen Red',
            value: formatCurrency(stats.totalVolumen),
            icon: TrendingUp,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10'
        },
        {
            title: 'Royalty Est.',
            value: formatCurrency(stats.totalVolumen * 0.1),
            icon: DollarSign,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10'
        }
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            {cards.map((card, index) => (
                <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white/60 backdrop-blur-md p-5 md:p-6 rounded-[2rem] shadow-sm border border-slate-200/50 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all duration-300 group"
                >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 md:gap-0">
                        <div>
                            <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 md:mb-2 truncate">{card.title}</p>
                            <h3 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{card.value}</h3>
                        </div>
                        <div className={`${card.bg} ${card.color} p-3 md:p-4 rounded-2xl w-fit self-start md:self-auto group-hover:scale-110 transition-transform duration-300 order-first md:order-last mb-2 md:mb-0`}>
                            <card.icon size={20} className="md:w-[22px] md:h-[22px] stroke-[2.5px]" />
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};
