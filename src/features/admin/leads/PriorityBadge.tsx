import React from 'react';
import { Flame, Equal, ArrowDown } from 'lucide-react';
import type { LeadPriority } from './priority';

const TIER_STYLES: Record<LeadPriority['tier'], { label: string; cls: string; Icon: typeof Flame }> = {
    alta: { label: 'Alta', cls: 'bg-rose-100 text-rose-700 ring-rose-200', Icon: Flame },
    media: { label: 'Media', cls: 'bg-amber-100 text-amber-700 ring-amber-200', Icon: Equal },
    baja: { label: 'Baja', cls: 'bg-slate-100 text-slate-500 ring-slate-200', Icon: ArrowDown },
};

export function PriorityBadge({ priority, showSavings = false }: { priority: LeadPriority; showSavings?: boolean }) {
    const s = TIER_STYLES[priority.tier];
    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ring-1 ${s.cls}`}
            title={priority.reasons.join(' · ')}
            aria-label={`Prioridad ${s.label}. ${priority.reasons.join('. ')}`}
        >
            <s.Icon size={11} aria-hidden="true" /> {s.label}
            {showSavings && priority.estimatedSavings != null && (
                <span className="font-semibold opacity-80">
                    · {priority.estimatedSavings}€/año{priority.savingsIsReal ? '' : '~'}
                </span>
            )}
        </span>
    );
}
