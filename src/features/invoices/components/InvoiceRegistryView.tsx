'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { FileText, CalendarClock, Eye, Info } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { useInvoices } from '../hooks/useInvoices';
import {
    reopenInvoiceAction,
    getInvoiceFileUrlAction,
    getLeadProposalsAction,
    type InvoiceRegistryRow,
    type LeadProposalSummary,
} from '@/app/actions/invoices';
import { getLeadAuditEventsAction, type LeadAuditEvent } from '@/app/actions/leadAudit';
import { getLeadClientAction } from '@/app/actions/clients';
import type { Client } from '@/types/crm';
import { LeadDetailDrawer } from '@/features/admin/leads/LeadDetailDrawer';
import LeadClientEditModal from '@/features/admin/leads/LeadClientEditModal';
import {
    formatEur,
    formatDate,
    ProcessBadge,
    LeadStatusBadge,
    DriveChip,
    Detail,
    CloseInvoiceModal,
} from './invoiceParts';

function InvoiceCard({
    invoice,
    index,
    isAdmin,
    onCloseClick,
    onReopen,
    onDetail,
}: {
    invoice: InvoiceRegistryRow;
    index: number;
    isAdmin: boolean;
    onCloseClick: () => void;
    onReopen: () => void;
    onDetail: () => void;
}) {
    const amount = formatEur(invoice.importe_total);
    const commission = formatEur(invoice.commission_amount);
    const isClosed = invoice.closed;
    const [openingFile, setOpeningFile] = useState(false);

    async function viewFile() {
        try {
            setOpeningFile(true);
            const url = await getInvoiceFileUrlAction(invoice.job_id);
            if (url) {
                window.open(url, '_blank', 'noopener,noreferrer');
            } else {
                toast.error('El archivo ya no está disponible para previsualizar');
            }
        } catch {
            toast.error('No se pudo abrir el archivo');
        } finally {
            setOpeningFile(false);
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
            className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md hover:border-slate-200 transition-colors"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{invoice.titular || 'Sin titular'}</p>
                    <p className="text-sm text-slate-500 truncate">
                        {invoice.comercializadora_actual || 'Comercializadora desconocida'}
                        {invoice.tarifa_actual ? ` · ${invoice.tarifa_actual}` : ''}
                    </p>
                </div>
                <div className="text-right shrink-0">
                    {amount && <p className="font-bold text-slate-900 tabular-nums">{amount}</p>}
                    <p className="text-[11px] text-slate-400">{formatDate(invoice.created_at)}</p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
                <LeadStatusBadge closed={invoice.closed} lost={invoice.lost} />
                <ProcessBadge status={invoice.process_status} />
                <DriveChip link={invoice.drive_view_link} synced={invoice.archived_in_drive} />
                {invoice.cups && (
                    <span className="text-[11px] text-slate-400 font-mono truncate max-w-[160px]">{invoice.cups}</span>
                )}
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
                        disabled={openingFile}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Eye size={13} /> {openingFile ? '…' : 'Ver'}
                    </button>
                    {isAdmin && !isClosed && !invoice.lost && invoice.process_status !== 'failed' && (
                        <button
                            type="button"
                            onClick={onCloseClick}
                            className="text-[12px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded-lg transition-colors"
                        >
                            Pasar a cliente
                        </button>
                    )}
                </div>
            </div>

            {isClosed && (
                <div className="mt-3 pt-3 border-t border-dashed border-slate-100 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    {invoice.compania_contratada && <Detail label="Compañía" value={invoice.compania_contratada} />}
                    {invoice.tarifa_contratada && <Detail label="Tarifa" value={invoice.tarifa_contratada} />}
                    {commission && <Detail label="Tu comisión" value={commission} />}
                    {invoice.permanencia_hasta && (
                        <div className="col-span-2 flex items-center gap-1.5 text-amber-700">
                            <CalendarClock size={14} />
                            <span className="text-[13px] font-medium">
                                Permanencia hasta {formatDate(invoice.permanencia_hasta)} — revisar
                            </span>
                        </div>
                    )}
                    {isAdmin && (
                        <button type="button" onClick={onReopen} className="col-span-2 text-left text-[11px] text-slate-400 hover:text-slate-600 mt-1">
                            Reabrir (volver a lead)
                        </button>
                    )}
                </div>
            )}
        </motion.div>
    );
}

export default function InvoiceRegistryView({
    initialData,
    isAdmin = false,
}: {
    initialData?: InvoiceRegistryRow[];
    isAdmin?: boolean;
}) {
    const { invoices, loading, loadingMore, hasMore, loadMore, patchInvoice } = useInvoices(initialData);
    const [closingInvoice, setClosingInvoice] = useState<InvoiceRegistryRow | null>(null);
    const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRegistryRow | null>(null);
    const [auditEvents, setAuditEvents] = useState<LeadAuditEvent[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [leadProposals, setLeadProposals] = useState<LeadProposalSummary[]>([]);
    const [proposalsLoading, setProposalsLoading] = useState(false);
    const [leadClient, setLeadClient] = useState<Client | null>(null);
    const [clientLoading, setClientLoading] = useState(false);
    const [editingLeadClient, setEditingLeadClient] = useState<Client | null>(null);

    async function handleReopen(jobId: string) {
        const res = await reopenInvoiceAction(jobId);
        if (res.success) {
            patchInvoice(jobId, {
                closed: false,
                lost: false,
                process_status: 'ocr_done',
                compania_contratada: null,
                tarifa_contratada: null,
                permanencia_hasta: null,
                commission_amount: null,
                closed_at: null,
            });
            toast.success('Factura reabierta');
        } else {
            toast.error('No se pudo reabrir');
        }
    }

    async function openInvoiceDetail(invoice: InvoiceRegistryRow) {
        setSelectedInvoice(invoice);
        setAuditEvents([]);
        setLeadProposals([]);
        setLeadClient(null);
        setAuditLoading(true);
        setProposalsLoading(true);
        setClientLoading(true);

        const [auditResult, proposalsResult, clientResult] = await Promise.allSettled([
            getLeadAuditEventsAction(invoice.job_id),
            getLeadProposalsAction(invoice.job_id),
            getLeadClientAction(invoice.job_id),
        ]);

        if (auditResult.status === 'fulfilled') setAuditEvents(auditResult.value);
        else toast.error('No se pudo cargar la auditoría');

        if (proposalsResult.status === 'fulfilled') setLeadProposals(proposalsResult.value);
        else toast.error('No se pudieron cargar las propuestas');

        if (clientResult.status === 'fulfilled') setLeadClient(clientResult.value);
        else toast.error('No se pudo cargar el cliente vinculado');

        setAuditLoading(false);
        setProposalsLoading(false);
        setClientLoading(false);
    }

    function closeInvoiceDetail() {
        setSelectedInvoice(null);
        setAuditEvents([]);
        setLeadProposals([]);
        setLeadClient(null);
        setAuditLoading(false);
        setProposalsLoading(false);
        setClientLoading(false);
        setEditingLeadClient(null);
    }

    async function viewSelectedFile(invoice: InvoiceRegistryRow) {
        try {
            const url = await getInvoiceFileUrlAction(invoice.job_id);
            if (url) window.open(url, '_blank', 'noopener,noreferrer');
            else toast.error('El archivo ya no está disponible para previsualizar');
        } catch {
            toast.error('No se pudo abrir el archivo');
        }
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-6 pb-28">
            <header className="mb-5">
                <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Facturas de clientes</h1>
                <p className="text-sm text-slate-500">
                    Solo se muestran facturas vinculadas a clientes activos. Si eliminas un cliente, sus facturas salen de este listado.
                </p>
            </header>

            {loading ? (
                <div className="space-y-3" aria-busy="true" aria-label="Cargando facturas">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
                    ))}
                </div>
            ) : invoices.length === 0 ? (
                <EmptyState
                    icon={FileText}
                    tone="energy"
                    title="No hay facturas de clientes"
                    description="Cuando analices una factura y se guarde el cliente, aparecerá aquí con su estado y archivo."
                />
            ) : (
                <div className="space-y-3">
                    {invoices.map((inv, i) => (
                        <InvoiceCard
                            key={inv.job_id}
                            invoice={inv}
                            index={i}
                            isAdmin={isAdmin}
                            onCloseClick={() => setClosingInvoice(inv)}
                            onReopen={() => handleReopen(inv.job_id)}
                            onDetail={() => void openInvoiceDetail(inv)}
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

            {closingInvoice && (
                <CloseInvoiceModal
                    invoice={closingInvoice}
                    onClose={() => setClosingInvoice(null)}
                    onClosed={(patch) => patchInvoice(closingInvoice.job_id, patch)}
                />
            )}
            {selectedInvoice && (
                <LeadDetailDrawer
                    lead={selectedInvoice}
                    onClose={closeInvoiceDetail}
                    onViewFile={() => void viewSelectedFile(selectedInvoice)}
                    onConvert={() => undefined}
                    onLost={() => undefined}
                    auditEvents={auditEvents}
                    auditLoading={auditLoading}
                    proposals={leadProposals}
                    proposalsLoading={proposalsLoading}
                    leadClient={leadClient}
                    clientLoading={clientLoading}
                    onEditClient={leadClient ? () => setEditingLeadClient(leadClient) : undefined}
                    canManageOutcome={false}
                />
            )}
            {selectedInvoice && editingLeadClient && (
                <LeadClientEditModal
                    jobId={selectedInvoice.job_id}
                    client={editingLeadClient}
                    onClose={() => setEditingLeadClient(null)}
                    onSaved={(updated) => {
                        setLeadClient(updated);
                        setEditingLeadClient(null);
                    }}
                />
            )}
        </div>
    );
}
