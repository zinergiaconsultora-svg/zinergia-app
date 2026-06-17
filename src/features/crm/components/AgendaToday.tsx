'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    getAgendaTodayAction,
    type AgendaTodayData,
} from '@/app/actions/agendaToday';
import {
    AlertTriangle,
    CalendarCheck,
    Clock,
    Send,
    ChevronRight,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { logger } from '@/lib/utils/logger';

const PRIORITY_DOT: Record<string, string> = {
    urgent: 'bg-red-500',
    high: 'bg-amber-500',
    medium: 'bg-blue-400',
    low: 'bg-slate-300',
};

export default function AgendaToday() {
    const [data, setData] = useState<AgendaTodayData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getAgendaTodayAction()
            .then(setData)
            .catch(err => logger.error('Error loading agenda:', err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="space-y-3">
                <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    if (!data) return null;

    const totalItems = data.overdueTasks.length + data.todayTasks.length + data.coldProposals.length;

    if (totalItems === 0) {
        return (
            <div className="text-center py-6">
                <CalendarCheck size={28} className="mx-auto text-emerald-400 mb-2" />
                <p className="text-sm font-semibold text-slate-700">Todo al día</p>
                <p className="text-xs text-slate-400 mt-0.5">No tienes tareas pendientes ni propuestas frías.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Overdue Tasks */}
            {data.overdueTasks.length > 0 && (
                <div>
                    <div className="flex items-center gap-1.5 mb-2">
                        <AlertTriangle size={12} className="text-red-500" />
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-red-500">
                            Vencidas ({data.overdueTasks.length})
                        </h4>
                    </div>
                    <div className="space-y-1.5">
                        {data.overdueTasks.map(task => (
                            <TaskRow key={task.id} task={task} overdue />
                        ))}
                    </div>
                </div>
            )}

            {/* Today's Tasks */}
            {data.todayTasks.length > 0 && (
                <div>
                    <div className="flex items-center gap-1.5 mb-2">
                        <Clock size={12} className="text-amber-500" />
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
                            Hoy ({data.todayTasks.length})
                        </h4>
                    </div>
                    <div className="space-y-1.5">
                        {data.todayTasks.map(task => (
                            <TaskRow key={task.id} task={task} />
                        ))}
                    </div>
                </div>
            )}

            {/* Cold Proposals */}
            {data.coldProposals.length > 0 && (
                <div>
                    <div className="flex items-center gap-1.5 mb-2">
                        <Send size={12} className="text-blue-500" />
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
                            Propuestas frías ({data.coldProposals.length})
                        </h4>
                    </div>
                    <div className="space-y-1.5">
                        {data.coldProposals.map(p => (
                            <Link
                                key={p.id}
                                href={`/dashboard/proposals/${p.id}`}
                                className="flex items-center gap-3 p-2.5 rounded-xl bg-blue-50/50 border border-blue-100 hover:bg-blue-50 transition-colors group"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-slate-700 truncate group-hover:text-blue-700">
                                        {p.client_name}
                                    </p>
                                    <p className="text-[10px] text-slate-400">
                                        {formatCurrency(p.annual_savings)} · enviada hace {p.days_since_sent}d
                                    </p>
                                </div>
                                <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 shrink-0" />
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            <Link
                href="/dashboard/tasks"
                className="block text-center text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 uppercase tracking-wider pt-1"
            >
                Ver todas las tareas →
            </Link>
        </div>
    );
}

function TaskRow({ task, overdue }: { task: { id: string; title: string; priority: string; client_name: string | null; client_id: string | null }; overdue?: boolean }) {
    return (
        <div className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-colors ${overdue ? 'bg-red-50/50 border-red-100' : 'bg-amber-50/50 border-amber-100'}`}>
            <div className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[task.priority] || 'bg-slate-300'}`} />
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{task.title}</p>
                {task.client_name && task.client_id && (
                    <Link href={`/dashboard/clients/${task.client_id}`} className="text-[10px] text-indigo-500 hover:text-indigo-700">
                        {task.client_name}
                    </Link>
                )}
            </div>
        </div>
    );
}
