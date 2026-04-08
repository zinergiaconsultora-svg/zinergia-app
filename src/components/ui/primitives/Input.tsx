import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    warning?: string;
    icon?: React.ReactNode;
    /** Botón o elemento que se renderiza en el extremo derecho del input */
    action?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, warning, icon, action, id, ...props }, ref) => {
        const generatedId = React.useId();
        const inputId = id || generatedId;

        return (
            <div className="space-y-1.5">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block"
                    >
                        {label}
                    </label>
                )}
                <div className="relative group">
                    <input
                        id={inputId}
                        ref={ref}
                        className={cn(
                            "flex h-11 w-full rounded-2xl border-0 bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white dark:focus:bg-slate-900 transition-all font-sans text-slate-900 dark:text-slate-100",
                            "hover:bg-slate-200 dark:hover:bg-slate-700/80",
                            icon ? "pl-11" : "",
                            action ? "pr-10" : "",
                            error ? "ring-2 ring-red-400 focus:ring-red-500 bg-red-50 dark:bg-red-950/20" :
                                warning ? "ring-2 ring-amber-400 focus:ring-amber-500 bg-amber-50 dark:bg-amber-950/20" : "",
                            className
                        )}
                        {...props}
                    />
                    {icon && (
                        <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${error ? 'text-red-400' : warning ? 'text-amber-500' : 'text-slate-400 group-focus-within:text-indigo-500'}`}>
                            {icon}
                        </div>
                    )}
                    {action && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            {action}
                        </div>
                    )}
                </div>
                {error && (
                    <p className="text-xs text-red-500 font-medium animate-slide-up">
                        {error}
                    </p>
                )}
                {warning && !error && (
                    <p className="text-xs text-amber-600 font-medium animate-slide-up">
                        {warning}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = "Input";
