import React from 'react';

interface StatValueProps {
    value: string | number;
    unit?: string;
    trend?: {
        value: number;
        label?: string;
        invertColor?: boolean;
    };
    description?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const StatValue: React.FC<StatValueProps> = ({ value, unit, trend, description, size = 'lg' }) => {
    const sizeClasses = {
        sm: 'text-lg md:text-xl',
        md: 'text-xl md:text-2xl',
        lg: 'text-2xl md:text-3xl',
        xl: 'text-3xl lg:text-4xl'
    };

    const isPositive = trend && trend.value >= 0;
    const isGood = trend?.invertColor ? !isPositive : isPositive;

    return (
        <div className="flex flex-col">
            <div className="flex items-baseline gap-1.5">
                <span className={`font-black text-slate-900 dark:text-white tabular-nums tracking-tight ${sizeClasses[size]}`}>
                    {value}
                </span>
                {unit && (
                    <span className="text-sm font-bold text-slate-400">{unit}</span>
                )}
            </div>

            {(trend || description) && (
                <div className="flex items-center gap-2 mt-1">
                    {trend && (
                        <div className={`
                            text-[10px] font-bold uppercase tracking-wider flex items-center gap-1
                            ${isGood ? 'text-emerald-600' : 'text-rose-600'}
                        `}>
                            <span>{isPositive ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}%</span>
                        </div>
                    )}
                    {trend && description && (
                        <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                    )}
                    {description && (
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                            {description}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};
