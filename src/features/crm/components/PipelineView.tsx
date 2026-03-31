'use client';

import React, { useState, useMemo, useCallback, useOptimistic } from 'react';
import { Client, ClientStatus } from '@/types/crm';
import { updateClientStatus } from '@/app/actions/crm';
import { Building2, User } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
    clients: Client[];
    onStatusChange: () => void;
}

const COLUMNS: { status: ClientStatus; label: string; dot: string; hoverBg: string }[] = [
    { status: 'new', label: 'Nuevos', dot: 'bg-blue-500', hoverBg: 'bg-blue-50/50 dark:bg-blue-900/10' },
    { status: 'contacted', label: 'Contactados', dot: 'bg-amber-500', hoverBg: 'bg-amber-50/50 dark:bg-amber-900/10' },
    { status: 'in_process', label: 'En proceso', dot: 'bg-violet-500', hoverBg: 'bg-violet-50/50 dark:bg-violet-900/10' },
    { status: 'won', label: 'Ganados', dot: 'bg-emerald-500', hoverBg: 'bg-emerald-50/50 dark:bg-emerald-900/10' },
    { status: 'lost', label: 'Perdidos', dot: 'bg-red-500', hoverBg: 'bg-red-50/50 dark:bg-red-900/10' },
];

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
        <div className="flex gap-6 overflow-x-auto pb-8 pt-2 snap-x px-2">
            {COLUMNS.map(col => {
                const columnClients = grouped.get(col.status) ?? [];
                const isOver = dragOverColumn === col.status;
                const columnValue = columnClients.reduce((sum, c) => sum + (c.average_monthly_bill || 0), 0);

                return (
                    <div
                        key={col.status}
                        className="flex-1 min-w-[280px] max-w-[320px] shrink-0 flex flex-col snap-start"
                        onDragOver={(e) => handleDragOver(e, col.status)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, col.status)}
                    >
                        {/* Minimalist Header */}
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/60 dark:border-slate-800 transition-colors">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate pr-2">
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

                        {/* Drop Zone & Cards */}
                        <div className={`flex flex-col gap-3 min-h-[500px] rounded-2xl transition-all duration-300 p-1 -mx-1 ${
                            isOver ? col.hoverBg + ' ring-1 ring-slate-200/50 dark:ring-slate-700/50' : ''
                        }`}>
                            {columnClients.map(client => (
                                <div
                                    key={client.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, client.id)}
                                    onDragEnd={handleDragEnd}
                                    onClick={() => router.push(`/dashboard/clients/${client.id}`)}
                                    className={`bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200/70 dark:border-slate-800 cursor-pointer active:cursor-grabbing hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-[1px] transition-all duration-200 group flex flex-col gap-3 ${
                                        draggingId === client.id ? 'opacity-40 scale-95 ring-2 ring-indigo-500' : ''
                                    }`}
                                >
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 capitalize leading-tight">
                                            {client.name.toLowerCase()}
                                        </div>
                                        <div className="text-slate-300 dark:text-slate-600 shrink-0">
                                            {client.type === 'company' ? <Building2 size={14} strokeWidth={2.5} /> : <User size={14} strokeWidth={2.5} />}
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-between items-end gap-4 min-h-[16px]">
                                        {client.cups ? (
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono tracking-wider truncate">
                                                {client.cups.substring(0, 20)}
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-slate-300 dark:text-slate-600 font-medium italic">Sin CUPS</div>
                                        )}
                                        {client.average_monthly_bill ? (
                                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                                                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(client.average_monthly_bill)}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            ))}

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
