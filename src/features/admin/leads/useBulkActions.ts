import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { bulkReassignLeadsAction, exportLeadsCsvAction, markLeadsReviewedAction } from '@/app/actions/leadBulk';
import type { InvoiceRegistryRow } from '@/app/actions/invoices';

export function useBulkActions(
    leads: InvoiceRegistryRow[],
    onRefresh: () => Promise<void>,
    onRouterRefresh: () => void,
) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState(false);

    const allVisibleSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.job_id));

    const toggleSelect = useCallback((jobId: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(jobId)) next.delete(jobId);
            else next.add(jobId);
            return next;
        });
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    const toggleSelectAllVisible = useCallback(() => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (leads.every((l) => next.has(l.job_id))) leads.forEach((l) => next.delete(l.job_id));
            else leads.forEach((l) => next.add(l.job_id));
            return next;
        });
    }, [leads]);

    const handleReassign = useCallback(async (agentId: string) => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;
        try {
            setBusy(true);
            const res = await bulkReassignLeadsAction(ids, agentId);
            if (!res.success) { toast.error(res.message ?? 'No se pudo reasignar'); return; }
            toast.success(`${res.updated} ${res.updated === 1 ? 'lead reasignado' : 'leads reasignados'}`);
            clearSelection();
            await onRefresh();
            onRouterRefresh();
        } catch {
            toast.error('No se pudo reasignar');
        } finally {
            setBusy(false);
        }
    }, [selectedIds, clearSelection, onRefresh, onRouterRefresh]);

    const handleReview = useCallback(async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;
        try {
            setBusy(true);
            const res = await markLeadsReviewedAction(ids);
            if (!res.success) { toast.error(res.message ?? 'No se pudo marcar'); return; }
            toast.success(`${res.updated} ${res.updated === 1 ? 'lead revisado' : 'leads revisados'}`);
            clearSelection();
            await onRefresh();
            onRouterRefresh();
        } catch {
            toast.error('No se pudo marcar como revisado');
        } finally {
            setBusy(false);
        }
    }, [selectedIds, clearSelection, onRefresh, onRouterRefresh]);

    const handleExport = useCallback(async () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;
        try {
            setBusy(true);
            const res = await exportLeadsCsvAction(ids);
            if (!res.success || !res.csv) { toast.error(res.message ?? 'No se pudo exportar'); return; }
            const blob = new Blob(['﻿' + res.csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success(`${ids.length} ${ids.length === 1 ? 'lead exportado' : 'leads exportados'}`);
        } catch {
            toast.error('No se pudo exportar');
        } finally {
            setBusy(false);
        }
    }, [selectedIds]);

    return {
        selectedIds,
        setSelectedIds,
        busy,
        allVisibleSelected,
        toggleSelect,
        clearSelection,
        toggleSelectAllVisible,
        handleReassign,
        handleReview,
        handleExport,
    };
}
