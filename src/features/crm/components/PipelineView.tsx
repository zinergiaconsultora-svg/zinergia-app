'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Client, ClientStatus } from '@/types/crm';
import { updateClientStatus } from '@/app/actions/crm';

interface Props {
    clients: Client[];
    onStatusChange: () => void;
}

const COLUMNS: { status: ClientStatus; label: string; color: string; emoji: string }[] = [
    { status: 'new', label: 'Nuevos', color: 'border-blue-500/50 bg-blue-500/5', emoji: '🆕' },
    { status: 'contacted', label: 'Contactados', color: 'border-amber-500/50 bg-amber-500/5', emoji: '📞' },
    { status: 'in_process', label: 'En Proceso', color: 'border-violet-500/50 bg-violet-500/5', emoji: '⚡' },
    { status: 'won', label: 'Ganados', color: 'border-emerald-500/50 bg-emerald-500/5', emoji: '🏆' },
    { status: 'lost', label: 'Perdidos', color: 'border-red-500/50 bg-red-500/5', emoji: '❌' },
];

export default function PipelineView({ clients, onStatusChange }: Props) {
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<ClientStatus | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const grouped = useMemo(() => {
        const map = new Map<ClientStatus, Client[]>();
        COLUMNS.forEach(c => map.set(c.status, []));
        clients.forEach(client => {
            const list = map.get(client.status);
            if (list) list.push(client);
        });
        return map;
    }, [clients]);

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

        setUpdatingId(clientId);
        try {
            await updateClientStatus(clientId, newStatus);
            onStatusChange();
        } catch (err) {
            console.error('Error moviendo cliente:', err);
        } finally {
            setUpdatingId(null);
        }
    }, [clients, onStatusChange]);

    return (
        <div className="flex gap-3 overflow-x-auto pb-4 min-h-[500px]">
            {COLUMNS.map(col => {
                const columnClients = grouped.get(col.status) ?? [];
                const isOver = dragOverColumn === col.status;

                return (
                    <div
                        key={col.status}
                        className={`flex-1 min-w-[220px] max-w-[320px] rounded-2xl border-2 border-dashed p-3 transition-all backdrop-blur-md ${col.color} ${
                            isOver ? 'scale-[1.02] shadow-2xl border-solid bg-white/80 dark:bg-slate-800/80 ring-2 ring-indigo-500/20' : ''
                        }`}
                        onDragOver={(e) => handleDragOver(e, col.status)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, col.status)}
                    >
                        {/* Column Header */}
                        <div className="flex items-center justify-between mb-3 px-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm">{col.emoji}</span>
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                    {col.label}
                                </span>
                            </div>
                            <span className="text-[10px] font-bold bg-slate-200/80 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                                {columnClients.length}
                            </span>
                        </div>

                        {/* Cards */}
                        <div className="space-y-2">
                            {columnClients.map(client => (
                                <div
                                    key={client.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, client.id)}
                                    onDragEnd={handleDragEnd}
                                    className={`bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-xl p-3 shadow-md border border-white dark:border-slate-600 cursor-grab active:cursor-grabbing hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${
                                        draggingId === client.id ? 'opacity-40 scale-95 ring-2 ring-indigo-500/30' : ''
                                    } ${updatingId === client.id ? 'animate-pulse' : ''}`}
                                >
                                    <div className="text-sm font-medium text-slate-800 dark:text-white truncate">
                                        {client.name}
                                    </div>
                                    {client.cups && (
                                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono truncate">
                                            {client.cups}
                                        </div>
                                    )}
                                    {client.email && (
                                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                                            {client.email}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {columnClients.length === 0 && (
                                <div className="text-center py-8 text-slate-400 dark:text-slate-600 text-xs">
                                    Arrastra clientes aquí
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
