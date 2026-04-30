'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    AppNotification,
    getNotificationsAction,
    markNotificationReadAction,
    markAllReadAction,
} from '@/app/actions/notifications';
import { logger } from '@/lib/utils/logger';

interface NotificationContextValue {
    notifications: AppNotification[];
    unreadCount: number;
    loaded: boolean;
    markRead: (id: string) => void;
    markAllRead: () => void;
    refresh: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
    notifications: [],
    unreadCount: 0,
    loaded: false,
    markRead: () => {},
    markAllRead: () => {},
    refresh: () => {},
});

export function useNotifications() {
    return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [, startTransition] = useTransition();

    const unreadCount = notifications.filter(n => !n.read).length;

    const refresh = useCallback(() => {
        getNotificationsAction()
            .then(data => { setNotifications(data); setLoaded(true); })
            .catch((e) => { logger.error('Failed to fetch notifications', e); setLoaded(true); });
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        const supabase = createClient();
        let channel: ReturnType<typeof supabase.channel> | null = null;

        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) return;

            channel = supabase
                .channel(`notifications:${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${user.id}`,
                    },
                    (payload) => {
                        const n = payload.new as AppNotification;
                        setNotifications(prev => [{ ...n, read: false }, ...prev].slice(0, 30));
                    }
                )
                .subscribe();
        });

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, []);

    const markRead = useCallback((id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        startTransition(() => { markNotificationReadAction(id).catch((e) => logger.error('Failed to mark notification read', e)); });
    }, [startTransition]);

    const markAllRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        startTransition(() => { markAllReadAction().catch((e) => logger.error('Failed to mark all read', e)); });
    }, [startTransition]);

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, loaded, markRead, markAllRead, refresh }}>
            {children}
        </NotificationContext.Provider>
    );
}
