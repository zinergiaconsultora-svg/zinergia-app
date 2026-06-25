'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Eye, Info, UserCheck, XCircle } from 'lucide-react';
import { getInvoiceFileUrlAction, type InvoiceRegistryRow } from '@/app/actions/invoices';
import { scoreLead } from './priority';
import { PriorityBadge } from './PriorityBadge';
import {
    formatEur,
    formatDate,
    ProcessBadge,
    LeadStatusBadge,
    DriveChip,
} from '@/features/invoices/components/invoiceParts';

export function LeadRow({
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
