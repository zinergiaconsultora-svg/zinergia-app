import React from 'react';
import { cn } from '@/lib/utils';
import { motion, HTMLMotionProps } from 'framer-motion';

// Combine Motion props with Button props (handling conflicts if necessary, but usually safe to just use motion.button)
// For simplicity and to avoid type complexity with forwardRef + motion, we'll wrap a standard button or use motion.button directly.
// Given Antigravity uses motion heavily, let's use motion.button.

interface MotionButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
    children?: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, MotionButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, ...props }, ref) => {

        const variants = {
            primary: "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/40 hover:scale-[1.02]",
            secondary: "bg-white/50 text-slate-700 border border-slate-200/50 hover:bg-white/80 shadow-sm hover:shadow-md",
            ghost: "bg-transparent text-slate-600 hover:bg-slate-100/50 hover:text-slate-900",
            danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100",
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
                whileTap={{ scale: 0.98 }}
                className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all font-display disabled:opacity-50 disabled:pointer-events-none",
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
