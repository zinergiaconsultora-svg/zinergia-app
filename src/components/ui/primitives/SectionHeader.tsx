import React from 'react';
import { CardTitle } from './Typography';

interface SectionHeaderProps {
    title: string;
    subtitle?: string | React.ReactNode | null;
    icon?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
    align?: 'left' | 'center';
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
    title,
    subtitle,
    icon,
    action,
    className = "",
    align = 'left'
}) => {
    return (
        <div className={`flex items-start justify-between gap-4 mb-6 ${className} ${align === 'center' ? 'flex-col items-center text-center' : ''}`}>
            <div className={`flex items-center gap-3 ${align === 'center' ? 'flex-col items-center' : ''}`}>
                {icon && (
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-400 shadow-sm border border-slate-100 dark:border-slate-800">
                        {icon}
                    </div>
                )}
                <div>
                    <CardTitle className="uppercase tracking-wider text-sm">{title}</CardTitle>
                    {subtitle && (
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>
            {action && (
                <div className="flex-shrink-0">
                    {action}
                </div>
            )}
        </div>
    );
};
