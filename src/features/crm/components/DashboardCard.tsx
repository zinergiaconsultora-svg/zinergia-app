import React from 'react';
import { LucideIcon, Info } from 'lucide-react';
import { motion } from 'framer-motion';

interface DashboardCardProps {
    title: string;
    icon: LucideIcon;
    subtitle?: string; // Short description below value or title
    helpText?: string; // Tooltip text for context
    action?: React.ReactNode; // Optional button/link in header
    children: React.ReactNode;
    className?: string; // For grid col-span, etc.
    trend?: {
        value: string;
        positive: boolean;
        label: string;
    } | null;
    onClick?: () => void;
}

export const DashboardCard = ({
    title,
    icon: Icon,
    subtitle,
    helpText,
    action,
    children,
    className = "",
    trend,
    onClick
}: DashboardCardProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={`
                group relative bg-white/80 backdrop-blur-xl rounded-[1.5rem] 
                border border-white/40 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.02)] 
                hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04)] hover:border-white/60 
                hover:-translate-y-1 transition-all duration-300 ease-out 
                p-6 flex flex-col h-full overflow-hidden
                ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''} 
                ${className}
            `}
            onClick={onClick}
        >
            {/* Subtle Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white via-white/50 to-energy-50/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            {/* Content Container */}
            <div className="relative z-10 flex flex-col h-full">
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-energy-50/80 text-energy-600 flex items-center justify-center shrink-0 shadow-sm ring-1 ring-energy-100/50 group-hover:scale-110 group-hover:bg-energy-500 group-hover:text-white transition-all duration-300">
                            <Icon size={22} className="transition-transform duration-300 group-hover:rotate-12" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-[15px] font-bold text-slate-800 leading-none tracking-tight group-hover:text-energy-700 transition-colors duration-300">{title}</h3>
                                {helpText && (
                                    <div className="group/tooltip relative">
                                        <Info size={14} className="text-slate-300 hover:text-energy-500 cursor-help transition-colors" />
                                        <div className="absolute left-1/2 -top-2 -translate-x-1/2 -translate-y-full w-56 p-3 bg-slate-900/90 backdrop-blur-md text-white text-xs font-medium rounded-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50 pointer-events-none text-center shadow-xl border border-white/10 translate-y-2 group-hover/tooltip:translate-y-0">
                                            {helpText}
                                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-8 border-transparent border-t-slate-900/90"></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {subtitle && <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wide">{subtitle}</p>}
                        </div>
                    </div>
                    {action && <div className="z-20 relative">{action}</div>}
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col">
                    {children}

                    {/* Optional Trend Footer */}
                    {trend && (
                        <div className="mt-auto pt-3 flex items-center gap-2 text-xs font-medium">
                            <span className={`${trend.positive ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'} px-2 py-0.5 rounded-full`}>
                                {trend.value}
                            </span>
                            <span className="text-slate-400">{trend.label}</span>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
