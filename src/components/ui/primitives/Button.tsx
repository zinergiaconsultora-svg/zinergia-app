import React from 'react';
import { cn } from '@/lib/utils';
import { motion, HTMLMotionProps } from 'framer-motion';

// Combine Motion props with Button props (handling conflicts if necessary, but usually safe to just use motion.button)
// For simplicity and to avoid type complexity with forwardRef + motion, we'll wrap a standard button or use motion.button directly.
// Given Antigravity uses motion heavily, let's use motion.button.

interface MotionButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
    children?: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gradient' | 'energy';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, MotionButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, ...props }, ref) => {

        const variants = {
            primary: "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white shadow-floating-light hover:shadow-floating-medium",
            secondary: "bg-white/40 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200 border border-white/25 dark:border-slate-700/40 backdrop-blur-md hover:bg-white/80 dark:hover:bg-slate-800/80 shadow-floating-light",
            ghost: "bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white",
            danger: "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-100 dark:border-rose-900/30",
            gradient: "bg-gradient-to-r from-energy-500 to-purple-600 text-white shadow-floating-light hover:shadow-floating-medium",
            energy: "bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-floating-light hover:shadow-floating-medium",
        };

        const sizes = {
            sm: "h-8 px-3 text-xs",
            md: "h-10 px-4 text-sm",
            lg: "h-12 px-6 text-base",
            icon: "h-10 w-10 p-0 flex items-center justify-center",
        };

        return (
            <motion.button
                ref={ref}
                whileHover={{ scale: 1.015, y: -0.5 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all font-sans disabled:opacity-50 disabled:pointer-events-none",
                    variants[variant],
                    sizes[size],
                    className
                )}
                disabled={isLoading || props.disabled}
                {...props}
            >
                {isLoading && (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                )}
                {!isLoading && leftIcon && <span className="mr-1">{leftIcon}</span>}
                {children}
                {!isLoading && rightIcon && <span className="ml-1">{rightIcon}</span>}
            </motion.button>
        );
    }
);

Button.displayName = "Button";
