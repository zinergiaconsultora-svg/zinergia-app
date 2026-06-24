import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatTone = 'slate' | 'sky' | 'emerald' | 'amber' | 'rose' | 'violet';

const ICON_TONES: Record<StatTone, string> = {
    slate: 'text-slate-600 bg-slate-100',
    sky: 'text-sky-700 bg-sky-100',
    emerald: 'text-emerald-700 bg-emerald-100',
    amber: 'text-amber-700 bg-amber-100',
    rose: 'text-rose-700 bg-rose-100',
    violet: 'text-violet-700 bg-violet-100',
};

const VALUE_TONES: Record<StatTone, string> = {
    slate: 'text-slate-900',
    sky: 'text-sky-700',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
    violet: 'text-violet-700',
};

interface StatCardProps {
    label: string;
    value: string | number;
    icon?: LucideIcon;
    tone?: StatTone;
    sub?: string;
    className?: string;
}

/**
 * Shared KPI card (slate-clean design system). With an icon, the tone colors the
 * icon chip and the value stays neutral; without an icon, the tone colors the value.
 */
export function StatCard({ label, value, icon: Icon, tone = 'slate', sub, className }: StatCardProps) {
    return (
        <div className={cn('bg-white rounded-2xl border border-slate-100 p-4 shadow-sm', className)}>
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
                {Icon && (
                    <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center', ICON_TONES[tone])}>
                        <Icon size={15} />
                    </span>
                )}
            </div>
            <p className={cn('mt-2 text-2xl font-bold tabular-nums', Icon ? 'text-slate-900' : VALUE_TONES[tone])}>
                {value}
            </p>
            {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
    );
}
