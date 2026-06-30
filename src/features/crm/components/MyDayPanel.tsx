'use client';

import React, { useState, useEffect } from 'react';
import { MyDayTask } from '@/types/energy';
import { getMyDayAction } from '@/app/actions/energy';
import {
    Phone, Send, ArrowRightLeft, RefreshCw, AlertTriangle,
    FileText, Clock, ChevronRight, Zap, CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

const PRIORITY_STYLES = {
    critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500', label: 'Urgente' },
    high:     { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Alta' },
    medium:   { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Media' },
    low:      { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Baja' },
};

const TYPE_ICONS = {
    call: Phone,
    follow_up: Send,
    atr_sla: ArrowRightLeft,
    renewal: RefreshCw,
    no_proposal: FileText,
    expiring_contract: AlertTriangle,
};

export default function MyDayPanel() {
    const [tasks, setTasks] = useState<MyDayTask[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getMyDayAction().then(data => {
            setTasks(data);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 animate-pulse h-64" />
        );
    }

    const critical = tasks.filter(t => t.priority === 'critical').length;
    const high = tasks.filter(t => t.priority === 'high').length;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Zap size={16} className="text-indigo-600" strokeWidth={2.5} />
                        {critical > 0 && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        )}
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Mi Día</h3>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                    {critical > 0 && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700">{critical} urgentes</span>}
                    {high > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{high} hoy</span>}
                    {critical === 0 && high === 0 && (
                        <span className="text-slate-400 font-normal">Todo al día</span>
                    )}
                </div>
            </div>

            {/* Tasks */}
            <div className="flex-1 overflow-y-auto max-h-[400px] divide-y divide-slate-50">
                {tasks.length === 0 ? (
                    <div className="p-8 text-center">
                        <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-slate-700">¡Día despejado!</p>
                        <p className="text-xs text-slate-400 mt-1">No hay tareas prioritarias pendientes.</p>
                    </div>
                ) : (
                    tasks.slice(0, 15).map(task => {
                        const style = PRIORITY_STYLES[task.priority];
                        const Icon = TYPE_ICONS[task.type] ?? Clock;

                        return (
                            <div
                                key={task.id}
                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/70 transition-colors group"
                            >
                                <Link href={task.cta_href} className="flex flex-1 min-w-0 items-center gap-3">
                                    {/* Priority dot */}
                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />

                                    {/* Icon */}
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${style.bg} ${style.border} border`}>
                                        <Icon size={13} className={style.text} strokeWidth={2.5} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[12px] font-semibold text-slate-800 truncate">
                                            {task.client_name}
                                        </p>
                                        <p className="text-[10px] text-slate-500 truncate">
                                            {task.title} - {task.subtitle}
                                        </p>
                                    </div>

                                    {/* Due badge */}
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${style.bg} ${style.text}`}>
                                        {task.due_label}
                                    </span>

                                    <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-500 shrink-0" />
                                </Link>

                                {task.phone && (
                                    <a
                                        href={`tel:${task.phone}`}
                                        onClick={e => e.stopPropagation()}
                                        className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 hover:bg-emerald-100 transition-colors"
                                        aria-label={`Llamar a ${task.client_name}`}
                                    >
                                        <Phone size={12} strokeWidth={2.5} />
                                    </a>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
