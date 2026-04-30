'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, DollarSign, Clock, CheckCircle, Loader2, Filter } from 'lucide-react';
import { InvoiceWithAgent, InvoiceStatus } from '@/types/crm';
import { getInvoicesAction, getInvoiceStatsAction, issueInvoiceAction, cancelInvoiceAction, markInvoicePaidAction, getUninvoicedCommissionsAction, generateInvoiceAction } from '@/app/actions/invoicing';
import { ErrorState } from '@/components/ui/ErrorState';
import { toast } from 'sonner';

const statusConfig: Record<InvoiceStatus, { label: string; color: string; bg: string }> = {
    draft: { label: 'Borrador', color: 'text-slate-700', bg: 'bg-slate-100' },
    issued: { label: 'Emitida', color: 'text-blue-700', bg: 'bg-blue-100' },
    paid: { label: 'Pagada', color: 'text-emerald-700', bg: 'bg-emerald-100' },
    cancelled: { label: 'Cancelada', color: 'text-red-700', bg: 'bg-red-100' },
};

interface UninvoicedCommission {
    id: string;
    proposal_id: string;
    agent_commission: number;
    total_revenue: number;
    created_at: string;
    proposals?: {
        client_id: string;
        current_annual_cost: number;
        offer_annual_cost: number;
        annual_savings: number;
        clients?: { name: string };
        offer_snapshot?: { marketer_name?: string };
    };
}

export default function InvoicingPage() {
    const [invoices, setInvoices] = useState<InvoiceWithAgent[]>([]);
    const [stats, setStats] = useState({ total: 0, draft: 0, issued: 0, paid: 0, totalAmount: 0 });
    const [uninvoicedCommissions, setUninvoicedCommissions] = useState<UninvoicedCommission[]>([]);
    const [selectedCommissions, setSelectedCommissions] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [filter, setFilter] = useState<InvoiceStatus | 'all'>('all');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [inv, st, comm] = await Promise.all([
                    getInvoicesAction({ status: filter !== 'all' ? filter : undefined }),
                    getInvoiceStatsAction(),
                    getUninvoicedCommissionsAction()
                ]);
                if (cancelled) return;
                setInvoices(inv || []);
                setStats(st || { total: 0, draft: 0, issued: 0, paid: 0, totalAmount: 0 });
                setUninvoicedCommissions((comm || []) as unknown as UninvoicedCommission[]);
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar la facturación');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [filter]);

    const loadData = useCallback(async () => {
        const [inv, st, comm] = await Promise.all([
            getInvoicesAction({ status: filter !== 'all' ? filter : undefined }),
            getInvoiceStatsAction(),
            getUninvoicedCommissionsAction()
        ]);
        setInvoices(inv || []);
        setStats(st || { total: 0, draft: 0, issued: 0, paid: 0, totalAmount: 0 });
        setUninvoicedCommissions((comm || []) as unknown as UninvoicedCommission[]);
    }, [filter]);

    const handleGenerateInvoice = async () => {
        if (selectedCommissions.size === 0) return;
        setActionLoading('create');
        const formData = new FormData();
        formData.append('commission_ids', JSON.stringify([...selectedCommissions]));
        const result = await generateInvoiceAction(formData);
        setActionLoading(null);
        if (result.success) {
            setShowCreateModal(false);
            setSelectedCommissions(new Set());
            loadData();
        } else {
            toast.error(result.error);
        }
    };

    const handleAction = async (action: string, invoiceId: string) => {
        setActionLoading(invoiceId);
        let result;
        switch (action) {
            case 'issue': result = await issueInvoiceAction(invoiceId); break;
            case 'cancel': result = await cancelInvoiceAction(invoiceId); break;
            case 'pay': result = await markInvoicePaidAction(invoiceId, 'transferencia'); break;
        }
        setActionLoading(null);
        if (result?.success) loadData();
        else if (result?.error) toast.error(result.error);
    };

    const toggleCommission = (id: string) => {
        setSelectedCommissions(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const kpis = [
        { label: 'Total Facturas', value: stats.total, icon: FileText, color: 'text-slate-700' },
        { label: 'Pendientes', value: stats.draft + stats.issued, icon: Clock, color: 'text-amber-600' },
        { label: 'Pagadas', value: stats.paid, icon: CheckCircle, color: 'text-emerald-600' },
        { label: 'Total Cobrado', value: `${stats.totalAmount.toFixed(0)}€`, icon: DollarSign, color: 'text-emerald-700' },
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Facturación</h1>
                    <p className="text-sm text-slate-500 mt-1">Gestiona tus facturas de comisiones</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    disabled={uninvoicedCommissions.length === 0}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Factura
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {kpis.map((kpi, i) => (
                    <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
                        <div className="flex items-center gap-3">
                            <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                            <div>
                                <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{kpi.label}</div>
                                <div className="text-xl font-bold text-slate-900">{kpi.value}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-2 mb-4">
                <Filter className="w-4 h-4 text-slate-400" />
                {(['all', 'draft', 'issued', 'paid', 'cancelled'] as const).map(s => (
                    <button
                        key={s}
                        onClick={() => setFilter(s)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${filter === s ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        {s === 'all' ? 'Todas' : statusConfig[s]?.label || s}
                    </button>
                ))}
            </div>

            {/* Lista de facturas */}
            {error ? (
                <ErrorState title="Error al cargar facturación" description={error} retry={loadData} />
            ) : loading ? (
                <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
            ) : invoices.length === 0 ? (
                <div className="text-center p-12 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No hay facturas{filter !== 'all' ? ` con estado ${statusConfig[filter]?.label}` : ''}</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                    {invoices.map(inv => (
                        <div key={inv.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                            <div className="flex-1">
                                <div className="flex items-center gap-3">
                                    <span className="font-mono text-sm font-semibold text-slate-900">{inv.invoice_number}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusConfig[inv.status]?.bg} ${statusConfig[inv.status]?.color}`}>
                                        {statusConfig[inv.status]?.label}
                                    </span>
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    {new Date(inv.issue_date).toLocaleDateString('es-ES')} · {inv.invoice_lines.length} línea(s)
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-slate-900">{inv.total.toFixed(2)}€</div>
                                <div className="text-xs text-slate-400">Base: {inv.tax_base.toFixed(2)}€</div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                                {inv.status === 'draft' && (
                                    <button onClick={() => handleAction('issue', inv.id)} disabled={actionLoading === inv.id}
                                        className="px-3 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                                        {actionLoading === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Emitir'}
                                    </button>
                                )}
                                {inv.status === 'issued' && (
                                    <button onClick={() => handleAction('pay', inv.id)} disabled={actionLoading === inv.id}
                                        className="px-3 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                                        {actionLoading === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Pagada'}
                                    </button>
                                )}
                                {['draft', 'issued'].includes(inv.status) && (
                                    <button onClick={() => handleAction('cancel', inv.id)} disabled={actionLoading === inv.id}
                                        className="px-3 py-1 rounded text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-colors">
                                        Cancelar
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Crear Factura */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div role="dialog" aria-modal="true" aria-label="Nueva factura" className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-200">
                            <h2 className="text-lg font-bold text-slate-900">Nueva Factura</h2>
                            <p className="text-sm text-slate-500 mt-1">Selecciona las comisiones a facturar ({uninvoicedCommissions.length} disponibles)</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-3">
                            {uninvoicedCommissions.length === 0 ? (
                                <p className="text-center text-slate-400 py-8">No hay comisiones pendientes de facturar</p>
                            ) : (
                                uninvoicedCommissions.map((comm) => (
                                    <label key={comm.id} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${selectedCommissions.has(comm.id) ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                        <input
                                            type="checkbox"
                                            checked={selectedCommissions.has(comm.id)}
                                            onChange={() => toggleCommission(comm.id)}
                                            className="w-4 h-4 text-emerald-600 rounded"
                                        />
                                        <div className="flex-1">
                                            <div className="text-sm font-semibold text-slate-900">
                                                {comm.proposals?.clients?.name || 'Cliente'}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {comm.proposals?.offer_snapshot?.marketer_name || 'Comercializadora'} · {new Date(comm.created_at).toLocaleDateString('es-ES')}
                                            </div>
                                        </div>
                                        <div className="text-sm font-bold text-emerald-600">
                                            {comm.agent_commission?.toFixed(2)}€
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>
                        <div className="p-6 border-t border-slate-200 flex items-center justify-between">
                            <div className="text-sm text-slate-600">
                                {selectedCommissions.size > 0 ? (
                                    <span>Total seleccionado: <strong className="text-emerald-700">
                                        {uninvoicedCommissions
                                            .filter((c) => selectedCommissions.has(c.id))
                                            .reduce((s, c) => s + (c.agent_commission || 0), 0)
                                            .toFixed(2)}€
                                    </strong></span>
                                ) : 'Selecciona comisiones'}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { setShowCreateModal(false); setSelectedCommissions(new Set()); }}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100">
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleGenerateInvoice}
                                    disabled={selectedCommissions.size === 0 || actionLoading === 'create'}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                                >
                                    {actionLoading === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : `Generar Factura (${selectedCommissions.size})`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}