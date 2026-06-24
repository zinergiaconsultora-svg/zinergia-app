'use client';

import React, { useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { AlertTriangle, CalendarClock, CloudOff, Search, Eye, Info, UserCheck, XCircle, Inbox, Clock3, ClipboardList } from 'lucide-react';
import { useAdminLeads } from './useAdminLeads';
import { buildAdminLeadQueryString } from './filters';
import { LeadDetailDrawer } from './LeadDetailDrawer';
import { buildOperationalQueuePatch, OPERATIONAL_QUEUES } from './operationalQueues';
import { BulkActionsBar, type AgentOption } from './BulkActionsBar';
import { bulkReassignLeadsAction, exportLeadsCsvAction, markLeadsReviewedAction } from '@/app/actions/leadBulk';
import { scoreLead, sortByPriority } from './priority';
import { PriorityBadge } from './PriorityBadge';
import {
    getInvoiceFileUrlAction,
    markLeadLostAction,
    type AdminLeadFilters,
    type AdminLeadOutcome,
    type AdminLeadQueue,
    type InvoiceRegistryRow,
} from '@/app/actions/invoices';
import {
    addLeadNoteAction,
    getLeadAuditEventsAction,
    type LeadAuditEvent,
} from '@/app/actions/leadAudit';
import {
    formatEur,
    formatDate,
    ProcessBadge,
    LeadStatusBadge,
    DriveChip,
    CloseInvoiceModal,
    useEscapeKey,
} from '@/features/invoices/components/invoiceParts';

const TABS: { value: AdminLeadOutcome; label: string }[] = [
    { value: 'open', label: 'Abiertos' },
    { value: 'won', label: 'Clientes' },
    { value: 'lost', label: 'Perdidos' },
    { value: 'all', label: 'Todos' },
];

const QUEUE_ICONS: Record<AdminLeadQueue, React.ComponentType<{ size?: number; className?: string }>> = {
    drive_pending: CloudOff,
    ocr_failed: AlertTriangle,
    needs_comparison: Search,
    permanence_due: CalendarClock,
    needs_review: ClipboardList,
    cooling: Clock3,
};

function LostModal({
    invoice,
    onClose,
    onLost,
}: {
    invoice: InvoiceRegistryRow;
    onClose: () => void;
    onLost: (reason: string | null) => void;
}) {
    const [reason, setReason] = useState(invoice.lost_reason ?? '');
    const [saving, setSaving] = useState(false);
    useEscapeKey(onClose);
    const titleId = 'lost-lead-title';
    const descriptionId = 'lost-lead-description';

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        try {
            setSaving(true);
            const normalizedReason = reason.trim() ? reason.trim().slice(0, 300) : null;
            const res = await markLeadLostAction(invoice.job_id, normalizedReason);
            if (!res.success) {
                toast.error('No se pudo marcar como perdido');
                return;
            }
            toast.success(invoice.lost ? 'Motivo actualizado' : 'Lead marcado como perdido');
            onLost(normalizedReason);
            onClose();
        } catch {
            toast.error('No se pudo marcar como perdido');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4" onClick={onClose}>
            <motion.form
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={(e) => e.stopPropagation()}
                onSubmit={submit}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-xl space-y-4"
            >
                <h2 id={titleId} className="text-lg font-bold text-slate-900">
                    {invoice.lost ? 'Editar motivo de pérdida' : 'Marcar lead como perdido'}
                </h2>
                <p id={descriptionId} className="text-[13px] text-slate-500">
                    {invoice.titular || 'Lead'} — no aceptó la oferta. Puedes anotar el motivo (opcional).
                </p>
                <label className="block">
                    <span className="sr-only">Motivo de pérdida</span>
                    <textarea
                        name="lostReason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        placeholder="Motivo (opcional): precio, no contesta…"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 focus:border-rose-400 focus:ring-1 focus:ring-rose-400 outline-none"
                    />
                </label>
                <div className="flex gap-2">
                    <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                        Cancelar
                    </button>
                    <button type="submit" disabled={saving} className="flex-1 py-3 rounded-2xl bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50">
                        {saving ? 'Guardando…' : 'Marcar perdido'}
                    </button>
                </div>
            </motion.form>
        </div>
    );
}

function LeadRow({
    lead,
    index,
    selected,
    onToggleSelect,
    onConvert,
    onLost,
    onDetail,
}: {
    lead: InvoiceRegistryRow;
    index: number;
    selected: boolean;
    onToggleSelect: () => void;
    onConvert: () => void;
    onLost: () => void;
    onDetail: () => void;
}) {
    const amount = formatEur(lead.importe_total);
    const commission = formatEur(lead.commission_amount);
    const [opening, setOpening] = useState(false);
    const isOpen = !lead.closed && !lead.lost;
    const priority = isOpen ? scoreLead(lead) : null;

    async function viewFile() {
        try {
            setOpening(true);
            const url = await getInvoiceFileUrlAction(lead.job_id);
            if (url) window.open(url, '_blank', 'noopener,noreferrer');
            else toast.error('El archivo ya no está disponible');
        } catch {
            toast.error('No se pudo abrir el archivo');
        } finally {
            setOpening(false);
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(index * 0.025, 0.25) }}
            className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md hover:border-slate-200 transition-colors"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={onToggleSelect}
                        aria-label={`Seleccionar lead de ${lead.titular || 'sin titular'}`}
                        className="mt-1 h-4 w-4 shrink-0 rounded accent-indigo-600 cursor-pointer"
                    />
                    <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{lead.titular || 'Sin titular'}</p>
                    <p className="text-sm text-slate-500 truncate">
                        {lead.comercializadora_actual || 'Comercializadora desconocida'}
                        {lead.tarifa_actual ? ` · ${lead.tarifa_actual}` : ''}
                    </p>
                    <p className="text-[12px] text-slate-400 mt-0.5">
                        Comercial: <span className="font-medium text-slate-600">{lead.agent_name || '—'}</span>
                        {lead.franchise_name ? ` · ${lead.franchise_name}` : ''}
                    </p>
                    </div>
                </div>
                <div className="text-right shrink-0">
                    {amount && <p className="font-bold text-slate-900 tabular-nums">{amount}</p>}
                    <p className="text-[11px] text-slate-400">{formatDate(lead.created_at)}</p>
                    {commission && <p className="text-[11px] font-semibold text-emerald-700">Comisión {commission}</p>}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
                {priority && <PriorityBadge priority={priority} showSavings />}
                <LeadStatusBadge closed={lead.closed} lost={lead.lost} />
                <ProcessBadge status={lead.process_status} />
                <DriveChip link={lead.drive_view_link} synced={lead.archived_in_drive} />

                <div className="ml-auto flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onDetail}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-lg transition-colors"
                    >
                        <Info size={13} /> Detalle
                    </button>
                    <button
                        type="button"
                        onClick={viewFile}
                        disabled={opening}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Eye size={13} /> {opening ? '…' : 'Ver'}
                    </button>
                    {isOpen && lead.process_status !== 'failed' && (
                        <>
                            <button
                                type="button"
                                onClick={onLost}
                                className="inline-flex items-center gap-1 text-[12px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1 rounded-lg transition-colors"
                            >
                                <XCircle size={13} /> Perdido
                            </button>
                            <button
                                type="button"
                                onClick={onConvert}
                                className="inline-flex items-center gap-1 text-[12px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded-lg transition-colors"
                            >
                                <UserCheck size={13} /> Pasar a cliente
                            </button>
                        </>
                    )}
                </div>
            </div>

            {lead.lost && lead.lost_reason && (
                <p className="mt-2 text-[12px] text-rose-600">Motivo: {lead.lost_reason}</p>
            )}
        </motion.div>
    );
}

export default function AdminLeadsView({
    initialData,
    initialFilters,
    agents = [],
}: {
    initialData?: InvoiceRegistryRow[];
    initialFilters?: AdminLeadFilters;
    agents?: AgentOption[];
}) {
    const router = useRouter();
    const pathname = usePathname();
    const {
        leads,
        filters,
        loading,
        loadingMore,
        hasMore,
        error,
        applyFilters,
        loadMore,
        patchLead,
        removeLead,
        clearError,
    } = useAdminLeads(initialData ?? [], initialFilters);
    const [converting, setConverting] = useState<InvoiceRegistryRow | null>(null);
    const [losing, setLosing] = useState<InvoiceRegistryRow | null>(null);
    const [selectedLead, setSelectedLead] = useState<InvoiceRegistryRow | null>(null);
    const [searchTerm, setSearchTerm] = useState(filters.search ?? '');
    const [auditEvents, setAuditEvents] = useState<LeadAuditEvent[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [noteSaving, setNoteSaving] = useState(false);
    const auditRequestJobRef = useRef<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkBusy, setBulkBusy] = useState(false);
    const [sortMode, setSortMode] = useState<'recent' | 'priority'>('recent');

    const outcome = filters.outcome ?? 'open';
    const activeQueue = filters.queue;

    async function loadLeadAudit(jobId: string) {
        auditRequestJobRef.current = jobId;
        setAuditLoading(true);

        try {
            const events = await getLeadAuditEventsAction(jobId);
            if (auditRequestJobRef.current === jobId) setAuditEvents(events);
        } catch {
            if (auditRequestJobRef.current === jobId) toast.error('No se pudo cargar la auditoría');
        } finally {
            if (auditRequestJobRef.current === jobId) setAuditLoading(false);
        }
    }

    function openLeadDetail(lead: InvoiceRegistryRow) {
        setSelectedLead(lead);
        setNoteText('');
        setAuditEvents([]);
        void loadLeadAudit(lead.job_id);
    }

    function closeLeadDetail() {
        auditRequestJobRef.current = null;
        setSelectedLead(null);
        setAuditEvents([]);
        setAuditLoading(false);
        setNoteText('');
    }

    async function addSelectedLeadNote() {
        if (!selectedLead) return;

        const note = noteText.trim();
        if (!note) {
            toast.error('La nota no puede estar vacía');
            return;
        }

        try {
            setNoteSaving(true);
            const result = await addLeadNoteAction(selectedLead.job_id, note);
            if (!result.success) {
                toast.error(result.message ?? 'No se pudo guardar la nota');
                return;
            }

            toast.success('Nota añadida');
            setNoteText('');
            await loadLeadAudit(selectedLead.job_id);
        } catch {
            toast.error('No se pudo guardar la nota');
        } finally {
            setNoteSaving(false);
        }
    }

    function updateFilters(patch: Partial<AdminLeadFilters>) {
        const next = { ...filters, ...patch };
        const query = buildAdminLeadQueryString(next);
        router.replace(`${pathname}?${query}`, { scroll: false });
        setSelectedIds(new Set());
        void applyFilters(patch);
    }

    // After an action that changes outcome, drop the row from filtered lists.
    const afterMutation = (jobId: string) => {
        if (outcome === 'open') {
            removeLead(jobId);
            closeLeadDetail();
        }
        router.refresh();
    };

    function applyLeadPatch(jobId: string, patch: Partial<InvoiceRegistryRow>) {
        patchLead(jobId, patch);
        setSelectedLead((current) => (current?.job_id === jobId ? { ...current, ...patch } : current));
    }

    async function viewLeadFile(lead: InvoiceRegistryRow) {
        try {
            const url = await getInvoiceFileUrlAction(lead.job_id);
            if (url) window.open(url, '_blank', 'noopener,noreferrer');
            else toast.error('El archivo ya no está disponible');
        } catch {
            toast.error('No se pudo abrir el archivo');
        }
    }

    // ── Selección múltiple + acciones masivas ──────────────────────────────────
    function toggleSelect(jobId: string) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(jobId)) next.delete(jobId);
            else next.add(jobId);
            return next;
        });
    }
    function clearSelection() {
        setSelectedIds(new Set());
    }
    const allVisibleSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.job_id));
    const displayLeads = sortMode === 'priority' ? sortByPriority(leads) : leads;
    function toggleSelectAllVisible() {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (leads.every((l) => next.has(l.job_id))) leads.forEach((l) => next.delete(l.job_id));
            else leads.forEach((l) => next.add(l.job_id));
            return next;
        });
    }

    async function handleBulkReassign(agentId: string) {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;
        try {
            setBulkBusy(true);
            const res = await bulkReassignLeadsAction(ids, agentId);
            if (!res.success) { toast.error(res.message ?? 'No se pudo reasignar'); return; }
            toast.success(`${res.updated} ${res.updated === 1 ? 'lead reasignado' : 'leads reasignados'}`);
            clearSelection();
            await applyFilters({});
            router.refresh();
        } catch {
            toast.error('No se pudo reasignar');
        } finally {
            setBulkBusy(false);
        }
    }

    async function handleBulkReview() {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;
        try {
            setBulkBusy(true);
            const res = await markLeadsReviewedAction(ids);
            if (!res.success) { toast.error(res.message ?? 'No se pudo marcar'); return; }
            toast.success(`${res.updated} ${res.updated === 1 ? 'lead revisado' : 'leads revisados'}`);
            clearSelection();
            await applyFilters({});
            router.refresh();
        } catch {
            toast.error('No se pudo marcar como revisado');
        } finally {
            setBulkBusy(false);
        }
    }

    async function handleBulkExport() {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;
        try {
            setBulkBusy(true);
            const res = await exportLeadsCsvAction(ids);
            if (!res.success || !res.csv) { toast.error(res.message ?? 'No se pudo exportar'); return; }
            // BOM para que Excel respete los acentos.
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
            setBulkBusy(false);
        }
    }

    return (
        <div>
            <header className="mb-5">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Leads</h1>
                <p className="text-sm text-slate-500">Revisa los leads y conviértelos en clientes cuando aceptan la oferta.</p>
            </header>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
                <div className="inline-flex rounded-xl bg-slate-100 p-0.5">
                    {TABS.map((t) => (
                        <button
                            type="button"
                            key={t.value}
                            onClick={() => updateFilters({ outcome: t.value, queue: undefined })}
                            aria-pressed={outcome === t.value}
                            className={
                                'px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-energy-500 ' +
                                (outcome === t.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')
                            }
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <form
                    className="relative flex-1 max-w-xs"
                    onSubmit={(e) => {
                        e.preventDefault();
                        updateFilters({ search: searchTerm.trim() || undefined });
                    }}
                >
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="search"
                        name="search"
                        aria-label="Buscar titular o comercial"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar titular o comercial…"
                        className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-energy-500 focus:ring-1 focus:ring-energy-500 outline-none"
                    />
                </form>
            </div>

            <section className="mb-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-extrabold text-slate-900">Colas de trabajo</h2>
                        <p className="text-[12px] text-slate-500">Accesos rápidos para revisar lo que requiere acción.</p>
                    </div>
                    {activeQueue && (
                        <button
                            type="button"
                            onClick={() => updateFilters({ queue: undefined })}
                            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            Quitar cola
                        </button>
                    )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {OPERATIONAL_QUEUES.map((queue) => {
                        const Icon = QUEUE_ICONS[queue.value];
                        const active = activeQueue === queue.value;
                        return (
                            <button
                                key={queue.value}
                                type="button"
                                onClick={() => updateFilters(buildOperationalQueuePatch(activeQueue, queue.value))}
                                aria-pressed={active}
                                className={
                                    'flex min-h-[76px] items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-500 ' +
                                    (active
                                        ? 'border-energy-300 bg-energy-50 text-energy-900'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50')
                                }
                            >
                                <span className={active ? 'mt-0.5 text-energy-700' : 'mt-0.5 text-slate-400'}>
                                    <Icon size={17} />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-extrabold">{queue.label}</span>
                                    <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">{queue.description}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </section>

            {error && (
                <div role="status" aria-live="polite" className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={16} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => void applyFilters({})}
                            className="rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition-colors"
                        >
                            Reintentar
                        </button>
                        <button
                            type="button"
                            onClick={clearError}
                            className="rounded-xl border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors"
                        >
                            Ocultar
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="space-y-3" aria-busy="true" aria-label="Cargando leads">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
                    ))}
                </div>
            ) : leads.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <Inbox size={36} className="mx-auto mb-3 opacity-60" />
                    <p className="font-medium text-slate-500">No hay leads en este filtro.</p>
                </div>
            ) : (
                <div className={`space-y-3 ${selectedIds.size > 0 ? 'pb-24' : ''}`}>
                    <div className="flex items-center justify-between px-1">
                        <label className="flex items-center gap-2 text-[13px] text-slate-500 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={allVisibleSelected}
                                onChange={toggleSelectAllVisible}
                                aria-label="Seleccionar todos los leads visibles"
                                className="h-4 w-4 rounded accent-indigo-600"
                            />
                            Seleccionar todos {selectedIds.size > 0 ? `(${selectedIds.size} seleccionados)` : ''}
                        </label>
                        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[12px] font-semibold">
                            <button
                                type="button"
                                onClick={() => setSortMode('recent')}
                                aria-pressed={sortMode === 'recent'}
                                className={`px-2.5 py-1 rounded-md transition-colors ${sortMode === 'recent' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                            >
                                Recientes
                            </button>
                            <button
                                type="button"
                                onClick={() => setSortMode('priority')}
                                aria-pressed={sortMode === 'priority'}
                                className={`px-2.5 py-1 rounded-md transition-colors ${sortMode === 'priority' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                            >
                                Prioridad
                            </button>
                        </div>
                    </div>
                    {displayLeads.map((lead, i) => (
                        <LeadRow
                            key={lead.job_id}
                            lead={lead}
                            index={i}
                            selected={selectedIds.has(lead.job_id)}
                            onToggleSelect={() => toggleSelect(lead.job_id)}
                            onConvert={() => setConverting(lead)}
                            onLost={() => setLosing(lead)}
                            onDetail={() => openLeadDetail(lead)}
                        />
                    ))}
                    {hasMore && (
                        <button
                            type="button"
                            onClick={loadMore}
                            disabled={loadingMore}
                            className="w-full py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                            {loadingMore ? 'Cargando…' : 'Cargar más'}
                        </button>
                    )}
                </div>
            )}

            {selectedLead && (
                <LeadDetailDrawer
                    lead={selectedLead}
                    onClose={closeLeadDetail}
                    onViewFile={() => void viewLeadFile(selectedLead)}
                    onConvert={() => setConverting(selectedLead)}
                    onLost={() => setLosing(selectedLead)}
                    auditEvents={auditEvents}
                    auditLoading={auditLoading}
                    noteText={noteText}
                    noteSaving={noteSaving}
                    onNoteTextChange={setNoteText}
                    onAddNote={() => void addSelectedLeadNote()}
                />
            )}
            {converting && (
                <CloseInvoiceModal
                    invoice={converting}
                    onClose={() => setConverting(null)}
                    onClosed={(patch) => {
                        const shouldReloadAudit = selectedLead?.job_id === converting.job_id && outcome !== 'open';
                        applyLeadPatch(converting.job_id, patch);
                        if (shouldReloadAudit) void loadLeadAudit(converting.job_id);
                        afterMutation(converting.job_id);
                    }}
                />
            )}
            {losing && (
                <LostModal
                    invoice={losing}
                    onClose={() => setLosing(null)}
                    onLost={(reason) => {
                        const shouldReloadAudit = selectedLead?.job_id === losing.job_id && outcome !== 'open';
                        applyLeadPatch(losing.job_id, {
                            lost: true,
                            lost_reason: reason,
                            process_status: 'closed_lost',
                        });
                        if (shouldReloadAudit) void loadLeadAudit(losing.job_id);
                        afterMutation(losing.job_id);
                    }}
                />
            )}
            {selectedIds.size > 0 && (
                <BulkActionsBar
                    count={selectedIds.size}
                    agents={agents}
                    busy={bulkBusy}
                    onReassign={(agentId) => void handleBulkReassign(agentId)}
                    onReview={() => void handleBulkReview()}
                    onExport={() => void handleBulkExport()}
                    onClear={clearSelection}
                />
            )}
        </div>
    );
}
