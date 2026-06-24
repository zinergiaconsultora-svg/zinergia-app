'use client';

import React from 'react';
import { Building2, CalendarClock, CheckCircle2, Clock3, Edit3, Euro, ExternalLink, FileText, Mail, MessageSquareText, Phone, UserCheck, X, XCircle, Zap } from 'lucide-react';
import type { LeadAuditEvent } from '@/app/actions/leadAudit';
import type { InvoiceRegistryRow, LeadProposalSummary } from '@/app/actions/invoices';
import type { Client } from '@/types/crm';
import {
    Detail,
    DriveChip,
    formatDate,
    formatEur,
    LeadStatusBadge,
    ProcessBadge,
    useEscapeKey,
} from '@/features/invoices/components/invoiceParts';
import { buildLeadTimeline, maskCups, type LeadTimelineStatus } from './leadDetail';
import { scoreLead } from './priority';
import { PriorityBadge } from './PriorityBadge';

interface LeadDetailDrawerProps {
    lead: InvoiceRegistryRow;
    onClose: () => void;
    onViewFile: () => void;
    onConvert: () => void;
    onLost: () => void;
    auditEvents?: LeadAuditEvent[];
    auditLoading?: boolean;
    noteText?: string;
    noteSaving?: boolean;
    onNoteTextChange?: (value: string) => void;
    onAddNote?: () => void;
    proposals?: LeadProposalSummary[];
    proposalsLoading?: boolean;
    leadClient?: Client | null;
    clientLoading?: boolean;
    onEditClient?: () => void;
    onCreateCustomProposal?: () => void;
    canManageOutcome?: boolean;
}

const timelineTone: Record<LeadTimelineStatus, string> = {
    done: 'bg-emerald-500 ring-emerald-100',
    pending: 'bg-amber-400 ring-amber-100',
    warning: 'bg-rose-500 ring-rose-100',
};

function TimelineIcon({ status }: { status: LeadTimelineStatus }) {
    if (status === 'done') return <CheckCircle2 size={14} />;
    if (status === 'warning') return <XCircle size={14} />;
    return <Clock3 size={14} />;
}

function auditActor(event: LeadAuditEvent) {
    return event.actor_name || event.actor_email || 'Sistema';
}

function formatMoney(value: number | null | undefined) {
    if (value == null || Number.isNaN(value)) return '—';
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
    }).format(value);
}

function proposalStatusLabel(status: string) {
    const labels: Record<string, string> = {
        draft: 'Borrador',
        sent: 'Enviada',
        accepted: 'Aceptada',
        rejected: 'Rechazada',
        expired: 'Caducada',
    };
    return labels[status] ?? status;
}

export function LeadDetailDrawer({
    lead,
    onClose,
    onViewFile,
    onConvert,
    onLost,
    auditEvents = [],
    auditLoading = false,
    noteText = '',
    noteSaving = false,
    onNoteTextChange,
    onAddNote,
    proposals = [],
    proposalsLoading = false,
    leadClient = null,
    clientLoading = false,
    onEditClient,
    onCreateCustomProposal,
    canManageOutcome = true,
}: LeadDetailDrawerProps) {
    useEscapeKey(onClose);

    const amount = formatEur(lead.importe_total);
    const commission = formatEur(lead.commission_amount);
    const timeline = buildLeadTimeline(lead);
    const isOpen = !lead.closed && !lead.lost;
    const priority = isOpen ? scoreLead(lead) : null;
    const canAddNote = Boolean(onAddNote) && noteText.trim().length > 0 && !noteSaving;

    return (
        <div className="fixed inset-0 z-40 bg-slate-950/35" onClick={onClose}>
            <aside
                role="dialog"
                aria-modal="true"
                aria-label="Detalle del lead"
                onClick={(event) => event.stopPropagation()}
                className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl"
            >
                <header className="border-b border-slate-100 px-5 py-4">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                            <FileText size={19} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                {priority && <PriorityBadge priority={priority} showSavings />}
                                <LeadStatusBadge closed={lead.closed} lost={lead.lost} />
                                <ProcessBadge status={lead.process_status} />
                            </div>
                            <h2 className="truncate text-xl font-black tracking-tight text-slate-950">
                                {lead.titular || 'Sin titular'}
                            </h2>
                            <p className="truncate text-sm text-slate-500">
                                {lead.agent_name || 'Comercial sin nombre'}
                                {lead.franchise_name ? ` · ${lead.franchise_name}` : ''}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Cerrar detalle"
                            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-500"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                    <section className="mb-5 grid grid-cols-2 gap-3">
                        <Detail label="Comercializadora actual" value={lead.comercializadora_actual || '—'} />
                        <Detail label="Tarifa actual" value={lead.tarifa_actual || '—'} />
                        <Detail label="Importe factura" value={amount || '—'} />
                        <Detail label="CUPS" value={maskCups(lead.cups)} />
                    </section>

                    {priority && (
                        <section className="mb-5 rounded-2xl border border-slate-100 p-4">
                            <div className="mb-2 flex items-center justify-between">
                                <h3 className="text-sm font-extrabold text-slate-900">Prioridad comercial</h3>
                                <PriorityBadge priority={priority} showSavings />
                            </div>
                            <ul className="flex flex-wrap gap-1.5">
                                {priority.reasons.map((reason, i) => (
                                    <li key={i} className="rounded-md bg-slate-100 px-2 py-0.5 text-[12px] text-slate-600">{reason}</li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <section className="mb-5 rounded-2xl border border-slate-100 bg-white p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-extrabold text-slate-900">Cliente CRM</h3>
                                <p className="text-[12px] text-slate-500">Datos editables desde el lead con motivo obligatorio.</p>
                            </div>
                            {leadClient && onEditClient && (
                                <button
                                    type="button"
                                    onClick={onEditClient}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200"
                                >
                                    <Edit3 size={13} /> Editar
                                </button>
                            )}
                        </div>
                        {clientLoading ? (
                            <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                        ) : leadClient ? (
                            <div className="rounded-2xl bg-slate-50 p-3">
                                <div className="mb-2 flex items-center gap-2">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-500">
                                        <Building2 size={15} />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-black text-slate-950">{leadClient.name}</p>
                                        <p className="truncate text-[12px] text-slate-500">
                                            {leadClient.current_supplier || 'Sin comercializadora'}{leadClient.tariff_type ? ` · ${leadClient.tariff_type}` : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[12px]">
                                    <Detail label="CUPS" value={maskCups(leadClient.cups ?? null)} />
                                    <Detail label="DNI/CIF" value={leadClient.dni_cif || '—'} />
                                    <Detail label="Email" value={leadClient.email || '—'} />
                                    <Detail label="Teléfono" value={leadClient.phone || '—'} />
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {leadClient.phone && (
                                        <a href={`tel:${leadClient.phone}`} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-bold text-slate-600 ring-1 ring-slate-100">
                                            <Phone size={12} /> Llamar
                                        </a>
                                    )}
                                    {leadClient.email && (
                                        <a href={`mailto:${leadClient.email}`} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-bold text-slate-600 ring-1 ring-slate-100">
                                            <Mail size={12} /> Email
                                        </a>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
                                Sin cliente vinculado todavía. Cuando el OCR cree o vincule el cliente, aparecerá aquí.
                            </p>
                        )}
                    </section>

                    <section className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-extrabold text-slate-900">Propuestas del comparador</h3>
                                <p className="text-[12px] text-slate-500">Ofertas generadas para este lead/cliente.</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                {onCreateCustomProposal && (
                                    <button
                                        type="button"
                                        onClick={onCreateCustomProposal}
                                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white transition-colors hover:bg-emerald-700"
                                    >
                                        Crear personalizada
                                    </button>
                                )}
                                <span className="inline-flex items-center gap-1 rounded-xl bg-white px-2.5 py-1.5 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-100">
                                    <Zap size={12} /> {proposals.length}
                                </span>
                            </div>
                        </div>
                        {proposalsLoading ? (
                            <div className="space-y-2">
                                <div className="h-16 animate-pulse rounded-2xl bg-white/80" />
                                <div className="h-16 animate-pulse rounded-2xl bg-white/80" />
                            </div>
                        ) : proposals.length === 0 ? (
                            <p className="rounded-2xl bg-white/70 px-3 py-3 text-sm text-slate-500">
                                No hay propuestas guardadas todavía. Ejecuta la comparativa desde el simulador para generarlas.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {proposals.map((proposal) => (
                                    <a
                                        key={proposal.id}
                                        href={`/dashboard/proposals/${proposal.id}`}
                                        className="block rounded-2xl border border-emerald-100 bg-white px-3 py-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-black text-slate-950">
                                                    {proposal.offer_snapshot?.marketer_name || 'Comercializadora'}
                                                </p>
                                                <p className="truncate text-[12px] text-slate-500">
                                                    {proposal.offer_snapshot?.tariff_name || 'Tarifa'} · {proposalStatusLabel(proposal.status)}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black tabular-nums text-emerald-700">{formatMoney(proposal.annual_savings)}</p>
                                                <p className="text-[11px] font-bold text-slate-400">/año</p>
                                            </div>
                                        </div>
                                        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                                            <Detail label="Actual" value={formatMoney(proposal.current_annual_cost)} />
                                            <Detail label="Oferta" value={formatMoney(proposal.offer_annual_cost)} />
                                            <Detail label="Mejora" value={`${Math.round(proposal.savings_percent || 0)}%`} />
                                        </div>
                                    </a>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="mb-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <h3 className="text-sm font-extrabold text-slate-900">Cierre comercial</h3>
                            <DriveChip link={lead.drive_view_link} synced={lead.archived_in_drive} />
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <Detail label="Compañía contratada" value={lead.compania_contratada || '—'} />
                            <Detail label="Tarifa contratada" value={lead.tarifa_contratada || '—'} />
                            <Detail label="Comisión" value={commission || '—'} />
                            <Detail label="Cierre" value={formatDate(lead.closed_at) || '—'} />
                            <Detail label="Permanencia" value={lead.permanencia_hasta ? formatDate(lead.permanencia_hasta) : '—'} />
                            <Detail label="Motivo perdido" value={lead.lost_reason || '—'} />
                        </div>
                    </section>

                    <section className="mb-5">
                        <h3 className="mb-3 text-sm font-extrabold text-slate-900">Historial del flujo</h3>
                        <ol className="space-y-3">
                            {timeline.map((item) => (
                                <li key={item.id} className="flex gap-3">
                                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ring-4 ${timelineTone[item.status]}`}>
                                        <TimelineIcon status={item.status} />
                                    </div>
                                    <div className="min-w-0 flex-1 rounded-2xl border border-slate-100 px-3 py-2">
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="text-sm font-bold text-slate-900">{item.label}</p>
                                            <span className="shrink-0 text-[11px] font-medium text-slate-400">
                                                {formatDate(item.at) || '—'}
                                            </span>
                                        </div>
                                        {item.detail && (
                                            <p className="mt-0.5 truncate text-[12px] text-slate-500">{item.detail}</p>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </section>

                    <section aria-busy={auditLoading} className="rounded-2xl border border-slate-100 bg-white p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-extrabold text-slate-900">Auditoría real</h3>
                                <p className="text-[12px] text-slate-500">Notas internas y cambios guardados en base de datos.</p>
                            </div>
                            <span className="mt-0.5 rounded-xl bg-slate-100 p-2 text-slate-500">
                                <MessageSquareText size={16} />
                            </span>
                        </div>

                        {auditLoading ? (
                            <div className="space-y-2" aria-label="Cargando auditoría">
                                <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
                                <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
                            </div>
                        ) : auditEvents.length === 0 ? (
                            <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
                                Sin eventos persistidos todavía.
                            </p>
                        ) : (
                            <ol className="space-y-2">
                                {auditEvents.map((event) => (
                                    <li key={event.id} className="rounded-xl border border-slate-100 px-3 py-2">
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="text-sm font-bold text-slate-900">{event.title}</p>
                                            <span className="shrink-0 text-[11px] font-medium text-slate-400">
                                                {formatDate(event.created_at) || '—'}
                                            </span>
                                        </div>
                                        {event.detail && (
                                            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600">{event.detail}</p>
                                        )}
                                        <p className="mt-1 text-[11px] font-medium text-slate-400">{auditActor(event)}</p>
                                    </li>
                                ))}
                            </ol>
                        )}

                        <form
                            className="mt-4"
                            onSubmit={(event) => {
                                event.preventDefault();
                                if (canAddNote) onAddNote?.();
                            }}
                        >
                            <label className="block">
                                <span className="mb-1 block text-[12px] font-bold text-slate-700">Nueva nota interna</span>
                                <textarea
                                    name="leadNote"
                                    value={noteText}
                                    onChange={(event) => onNoteTextChange?.(event.target.value)}
                                    rows={3}
                                    maxLength={2000}
                                    placeholder="Añade contexto operativo: llamada pendiente, objeción, próximo paso…"
                                    className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-energy-500 focus:ring-1 focus:ring-energy-500"
                                />
                            </label>
                            <div className="mt-2 flex items-center justify-between gap-3">
                                <span className="text-[11px] text-slate-400">{noteText.length}/2000</span>
                                <button
                                    type="submit"
                                    disabled={!canAddNote}
                                    className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {noteSaving ? 'Guardando…' : 'Añadir nota'}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>

                <footer className="border-t border-slate-100 p-4">
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={onViewFile}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy-500"
                        >
                            <ExternalLink size={16} /> Ver factura
                        </button>
                        {canManageOutcome && isOpen && lead.process_status !== 'failed' && (
                            <>
                                <button
                                    type="button"
                                    onClick={onLost}
                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                                >
                                    <XCircle size={16} /> Marcar perdido
                                </button>
                                <button
                                    type="button"
                                    onClick={onConvert}
                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                                >
                                    <UserCheck size={16} /> Pasar a cliente
                                </button>
                            </>
                        )}
                        {canManageOutcome && lead.closed && (
                            <button
                                type="button"
                                onClick={onConvert}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                            >
                                <Euro size={16} /> Editar cierre
                            </button>
                        )}
                        {canManageOutcome && lead.lost && (
                            <button
                                type="button"
                                onClick={onLost}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                            >
                                <CalendarClock size={16} /> Editar motivo
                            </button>
                        )}
                    </div>
                </footer>
            </aside>
        </div>
    );
}
