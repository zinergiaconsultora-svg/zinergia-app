'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Check,
    CircleDollarSign,
    FileCheck2,
    FilePlus2,
    Loader2,
    ReceiptText,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    acceptSelfBilledInvoiceAction,
    acceptSelfBillingAgreementAction,
    cancelInvoiceAction,
    generateInvoiceAction,
    issueInvoiceAction,
    markInvoicePaidAction,
    type InvoicingWorkspaceData,
} from '@/app/actions/invoicing';
import type { InvoiceStatus } from '@/types/crm';

const statusLabels: Record<InvoiceStatus, string> = {
    draft: 'Borrador',
    issued: 'Emitida',
    paid: 'Pagada',
    cancelled: 'Cancelada',
};

const statusClasses: Record<InvoiceStatus, string> = {
    draft: 'bg-slate-100 text-slate-700',
    issued: 'bg-blue-50 text-blue-700',
    paid: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-rose-50 text-rose-700',
};

function formatCurrency(value: number) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

function commissionClientName(commission: InvoicingWorkspaceData['commissions'][number]) {
    const proposals = Array.isArray(commission.proposals) ? commission.proposals[0] : commission.proposals;
    const clients = proposals?.clients as { name?: string } | { name?: string }[] | null | undefined;
    return (Array.isArray(clients) ? clients[0]?.name : clients?.name) ?? 'Cliente';
}

export function FiscalInvoicingWorkspace({ data }: { data: InvoicingWorkspaceData }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [filter, setFilter] = useState<InvoiceStatus | 'all'>('all');
    const [creating, setCreating] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [activeInvoice, setActiveInvoice] = useState<string | null>(null);
    const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | null>(null);
    const [paymentReference, setPaymentReference] = useState('');

    const invoices = useMemo(
        () => filter === 'all' ? data.invoices : data.invoices.filter((invoice) => invoice.status === filter),
        [data.invoices, filter],
    );
    const selectedTotal = data.commissions
        .filter((commission) => selected.has(commission.id))
        .reduce((sum, commission) => sum + Number(commission.agent_commission ?? 0), 0);
    const fiscalReady = data.missingFiscalFields.length === 0;

    function complete(result: { success: boolean; error?: string }, successMessage: string) {
        setActiveInvoice(null);
        if (!result.success) {
            toast.error(result.error ?? 'No se pudo completar la operación.');
            return;
        }
        toast.success(successMessage);
        startTransition(() => router.refresh());
    }

    async function createDraft() {
        const formData = new FormData();
        formData.set('commission_ids', JSON.stringify([...selected]));
        setActiveInvoice('create');
        const result = await generateInvoiceAction(formData);
        if (result.success) {
            setCreating(false);
            setSelected(new Set());
        }
        complete(result, 'Borrador fiscal creado.');
    }

    async function runInvoiceAction(
        invoiceId: string,
        action: 'accept' | 'issue' | 'cancel',
    ) {
        setActiveInvoice(invoiceId);
        if (action === 'accept') {
            complete(await acceptSelfBilledInvoiceAction(invoiceId), 'Autofactura aceptada.');
            return;
        }
        if (action === 'issue') {
            complete(await issueInvoiceAction(invoiceId), 'Factura emitida.');
            return;
        }
        if (action === 'cancel') {
            complete(await cancelInvoiceAction(invoiceId), 'Borrador cancelado.');
        }
    }

    async function acceptAgreement() {
        if (!data.selfBillingAgreement) return;
        setActiveInvoice('agreement');
        complete(
            await acceptSelfBillingAgreementAction(data.selfBillingAgreement.id),
            'Acuerdo de autofacturación aceptado.',
        );
    }

    async function settlePayment() {
        if (!paymentInvoiceId || paymentReference.trim().length < 3) return;
        const invoiceId = paymentInvoiceId;
        setActiveInvoice(invoiceId);
        const result = await markInvoicePaidAction(invoiceId, 'transferencia', paymentReference.trim());
        if (result.success) {
            setPaymentInvoiceId(null);
            setPaymentReference('');
        }
        complete(result, 'Pago conciliado.');
    }

    return (
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
            <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-950">Facturación de comisiones</h1>
                    <p className="mt-1 text-sm text-slate-700">Cobros fiscales vinculados a comisiones validadas.</p>
                </div>
                <button
                    type="button"
                    onClick={() => setCreating(true)}
                    disabled={!fiscalReady || data.commissions.length === 0}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
                >
                    <FilePlus2 className="h-4 w-4" />
                    Crear borrador
                </button>
            </header>

            {!fiscalReady && (
                <div className="flex flex-col gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
                    <span>Falta completar: {data.missingFiscalFields.join(', ')}.</span>
                    <Link href="/dashboard/settings" className="font-semibold underline underline-offset-4">
                        Completar datos fiscales
                    </Link>
                </div>
            )}

            {data.selfBillingAgreement && !data.selfBillingAgreement.acceptedAt && (
                <div className="flex flex-col gap-3 border-b border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <strong>Acuerdo de autofacturación pendiente</strong>
                        <span className="ml-2">{data.selfBillingAgreement.reference}</span>
                    </div>
                    <button
                        type="button"
                        onClick={acceptAgreement}
                        disabled={activeInvoice === 'agreement'}
                        className="h-8 rounded-md bg-blue-800 px-3 text-xs font-semibold text-white hover:bg-blue-900 disabled:opacity-50"
                    >
                        {activeInvoice === 'agreement' ? 'Aceptando…' : 'Aceptar acuerdo'}
                    </button>
                </div>
            )}

            <section aria-label="Resumen de facturación" className="grid grid-cols-1 border-b border-slate-200 sm:grid-cols-3">
                <Metric icon={ReceiptText} label="Por facturar" value={formatCurrency(data.commissions.reduce((sum, item) => sum + Number(item.agent_commission ?? 0), 0))} />
                <Metric icon={FileCheck2} label="En trámite" value={String(data.stats.draft + data.stats.issued)} />
                <Metric icon={CircleDollarSign} label="Pagado" value={formatCurrency(data.stats.totalAmount)} />
            </section>

            <div className="flex gap-1 overflow-x-auto border-b border-slate-200 py-3" role="tablist" aria-label="Estado fiscal">
                {(['all', 'draft', 'issued', 'paid', 'cancelled'] as const).map((status) => (
                    <button
                        type="button"
                        role="tab"
                        aria-selected={filter === status}
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`h-8 shrink-0 rounded-md px-3 text-sm font-medium ${filter === status ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                    >
                        {status === 'all' ? 'Todas' : statusLabels[status]}
                    </button>
                ))}
            </div>

            <section aria-label="Facturas" className="divide-y divide-slate-200">
                {invoices.length === 0 ? (
                    <div className="py-14 text-center">
                        <ReceiptText className="mx-auto h-8 w-8 text-slate-300" />
                        <p className="mt-3 text-sm font-semibold text-slate-700">No hay facturas en este estado</p>
                    </div>
                ) : invoices.map((invoice) => {
                    const isOwner = invoice.agent_id === data.actorId;
                    const isAdmin = data.role === 'admin';
                    const canAccept = invoice.status === 'draft' && invoice.self_billing
                        && invoice.acceptance_status === 'pending' && isOwner;
                    const canIssue = invoice.status === 'draft' && (
                        (!invoice.self_billing && isOwner)
                        || (invoice.self_billing && invoice.acceptance_status === 'accepted' && isAdmin)
                    );
                    const canCancel = invoice.status === 'draft' && (
                        (invoice.self_billing && isAdmin) || (!invoice.self_billing && isOwner)
                    );
                    const busy = activeInvoice === invoice.id || isPending;
                    return (
                        <article key={invoice.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-sm font-semibold text-slate-950">{invoice.invoice_number}</span>
                                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusClasses[invoice.status as InvoiceStatus]}`}>
                                        {statusLabels[invoice.status as InvoiceStatus]}
                                    </span>
                                    {invoice.document_kind === 'rectifying_invoice' && (
                                        <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">Rectificativa</span>
                                    )}
                                    {invoice.self_billing && (
                                        <span className="rounded bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-800">Autofactura</span>
                                    )}
                                </div>
                                <p className="mt-1 truncate text-sm text-slate-700">
                                    {invoice.profiles?.full_name ?? invoice.issuer_name} · {invoice.invoice_lines?.length ?? 0} concepto(s)
                                </p>
                            </div>
                            <div className="md:text-right">
                                <p className="font-semibold tabular-nums text-slate-950">{formatCurrency(Number(invoice.total))}</p>
                                <p className="text-xs text-slate-700">Base {formatCurrency(Number(invoice.tax_base))}</p>
                            </div>
                            <div className="flex min-w-32 justify-start gap-2 md:justify-end">
                                {busy ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : (
                                    <>
                                        {canAccept && <ActionButton label="Aceptar" onClick={() => runInvoiceAction(invoice.id, 'accept')} />}
                                        {canIssue && <ActionButton label="Emitir" onClick={() => runInvoiceAction(invoice.id, 'issue')} />}
                                        {invoice.status === 'issued' && isAdmin && <ActionButton label="Conciliar" onClick={() => setPaymentInvoiceId(invoice.id)} />}
                                        {canCancel && (
                                            <button type="button" title="Cancelar borrador" onClick={() => runInvoiceAction(invoice.id, 'cancel')} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-700 hover:bg-rose-50">
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </article>
                    );
                })}
            </section>

            {creating && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
                    <div role="dialog" aria-modal="true" aria-labelledby="invoice-draft-title" className="flex max-h-[82vh] w-full max-w-xl flex-col rounded-lg bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                            <div>
                                <h2 id="invoice-draft-title" className="text-base font-bold text-slate-950">Nuevo borrador</h2>
                                <p className="mt-1 text-sm text-slate-700">Comisiones validadas y conciliadas</p>
                            </div>
                            <button type="button" title="Cerrar" onClick={() => setCreating(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex-1 divide-y divide-slate-100 overflow-y-auto px-5">
                            {data.commissions.map((commission) => (
                                <label key={commission.id} className="flex cursor-pointer items-center gap-3 py-3">
                                    <input
                                        type="checkbox"
                                        checked={selected.has(commission.id)}
                                        onChange={() => setSelected((current) => {
                                            const next = new Set(current);
                                            if (next.has(commission.id)) next.delete(commission.id); else next.add(commission.id);
                                            return next;
                                        })}
                                        className="h-4 w-4 rounded border-slate-300 text-emerald-700"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                                        {commissionClientName(commission)}
                                    </span>
                                    <span className="text-sm font-semibold tabular-nums text-slate-950">
                                        {formatCurrency(Number(commission.agent_commission))}
                                    </span>
                                </label>
                            ))}
                        </div>
                        <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-5 py-4">
                            <span className="text-sm text-slate-700">Total <strong className="text-slate-950">{formatCurrency(selectedTotal)}</strong></span>
                            <button
                                type="button"
                                onClick={createDraft}
                                disabled={selected.size === 0 || activeInvoice === 'create'}
                                className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-45"
                            >
                                {activeInvoice === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                Crear borrador
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {paymentInvoiceId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
                    <div role="dialog" aria-modal="true" aria-labelledby="payment-title" className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
                        <div className="flex items-center justify-between">
                            <h2 id="payment-title" className="text-base font-bold text-slate-950">Conciliar pago</h2>
                            <button type="button" title="Cerrar" onClick={() => setPaymentInvoiceId(null)} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"><X className="h-4 w-4" /></button>
                        </div>
                        <label htmlFor="payment-reference" className="mt-5 block text-sm font-semibold text-slate-700">Referencia bancaria</label>
                        <input id="payment-reference" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" autoFocus />
                        <button type="button" onClick={settlePayment} disabled={paymentReference.trim().length < 3 || activeInvoice === paymentInvoiceId} className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-45">
                            {activeInvoice === paymentInvoiceId && <Loader2 className="h-4 w-4 animate-spin" />}
                            Confirmar pago
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}

function Metric({ icon: Icon, label, value }: { icon: typeof ReceiptText; label: string; value: string }) {
    return (
        <div className="flex items-center gap-3 border-slate-200 px-4 py-5 sm:not-last:border-r">
            <Icon className="h-5 w-5 text-slate-500" />
            <div>
                <p className="text-xs font-semibold uppercase text-slate-700">{label}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{value}</p>
            </div>
        </div>
    );
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className="h-8 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-700">
            {label}
        </button>
    );
}
