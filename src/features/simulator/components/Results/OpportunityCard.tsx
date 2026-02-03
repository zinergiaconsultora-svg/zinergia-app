import React from 'react';
import { AuditOpportunity } from '@/lib/aletheia/types';
import { AlertTriangle, Zap, TrendingUp, CheckCircle, Info } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';

interface OpportunityCardProps {
    opportunity: AuditOpportunity;
    className?: string;
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({ opportunity, className }) => {

    // Design Configuration based on Priority/Type
    const config = {
        REACTIVE_COMPENSATION: {
            icon: AlertTriangle,
            bg: 'bg-amber-500',
            text: 'text-amber-900',
            border: 'border-amber-200',
            lightBg: 'bg-amber-50/50',
            accent: 'text-amber-600'
        },
        POWER_OPTIMIZATION: {
            icon: Zap,
            bg: 'bg-emerald-500',
            text: 'text-emerald-900',
            border: 'border-emerald-200',
            lightBg: 'bg-emerald-50/50',
            accent: 'text-emerald-600'
        },
        TARIFF_SAVING: {
            icon: TrendingUp,
            bg: 'bg-indigo-500',
            text: 'text-indigo-900',
            border: 'border-indigo-200',
            lightBg: 'bg-indigo-50/50',
            accent: 'text-indigo-600'
        }
    }[opportunity.type] || {
        icon: Info,
        bg: 'bg-slate-500',
        text: 'text-slate-900',
        border: 'border-slate-200',
        lightBg: 'bg-slate-50/50',
        accent: 'text-slate-600'
    };

    const Icon = config.icon;

    return (
        <div className={`relative overflow-hidden rounded-[1.5rem] border ${config.border} bg-white shadow-lg shadow-slate-100/50 group transition-all duration-300 hover:shadow-xl hover:translate-y-[-2px] ${className}`}>
            {/* Background Decor */}
            <div className={`absolute top-0 right-0 w-32 h-32 ${config.bg} opacity-5 rounded-full blur-2xl -mr-10 -mt-10`}></div>

            <div className="p-5 flex gap-4">
                {/* Icon Box */}
                <div className={`shrink-0 w-12 h-12 rounded-2xl ${config.bg} bg-opacity-10 flex items-center justify-center`}>
                    <Icon size={24} className={config.accent} />
                </div>

                {/* Content */}
                <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                        <h4 className={`font-bold text-sm uppercase tracking-wide ${config.text}`}>
                            {opportunity.title}
                        </h4>
                        {opportunity.priority === 'HIGH' && (
                            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[9px] font-extrabold uppercase tracking-wider">
                                Crítico
                            </span>
                        )}
                    </div>

                    <p className="text-slate-600 text-sm leading-relaxed mb-4">
                        {opportunity.description}
                    </p>

                    {/* Financials Grid */}
                    <div className={`rounded-xl ${config.lightBg} p-3 grid grid-cols-2 gap-4 border border-white/50 backdrop-blur-sm`}>
                        <div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ahorro Anual</div>
                            <div className={`text-lg font-black ${config.accent}`}>
                                {formatCurrency(opportunity.annual_savings)}
                            </div>
                        </div>

                        {opportunity.roi_months && (
                            <div>
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Retorno (ROI)</div>
                                <div className="flex items-center gap-1">
                                    <span className="text-lg font-black text-slate-700">{opportunity.roi_months.toFixed(1)}</span>
                                    <span className="text-xs font-medium text-slate-500">meses</span>
                                </div>
                            </div>
                        )}

                        {opportunity.investment_cost && (
                            <div className="col-span-2 pt-2 mt-1 border-t border-slate-200/50 flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inversión Estimada</span>
                                <span className="text-sm font-bold text-slate-600">{formatCurrency(opportunity.investment_cost)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Action Strip */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button className="text-xs font-bold text-slate-500 hover:text-slate-800 uppercase tracking-wide transition-colors flex items-center gap-2">
                    Ver Detalles <CheckCircle size={14} />
                </button>
            </div>
        </div>
    );
};
