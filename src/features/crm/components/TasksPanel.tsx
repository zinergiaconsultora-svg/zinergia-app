'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    CheckCircle2,
    Circle,
    AlertTriangle,
    Loader2,
    Plus,
    Trash2,
    CalendarDays,
    ListTodo,
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority } from '@/types/crm';
import { tasksService } from '@/services/crm/tasks';

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; label: string }> = {
    low: { color: 'text-slate-400', label: 'Baja' },
    medium: { color: 'text-blue-500', label: 'Media' },
    high: { color: 'text-amber-500', label: 'Alta' },
    urgent: { color: 'text-red-500', label: 'Urgente' },
};

function isOverdue(dueDate?: string, status?: TaskStatus): boolean {
    if (!dueDate || status === 'completed' || status === 'cancelled') return false;
    return dueDate < new Date().toISOString().split('T')[0];
}

interface TasksPanelProps {
    clientId: string;
}

export default function TasksPanel({ clientId }: TasksPanelProps) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formTitle, setFormTitle] = useState('');
    const [formDueDate, setFormDueDate] = useState('');
    const [formPriority, setFormPriority] = useState<TaskPriority>('medium');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const data = await tasksService.getTasksByClient(clientId);
            if (cancelled) return;
            setTasks(data);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [clientId]);

    const load = useCallback(async () => {
        const data = await tasksService.getTasksByClient(clientId);
        setTasks(data);
    }, [clientId]);

    const handleToggleComplete = async (task: Task) => {
        const newStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
        await tasksService.updateTask(task.id, { status: newStatus });
        load();
    };

    const handleDelete = async (id: string) => {
        await tasksService.deleteTask(id);
        load();
    };

    const handleCreate = async () => {
        if (!formTitle.trim()) return;
        await tasksService.createTask({
            client_id: clientId,
            title: formTitle.trim(),
            due_date: formDueDate || undefined,
            priority: formPriority,
        });
        setFormTitle('');
        setFormDueDate('');
        setFormPriority('medium');
        setShowForm(false);
        load();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
        );
    }

    const pending = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
    const completed = tasks.filter(t => t.status === 'completed');

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Tareas</h3>
                    {pending.length > 0 && (
                        <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            {pending.length}
                        </span>
                    )}
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                    title="Nueva tarea"
                >
                    <Plus size={16} />
                </button>
            </div>

            {showForm && (
                <div className="mb-4 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-2">
                    <input
                        type="text"
                        placeholder="Título de la tarea..."
                        value={formTitle}
                        onChange={e => setFormTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                    />
                    <div className="flex gap-2">
                        <input
                            type="date"
                            value={formDueDate}
                            onChange={e => setFormDueDate(e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        />
                        <select
                            value={formPriority}
                            onChange={e => setFormPriority(e.target.value as TaskPriority)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        >
                            <option value="low">Baja</option>
                            <option value="medium">Media</option>
                            <option value="high">Alta</option>
                            <option value="urgent">Urgente</option>
                        </select>
                        <button
                            onClick={handleCreate}
                            disabled={!formTitle.trim()}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                        >
                            Crear
                        </button>
                    </div>
                </div>
            )}

            {tasks.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                    <ListTodo className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">Sin tareas para este cliente</p>
                </div>
            ) : (
                <div className="space-y-1.5">
                    {pending.map(task => {
                        const overdue = isOverdue(task.due_date, task.status);
                        return (
                            <div key={task.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                <button
                                    onClick={() => handleToggleComplete(task)}
                                    className={`shrink-0 ${overdue ? 'text-red-400' : 'text-slate-300 hover:text-emerald-500'} transition-colors`}
                                >
                                    <Circle size={16} />
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm truncate ${overdue ? 'text-red-600 font-semibold' : 'text-slate-800 dark:text-slate-200'}`}>
                                        {task.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {task.due_date && (
                                            <span className={`text-[10px] flex items-center gap-0.5 ${overdue ? 'text-red-500' : 'text-slate-400'}`}>
                                                {overdue ? <AlertTriangle size={9} /> : <CalendarDays size={9} />}
                                                {new Date(task.due_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                            </span>
                                        )}
                                        {task.auto_generated && (
                                            <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1 py-0.5 rounded">Auto</span>
                                        )}
                                        <span className={`text-[9px] ${PRIORITY_CONFIG[task.priority].color}`}>
                                            {PRIORITY_CONFIG[task.priority].label}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(task.id)}
                                    className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        );
                    })}

                    {completed.length > 0 && (
                        <details className="mt-2">
                            <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-slate-600 px-2">
                                {completed.length} completada{completed.length > 1 ? 's' : ''}
                            </summary>
                            <div className="mt-1 space-y-1">
                                {completed.map(task => (
                                    <div key={task.id} className="flex items-center gap-2.5 p-2 rounded-lg opacity-50">
                                        <button onClick={() => handleToggleComplete(task)} className="shrink-0 text-emerald-500">
                                            <CheckCircle2 size={16} />
                                        </button>
                                        <p className="text-sm text-slate-500 line-through truncate">{task.title}</p>
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}
                </div>
            )}
        </div>
    );
}
