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
        new: 'bg-emerald-100/60 text-emerald-700 border-emerald-200/50',
        active: 'bg-energy-100/60 text-energy-700 border-energy-200/50', // Changed from indigo
        contacted: 'bg-blue-100/60 text-blue-700 border-blue-200/50',
        in_process: 'bg-purple-100/60 text-purple-700 border-purple-200/50',
        won: 'bg-green-100/60 text-green-700 border-green-200/50',
        pending: 'bg-amber-100/60 text-amber-700 border-amber-200/50',
        churn: 'bg-slate-100/60 text-slate-600 border-slate-200/50',
        draft: 'bg-slate-100/60 text-slate-600 border-slate-200/50',
        sent: 'bg-blue-100/60 text-blue-700 border-blue-200/50',
        accepted: 'bg-emerald-100/60 text-emerald-700 border-emerald-200/50',
        rejected: 'bg-red-100/60 text-red-700 border-red-200/50',
        expired: 'bg-slate-200/60 text-slate-500 border-slate-300/50'
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
    const style = styles[s] || 'bg-slate-100 text-slate-600 border-slate-200';
    const label = labels[s] || status;

    return (
        <span className={cn("px-3 py-1 rounded-full text-xs font-medium border", style, className)}>
            {label}
        </span>
    );
}
