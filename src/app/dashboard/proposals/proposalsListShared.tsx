import React from 'react';
import { FileText, Send, CheckCircle2, XCircle, Ban, Clock, Zap } from 'lucide-react';
import { Proposal } from '@/types/crm';

export const PAGE_SIZE = 60;

export type StatusFilter = 'all' | 'sent' | 'accepted' | 'draft' | 'rejected';
export type ViewMode = 'table' | 'list';
export type SortKey = 'created_at' | 'annual_savings' | 'client_name' | 'status' | 'savings_percent';
export type SortDir = 'asc' | 'desc';

export function getPendingDays(p: Proposal): number | null {
    if (p.status !== 'sent') return null;
    return Math.floor((Date.now() - new Date(p.updated_at || p.created_at).getTime()) / 86400000);
}

export const STATUS_CFG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    draft:    { label: 'Borrador',  icon: <FileText size={11} />,    cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    sent:     { label: 'Enviada',   icon: <Send size={11} />,        cls: 'bg-blue-50 text-blue-600 border-blue-200' },
    accepted: { label: 'Firmada',   icon: <CheckCircle2 size={11} />, cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    rejected: { label: 'Rechazada', icon: <XCircle size={11} />,     cls: 'bg-red-50 text-red-500 border-red-200' },
    expired:  { label: 'Expirada',  icon: <Ban size={11} />,         cls: 'bg-slate-50 text-slate-400 border-slate-200' },
};

export const STATUS_TABS: { value: StatusFilter; label: string; icon: React.ReactNode }[] = [
    { value: 'all',      label: 'Todas',      icon: <FileText size={12} /> },
    { value: 'sent',     label: 'Enviadas',   icon: <Clock size={12} /> },
    { value: 'accepted', label: 'Firmadas',   icon: <CheckCircle2 size={12} /> },
    { value: 'draft',    label: 'Borradores', icon: <Zap size={12} /> },
    { value: 'rejected', label: 'Rechazadas', icon: <XCircle size={12} /> },
];

/** Currency formatter (EUR, no decimals). */
export const FC = (v: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
