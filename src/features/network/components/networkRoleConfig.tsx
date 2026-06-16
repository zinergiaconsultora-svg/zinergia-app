import React from 'react';
import { Building2, ShieldCheck, User, UserX } from 'lucide-react';

// ─── Role config (compartido por NetworkTree y EditUserModal) ──────────────

export const ROLE_CONFIG: Record<string, {
    label: string;
    icon: React.ReactNode;
    cardBg: string;
    cardBorder: string;
    avatarBg: string;
    avatarText: string;
    badgeBg: string;
    badgeText: string;
    nameCls: string;
    subCls: string;
    statLabelCls: string;
    statValueCls: string;
    dividerCls: string;
    actionBg: string;
    actionHover: string;
    actionText: string;
    chevronCls: string;
}> = {
    franchise: {
        label: 'Franquicia',
        icon: <Building2 size={18} strokeWidth={1.8} />,
        cardBg: 'bg-white',
        cardBorder: 'border-indigo-100',
        avatarBg: 'bg-indigo-50',
        avatarText: 'text-indigo-600',
        badgeBg: 'bg-indigo-50 border-indigo-100',
        badgeText: 'text-indigo-600',
        nameCls: 'text-slate-900',
        subCls: 'text-slate-400',
        statLabelCls: 'text-slate-400',
        statValueCls: 'text-slate-700',
        dividerCls: 'border-slate-100',
        actionBg: 'bg-slate-50',
        actionHover: 'hover:bg-indigo-50',
        actionText: 'text-slate-400 hover:text-indigo-600',
        chevronCls: 'text-slate-400 hover:bg-slate-100',
    },
    admin: {
        label: 'Admin',
        icon: <ShieldCheck size={18} strokeWidth={1.8} />,
        cardBg: 'bg-white',
        cardBorder: 'border-slate-200',
        avatarBg: 'bg-slate-100',
        avatarText: 'text-slate-600',
        badgeBg: 'bg-slate-100 border-slate-200',
        badgeText: 'text-slate-600',
        nameCls: 'text-slate-900',
        subCls: 'text-slate-400',
        statLabelCls: 'text-slate-400',
        statValueCls: 'text-slate-700',
        dividerCls: 'border-slate-100',
        actionBg: 'bg-slate-50',
        actionHover: 'hover:bg-slate-100',
        actionText: 'text-slate-400 hover:text-slate-700',
        chevronCls: 'text-slate-400 hover:bg-slate-100',
    },
    agent: {
        label: 'Colaborador',
        icon: <User size={18} strokeWidth={1.8} />,
        cardBg: 'bg-white',
        cardBorder: 'border-slate-200/70',
        avatarBg: 'bg-gradient-to-br from-slate-100 to-slate-200',
        avatarText: 'text-slate-600',
        badgeBg: 'bg-emerald-50 border-emerald-100',
        badgeText: 'text-emerald-700',
        nameCls: 'text-slate-900',
        subCls: 'text-slate-400',
        statLabelCls: 'text-slate-400',
        statValueCls: 'text-slate-700',
        dividerCls: 'border-slate-100',
        actionBg: 'bg-slate-50',
        actionHover: 'hover:bg-slate-100',
        actionText: 'text-slate-400 hover:text-slate-700',
        chevronCls: 'text-slate-400 hover:bg-slate-100',
    },
};

export const DEACTIVATED_CONFIG = {
    label: 'Desactivado',
    icon: <UserX size={18} strokeWidth={1.8} />,
    cardBg: 'bg-slate-50',
    cardBorder: 'border-slate-200',
    avatarBg: 'bg-slate-100',
    avatarText: 'text-slate-400',
    badgeBg: 'bg-slate-100 border-slate-200',
    badgeText: 'text-slate-400',
    nameCls: 'text-slate-400',
    subCls: 'text-slate-300',
    statLabelCls: 'text-slate-300',
    statValueCls: 'text-slate-400',
    dividerCls: 'border-slate-100',
    actionBg: 'bg-slate-50',
    actionHover: 'hover:bg-slate-100',
    actionText: 'text-slate-300 hover:text-slate-500',
    chevronCls: 'text-slate-300 hover:bg-slate-100',
};

export const DEFAULT_ROLE = ROLE_CONFIG.agent;
