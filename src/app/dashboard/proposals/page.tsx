'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { crmService } from '@/services/crmService';
import { Proposal, ProposalStatus } from '@/types/crm';
import {
    Plus, Clock, CheckCircle2, FileText, XCircle, Zap,
    Search, TrendingUp, Bell, AlertTriangle, Trash2, X,
    Building2, MoreHorizontal, Send, Ban, RotateCcw,
    ArrowUpRight, ChevronDown, LayoutGrid, List, SlidersHorizontal,
    CheckSquare, Square, ArrowUpDown, Download,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const PAGE_SIZE = 60;

type StatusFilter = 'all' | 'sent' | 'accepted' | 'draft' | 'rejected';
type ViewMode = 'table' | 'list';
type SortKey = 'created_at' | 'annual_savings' | 'client_name' | 'status' | 'savings_percent';
type SortDir = 'asc' | 'desc';

function getPendingDays(p: Proposal): number | null {
    if (p.status !== 'sent') return null;
    return Math.floor((Date.now() - new Date(p.updated_at || p.created_at).getTime()) / 86400000);
}

const STATUS_CFG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    draft:    { label: 'Borrador',  icon: <FileText size={11} />,    cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    sent:     { label: 'Enviada',   icon: <Send size={11} />,        cls: 'bg-blue-50 text-blue-600 border-blue-200' },
    accepted: { label: 'Firmada',   icon: <CheckCircle2 size={11} />, cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    rejected: { label: 'Rechazada', icon: <XCircle size={11} />,     cls: 'bg-red-50 text-red-500 border-red-200' },
    expired:  { label: 'Expirada',  icon: <Ban size={11} />,         cls: 'bg-slate-50 text-slate-400 border-slate-200' },
};

const STATUS_TABS: { value: StatusFilter; label: string; icon: React.ReactNode }[] = [
    { value: 'all',      label: 'Todas',      icon: <FileText size={12} /> },
    { value: 'sent',     label: 'Enviadas',   icon: <Clock size={12} /> },
    { value: 'accepted', label: 'Firmadas',   icon: <CheckCircle2 size={12} /> },
    { value: 'draft',    label: 'Borradores', icon: <Zap size={12} /> },
    { value: 'rejected', label: 'Rechazadas', icon: <XCircle size={12} /> },
];

const SORT_LABELS: Record<SortKey, string> = {
    created_at: 'Fecha',
    annual_savings: 'Ahorro',
    client_name: 'Cliente',
    status: 'Estado',
    savings_percent: '% Ahorro',
};

const FC = (v: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

export default function ProposalsPage() {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

    const [sortKey, setSortKey] = useState<SortKey>('created_at');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    const [showFilters, setShowFilters] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [minSavings, setMinSavings] = useState('');
    const [marketerFilter, setMarketerFilter] = useState('');

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkAction, setBulkAction] = useState<'delete' | 'status' | null>(null);
    const [bulkStatus, setBulkStatus] = useState<ProposalStatus>('sent');
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);

    const [deleteTarget, setDeleteTarget] = useState<Proposal | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

    const fetchProposals = useCallback(async () => {
        try {
            const data = await crmService.getRecentProposals(PAGE_SIZE, 0);
            setProposals(data);
        } catch (err) {
            console.error('Error loading proposals:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchProposals(); }, [fetchProposals]);

    const marketers = useMemo(() =>
        [...new Set(proposals.map(p => p.offer_snapshot?.marketer_name).filter(Boolean) as string[])].sort(),
        [proposals]
    );

    const stats = useMemo(() => {
        const draft = proposals.filter(p => p.status === 'draft').length;
        const sent = proposals.filter(p => p.status === 'sent').length;
        const accepted = proposals.filter(p => p.status === 'accepted').length;
        const rejected = proposals.filter(p => p.status === 'rejected').length;
        const totalSavings = proposals.filter(p => p.status === 'accepted').reduce((s, p) => s + (p.annual_savings ?? 0), 0);
        const conversionPct = proposals.length > 0 ? Math.round((accepted / proposals.length) * 100) : 0;
        const pendingFollowUps = proposals.filter(p => { const d = getPendingDays(p); return d !== null && d >= 3; }).length;
        return { total: proposals.length, draft, sent, accepted, rejected, totalSavings, conversionPct, pendingFollowUps };
    }, [proposals]);

    const filtered = useMemo(() => {
        let list = proposals;
        if (statusFilter !== 'all') list = list.filter(p => p.status === statusFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(p =>
                (p.clients?.name ?? '').toLowerCase().includes(q) ||
                (p.offer_snapshot?.marketer_name ?? '').toLowerCase().includes(q) ||
                (p.calculation_data?.cups ?? '').toLowerCase().includes(q)
            );
        }
        if (dateFrom) list = list.filter(p => p.created_at >= dateFrom);
        if (dateTo) list = list.filter(p => p.created_at <= dateTo + 'T23:59:59');
        if (minSavings) list = list.filter(p => p.annual_savings >= Number(minSavings));
        if (marketerFilter) list = list.filter(p => p.offer_snapshot?.marketer_name === marketerFilter);

        list.sort((a, b) => {
            let cmp = 0;
            switch (sortKey) {
                case 'created_at': cmp = a.created_at.localeCompare(b.created_at); break;
                case 'annual_savings': cmp = a.annual_savings - b.annual_savings; break;
                case 'client_name': cmp = (a.clients?.name ?? '').localeCompare(b.clients?.name ?? ''); break;
                case 'status': cmp = a.status.localeCompare(b.status); break;
                case 'savings_percent': cmp = a.savings_percent - b.savings_percent; break;
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return list;
    }, [proposals, statusFilter, search, dateFrom, dateTo, minSavings, marketerFilter, sortKey, sortDir]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('desc'); }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filtered.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filtered.map(p => p.id)));
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await crmService.deleteProposal(deleteTarget.id);
            setProposals(prev => prev.filter(p => p.id !== deleteTarget.id));
            toast.success('Propuesta eliminada');
        } catch { toast.error('Error al eliminar'); }
        finally { setIsDeleting(false); setDeleteTarget(null); }
    };

    const handleBulkDelete = async () => {
        setIsBulkProcessing(true);
        let ok = 0;
        for (const id of selectedIds) {
            try { await crmService.deleteProposal(id); ok++; } catch { /* continue */ }
        }
        setProposals(prev => prev.filter(p => !selectedIds.has(p.id)));
        setSelectedIds(new Set());
        setBulkAction(null);
        setIsBulkProcessing(false);
        toast.success(`${ok} propuestas eliminadas`);
    };

    const handleBulkStatus = async () => {
        setIsBulkProcessing(true);
        let ok = 0;
        for (const id of selectedIds) {
            try {
                await crmService.updateProposalStatus(id, bulkStatus);
                ok++;
            } catch { /* continue */ }
        }
        setProposals(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, status: bulkStatus } : p));
        setSelectedIds(new Set());
        setBulkAction(null);
        setIsBulkProcessing(false);
        toast.success(`${ok} propuestas actualizadas`);
    };

    const handleQuickStatus = async (p: Proposal, s: ProposalStatus) => {
        try {
            await crmService.updateProposalStatus(p.id, s);
            setProposals(prev => prev.map(x => x.id === p.id ? { ...x, status: s } : x));
            toast.success(`Estado → ${STATUS_CFG[s]?.label ?? s}`);
            setMenuOpenId(null);
        } catch { toast.error('Error al actualizar'); }
    };

    const exportCSV = () => {
        const rows = [
            ['Cliente', 'Comercializadora', 'Tarifa', 'CUPS', 'Ahorro €', '% Ahorro', 'Estado', 'Fecha'],
            ...filtered.map(p => [
                p.clients?.name || p.calculation_data?.client_name || '',
                p.offer_snapshot?.marketer_name || '',
                p.calculation_data?.tariff_name || p.offer_snapshot?.tariff_name || '',
                p.calculation_data?.cups || '',
                String(Math.round(p.annual_savings)),
                String(Math.round(p.savings_percent)),
                STATUS_CFG[p.status]?.label || p.status,
                new Date(p.created_at).toLocaleDateString('es-ES'),
            ])
        ];
        const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `propuestas_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
    };

    const hasActiveFilters = dateFrom || dateTo || minSavings || marketerFilter;

    const clearFilters = () => {
        setDateFrom(''); setDateTo(''); setMinSavings(''); setMarketerFilter('');
    };

    const SortIcon = ({ col }: { col: SortKey }) => (
        <ArrowUpDown size={11} className={`inline ml-1 ${sortKey === col ? 'text-indigo-500' : 'text-slate-300'}`} />
    );

    return (
        <div className="space-y-5 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Propuestas</h1>
                        {stats.pendingFollowUps > 0 && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-full text-[10px] font-bold text-amber-700">
                                <Bell size={10} /> {stats.pendingFollowUps} seguimiento{stats.pendingFollowUps > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    <p className="text-slate-400 text-sm mt-0.5">{stats.total} propuestas en tu cartera</p>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={exportCSV} disabled={filtered.length === 0}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40">
                        <Download size={13} /> CSV
                    </button>
                    <Link href="/dashboard/simulator"
                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold shadow-md shadow-indigo-500/20 hover:bg-indigo-700 transition-all text-sm shrink-0">
                        <Plus size={16} /> Nueva simulación
                    </Link>
                </div>
            </div>

            {/* ── Pipeline Visual ── */}
            {!isLoading && stats.total > 0 && (
                <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                    <div className="flex items-center gap-1 mb-2">
                        <TrendingUp size={13} className="text-indigo-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pipeline</span>
                        <span className="ml-auto text-xs font-bold text-slate-500">{stats.conversionPct}% conversión</span>
                    </div>
                    <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
                        {stats.draft > 0 && <div className="bg-slate-400 transition-all" style={{ width: `${(stats.draft / stats.total) * 100}%` }} title={`${stats.draft} borradores`} />}
                        {stats.sent > 0 && <div className="bg-blue-400 transition-all" style={{ width: `${(stats.sent / stats.total) * 100}%` }} title={`${stats.sent} enviadas`} />}
                        {stats.accepted > 0 && <div className="bg-emerald-400 transition-all" style={{ width: `${(stats.accepted / stats.total) * 100}%` }} title={`${stats.accepted} firmadas`} />}
                        {stats.rejected > 0 && <div className="bg-red-300 transition-all" style={{ width: `${(stats.rejected / stats.total) * 100}%` }} title={`${stats.rejected} rechazadas`} />}
                    </div>
                    <div className="flex gap-4 mt-2 flex-wrap">
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500"><span className="w-2 h-2 rounded-full bg-slate-400" /> {stats.draft} borrador{stats.draft !== 1 ? 'es' : ''}</span>
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-600"><span className="w-2 h-2 rounded-full bg-blue-400" /> {stats.sent} enviada{stats.sent !== 1 ? 's' : ''}</span>
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-400" /> {stats.accepted} firmada{stats.accepted !== 1 ? 's' : ''}</span>
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-red-500"><span className="w-2 h-2 rounded-full bg-red-300" /> {stats.rejected} rechazada{stats.rejected !== 1 ? 's' : ''}</span>
                        {stats.totalSavings > 0 && <span className="ml-auto text-[10px] font-bold text-emerald-600">{FC(stats.totalSavings)} ahorros confirmados</span>}
                    </div>
                </div>
            )}

            {/* ── Toolbar ── */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Buscar cliente, comercializadora, CUPS…" value={search}
                        onChange={e => setSearch(e.target.value)}
                        aria-label="Buscar propuestas"
                        className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all" />
                </div>

                <div className="flex gap-1 flex-wrap">
                    {STATUS_TABS.map(tab => {
                        const count = tab.value === 'all' ? proposals.length : proposals.filter(p => p.status === tab.value).length;
                        return (
                            <button key={tab.value} type="button" onClick={() => setStatusFilter(tab.value)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    statusFilter === tab.value ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-700'
                                }`}>
                                {tab.icon} {tab.label}
                                <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${statusFilter === tab.value ? 'bg-white/20' : 'bg-slate-100'}`}>{count}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-1.5 ml-auto">
                    <button type="button" onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${hasActiveFilters ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-slate-500 border-slate-200 hover:text-slate-700'}`}>
                        <SlidersHorizontal size={13} /> Filtros
                        {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                    </button>
                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                        <button type="button" onClick={() => setViewMode('table')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`} title="Vista tabla">
                            <List size={14} />
                        </button>
                        <button type="button" onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`} title="Vista lista">
                            <LayoutGrid size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Advanced Filters Panel ── */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Desde</label>
                                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                                    aria-label="Fecha desde"
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Hasta</label>
                                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                                    aria-label="Fecha hasta"
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Ahorro mín. (€)</label>
                                <input type="number" placeholder="0" value={minSavings} onChange={e => setMinSavings(e.target.value)}
                                    aria-label="Ahorro mínimo"
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Comercializadora</label>
                                <select value={marketerFilter} onChange={e => setMarketerFilter(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20">
                                    <option value="">Todas</option>
                                    {marketers.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            {hasActiveFilters && (
                                <div className="col-span-full flex justify-end">
                                    <button type="button" onClick={clearFilters}
                                        className="text-xs font-semibold text-indigo-600 hover:underline">Limpiar filtros</button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Bulk Actions Bar ── */}
            <AnimatePresence>
                {selectedIds.size > 0 && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-3 shadow-lg">
                        <span className="text-sm font-bold">{selectedIds.size} seleccionada{selectedIds.size > 1 ? 's' : ''}</span>
                        <div className="flex-1" />
                        <button type="button" onClick={() => { setBulkAction('status'); }}
                            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-colors">
                            Cambiar estado
                        </button>
                        <button type="button" onClick={() => { setBulkAction('delete'); }}
                            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-xs font-semibold transition-colors">
                            Eliminar
                        </button>
                        <button type="button" onClick={() => setSelectedIds(new Set())}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors">
                            <X size={14} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Content ── */}
            {isLoading ? (
                <div className="space-y-2">{[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-14 bg-white rounded-xl border border-slate-100 animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl p-16 text-center border border-slate-100 shadow-sm">
                    <FileText size={36} className="mx-auto text-slate-200 mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 mb-1">
                        {search || statusFilter !== 'all' || hasActiveFilters ? 'Sin resultados' : 'Sin propuestas todavía'}
                    </h3>
                    <p className="text-slate-500 text-sm mb-6">
                        {search || statusFilter !== 'all' || hasActiveFilters ? 'Prueba con otros filtros' : 'Inicia una simulación para generar la primera'}
                    </p>
                    {(search || statusFilter !== 'all' || hasActiveFilters) ? (
                        <button type="button" onClick={() => { setSearch(''); setStatusFilter('all'); clearFilters(); }}
                            className="text-indigo-500 text-sm font-semibold hover:underline">Limpiar filtros</button>
                    ) : (
                        <Link href="/dashboard/simulator" className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all text-sm">
                            Abrir Simulador
                        </Link>
                    )}
                </div>
            ) : viewMode === 'table' ? (
                /* ── TABLE VIEW ── */
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="w-10 px-3 py-3">
                                        <button type="button" onClick={toggleSelectAll}
                                            className="text-slate-400 hover:text-indigo-600 transition-colors">
                                            {selectedIds.size === filtered.length && filtered.length > 0 ? <CheckSquare size={15} /> : <Square size={15} />}
                                        </button>
                                    </th>
                                    {([
                                        ['client_name', 'Cliente'],
                                        ['created_at', 'Fecha'],
                                        ['annual_savings', 'Ahorro'],
                                        ['savings_percent', '%'],
                                        ['status', 'Estado'],
                                    ] as [SortKey, string][]).map(([key, label]) => (
                                        <th key={key} className="px-3 py-3 text-left">
                                            <button type="button" onClick={() => toggleSort(key)}
                                                className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors flex items-center gap-0.5">
                                                {label} <SortIcon col={key} />
                                            </button>
                                        </th>
                                    ))}
                                    <th className="px-3 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Comercializadora</th>
                                    <th className="px-3 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">CUPS</th>
                                    <th className="w-20 px-3 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(p => {
                                    const sc = STATUS_CFG[p.status] ?? STATUS_CFG.draft;
                                    const pendingDays = getPendingDays(p);
                                    const isSelected = selectedIds.has(p.id);

                                    return (
                                        <tr key={p.id}
                                            className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-indigo-50/40' : ''}`}>
                                            <td className="px-3 py-3">
                                                <button type="button" onClick={() => toggleSelect(p.id)} aria-label="Seleccionar propuesta"
                                                    className={isSelected ? 'text-indigo-600' : 'text-slate-300 hover:text-indigo-400 transition-colors'}>
                                                    {isSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                                                </button>
                                            </td>
                                            <td className="px-3 py-3">
                                                <Link href={`/dashboard/proposals/${p.id}`}
                                                    className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors break-words">
                                                    {p.clients?.name || p.calculation_data?.client_name || 'Cliente'}
                                                </Link>
                                                {pendingDays !== null && pendingDays >= 3 && (
                                                    <span className={`ml-2 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                                                        pendingDays >= 7 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-600 border-amber-200'
                                                    }`}>
                                                        {pendingDays}d
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                                                {new Date(p.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className={`font-bold ${p.annual_savings > 300 ? 'text-emerald-600' : 'text-slate-800'}`}>
                                                    {FC(p.annual_savings)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-xs text-slate-500">{p.savings_percent > 0 ? `${Math.round(p.savings_percent)}%` : '—'}</td>
                                            <td className="px-3 py-3">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${sc.cls}`}>
                                                    {sc.icon} {sc.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-xs text-slate-500">{p.offer_snapshot?.marketer_name || '—'}</td>
                                            <td className="px-3 py-3 text-xs text-slate-400 font-mono max-w-[100px] truncate">{p.calculation_data?.cups ? p.calculation_data.cups.slice(0, 16) + '…' : '—'}</td>
                                            <td className="px-3 py-3">
                                                <div className="relative flex items-center gap-1">
                                                    <Link href={`/dashboard/proposals/${p.id}`}
                                                        className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                                        title="Ver detalle">
                                                        <ArrowUpRight size={14} />
                                                    </Link>
                                                    <button type="button" onClick={() => setMenuOpenId(menuOpenId === p.id ? null : p.id)}
                                                        className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
                                                        title="Opciones">
                                                        <MoreHorizontal size={14} />
                                                    </button>
                                                    <AnimatePresence>
                                                        {menuOpenId === p.id && (
                                                            <>
                                                                <div className="fixed inset-0 z-30" onClick={() => setMenuOpenId(null)} />
                                                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                                                    className="absolute right-0 top-full mt-1 z-40 w-44 bg-white rounded-xl border border-slate-200 shadow-xl py-1">
                                                                    {p.status === 'draft' && (
                                                                        <button type="button" onClick={() => handleQuickStatus(p, 'sent')}
                                                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-slate-50">
                                                                            <Send size={12} className="text-blue-500" /> Marcar enviada
                                                                        </button>
                                                                    )}
                                                                    {(p.status === 'sent' || p.status === 'draft') && (
                                                                        <button type="button" onClick={() => handleQuickStatus(p, 'accepted')}
                                                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-slate-50">
                                                                            <CheckCircle2 size={12} className="text-emerald-500" /> Marcar firmada
                                                                        </button>
                                                                    )}
                                                                    {p.status !== 'rejected' && p.status !== 'accepted' && (
                                                                        <button type="button" onClick={() => handleQuickStatus(p, 'rejected')}
                                                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-slate-50">
                                                                            <XCircle size={12} className="text-red-500" /> Rechazar
                                                                        </button>
                                                                    )}
                                                                    {p.status === 'rejected' && (
                                                                        <button type="button" onClick={() => handleQuickStatus(p, 'draft')}
                                                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-slate-50">
                                                                            <RotateCcw size={12} className="text-slate-500" /> Reabrir
                                                                        </button>
                                                                    )}
                                                                    <div className="my-1 border-t border-slate-100" />
                                                                    <button type="button" onClick={() => { setDeleteTarget(p); setMenuOpenId(null); }}
                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50">
                                                                        <Trash2 size={12} /> Eliminar
                                                                    </button>
                                                                </motion.div>
                                                            </>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* ── LIST VIEW (mobile-friendly) ── */
                <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                        <button type="button" onClick={toggleSelectAll}
                            className="text-slate-400 hover:text-indigo-600 transition-colors">
                            {selectedIds.size === filtered.length && filtered.length > 0 ? <CheckSquare size={15} /> : <Square size={15} />}
                        </button>
                        <span className="text-[10px] text-slate-400 font-semibold">{filtered.length} propuestas</span>
                    </div>
                    {filtered.map(p => {
                        const sc = STATUS_CFG[p.status] ?? STATUS_CFG.draft;
                        const pendingDays = getPendingDays(p);
                        const isSelected = selectedIds.has(p.id);
                        const clientName = p.clients?.name || p.calculation_data?.client_name || 'Cliente';

                        return (
                            <div key={p.id}
                                className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${isSelected ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100'}`}>
                                <div className="flex items-center gap-3 p-3.5">
                                    <button type="button" onClick={() => toggleSelect(p.id)}
                                        className={isSelected ? 'text-indigo-600 shrink-0' : 'text-slate-300 hover:text-indigo-400 shrink-0 transition-colors'}>
                                        {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                            <Link href={`/dashboard/proposals/${p.id}`}
                                                className="font-bold text-sm text-slate-900 hover:text-indigo-600 transition-colors break-words">
                                                {clientName}
                                            </Link>
                                            <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${sc.cls}`}>
                                                {sc.icon} {sc.label}
                                            </span>
                                            {pendingDays !== null && pendingDays >= 3 && (
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${pendingDays >= 7 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                                                    {pendingDays}d
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                                            {p.offer_snapshot?.marketer_name && <span>{p.offer_snapshot.marketer_name}</span>}
                                            <span>{new Date(p.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 flex items-center gap-3">
                                        <div>
                                            <p className={`text-sm font-black ${p.annual_savings > 300 ? 'text-emerald-600' : 'text-slate-800'}`}>
                                                {FC(p.annual_savings)}
                                            </p>
                                            {p.savings_percent > 0 && <p className="text-[10px] text-slate-400">{Math.round(p.savings_percent)}%</p>}
                                        </div>
                                        <div className="relative">
                                            <button type="button" onClick={() => setMenuOpenId(menuOpenId === p.id ? null : p.id)}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                                                <MoreHorizontal size={15} />
                                            </button>
                                            <AnimatePresence>
                                                {menuOpenId === p.id && (
                                                    <>
                                                        <div className="fixed inset-0 z-30" onClick={() => setMenuOpenId(null)} />
                                                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                                            className="absolute right-0 top-full mt-1 z-40 w-44 bg-white rounded-xl border border-slate-200 shadow-xl py-1">
                                                            <Link href={`/dashboard/proposals/${p.id}`} onClick={() => setMenuOpenId(null)}
                                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-slate-50">
                                                                <ArrowUpRight size={12} className="text-indigo-500" /> Ver detalle
                                                            </Link>
                                                            {p.status === 'draft' && (
                                                                <button type="button" onClick={() => handleQuickStatus(p, 'sent')}
                                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-slate-50">
                                                                    <Send size={12} className="text-blue-500" /> Marcar enviada
                                                                </button>
                                                            )}
                                                            {(p.status === 'sent' || p.status === 'draft') && (
                                                                <button type="button" onClick={() => handleQuickStatus(p, 'accepted')}
                                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-slate-50">
                                                                    <CheckCircle2 size={12} className="text-emerald-500" /> Marcar firmada
                                                                </button>
                                                            )}
                                                            <div className="my-1 border-t border-slate-100" />
                                                            <button type="button" onClick={() => { setDeleteTarget(p); setMenuOpenId(null); }}
                                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50">
                                                                <Trash2 size={12} /> Eliminar
                                                            </button>
                                                        </motion.div>
                                                    </>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Delete Confirmation Modal ── */}
            <AnimatePresence>
                {deleteTarget && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !isDeleting && setDeleteTarget(null)} />
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            role="dialog" aria-modal="true" aria-label="Eliminar propuesta"
                            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                            <div className="p-6 text-center">
                                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
                                    <Trash2 size={22} className="text-red-500" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">Eliminar propuesta</h3>
                                <p className="text-sm text-slate-500">
                                    Se eliminará la propuesta de <span className="font-semibold text-slate-700">{deleteTarget.clients?.name || deleteTarget.calculation_data?.client_name || 'este cliente'}</span>. Esta acción no se puede deshacer.
                                </p>
                            </div>
                            <div className="flex gap-3 p-4 border-t border-slate-100 bg-slate-50/50">
                                <button type="button" onClick={() => setDeleteTarget(null)} disabled={isDeleting}
                                    className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-sm disabled:opacity-60">Cancelar</button>
                                <button type="button" onClick={handleDelete} disabled={isDeleting}
                                    className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                                    {isDeleting ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Eliminando…</> : <><Trash2 size={14} /> Eliminar</>}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Bulk Action Confirmation Modal ── */}
            <AnimatePresence>
                {bulkAction && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !isBulkProcessing && setBulkAction(null)} />
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            role="dialog" aria-modal="true" aria-label="Acción masiva sobre propuestas"
                            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                            <div className="p-6 text-center">
                                <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl border flex items-center justify-center ${
                                    bulkAction === 'delete' ? 'bg-red-50 border-red-100' : 'bg-indigo-50 border-indigo-100'
                                }`}>
                                    {bulkAction === 'delete'
                                        ? <Trash2 size={22} className="text-red-500" />
                                        : <CheckCircle2 size={22} className="text-indigo-500" />}
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">
                                    {bulkAction === 'delete' ? 'Eliminar propuestas' : 'Cambiar estado'}
                                </h3>
                                <p className="text-sm text-slate-500">
                                    {selectedIds.size} propuesta{selectedIds.size > 1 ? 's' : ''} seleccionada{selectedIds.size > 1 ? 's' : ''}
                                    {bulkAction === 'delete' ? ' se eliminarán permanentemente.' : '.'}
                                </p>
                                {bulkAction === 'status' && (
                                    <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as ProposalStatus)}
                                        aria-label="Cambiar estado"
                                        className="mt-3 w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20">
                                        <option value="draft">Borrador</option>
                                        <option value="sent">Enviada</option>
                                        <option value="accepted">Firmada</option>
                                        <option value="rejected">Rechazada</option>
                                    </select>
                                )}
                            </div>
                            <div className="flex gap-3 p-4 border-t border-slate-100 bg-slate-50/50">
                                <button type="button" onClick={() => setBulkAction(null)} disabled={isBulkProcessing}
                                    className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-sm disabled:opacity-60">Cancelar</button>
                                <button type="button" onClick={bulkAction === 'delete' ? handleBulkDelete : handleBulkStatus} disabled={isBulkProcessing}
                                    className={`flex-1 py-2.5 text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60 ${
                                        bulkAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
                                    }`}>
                                    {isBulkProcessing
                                        ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Procesando…</>
                                        : bulkAction === 'delete' ? <><Trash2 size={14} /> Eliminar</> : <><CheckCircle2 size={14} /> Aplicar</>}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
