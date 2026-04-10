'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { crmService } from '@/services/crmService';
import { Proposal } from '@/types/crm';
import { PieChart, Plus, Clock, Users, TrendingUp, AlertTriangle, Bell, Search, Filter, CheckCircle2, FileText, XCircle, Zap } from 'lucide-react';
import Link from 'next/link';

const PAGE_SIZE = 40;

type StatusFilter = 'all' | 'sent' | 'accepted' | 'draft' | 'rejected';

function getPendingDays(proposal: Proposal): number | null {
    if (proposal.status !== 'sent') return null;
    const updated = new Date(proposal.updated_at || proposal.created_at).getTime();
    return Math.floor((Date.now() - updated) / (1000 * 60 * 60 * 24));
}

function FollowUpBadge({ days }: { days: number }) {
    if (days < 3) return null;
    const urgent = days >= 7;
    return (
        <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md border uppercase tracking-wider ${
            urgent
                ? 'bg-red-50 text-red-600 border-red-200'
                : 'bg-amber-50 text-amber-600 border-amber-200'
        }`}>
            {urgent ? <AlertTriangle size={9} /> : <Bell size={9} />}
            {urgent ? `${days}d sin respuesta` : `${days}d enviada`}
        </span>
    );
}

const STATUS_TABS: { value: StatusFilter; label: string; icon: React.ReactNode }[] = [
    { value: 'all',      label: 'Todas',      icon: <FileText size={13} /> },
    { value: 'sent',     label: 'Enviadas',   icon: <Clock size={13} /> },
    { value: 'accepted', label: 'Firmadas',   icon: <CheckCircle2 size={13} /> },
    { value: 'draft',    label: 'Borradores', icon: <Zap size={13} /> },
    { value: 'rejected', label: 'Rechazadas', icon: <XCircle size={13} /> },
];

interface AuditGroup {
    client_id: string;
    clientName: string;
    date: string;
    items: Proposal[];
}

export default function ProposalsPage() {
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

    const fetchProposals = useCallback(async (currentOffset: number, append: boolean) => {
        try {
            const data = await crmService.getRecentProposals(PAGE_SIZE, currentOffset);
            setProposals(prev => append ? [...prev, ...data] : data);
            setOffset(currentOffset + data.length);
            setHasMore(data.length === PAGE_SIZE);
        } catch (err) {
            console.error('Error loading proposals:', err);
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchProposals(0, false).finally(() => setIsLoading(false));
    }, [fetchProposals]);

    const loadMore = async () => {
        setIsLoadingMore(true);
        await fetchProposals(offset, true);
        setIsLoadingMore(false);
    };

    // Summary stats
    const stats = useMemo(() => {
        const total = proposals.length;
        const accepted = proposals.filter(p => p.status === 'accepted').length;
        const sent = proposals.filter(p => p.status === 'sent').length;
        const pendingFollowUps = proposals.filter(p => {
            const d = getPendingDays(p);
            return d !== null && d >= 3;
        }).length;
        const totalSavings = proposals
            .filter(p => p.status === 'accepted')
            .reduce((s, p) => s + (p.annual_savings ?? 0), 0);
        const conversionPct = total > 0 ? Math.round((accepted / total) * 100) : 0;
        return { total, accepted, sent, pendingFollowUps, totalSavings, conversionPct };
    }, [proposals]);

    // Filter + search
    const filteredProposals = useMemo(() => {
        let list = proposals;
        if (statusFilter !== 'all') list = list.filter(p => p.status === statusFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(p =>
                (p.clients?.name ?? '').toLowerCase().includes(q) ||
                (p.offer_snapshot?.marketer_name ?? '').toLowerCase().includes(q)
            );
        }
        return list;
    }, [proposals, statusFilter, search]);

    // Group by client session
    const groupedProposals = useMemo(() => {
        const timeThreshold = 5 * 60 * 1000;
        const groups = filteredProposals.reduce((acc: Map<string, AuditGroup>, current: Proposal) => {
            const currentDate = new Date(current.created_at).getTime();
            const groupKey = `${current.client_id}-${Math.floor(currentDate / timeThreshold)}`;
            const existingGroup = acc.get(groupKey);
            if (existingGroup) {
                existingGroup.items.push(current);
            } else {
                acc.set(groupKey, {
                    client_id: current.client_id,
                    clientName: current.clients?.name || 'Cliente Desconocido',
                    date: current.created_at,
                    items: [current],
                });
            }
            return acc;
        }, new Map());
        groups.forEach(g => g.items.sort((a: Proposal, b: Proposal) => b.annual_savings - a.annual_savings));
        return Array.from(groups.values());
    }, [filteredProposals]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Propuestas</h1>
                        {stats.pendingFollowUps > 0 && (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-bold text-amber-700">
                                <Bell size={11} />
                                {stats.pendingFollowUps} seguimiento{stats.pendingFollowUps > 1 ? 's' : ''} pendiente{stats.pendingFollowUps > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    <p className="text-slate-500 text-sm mt-0.5">Historial de simulaciones y propuestas por cliente</p>
                </div>
                <Link
                    href="/dashboard/simulator"
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold shadow-md shadow-indigo-500/20 hover:bg-indigo-700 transition-all text-sm shrink-0"
                >
                    <Plus size={16} />
                    Nueva simulación
                </Link>
            </div>

            {/* Stats bar */}
            {!isLoading && proposals.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Total simulaciones', value: stats.total, icon: <FileText size={14} />, color: 'text-indigo-500' },
                        { label: 'Firmadas', value: stats.accepted, icon: <CheckCircle2 size={14} />, color: 'text-emerald-500' },
                        { label: 'Conversión', value: `${stats.conversionPct}%`, icon: <TrendingUp size={14} />, color: 'text-violet-500' },
                        { label: 'Ahorros confirmados', value: new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(stats.totalSavings), icon: <Zap size={14} />, color: 'text-energy-600' },
                    ].map(s => (
                        <div key={s.label} className="bg-white/60 dark:bg-slate-900/50 backdrop-blur border border-white/60 dark:border-slate-700/50 rounded-xl px-4 py-3 shadow-sm">
                            <div className={`flex items-center gap-1.5 mb-1 ${s.color}`}>
                                {s.icon}
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</span>
                            </div>
                            <p className="text-xl font-black text-slate-900 dark:text-white">{s.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar cliente o comercializadora…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                    />
                </div>

                {/* Status tabs */}
                <div className="flex gap-1 flex-wrap">
                    {STATUS_TABS.map(tab => {
                        const count = tab.value === 'all'
                            ? proposals.length
                            : proposals.filter(p => p.status === tab.value).length;
                        return (
                            <button
                                key={tab.value}
                                type="button"
                                onClick={() => setStatusFilter(tab.value)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                    statusFilter === tab.value
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:text-slate-800'
                                }`}
                            >
                                {tab.icon}
                                {tab.label}
                                <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${statusFilter === tab.value ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-64 bg-white rounded-2xl border border-slate-100 animate-pulse shadow-sm" />
                    ))}
                </div>
            ) : groupedProposals.length > 0 ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        {groupedProposals.map((group) => (
                            <div
                                key={`${group.client_id}-${group.date}`}
                                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-indigo-100 dark:hover:border-indigo-800/50 transition-all overflow-hidden flex flex-col group"
                            >
                                {/* Card Header */}
                                <div className="p-5 pb-3 flex justify-between items-start">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                                            {group.clientName}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mt-1">
                                            <Clock size={10} className="text-slate-300" />
                                            {new Date(group.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 group-hover:text-indigo-500 transition-colors">
                                        <Users size={16} />
                                    </div>
                                </div>

                                {/* Options */}
                                <div className="flex-1 px-5 pb-4 space-y-2">
                                    {group.items.map((p: Proposal, idx: number) => {
                                        const roiHigh = p.savings_percent > 30;
                                        const hasOpp = (p.aletheia_summary?.opportunities?.length ?? 0) > 0;
                                        const pendingDays = getPendingDays(p);

                                        return (
                                            <Link
                                                href={`/dashboard/proposals/${p.id}`}
                                                key={p.id}
                                                className="block p-3.5 bg-slate-50/70 dark:bg-slate-800/50 rounded-xl border border-transparent hover:border-indigo-100 dark:hover:border-indigo-800/50 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all relative overflow-hidden"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="min-w-0 flex-1 pr-4">
                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${idx === 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                                {idx === 0 ? 'Mejor' : `Alt. ${idx}`}
                                                            </span>
                                                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{p.offer_snapshot.marketer_name}</span>
                                                            {pendingDays !== null && <FollowUpBadge days={pendingDays} />}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                            <span className="truncate">{p.offer_snapshot.tariff_name}</span>
                                                            {hasOpp && (
                                                                <span className="text-amber-500 font-bold">· {(p.aletheia_summary?.opportunities?.length ?? 0)} upsells</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Ahorro</p>
                                                        <p className={`text-sm font-bold ${roiHigh ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-200'}`}>
                                                            +{Math.round(p.annual_savings)}€
                                                        </p>
                                                        {/* Status dot */}
                                                        <div className={`mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                                            p.status === 'accepted' ? 'bg-emerald-50 text-emerald-600' :
                                                            p.status === 'sent' ? 'bg-blue-50 text-blue-600' :
                                                            p.status === 'rejected' ? 'bg-red-50 text-red-500' :
                                                            'bg-slate-100 text-slate-400'
                                                        }`}>
                                                            {p.status === 'accepted' ? '✓ Firmada' : p.status === 'sent' ? '→ Enviada' : p.status === 'rejected' ? '✗ Rechazada' : 'Borrador'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>

                                {/* Footer */}
                                <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <TrendingUp size={13} className="text-indigo-400" />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ahorro máximo</span>
                                    </div>
                                    <span className="text-base font-black text-slate-900 dark:text-white">
                                        {Math.round(group.items[0]?.annual_savings ?? 0).toLocaleString('es-ES')}€<span className="text-xs font-normal text-slate-400 ml-1">/año</span>
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {hasMore && !search && statusFilter === 'all' && (
                        <div className="flex justify-center pt-4">
                            <button
                                type="button"
                                onClick={loadMore}
                                disabled={isLoadingMore}
                                className="flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                            >
                                {isLoadingMore ? (
                                    <><div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> Cargando...</>
                                ) : 'Cargar más'}
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-16 text-center border border-slate-100 dark:border-slate-800 shadow-sm">
                    {search || statusFilter !== 'all' ? (
                        <>
                            <Filter size={32} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-slate-500 font-medium">Sin resultados para este filtro</p>
                            <button type="button" onClick={() => { setSearch(''); setStatusFilter('all'); }} className="mt-3 text-indigo-500 text-sm font-semibold hover:underline">
                                Limpiar filtros
                            </button>
                        </>
                    ) : (
                        <>
                            <PieChart size={36} className="mx-auto text-slate-200 mb-4" />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Sin propuestas todavía</h3>
                            <p className="text-slate-500 text-sm mb-6">Inicia una simulación para generar la primera propuesta</p>
                            <Link href="/dashboard/simulator" className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all text-sm">
                                Abrir Simulador
                            </Link>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
