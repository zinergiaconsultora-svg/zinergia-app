import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, icon, id, ...props }, ref) => {
        const generatedId = React.useId();
        const inputId = id || generatedId;

        return (
            <div className="space-y-1.5">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="text-xs font-bold text-slate-500 uppercase tracking-wider block ml-1"
                    >
                        {label}
                    </label>
                )}
                <div className="relative group">
                    <input
                        id={inputId}
                        ref={ref}
                        className={cn(
                            "flex h-10 w-full rounded-2xl border border-slate-200 bg-white/50 backdrop-blur-md px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-body text-slate-700",
                            "hover:bg-white/80 hover:border-slate-300",
                            icon ? "pl-10" : "",
                            error ? "border-red-300 focus:border-red-500 focus:ring-red-200" : "",
                            className
                        )}
                        {...props}
                    />
                    {icon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                            {icon}
                        </div>
                    )}
                </div>
                {error && (
                    <p className="text-xs text-red-500 font-medium ml-1 animate-slide-up">
                        {error}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = "Input";
