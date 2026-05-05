import React from 'react';
import { cn } from '@/lib/utils';

export type StatusType =
    | 'new' | 'active' | 'contacted' | 'in_process' | 'won'
    | 'pending' | 'churn' | 'draft' | 'sent' | 'accepted'
    | 'rejected' | 'expired';

interface StatusBadgeProps {
    status: string;
    className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
    const styles: Record<string, string> = {
        new: 'bg-blue-50 text-blue-700',
        active: 'bg-emerald-50 text-emerald-700',
        contacted: 'bg-amber-50 text-amber-700',
        in_process: 'bg-violet-50 text-violet-700',
        won: 'bg-emerald-50 text-emerald-700',
        pending: 'bg-slate-100 text-slate-700',
        churn: 'bg-red-50 text-red-700',
        draft: 'bg-slate-100 text-slate-700',
        sent: 'bg-blue-50 text-blue-700',
        accepted: 'bg-emerald-50 text-emerald-700',
        rejected: 'bg-red-50 text-red-700',
        expired: 'bg-slate-100 text-slate-500'
    };

    const labels: Record<string, string> = {
        new: 'Nuevo',
        active: 'Activo',
        contacted: 'Contactado',
        in_process: 'En Proceso',
        won: 'Ganado',
        pending: 'Pendiente',
        churn: 'Baja',
        draft: 'Borrador',
        sent: 'Enviada',
        accepted: 'Aceptada',
        rejected: 'Rechazada',
        expired: 'Expirada'
    };

    const s = status as string;
    const style = styles[s] || 'bg-slate-100 text-slate-600';
    const label = labels[s] || status;

    return (
        <span className={cn("px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide uppercase", style, className)}>
            {label}
        </span>
    );
}
