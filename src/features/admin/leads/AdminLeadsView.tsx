'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Search, Eye, UserCheck, XCircle, Inbox } from 'lucide-react';
import { useAdminLeads } from './useAdminLeads';
import {
    getInvoiceFileUrlAction,
    markLeadLostAction,
    type AdminLeadOutcome,
    type InvoiceRegistryRow,
} from '@/app/actions/invoices';
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

function LostModal({
    invoice,
    onClose,
    onLost,
}: {
    invoice: InvoiceRegistryRow;
    onClose: () => void;
    onLost: () => void;
}) {
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    useEscapeKey(onClose);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        const res = await markLeadLostAction(invoice.job_id, reason || null);
        setSaving(false);
        if (!res.success) {
            toast.error('No se pudo marcar como perdido');
            return;
        }
        toast.success('Lead marcado como perdido');
        onLost();
        onClose();
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
                className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-xl space-y-4"
            >
                <h2 className="text-lg font-bold text-slate-900">Marcar lead como perdido</h2>
                <p className="text-[13px] text-slate-500">
                    {invoice.titular || 'Lead'} — no aceptó la oferta. Puedes anotar el motivo (opcional).
                </p>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="Motivo (opcional): precio, no contesta…"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900 focus:border-rose-400 focus:ring-1 focus:ring-rose-400 outline-none"
                />
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
    onConvert,
    onLost,
}: {
    lead: InvoiceRegistryRow;
    index: number;
    onConvert: () => void;
    onLost: () => void;
}) {
    const amount = formatEur(lead.importe_total);
    const commission = formatEur(lead.commission_amount);
    const [opening, setOpening] = useState(false);
    const isOpen = !lead.closed && !lead.lost;

    async function viewFile() {
        setOpening(true);
        const url = await getInvoiceFileUrlAction(lead.job_id);
        setOpening(false);
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
        else toast.error('El archivo ya no está disponible');
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(index * 0.025, 0.25) }}
            className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md hover:border-slate-200 transition-all"
        >
            <div className="flex items-start justify-between gap-3">
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
                <div className="text-right shrink-0">
                    {amount && <p className="font-bold text-slate-900 tabular-nums">{amount}</p>}
                    <p className="text-[11px] text-slate-400">{formatDate(lead.created_at)}</p>
                    {commission && <p className="text-[11px] font-semibold text-emerald-700">Comisión {commission}</p>}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
                <LeadStatusBadge closed={lead.closed} lost={lead.lost} />
                <ProcessBadge status={lead.process_status} />
                <DriveChip link={lead.drive_view_link} synced={lead.archived_in_drive} />

                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={viewFile}
                        disabled={opening}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Eye size={13} /> {opening ? '…' : 'Ver'}
                    </button>
                    {isOpen && lead.process_status !== 'failed' && (
                        <>
                            <button
                                onClick={onLost}
                                className="inline-flex items-center gap-1 text-[12px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1 rounded-lg transition-colors"
                            >
                                <XCircle size={13} /> Perdido
                            </button>
                            <button
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

export default function AdminLeadsView({ initialData }: { initialData?: InvoiceRegistryRow[] }) {
    const { leads, filters, loading, loadingMore, hasMore, applyFilters, loadMore, patchLead, removeLead } =
        useAdminLeads(initialData ?? []);
    const [converting, setConverting] = useState<InvoiceRegistryRow | null>(null);
    const [losing, setLosing] = useState<InvoiceRegistryRow | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const outcome = filters.outcome ?? 'open';
    // After an action that changes outcome, drop the row from filtered lists.
    const afterMutation = (jobId: string) => {
        if (outcome === 'open') removeLead(jobId);
    };

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
                            key={t.value}
                            onClick={() => applyFilters({ outcome: t.value })}
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
                        applyFilters({ search: searchTerm.trim() || undefined });
                    }}
                >
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar titular o comercial…"
                        className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-energy-500 focus:ring-1 focus:ring-energy-500 outline-none"
                    />
                </form>
            </div>

            {loading ? (
                <div className="space-y-3">
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
                <div className="space-y-3">
                    {leads.map((lead, i) => (
                        <LeadRow
                            key={lead.job_id}
                            lead={lead}
                            index={i}
                            onConvert={() => setConverting(lead)}
                            onLost={() => setLosing(lead)}
                        />
                    ))}
                    {hasMore && (
                        <button
                            onClick={loadMore}
                            disabled={loadingMore}
                            className="w-full py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                            {loadingMore ? 'Cargando…' : 'Cargar más'}
                        </button>
                    )}
                </div>
            )}

            {converting && (
                <CloseInvoiceModal
                    invoice={converting}
                    onClose={() => setConverting(null)}
                    onClosed={(patch) => {
                        patchLead(converting.job_id, patch);
                        afterMutation(converting.job_id);
                    }}
                />
            )}
            {losing && (
                <LostModal
                    invoice={losing}
                    onClose={() => setLosing(null)}
                    onLost={() => {
                        patchLead(losing.job_id, { lost: true, process_status: 'closed_lost' });
                        afterMutation(losing.job_id);
                    }}
                />
            )}
        </div>
    );
}
