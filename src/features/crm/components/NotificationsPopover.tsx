'use client';

import React, { useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

// Memoized notification item component to prevent unnecessary re-renders
interface NotificationItemProps {
    notif: Notification;
    onMarkAsRead: (id: string) => void;
    onDismiss: (id: string) => void;
}

const NotificationItem = memo(function NotificationItem({ notif, onMarkAsRead, onDismiss }: NotificationItemProps) {
    // Memoize formatted time to prevent recalculation on every render
    const formattedTime = useMemo(() => {
        return new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, [notif.created_at]);

    return (
        <div
            className={`
                relative p-4 rounded-2xl transition-all group border
                ${notif.read ? 'bg-transparent border-transparent opacity-70 hover:opacity-100 hover:bg-slate-50' : 'bg-white shadow-sm border-slate-100 hover:border-indigo-100 hover:shadow-md'}
            `}
        >
            <div className="flex gap-3 items-start pr-6" onClick={() => !notif.read && onMarkAsRead(notif.id)}>
                <div className={`mt-0.5 shrink-0 p-2 rounded-xl border ${notif.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    notif.type === 'warning' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        'bg-blue-50 text-blue-600 border-blue-100'
                    }`}>
                    {notif.type === 'success' && <CheckCircle2 size={16} />}
                    {notif.type === 'warning' && <AlertCircle size={16} />}
                    {notif.type === 'info' && <Info size={16} />}
                </div>
                <div className="flex-1 cursor-pointer">
                    <h4 className={`text-sm font-bold leading-tight mb-1 ${notif.read ? 'text-slate-600' : 'text-slate-800'}`}>
                        {notif.title}
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                        {notif.message}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-2 font-semibold">
                        {formattedTime}
                    </p>
                </div>
            </div>

            {/* Actions */}
            <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={(e) => { e.stopPropagation(); onDismiss(notif.id); }}
                    className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Eliminar notificación"
                >
                    <X size={14} />
                </button>
            </div>

            {!notif.read && (
                <div className="absolute top-4 right-4 w-2 h-2 bg-indigo-500 rounded-full group-hover:opacity-0 transition-opacity pointer-events-none" />
            )}
        </div>
    );
});

interface Notification {
    id: string;
    type: 'success' | 'warning' | 'info';
    title: string;
    message: string;
    created_at: string;
    read: boolean;
}

interface NotificationsPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: Notification[];
    onMarkAsRead: (id: string) => void;
    onMarkAllAsRead: () => void;
    onDismiss: (id: string) => void;
}

export const NotificationsPopover: React.FC<NotificationsPopoverProps> = ({
    isOpen,
    onClose,
    notifications,
    onMarkAsRead,
    onMarkAllAsRead,
    onDismiss
}) => {
    // Memoize unread calculations to prevent recalculation on every render
    const { hasUnread, unreadCount } = useMemo(() => {
        const unread = notifications.filter(n => !n.read);
        return {
            hasUnread: unread.length > 0,
            unreadCount: unread.length
        };
    }, [notifications]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop for closing */}
                    <div className="fixed inset-0 z-40" onClick={onClose} />

                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-16 right-4 z-50 w-80 md:w-96 bg-white/90 backdrop-blur-xl border border-white/50 rounded-3xl shadow-2xl shadow-indigo-500/10 overflow-hidden ring-1 ring-slate-900/5"
                    >
                        <div className="p-4 border-b border-slate-100/50 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Bell size={16} className="text-indigo-600" />
                                Notificaciones
                                {hasUnread && (
                                    <span className="bg-indigo-100 text-indigo-600 text-[10px] px-2 py-0.5 rounded-full font-extrabold">
                                        {unreadCount}
                                    </span>
                                )}
                            </h3>
                            <button
                                onClick={onClose}
                                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
                                aria-label="Cerrar"
                                title="Cerrar"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent p-2">
                            {notifications.length === 0 ? (
                                <div className="py-12 px-6 text-center">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                        <Bell size={24} className="text-slate-300" />
                                    </div>
                                    <p className="text-slate-500 text-sm font-medium">Estás al día</p>
                                    <p className="text-slate-400 text-xs mt-1">No tienes nuevas notificaciones.</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {notifications.map((notif) => (
                                        <NotificationItem
                                            key={notif.id}
                                            notif={notif}
                                            onMarkAsRead={onMarkAsRead}
                                            onDismiss={onDismiss}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                                {hasUnread && (
                            <div className="p-3 border-t border-slate-100/50 bg-slate-50/50 text-center">
                                <button
                                    onClick={onMarkAllAsRead}
                                    className="text-[11px] font-bold text-indigo-500 hover:text-indigo-700 uppercase tracking-widest transition-colors py-2 px-4 rounded-xl hover:bg-indigo-50"
                                >
                                    Marcar todo como leído
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
