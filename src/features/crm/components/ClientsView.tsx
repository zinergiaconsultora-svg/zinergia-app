'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, ChevronRight, User, LayoutGrid, Columns3, TrendingUp, Users, Target, Activity, FileUp } from 'lucide-react';
import { getClientScoresAction, type ClientScore } from '@/app/actions/clientScores';
import { useClients } from '../hooks/useClients';
import ClientCard from './ClientCard';
import ClientQuickActions from './ClientQuickActions';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/primitives/Button';
import { Input } from '@/components/ui/primitives/Input';
import BulkActions from './BulkActions';
import { ClientStatus } from '@/types/crm';

const CreateClientModal = dynamic(() => import('./CreateClientModal'), {
    ssr: false,
    loading: () => null
});

const CsvImportModal = dynamic(() => import('./CsvImportModal'), {
    ssr: false,
    loading: () => null
});

const PipelineView = dynamic(() => import('./PipelineView'), {
    ssr: false,
    loading: () => <div className="h-[500px] bg-white/20 rounded-2xl animate-pulse" />
});

import { Client } from '@/types/crm';

interface ClientsViewProps {
    initialData?: Client[];
}

type ViewMode = 'list' | 'pipeline';
type SortOption = 'created_at' | 'name' | 'status';

const STATUS_FILTERS: { value: ClientStatus | 'all'; label: string; emoji: string }[] = [
    { value: 'all', label: 'Todos', emoji: '📋' },
    { value: 'new', label: 'Nuevos', emoji: '🆕' },
    { value: 'contacted', label: 'Contactados', emoji: '📞' },
    { value: 'in_process', label: 'En Proceso', emoji: '⚡' },
    { value: 'won', label: 'Ganados', emoji: '🏆' },
    { value: 'lost', label: 'Perdidos', emoji: '❌' },
];

export default function ClientsView({ initialData }: ClientsViewProps) {
    const {
        clients, loading, loadingMore, hasMore, searching,
        searchTerm, search, refresh, loadMore, kpis, kpisLoading,
    } = useClients(initialData);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('pipeline');
    const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all');
    const [sortBy, setSortBy] = useState<SortOption>('created_at');
    const [filterSupplier, setFilterSupplier] = useState('');
    const [filterMinBill, setFilterMinBill] = useState('');
    const [filterColdDays, setFilterColdDays] = useState(0);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [scores, setScores] = useState<Map<string, ClientScore>>(new Map());
    // Timestamp de corte para "sin contactar hace X días". Se calcula en el
    // manejador del select (evento), no en render, para no llamar a Date.now()
    // durante el render (regla react-hooks/purity). 0 = filtro desactivado.
    const [coldCutoff, setColdCutoff] = useState(0);

    useEffect(() => {
        if (clients.length === 0) return;
        getClientScoresAction(clients.map(c => c.id))
            .then(list => setScores(new Map(list.map(s => [s.clientId, s]))))
            .catch(() => { /* non-fatal */ });
    }, [clients]);
    const router = useRouter();

    const filteredClients = useMemo(() => {
        let result = [...clients];

        if (statusFilter !== 'all') {
            result = result.filter(c => c.status === statusFilter);
        }

        if (filterSupplier.trim()) {
            const q = filterSupplier.trim().toLowerCase();
            result = result.filter(c => (c.current_supplier ?? '').toLowerCase().includes(q));
        }

        if (filterMinBill) {
            const min = parseFloat(filterMinBill);
            if (!Number.isNaN(min)) result = result.filter(c => (c.average_monthly_bill ?? 0) >= min);
        }

        if (coldCutoff > 0) {
            // "Cold" = no contact (or creation) more recent than the cutoff.
            result = result.filter(c => {
                const ref = c.last_contact_date ?? c.created_at;
                return new Date(ref).getTime() <= coldCutoff;
            });
        }

        result.sort((a, b) => {
            switch (sortBy) {
                case 'name': return a.name.localeCompare(b.name);
                case 'status': return a.status.localeCompare(b.status);
                case 'created_at':
                default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
        });

        return result;
    }, [clients, statusFilter, sortBy, filterSupplier, filterMinBill, coldCutoff]);

    const hasAdvancedFilters = filterSupplier.trim() !== '' || filterMinBill !== '' || filterColdDays > 0;
    const clearAdvancedFilters = useCallback(() => {
        setFilterSupplier('');
        setFilterMinBill('');
        setFilterColdDays(0);
        setColdCutoff(0);
    }, []);

    // Evento (no render): aquí sí podemos leer Date.now() para fijar el corte.
    const handleColdDaysChange = useCallback((days: number) => {
        setFilterColdDays(days);
        setColdCutoff(days > 0 ? Date.now() - days * 86_400_000 : 0);
    }, []);

    const toggleSelect = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const selectAll = useCallback(() => {
        setSelectedIds(new Set(filteredClients.map(c => c.id)));
    }, [filteredClients]);

    const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 relative overflow-hidden font-sans selection:bg-energy-500/30 selection:text-energy-900">
            <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12 py-12 relative z-10">

                {/* HEADER */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Button
                                onClick={() => router.back()}
                                variant="secondary"
                                size="icon"
                                className="rounded-2xl"
                            >
                                <ChevronRight size={20} className="rotate-180" />
                            </Button>
                            <span className="text-[11px] font-medium text-energy-600 bg-energy-50 px-3 py-1 rounded-full border border-energy-100 uppercase tracking-widest">
                                Cartera
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-medium text-slate-900 tracking-tight leading-none">
                            Mis Clientes<span className="text-transparent bg-clip-text bg-gradient-to-r from-energy-600 to-energy-400">.</span>
                        </h1>
                    </div>

                    <div className="flex-1 max-w-md flex gap-3">
                        <div className="relative group flex-1">
                            <Input
                                placeholder="Buscar por nombre, CUPS, teléfono, email o DNI..."
                                value={searchTerm}
                                onChange={(e) => search(e.target.value)}
                                icon={searching ? (
                                    <div className="w-[18px] h-[18px] border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
                                ) : (
                                    <Search size={18} />
                                )}
                                className="rounded-2xl py-6"
                            />
                        </div>
                        <Button
                            onClick={() => setIsCsvImportOpen(true)}
                            variant="secondary"
                            size="lg"
                            className="h-[52px] rounded-2xl px-4 shrink-0"
                            leftIcon={<FileUp size={18} />}
                            title="Importar desde CSV"
                        >
                            <span className="hidden md:inline">CSV</span>
                        </Button>
                        <Button
                            onClick={() => setIsModalOpen(true)}
                            variant="primary"
                            size="lg"
                            className="h-[52px] rounded-2xl px-6 shadow-floating"
                            leftIcon={<Plus size={20} />}
                        >
                            <span className="hidden sm:inline">Nuevo</span>
                        </Button>
                    </div>
                </div>

                {/* CRM INSIGHTS CARDS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm hover:shadow-floating transition-all">
                        <div className="flex items-center gap-3 mb-2 text-slate-500">
                            <Users size={16} className="text-indigo-500" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Total Clientes</span>
                        </div>
                        <div className="text-3xl font-bold text-slate-900 dark:text-white">
                            {kpisLoading ? <span className="inline-block w-12 h-8 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /> : kpis.total}
                        </div>
                    </div>
                    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm hover:shadow-floating transition-all">
                        <div className="flex items-center gap-3 mb-2 text-slate-500">
                            <Activity size={16} className="text-emerald-500" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Nuevos Leads</span>
                        </div>
                        <div className="text-3xl font-bold text-slate-900 dark:text-white">
                            {kpisLoading ? <span className="inline-block w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /> : kpis.nuevos}
                        </div>
                    </div>
                    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm hover:shadow-floating transition-all">
                        <div className="flex items-center gap-3 mb-2 text-slate-500">
                            <TrendingUp size={16} className="text-violet-500" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Valor Pipeline</span>
                        </div>
                        <div className="text-3xl font-bold text-slate-900 dark:text-white">
                            {kpisLoading ? <span className="inline-block w-20 h-8 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /> : (
                                <>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(kpis.pipelineValue)}<span className="text-lg text-slate-400 font-medium ml-1">/mes</span></>
                            )}
                        </div>
                    </div>
                    <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm hover:shadow-floating transition-all">
                        <div className="flex items-center gap-3 mb-2 text-slate-500">
                            <Target size={16} className="text-amber-500" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Tasa Conversión</span>
                        </div>
                        <div className="text-3xl font-bold text-slate-900 dark:text-white">
                            {kpisLoading ? <span className="inline-block w-10 h-8 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /> : <>{kpis.conversion}%</>}
                        </div>
                    </div>
                </div>

                {/* TOOLBAR: Filters + View Toggle + Sort */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    {/* Status Filters */}
                    <div className="flex flex-wrap gap-2">
                        {viewMode === 'list' && STATUS_FILTERS.map(f => (
                            <button
                                key={f.value}
                                onClick={() => setStatusFilter(f.value)}
                                className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
                                    statusFilter === f.value
                                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-sm'
                                        : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                }`}
                            >
                                {f.emoji} {f.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Sort */}
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            aria-label="Ordenar por"
                            className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-600 dark:text-slate-300"
                        >
                            <option value="created_at">Más recientes</option>
                            <option value="name">Nombre A-Z</option>
                            <option value="status">Estado</option>
                        </select>

                        {/* View Toggle */}
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-md transition-all ${
                                    viewMode === 'list'
                                        ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-700 dark:text-white'
                                        : 'text-slate-400 hover:text-slate-600'
                                }`}
                                title="Vista lista"
                            >
                                <LayoutGrid size={16} />
                            </button>
                            <button
                                onClick={() => setViewMode('pipeline')}
                                className={`p-1.5 rounded-md transition-all ${
                                    viewMode === 'pipeline'
                                        ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-700 dark:text-white'
                                        : 'text-slate-400 hover:text-slate-600'
                                }`}
                                title="Vista pipeline"
                            >
                                <Columns3 size={16} />
                            </button>
                        </div>

                        {/* Results count */}
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                            {filteredClients.length} {filteredClients.length === 1 ? 'cliente' : 'clientes'}
                        </span>
                    </div>
                </div>

                {/* ADVANCED FILTERS */}
                <div className="flex flex-wrap items-center gap-2 mb-5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-1">Filtros</span>
                    <input
                        value={filterSupplier}
                        onChange={(e) => setFilterSupplier(e.target.value)}
                        placeholder="Compañía actual…"
                        aria-label="Filtrar por compañía actual"
                        className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-600 dark:text-slate-300 w-40 focus:border-indigo-400 outline-none"
                    />
                    <div className="relative">
                        <input
                            type="number"
                            min="0"
                            value={filterMinBill}
                            onChange={(e) => setFilterMinBill(e.target.value)}
                            placeholder="Factura mín."
                            aria-label="Factura mensual mínima en euros"
                            className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-6 py-1.5 text-slate-600 dark:text-slate-300 w-28 focus:border-indigo-400 outline-none"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">€</span>
                    </div>
                    <select
                        value={filterColdDays}
                        onChange={(e) => handleColdDaysChange(Number(e.target.value))}
                        aria-label="Sin contactar desde hace"
                        className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-600 dark:text-slate-300 focus:border-indigo-400 outline-none"
                    >
                        <option value={0}>Sin contactar: cualquiera</option>
                        <option value={7}>Sin contactar +7 días</option>
                        <option value={14}>Sin contactar +14 días</option>
                        <option value={30}>Sin contactar +30 días</option>
                    </select>
                    {hasAdvancedFilters && (
                        <button
                            onClick={clearAdvancedFilters}
                            className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium px-2 py-1.5 transition-colors"
                        >
                            ✕ Limpiar filtros
                        </button>
                    )}
                </div>

                {/* BULK ACTIONS BAR */}
                <BulkActions
                    clients={filteredClients}
                    selectedIds={selectedIds}
                    onToggle={toggleSelect}
                    onSelectAll={selectAll}
                    onClearSelection={clearSelection}
                    onRefresh={refresh}
                />

                {/* Select All Link */}
                {viewMode === 'list' && filteredClients.length > 0 && !loading && (
                    <div className="flex items-center gap-3 mb-4 mt-2">
                        <button
                            onClick={selectedIds.size === filteredClients.length ? clearSelection : selectAll}
                            className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors"
                        >
                            {selectedIds.size === filteredClients.length ? '✕ Deseleccionar todos' : '☑ Seleccionar todos'}
                        </button>
                    </div>
                )}

                {/* CONTENT: List or Pipeline */}
                {viewMode === 'pipeline' ? (
                    <PipelineView clients={filteredClients} onStatusChange={refresh} />
                ) : (
                    <div
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {loading ? (
                            [1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="bg-white/40 rounded-[2rem] p-8 h-64 animate-pulse border border-white/40" />
                            ))
                        ) : filteredClients.length === 0 ? (
                            <div className="col-span-full py-32 flex flex-col items-center justify-center text-center">
                                <div className="w-24 h-24 bg-gradient-to-tr from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-[2rem] shadow-xl shadow-energy-500/5 flex items-center justify-center mb-6 border border-white/60 dark:border-white/10">
                                    <User size={40} className="text-slate-300 dark:text-slate-600" strokeWidth={1} />
                                </div>
                                <h3 className="text-2xl font-medium text-slate-900 dark:text-white mb-2">No se encontraron clientes</h3>
                                <p className="text-slate-500 dark:text-slate-400 font-light max-w-md">
                                    Prueba con otra búsqueda o añade un nuevo cliente a tu cartera.
                                </p>
                            </div>
                        ) : (
                            filteredClients.map(client => (
                                <div key={client.id} className="relative">
                                    {/* Selection Checkbox */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleSelect(client.id); }}
                                        className={`absolute top-4 left-4 z-20 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                            selectedIds.has(client.id)
                                                ? 'bg-indigo-500 border-indigo-500 text-white'
                                                : 'border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 hover:border-indigo-400'
                                        }`}
                                    >
                                        {selectedIds.has(client.id) && (
                                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        )}
                                    </button>
                                    {/* Priority Score Badge */}
                                    {(() => {
                                        const s = scores.get(client.id);
                                        if (!s || s.score < 20) return null;
                                        const color = s.score >= 60
                                            ? 'bg-red-500 ring-red-200'
                                            : s.score >= 35
                                                ? 'bg-amber-400 ring-amber-200'
                                                : 'bg-blue-400 ring-blue-200';
                                        return (
                                            <div
                                                title={s.reasons.join(' · ')}
                                                className={`absolute top-4 right-14 z-20 w-7 h-7 rounded-full ${color} ring-2 flex items-center justify-center text-white text-[10px] font-bold shadow-sm`}
                                            >
                                                {s.score}
                                            </div>
                                        );
                                    })()}
                                    {/* Quick actions menu */}
                                    <div className="absolute top-3.5 right-3.5 z-20">
                                        <ClientQuickActions client={client} onChanged={refresh} />
                                    </div>
                                    <ClientCard client={client} />
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* LOAD MORE */}
                {hasMore && !loading && viewMode === 'list' && (
                    <div className="flex justify-center pt-8">
                        <Button
                            onClick={loadMore}
                            disabled={loadingMore}
                            variant="secondary"
                            size="lg"
                            className="rounded-2xl px-8"
                        >
                            {loadingMore ? (
                                <span className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                                    Cargando...
                                </span>
                            ) : 'Cargar más clientes'}
                        </Button>
                    </div>
                )}
            </div>

            <CreateClientModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={refresh}
            />

            {isCsvImportOpen && (
                <CsvImportModal
                    onClose={() => setIsCsvImportOpen(false)}
                    onSuccess={refresh}
                />
            )}
        </div>
    );
}
