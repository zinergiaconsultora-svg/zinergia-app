'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSmartAlertsAction, type SmartAlert, type AlertSeverity } from '@/app/actions/smartAlerts';
import { AlertCircle, AlertTriangle, Info, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SEVERITY_STYLE: Record<AlertSeverity, {
    bg: string;
    border: string;
    icon: typeof AlertCircle;
    iconColor: string;
    title: string;
    badge: string;
    cta: string;
}> = {
    critical: {
        bg: 'bg-red-50/80',
        border: 'border-red-200',
        icon: AlertCircle,
        iconColor: 'text-red-500',
        title: 'text-red-800',
        badge: 'bg-red-100 text-red-700 border-red-200',
        cta: 'bg-red-500 hover:bg-red-600 text-white',
    },
    warning: {
        bg: 'bg-amber-50/80',
        border: 'border-amber-200',
        icon: AlertTriangle,
        iconColor: 'text-amber-500',
        title: 'text-amber-800',
        badge: 'bg-amber-100 text-amber-700 border-amber-200',
        cta: 'bg-amber-500 hover:bg-amber-600 text-white',
    },
    info: {
        bg: 'bg-blue-50/80',
        border: 'border-blue-200',
        icon: Info,
        iconColor: 'text-blue-500',
        title: 'text-blue-800',
        badge: 'bg-blue-100 text-blue-700 border-blue-200',
        cta: 'bg-blue-500 hover:bg-blue-600 text-white',
    },
};

const SESSION_KEY = 'dismissed_smart_alerts';

function getDismissed(): Set<string> {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        return new Set(raw ? JSON.parse(raw) : []);
    } catch {
        return new Set();
    }
}

function saveDismissed(ids: Set<string>) {
    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify([...ids]));
    } catch { /* noop */ }
}

export default function SmartAlertsStrip() {
    const router = useRouter();
    const [alerts, setAlerts] = useState<SmartAlert[]>([]);
    const [dismissed, setDismissed] = useState<Set<string>>(() => getDismissed());

    useEffect(() => {
        getSmartAlertsAction().then(setAlerts).catch(() => { /* non-fatal */ });
    }, []);

    const visible = alerts.filter(a => !dismissed.has(a.id));
    if (visible.length === 0) return null;

    const dismiss = (id: string) => {
        const next = new Set(dismissed).add(id);
        setDismissed(next);
        saveDismissed(next);
    };

    return (
        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 lg:mx-0 lg:px-0">
            <div className="flex gap-3 min-w-0" style={{ width: 'max-content', maxWidth: '100%' }}>
                <AnimatePresence initial={false}>
                    {visible.slice(0, 4).map(alert => {
                        const s = SEVERITY_STYLE[alert.severity];
                        const Icon = s.icon;
                        return (
                            <motion.div
                                key={alert.id}
                                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: -8 }}
                                transition={{ duration: 0.2 }}
                                className={`relative flex-shrink-0 flex items-start gap-3 px-4 py-3 rounded-2xl border backdrop-blur-sm ${s.bg} ${s.border} min-w-[260px] max-w-[320px]`}
                            >
                                {/* Dismiss */}
                                <button
                                    type="button"
                                    onClick={() => dismiss(alert.id)}
                                    className="absolute top-2 right-2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors"
                                >
                                    <X size={12} />
                                </button>

                                <Icon size={18} className={`${s.iconColor} shrink-0 mt-0.5`} />

                                <div className="flex-1 min-w-0 pr-4">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className={`text-xs font-bold ${s.title}`}>{alert.title}</span>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${s.badge}`}>
                                            {alert.count}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-600 leading-snug mb-2">{alert.description}</p>
                                    <button
                                        type="button"
                                        onClick={() => router.push(alert.href)}
                                        className={`flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg ${s.cta} transition-colors`}
                                    >
                                        {alert.cta}
                                        <ArrowRight size={10} />
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
}
