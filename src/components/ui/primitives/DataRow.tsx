import React from 'react';
import { Micro } from './Typography';

interface DataRowProps {
    label: string;
    value: string;
    color?: string;
    secondaryText?: string;
    icon?: React.ReactNode;
    className?: string;
}

export const DataRow: React.FC<DataRowProps> = ({
    label,
    value,
    color = "bg-slate-400",
    secondaryText,
    icon,
    className = ""
}) => {
    return (
        <div className={`flex w-full flex-wrap items-center justify-between gap-y-1 gap-x-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 border border-slate-100 dark:border-slate-800 ${className}`}>

            <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                    <div className={`h-2 w-2 rounded-full flex-shrink-0 ${color}`} />
                    <Micro className="whitespace-normal leading-tight text-left">{label}</Micro>
                </div>
                <span className="tabular-nums font-bold text-slate-900 dark:text-slate-100 text-sm whitespace-nowrap flex-shrink-0 ml-auto">
                    {value}
                </span>
            </div>

            {(secondaryText || icon) && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 ml-auto flex-shrink-0">
                    {icon && <span className="text-slate-400">{icon}</span>}
                    {secondaryText && (
                        <span className="tabular-nums whitespace-nowrap">
                            {secondaryText}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};
