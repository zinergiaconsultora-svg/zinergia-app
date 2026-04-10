'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { Bell, CheckCheck, X, Zap, TrendingUp, Send, Clock, Info, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
    AppNotification,
    getNotificationsAction,
    markNotificationReadAction,
    markAllReadAction,
} from '@/app/actions/notifications';

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `hace ${days}d`;
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function NotifIcon({ type }: { type: string | null }) {
    const cfg: Record<string, { icon: React.ReactNode; bg: string; text: string }> = {
        proposal_accepted: { icon: <TrendingUp size={12} />, bg: 'bg-emerald-100', text: 'text-emerald-600' },
        proposal_rejected: { icon: <X size={12} />, bg: 'bg-rose-100', text: 'text-rose-600' },
        proposal_sent: { icon: <Send size={12} />, bg: 'bg-blue-100', text: 'text-blue-600' },
        followup_due: { icon: <Clock size={12} />, bg: 'bg-amber-100', text: 'text-amber-600' },
        commission_earned: { icon: <Zap size={12} />, bg: 'bg-indigo-100', text: 'text-indigo-600' },
        tariff_update: { icon: <AlertCircle size={12} />, bg: 'bg-violet-100', text: 'text-violet-600' },
        info: { icon: <Info size={12} />, bg: 'bg-slate-100', text: 'text-slate-500' },
    };
    const { icon, bg, text } = cfg[type ?? 'info'] ?? cfg.info;
    return (
        <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${bg} ${text}`}>
            {icon}
        </div>
    );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationBell() {
    const router = useRouter();
    const panelRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [, startTransition] = useTransition();

    const unread = notifications.filter(n => !n.read).length;

    // Initial load
    useEffect(() => {
        getNotificationsAction()
            .then(setNotifications)
            .catch(() => { })
            .finally(() => setLoaded(true));
    }, []);

    // Supabase Realtime subscription
    useEffect(() => {
        const supabase = createClient();
        let userId: string | null = null;

        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) return;
            userId = user.id;

            const channel = supabase
                .channel(`notifications:${userId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${userId}`,
                    },
                    (payload) => {
                        const n = payload.new as AppNotification;
                        setNotifications(prev => [{ ...n, read: false }, ...prev].slice(0, 30));
                    }
                )
                .subscribe();

            return () => { supabase.removeChannel(channel); };
        });
    }, []);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleMarkRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        startTransition(() => { markNotificationReadAction(id).catch(() => { }); });
    };

    const handleMarkAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        startTransition(() => { markAllReadAction().catch(() => { }); });
    };

    const handleClick = (n: AppNotification) => {
        handleMarkRead(n.id);
        if (n.link) router.push(n.link);
        setOpen(false);
    };

    return (
        <div ref={panelRef} className="relative">
            {/* Bell button */}
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="relative w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100/60 transition-all active:scale-90"
                title="Notificaciones"
            >
                <Bell size={17} />
                {unread > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center bg-rose-500 text-white text-[9px] font-black rounded-full px-0.5 leading-none">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {/* Panel */}
            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-200/60 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <Bell size={14} className="text-slate-400" />
                            <span className="text-sm font-bold text-slate-800">Notificaciones</span>
                            {unread > 0 && (
                                <span className="text-[10px] font-bold bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full">
                                    {unread} nueva{unread !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                        {unread > 0 && (
                            <button
                                type="button"
                                onClick={handleMarkAllRead}
                                className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                                <CheckCheck size={12} />
                                Marcar todas
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-50">
                        {!loaded ? (
                            <div className="flex justify-center py-8">
                                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="py-10 text-center">
                                <Bell size={24} className="mx-auto text-slate-200 mb-2" />
                                <p className="text-xs text-slate-400">Sin notificaciones</p>
                            </div>
                        ) : (
                            notifications.map(n => (
                                <button
                                    key={n.id}
                                    type="button"
                                    onClick={() => handleClick(n)}
                                    className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors ${!n.read ? 'bg-indigo-50/40' : ''}`}
                                >
                                    <NotifIcon type={n.type} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-0.5">
                                            <p className={`text-xs font-bold truncate ${n.read ? 'text-slate-600' : 'text-slate-900'}`}>
                                                {n.title}
                                            </p>
                                            <span className="text-[9px] text-slate-400 shrink-0">{timeAgo(n.created_at)}</span>
                                        </div>
                                        <p className={`text-[11px] leading-snug ${n.read ? 'text-slate-400' : 'text-slate-600'}`}>
                                            {n.message}
                                        </p>
                                    </div>
                                    {!n.read && (
                                        <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="px-4 py-2.5 border-t border-slate-100">
                            <p className="text-[10px] text-slate-400 text-center">
                                Mostrando las últimas {notifications.length} notificaciones
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
