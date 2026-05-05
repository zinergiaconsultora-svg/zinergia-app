'use client';

import React, { useState, useMemo, useCallback, useOptimistic } from 'react';
import { Client, ClientStatus } from '@/types/crm';
import { updateClientStatus } from '@/app/actions/crm';
import { Building2, User, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
    clients: Client[];
    onStatusChange: () => void;
}

const COLUMNS: { status: ClientStatus; label: string; dot: string; hoverBg: string; border: string }[] = [
    { status: 'new',        label: 'Nuevos',      dot: 'bg-blue-500',    hoverBg: 'bg-blue-50/50 dark:bg-blue-900/10',    border: 'border-blue-200/60 dark:border-blue-800/40' },
    { status: 'contacted',  label: 'Contactados', dot: 'bg-amber-500',   hoverBg: 'bg-amber-50/50 dark:bg-amber-900/10',  border: 'border-amber-200/60 dark:border-amber-800/40' },
    { status: 'in_process', label: 'En proceso',  dot: 'bg-violet-500',  hoverBg: 'bg-violet-50/50 dark:bg-violet-900/10',border: 'border-violet-200/60 dark:border-violet-800/40' },
    { status: 'won',        label: 'Ganados',     dot: 'bg-emerald-500', hoverBg: 'bg-emerald-50/50 dark:bg-emerald-900/10', border: 'border-emerald-200/60 dark:border-emerald-800/40' },
    { status: 'lost',       label: 'Perdidos',    dot: 'bg-red-500',     hoverBg: 'bg-red-50/50 dark:bg-red-900/10',      border: 'border-red-200/60 dark:border-red-800/40' },
];

// Días sin cambio de estado — proxy de "tiempo en esta fase"
function daysInStatus(updatedAt?: string): number {
    if (!updatedAt) return 0;
    return Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000);
}

// Nivel de urgencia según fase y días
function urgencyLevel(status: ClientStatus, days: number): 'hot' | 'warm' | null {
    if (status === 'won' || status === 'lost') return null;
    if (days >= 7) return 'hot';
    if (days >= 3) return 'warm';
    return null;
}

export default function PipelineView({ clients, onStatusChange }: Props) {
    const router = useRouter();
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<ClientStatus | null>(null);

    const [optimisticClients, applyOptimisticMove] = useOptimistic(
        clients,
        (state, { id, newStatus }: { id: string; newStatus: ClientStatus }) =>
            state.map(c => c.id === id ? { ...c, status: newStatus } : c)
    );

    const grouped = useMemo(() => {
        const map = new Map<ClientStatus, Client[]>();
        COLUMNS.forEach(c => map.set(c.status, []));
        optimisticClients.forEach(client => {
            const list = map.get(client.status);
            if (list) list.push(client);
        });
        return map;
    }, [optimisticClients]);

    const handleDragStart = useCallback((e: React.DragEvent, clientId: string) => {
        e.dataTransfer.setData('text/plain', clientId);
        e.dataTransfer.effectAllowed = 'move';
        setDraggingId(clientId);
    }, []);

    const handleDragEnd = useCallback(() => {
        setDraggingId(null);
        setDragOverColumn(null);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, status: ClientStatus) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverColumn(status);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOverColumn(null);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent, newStatus: ClientStatus) => {
        e.preventDefault();
        const clientId = e.dataTransfer.getData('text/plain');
        setDragOverColumn(null);
        setDraggingId(null);

        const client = clients.find(c => c.id === clientId);
        if (!client || client.status === newStatus) return;

        applyOptimisticMove({ id: clientId, newStatus });
        try {
            await updateClientStatus(clientId, newStatus);
            onStatusChange();
        } catch (err) {
            console.error('Error moviendo cliente:', err);
        }
    }, [clients, onStatusChange, applyOptimisticMove]);

    return (
        <div className="flex gap-4 overflow-x-auto pb-8 pt-2 snap-x px-2">
            {COLUMNS.map(col => {
                const columnClients = grouped.get(col.status) ?? [];
                const isOver = dragOverColumn === col.status;
                const columnValue = columnClients.reduce((sum, c) => sum + (c.average_monthly_bill || 0), 0);

                return (
                    <div
                        key={col.status}
                        className="flex-1 min-w-[270px] max-w-[310px] shrink-0 flex flex-col snap-start"
                        onDragOver={(e) => handleDragOver(e, col.status)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, col.status)}
                    >
                        {/* Column header */}
                        <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200/60 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    {col.label}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                    {columnClients.length}
                                </span>
                            </div>
                            {columnValue > 0 && (
                                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                                    {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(columnValue)}
                                </span>
                            )}
                        </div>

                        {/* Drop zone */}
                        <div className={`flex flex-col gap-2.5 min-h-[500px] rounded-2xl transition-all duration-300 p-1 -mx-1 ${
                            isOver ? col.hoverBg + ' ring-1 ring-slate-200/50 dark:ring-slate-700/50' : ''
                        }`}>
                            {columnClients.map(client => {
                                const days = daysInStatus(client.updated_at);
                                const urgency = urgencyLevel(client.status, days);

                                return (
                                    <div
                                        key={client.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, client.id)}
                                        onDragEnd={handleDragEnd}
                                        onClick={() => router.push(`/dashboard/clients/${client.id}`)}
                                        className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm border cursor-pointer active:cursor-grabbing hover:shadow-md hover:-translate-y-[1px] transition-all duration-200 group flex flex-col gap-2 relative overflow-hidden ${
                                            draggingId === client.id
                                                ? 'opacity-40 scale-95 ring-2 ring-indigo-500'
                                                : urgency === 'hot'
                                                    ? 'border-red-200 dark:border-red-800/50'
                                                    : urgency === 'warm'
                                                        ? 'border-amber-200 dark:border-amber-800/50'
                                                        : 'border-slate-200/70 dark:border-slate-800 hover:border-indigo-300/50 dark:hover:border-indigo-500/50'
                                        }`}
                                    >
                                        {/* Urgency top bar */}
                                        {urgency && (
                                            <div className={`h-0.5 w-full ${urgency === 'hot' ? 'bg-red-400' : 'bg-amber-400'}`} />
                                        )}

                                        <div className="px-3.5 pb-3 pt-2.5 flex flex-col gap-2">
                                            {/* Name + icon row */}
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-tight truncate pr-1">
                                                    {client.name}
                                                </div>
                                                <div className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center ${
                                                    client.type === 'company'
                                                        ? 'bg-blue-50 text-blue-500 dark:bg-blue-500/10 dark:text-blue-400'
                                                        : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400'
                                                }`}>
                                                    {client.type === 'company' ? <Building2 size={12} strokeWidth={2.5} /> : <User size={12} strokeWidth={2.5} />}
                                                </div>
                                            </div>

                                            {/* Tags row */}
                                            <div className="flex gap-1.5 flex-wrap">
                                                {client.current_supplier && (
                                                    <span className="text-[9px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-1.5 py-0.5 rounded truncate max-w-[100px]">
                                                        {client.current_supplier}
                                                    </span>
                                                )}
                                                {client.tariff_type && (
                                                    <span className="text-[9px] font-semibold text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400 px-1.5 py-0.5 rounded shrink-0">
                                                        {client.tariff_type}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Footer: CUPS + value + days */}
                                            <div className="flex justify-between items-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                                                <div className="min-w-0 flex flex-col gap-0.5">
                                                    {client.cups ? (
                                                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono tracking-wider break-all" title={client.cups}>
                                                            {client.cups}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[10px] text-slate-300 dark:text-slate-600 italic">Sin CUPS</div>
                                                    )}
                                                    {/* Days in status */}
                                                    {days > 0 && (
                                                        <div className={`text-[9px] font-semibold ${
                                                            urgency === 'hot'
                                                                ? 'text-red-500'
                                                                : urgency === 'warm'
                                                                    ? 'text-amber-500'
                                                                    : 'text-slate-400'
                                                        }`}>
                                                            {days}d en esta fase
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="shrink-0 flex items-center gap-1.5">
                                                    {client.average_monthly_bill ? (
                                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                                            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(client.average_monthly_bill)}
                                                        </span>
                                                    ) : null}

                                                    {/* Simular button — only visible on hover */}
                                                    {client.status !== 'won' && client.status !== 'lost' && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                sessionStorage.setItem('pendingClientPreload', JSON.stringify({
                                                                    client_id: client.id,
                                                                    client_name: client.name,
                                                                    cups: client.cups ?? '',
                                                                }));
                                                                router.push('/dashboard/simulator');
                                                            }}
                                                            title="Simular ahorro para este cliente"
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-md bg-energy-500 text-white flex items-center justify-center hover:bg-energy-600 shrink-0"
                                                        >
                                                            <Zap size={11} strokeWidth={2.5} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {columnClients.length === 0 && (
                                <div className="h-24 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-600 text-xs font-medium m-1">
                                    Soltar aquí
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
