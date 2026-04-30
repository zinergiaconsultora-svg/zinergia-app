'use client';

import React from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface EmptyStateProps {
    /** Icon component from lucide-react. Defaults to Inbox. */
    icon?: LucideIcon;
    /** Color tint for the icon container. Defaults to slate. */
    tone?: 'slate' | 'energy' | 'emerald' | 'amber' | 'indigo' | 'rose';
    title: string;
    description?: string;
    /** Primary call-to-action. Renders as a Link if `href` provided, otherwise a button. */
    action?: {
        label: string;
        href?: string;
        onClick?: () => void;
        icon?: LucideIcon;
    };
    /** Compact mode: smaller padding/icon, useful inside cards */
    compact?: boolean;
    className?: string;
}

const toneStyles = {
    slate: {
        bg: 'bg-slate-100 dark:bg-slate-800/50',
        icon: 'text-slate-500 dark:text-slate-400',
        ring: 'ring-slate-200 dark:ring-slate-700/50',
    },
    energy: {
        bg: 'bg-energy-50 dark:bg-energy-900/20',
        icon: 'text-energy-600 dark:text-energy-400',
        ring: 'ring-energy-100 dark:ring-energy-800/30',
    },
    emerald: {
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        icon: 'text-emerald-600 dark:text-emerald-400',
        ring: 'ring-emerald-100 dark:ring-emerald-800/30',
    },
    amber: {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        icon: 'text-amber-600 dark:text-amber-400',
        ring: 'ring-amber-100 dark:ring-amber-800/30',
    },
    indigo: {
        bg: 'bg-indigo-50 dark:bg-indigo-900/20',
        icon: 'text-indigo-600 dark:text-indigo-400',
        ring: 'ring-indigo-100 dark:ring-indigo-800/30',
    },
    rose: {
        bg: 'bg-rose-50 dark:bg-rose-900/20',
        icon: 'text-rose-600 dark:text-rose-400',
        ring: 'ring-rose-100 dark:ring-rose-800/30',
    },
};

export function EmptyState({
    icon: Icon = Inbox,
    tone = 'slate',
    title,
    description,
    action,
    compact = false,
    className = '',
}: EmptyStateProps) {
    const styles = toneStyles[tone];
    const ActionIcon = action?.icon;
    const iconSize = compact ? 24 : 32;
    const iconBoxClass = compact ? 'w-12 h-12' : 'w-16 h-16';
    const padClass = compact ? 'py-8 px-4' : 'py-14 px-6';

    const actionContent = action ? (
        <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-energy-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900">
            {ActionIcon && <ActionIcon size={16} />}
            {action.label}
        </span>
    ) : null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className={`flex flex-col items-center justify-center text-center ${padClass} ${className}`}
        >
            <div
                className={`${iconBoxClass} ${styles.bg} ${styles.icon} rounded-2xl flex items-center justify-center mb-4 ring-1 ${styles.ring}`}
                aria-hidden="true"
            >
                <Icon size={iconSize} strokeWidth={1.5} />
            </div>

            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                {title}
            </h3>

            {description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mb-5">
                    {description}
                </p>
            )}

            {action && (
                action.href ? (
                    <Link href={action.href} aria-label={action.label}>
                        {actionContent}
                    </Link>
                ) : (
                    <button type="button" onClick={action.onClick} aria-label={action.label}>
                        {actionContent}
                    </button>
                )
            )}
        </motion.div>
    );
}
