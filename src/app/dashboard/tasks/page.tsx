'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    ListTodo,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Circle,
    Loader2,
    Plus,
    Filter,
    Trash2,
    CalendarDays,
    User,
} from 'lucide-react';
import Link from 'next/link';
import { Task, TaskStatus, TaskPriority } from '@/types/crm';
import { tasksService } from '@/services/crm/tasks';
import { ErrorState } from '@/components/ui/ErrorState';

const STATUS_TABS: { value: TaskStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'pending', label: 'Pendientes' },
    { value: 'in_progress', label: 'En progreso' },
    { value: 'completed', label: 'Completadas' },
];

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; label: string; bg: string }> = {
    low: { color: 'text-slate-500', label: 'Baja', bg: 'bg-slate-100' },
    medium: { color: 'text-blue-600', label: 'Media', bg: 'bg-blue-50' },
    high: { color: 'text-amber-600', label: 'Alta', bg: 'bg-amber-50' },
    urgent: { color: 'text-red-600', label: 'Urgente', bg: 'bg-red-50' },
};

function isOverdue(dueDate?: string, status?: TaskStatus): boolean {
    if (!dueDate || status === 'completed' || status === 'cancelled') return false;
    return dueDate < new Date().toISOString().split('T')[0];
}

export default function TasksPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [stats, setStats] = useState({ pending: 0, overdue: 0, completed: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formTitle, setFormTitle] = useState('');
    const [formDueDate, setFormDueDate] = useState('');
    const [formPriority, setFormPriority] = useState<TaskPriority>('medium');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [taskData, taskStats] = await Promise.all([
                    tasksService.getTasks({ status: filter !== 'all' ? filter : undefined }),
                    tasksService.getTaskStats(),
                ]);
                if (cancelled) return;
                setTasks(taskData);
                setStats(taskStats);
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar las tareas');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [filter]);

    const loadData = useCallback(async () => {
        const [taskData, taskStats] = await Promise.all([
            tasksService.getTasks({ status: filter !== 'all' ? filter : undefined }),
            tasksService.getTaskStats(),
        ]);
        setTasks(taskData);
        setStats(taskStats);
    }, [filter]);

    const handleToggleComplete = async (task: Task) => {
        const newStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
        await tasksService.updateTask(task.id, { status: newStatus });
        loadData();
    };

    const handleDelete = async (id: string) => {
        await tasksService.deleteTask(id);
        loadData();
    };

    const handleCreate = async () => {
        if (!formTitle.trim()) return;
        setCreating(true);
        await tasksService.createTask({
            title: formTitle.trim(),
            due_date: formDueDate || undefined,
            priority: formPriority,
        });
        setFormTitle('');
        setFormDueDate('');
        setFormPriority('medium');
        setCreating(false);
        setShowCreateModal(false);
        loadData();
    };

    const kpis = [
        { label: 'Total', value: stats.total, icon: ListTodo, color: 'text-slate-700' },
        { label: 'Pendientes', value: stats.pending, icon: Clock, color: 'text-amber-600' },
        { label: 'Vencidas', value: stats.overdue, icon: AlertTriangle, color: 'text-red-600' },
        { label: 'Completadas', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-600' },
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Tareas</h1>
                    <p className="text-sm text-slate-500 mt-1">Gestiona tus tareas y seguimientos</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Tarea
                </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {kpis.map((kpi, i) => (
                    <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
                        <div className="flex items-center gap-3">
                            <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                            <div>
                                <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{kpi.label}</div>
                                <div className="text-xl font-bold text-slate-900">{kpi.value}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-2 mb-4">
                <Filter className="w-4 h-4 text-slate-400" />
                {STATUS_TABS.map(tab => (
                    <button
                        key={tab.value}
                        onClick={() => setFilter(tab.value)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${filter === tab.value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {error ? (
                <ErrorState title="Error al cargar tareas" description={error} retry={loadData} />
            ) : loading ? (
                <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
            ) : tasks.length === 0 ? (
                <div className="text-center p-12 text-slate-400">
                    <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No hay tareas{filter !== 'all' ? ` con este filtro` : ''}</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                    {tasks.map(task => {
                        const overdue = isOverdue(task.due_date, task.status);
                        const clientName = task.clients?.name;

                        return (
                            <div key={task.id} className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors group">
                                <button
                                    onClick={() => handleToggleComplete(task)}
                                    className={`shrink-0 ${task.status === 'completed' ? 'text-emerald-500' : overdue ? 'text-red-400' : 'text-slate-300 hover:text-emerald-500'} transition-colors`}
                                >
                                    {task.status === 'completed' ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                                </button>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className={`text-sm font-medium truncate ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                                            {task.title}
                                        </p>
                                        {task.auto_generated && (
                                            <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded shrink-0">Auto</span>
                                        )}
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${PRIORITY_CONFIG[task.priority].bg} ${PRIORITY_CONFIG[task.priority].color}`}>
                                            {PRIORITY_CONFIG[task.priority].label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1">
                                        {clientName && (
                                            <Link
                                                href={`/dashboard/clients/${task.client_id}`}
                                                className="text-[10px] text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5"
                                            >
                                                <User size={9} />
                                                {clientName}
                                            </Link>
                                        )}
                                        {task.due_date && (
                                            <span className={`text-[10px] flex items-center gap-0.5 ${overdue ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                                                {overdue ? <AlertTriangle size={9} /> : <CalendarDays size={9} />}
                                                {new Date(task.due_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleDelete(task.id)}
                                    className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div role="dialog" aria-modal="true" aria-label="Nueva tarea" className="bg-white rounded-2xl max-w-md w-full p-6">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">Nueva Tarea</h2>
                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="Título de la tarea..."
                                value={formTitle}
                                onChange={e => setFormTitle(e.target.value)}
                                aria-label="Título de la tarea"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                            />
                            <input
                                type="date"
                                value={formDueDate}
                                onChange={e => setFormDueDate(e.target.value)}
                                aria-label="Fecha límite"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            />
                            <select
                                value={formPriority}
                                onChange={e => setFormPriority(e.target.value as TaskPriority)}
                                aria-label="Prioridad"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            >
                                <option value="low">Prioridad: Baja</option>
                                <option value="medium">Prioridad: Media</option>
                                <option value="high">Prioridad: Alta</option>
                                <option value="urgent">Prioridad: Urgente</option>
                            </select>
                        </div>
                        <div className="flex justify-end gap-2 mt-5">
                            <button
                                onClick={() => { setShowCreateModal(false); setFormTitle(''); }}
                                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!formTitle.trim() || creating}
                                className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                            >
                                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear Tarea'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
