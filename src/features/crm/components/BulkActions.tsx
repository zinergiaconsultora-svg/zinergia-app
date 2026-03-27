'use client';

import React, { useState, useCallback } from 'react';
import { Client, ClientStatus } from '@/types/crm';
import { updateClientStatusBulk, deleteClientsBulk } from '@/app/actions/crm';
import * as XLSX from 'xlsx';

interface Props {
    clients: Client[];
    selectedIds: Set<string>;
    onToggle: (id: string) => void;
    onSelectAll: () => void;
    onClearSelection: () => void;
    onRefresh: () => void;
}

const STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
    { value: 'new', label: 'Nuevo' },
    { value: 'contacted', label: 'Contactado' },
    { value: 'in_process', label: 'En Proceso' },
    { value: 'won', label: 'Ganado' },
    { value: 'lost', label: 'Perdido' },
];

export default function BulkActions({ clients, selectedIds, onClearSelection, onRefresh }: Props) {
    const [loading, setLoading] = useState(false);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);
    const count = selectedIds.size;

    const handleBulkStatus = useCallback(async (newStatus: ClientStatus) => {
        if (count === 0) return;
        setLoading(true);
        try {
            await updateClientStatusBulk(Array.from(selectedIds), newStatus);
            onClearSelection();
            onRefresh();
        } catch (err) {
            console.error('Bulk status error:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedIds, count, onClearSelection, onRefresh]);

    const handleBulkDelete = useCallback(async () => {
        setLoading(true);
        try {
            await deleteClientsBulk(Array.from(selectedIds));
            onClearSelection();
            onRefresh();
        } catch (err) {
            console.error('Bulk delete error:', err);
        } finally {
            setLoading(false);
            setShowConfirmDelete(false);
        }
    }, [selectedIds, onClearSelection, onRefresh]);

    const handleExport = useCallback(() => {
        const selected = clients.filter(c => selectedIds.has(c.id));
        const rows = selected.map(c => ({
            'Nombre': c.name,
            'Email': c.email ?? '',
            'Teléfono': c.phone ?? '',
            'CUPS': c.cups ?? '',
            'Estado': c.status,
            'Tipo': c.type,
            'Dirección': c.address ?? '',
            'Fecha Creación': c.created_at,
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
        XLSX.writeFile(wb, `Clientes_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }, [clients, selectedIds]);

    if (count === 0) return null;

    return (
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl border border-indigo-200 dark:border-indigo-800/50 animate-in slide-in-from-top-2">
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mr-2">
                {count} seleccionado{count > 1 ? 's' : ''}
            </span>

            {/* Status change dropdown */}
            <select
                onChange={(e) => {
                    if (e.target.value) handleBulkStatus(e.target.value as ClientStatus);
                    e.target.value = '';
                }}
                disabled={loading}
                aria-label="Cambiar estado"
                className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-600 dark:text-slate-300 cursor-pointer"
                defaultValue=""
            >
                <option value="" disabled>Cambiar estado...</option>
                {STATUS_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                ))}
            </select>

            {/* Export */}
            <button
                onClick={handleExport}
                disabled={loading}
                className="text-xs px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors font-medium"
            >
                📥 Exportar
            </button>

            {/* Delete */}
            {!showConfirmDelete ? (
                <button
                    onClick={() => setShowConfirmDelete(true)}
                    disabled={loading}
                    className="text-xs px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-medium"
                >
                    🗑 Eliminar
                </button>
            ) : (
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleBulkDelete}
                        disabled={loading}
                        className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors font-medium"
                    >
                        {loading ? '...' : '⚠ Confirmar'}
                    </button>
                    <button
                        onClick={() => setShowConfirmDelete(false)}
                        className="text-xs px-2 py-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                        Cancelar
                    </button>
                </div>
            )}

            {/* Clear */}
            <button
                onClick={onClearSelection}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 ml-auto"
            >
                ✕ Limpiar
            </button>
        </div>
    );
}
