'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, CalendarClock, CloudOff, Search, Inbox, Clock3, ClipboardList } from 'lucide-react';
import { useAdminLeads } from './useAdminLeads';
import { useLeadDetail } from './useLeadDetail';
import { useBulkActions } from './useBulkActions';
import { buildAdminLeadQueryString } from './filters';
import { LeadDetailDrawer } from './LeadDetailDrawer';
import { buildOperationalQueuePatch, OPERATIONAL_QUEUES } from './operationalQueues';
import { BulkActionsBar, type AgentOption } from './BulkActionsBar';
import { LeadRow } from './LeadRow';
import { LostModal } from './LostModal';
import { sortByPriority } from './priority';
import {
    getInvoiceFileUrlAction,
    type AdminLeadFilters,
    type AdminLeadOutcome,
    type AdminLeadQueue,
    type InvoiceRegistryRow,
} from '@/app/actions/invoices';
import LeadClientEditModal from './LeadClientEditModal';
import LeadCustomProposalModal from './LeadCustomProposalModal';
import { CloseInvoiceModal } from '@/features/invoices/components/invoiceParts';

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

    const detail = useLeadDetail();
    const bulk = useBulkActions(
        leads,
        () => applyFilters({}),
        () => router.refresh(),
    );

    const [converting, setConverting] = useState<InvoiceRegistryRow | null>(null);
    const [losing, setLosing] = useState<InvoiceRegistryRow | null>(null);
    const [searchTerm, setSearchTerm] = useState(filters.search ?? '');
    const [sortMode, setSortMode] = useState<'recent' | 'priority'>('recent');

    const outcome = filters.outcome ?? 'open';
    const activeQueue = filters.queue;
    const displayLeads = sortMode === 'priority' ? sortByPriority(leads) : leads;

    function updateFilters(patch: Partial<AdminLeadFilters>) {
        const next = { ...filters, ...patch };
        const query = buildAdminLeadQueryString(next);
        router.replace(`${pathname}?${query}`, { scroll: false });
        bulk.setSelectedIds(new Set());
        void applyFilters(patch);
    }

    const afterMutation = (jobId: string) => {
        if (outcome === 'open') {
            removeLead(jobId);
            detail.closeLeadDetail();
        }
        router.refresh();
    };

    function applyLeadPatch(jobId: string, patch: Partial<InvoiceRegistryRow>) {
        patchLead(jobId, patch);
        detail.setSelectedLead((current) => (current?.job_id === jobId ? { ...current, ...patch } : current));
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
                <div className={`space-y-3 ${bulk.selectedIds.size > 0 ? 'pb-24' : ''}`}>
                    <div className="flex items-center justify-between px-1">
                        <label className="flex items-center gap-2 text-[13px] text-slate-500 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={bulk.allVisibleSelected}
                                onChange={bulk.toggleSelectAllVisible}
                                aria-label="Seleccionar todos los leads visibles"
                                className="h-4 w-4 rounded accent-indigo-600"
                            />
                            Seleccionar todos {bulk.selectedIds.size > 0 ? `(${bulk.selectedIds.size} seleccionados)` : ''}
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
                            selected={bulk.selectedIds.has(lead.job_id)}
                            onToggleSelect={() => bulk.toggleSelect(lead.job_id)}
                            onConvert={() => setConverting(lead)}
                            onLost={() => setLosing(lead)}
                            onDetail={() => detail.openLeadDetail(lead)}
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

            {detail.selectedLead && (
                <LeadDetailDrawer
                    lead={detail.selectedLead}
                    onClose={detail.closeLeadDetail}
                    onViewFile={() => void viewLeadFile(detail.selectedLead!)}
                    onConvert={() => setConverting(detail.selectedLead)}
                    onLost={() => setLosing(detail.selectedLead)}
                    auditEvents={detail.auditEvents}
                    auditLoading={detail.auditLoading}
                    noteText={detail.noteText}
                    noteSaving={detail.noteSaving}
                    onNoteTextChange={detail.setNoteText}
                    onAddNote={() => void detail.addNote()}
                    proposals={detail.leadProposals}
                    proposalsLoading={detail.proposalsLoading}
                    leadClient={detail.leadClient}
                    clientLoading={detail.clientLoading}
                    onEditClient={detail.leadClient ? () => detail.setEditingLeadClient(detail.leadClient) : undefined}
                    onCreateCustomProposal={() => detail.setCustomProposalLead(detail.selectedLead)}
                />
            )}
            {detail.selectedLead && detail.editingLeadClient && (
                <LeadClientEditModal
                    jobId={detail.selectedLead.job_id}
                    client={detail.editingLeadClient}
                    onClose={() => detail.setEditingLeadClient(null)}
                    onSaved={(updated) => {
                        detail.setLeadClient(updated);
                        detail.setEditingLeadClient(null);
                        void detail.loadLeadAudit(detail.selectedLead!.job_id);
                    }}
                />
            )}
            {detail.customProposalLead && (
                <LeadCustomProposalModal
                    lead={detail.customProposalLead}
                    onClose={() => detail.setCustomProposalLead(null)}
                    onCreated={(proposal) => {
                        detail.setLeadProposals((current) => [proposal, ...current.filter((item) => item.id !== proposal.id)]);
                        applyLeadPatch(detail.customProposalLead!.job_id, {
                            has_proposal: true,
                            annual_savings: proposal.annual_savings,
                            savings_percent: proposal.savings_percent,
                            process_status: 'compared',
                            compared_at: new Date().toISOString(),
                        });
                        void detail.loadLeadAudit(detail.customProposalLead!.job_id);
                    }}
                />
            )}
            {converting && (
                <CloseInvoiceModal
                    invoice={converting}
                    onClose={() => setConverting(null)}
                    onClosed={(patch) => {
                        const shouldReloadAudit = detail.selectedLead?.job_id === converting.job_id && outcome !== 'open';
                        applyLeadPatch(converting.job_id, patch);
                        if (shouldReloadAudit) void detail.loadLeadAudit(converting.job_id);
                        afterMutation(converting.job_id);
                    }}
                />
            )}
            {losing && (
                <LostModal
                    invoice={losing}
                    onClose={() => setLosing(null)}
                    onLost={(reason) => {
                        const shouldReloadAudit = detail.selectedLead?.job_id === losing.job_id && outcome !== 'open';
                        applyLeadPatch(losing.job_id, {
                            lost: true,
                            lost_reason: reason,
                            process_status: 'closed_lost',
                        });
                        if (shouldReloadAudit) void detail.loadLeadAudit(losing.job_id);
                        afterMutation(losing.job_id);
                    }}
                />
            )}
            {bulk.selectedIds.size > 0 && (
                <BulkActionsBar
                    count={bulk.selectedIds.size}
                    agents={agents}
                    busy={bulk.busy}
                    onReassign={(agentId) => void bulk.handleReassign(agentId)}
                    onReview={() => void bulk.handleReview()}
                    onExport={() => void bulk.handleExport()}
                    onClear={bulk.clearSelection}
                />
            )}
        </div>
    );
}
