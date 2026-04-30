'use client';

import React from 'react';

type Variant = 'flat' | 'elevated' | 'hero';
type Tone = 'neutral' | 'energy' | 'emerald' | 'amber' | 'indigo';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: Variant;
    tone?: Tone;
    interactive?: boolean;
    as?: keyof React.JSX.IntrinsicElements;
    children?: React.ReactNode;
}

const variantStyles: Record<Variant, string> = {
    flat: [
        'bg-white/70 dark:bg-slate-900/40',
        'border border-slate-200/60 dark:border-slate-700/40',
        'shadow-sm',
    ].join(' '),
    elevated: [
        'bg-white dark:bg-slate-900/80',
        'backdrop-blur-md',
        'border border-white/80 dark:border-white/10',
        'shadow-[0_10px_40px_-12px_rgba(0,0,0,0.08)]',
        'dark:shadow-[0_10px_40px_-12px_rgba(0,0,0,0.5)]',
    ].join(' '),
    hero: [
        'relative overflow-hidden',
        'bg-gradient-to-br from-white via-white to-slate-50',
        'dark:from-slate-900 dark:via-slate-900 dark:to-slate-950',
        'border border-white/90 dark:border-white/10',
        'shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)]',
        'dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]',
        'ring-1 ring-slate-100/80 dark:ring-white/5',
    ].join(' '),
};

const toneAccent: Record<Tone, string> = {
    neutral: '',
    energy: 'before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-energy-400 before:to-energy-600',
    emerald: 'before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-emerald-400 before:to-emerald-600',
    amber: 'before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-amber-400 before:to-amber-600',
    indigo: 'before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-indigo-400 before:to-indigo-600',
};

const interactiveBoost = 'transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_24px_60px_-15px_rgba(0,0,0,0.7)] focus-within:ring-2 focus-within:ring-energy-500/40';

export function Card({
    variant = 'flat',
    tone = 'neutral',
    interactive = false,
    as: Tag = 'div',
    className = '',
    children,
    ...rest
}: CardProps) {
    const isHero = variant === 'hero';
    const accent = isHero && tone !== 'neutral' ? `relative ${toneAccent[tone]}` : '';
    const cls = [
        'rounded-2xl',
        variantStyles[variant],
        accent,
        interactive ? interactiveBoost : '',
        className,
    ].filter(Boolean).join(' ');

    return React.createElement(
        Tag as string,
        { className: cls, ...rest },
        children
    );
}
