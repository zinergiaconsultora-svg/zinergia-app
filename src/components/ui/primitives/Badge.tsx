import React from 'react';

export type BadgeIntent = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';

interface BadgeProps {
    children: React.ReactNode;
    intent?: BadgeIntent;
    className?: string;
    title?: string;
}

export const Badge: React.FC<BadgeProps> = ({
    children,
    intent = 'neutral',
    className = "",
    title
}) => {
    const intentClasses: Record<BadgeIntent, string> = {
        success: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20',
        warning: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20',
        danger: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20',
        info: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20',
        accent: 'bg-energy-50 dark:bg-energy-500/10 text-energy-600 dark:text-energy-400 border-energy-100 dark:border-energy-500/20',
        neutral: 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
    };

    return (
        <span
            title={title}
            className={`
                px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider
                ${intentClasses[intent]}
                ${className}
            `}
        >
            {children}
        </span>
    );
};
