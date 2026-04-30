'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useClientDetails } from '../hooks/useClientDetails';
import {
    ChevronLeft,
    User,
    Building2,
    FileText,
    Phone,
    Mail,
    Edit3,
    Trash2,
    AlertTriangle,
    ArrowRight,
    Zap,
    TrendingDown,
    CalendarDays,
    CheckCircle2,
    Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CreateClientModal from './CreateClientModal';
import InvoiceHistoryPanel from './InvoiceHistoryPanel';
import ActivityTimeline from './ActivityTimeline';
import TasksPanel from './TasksPanel';
import DocumentsPanel from './DocumentsPanel';
import ContractsPanel from './ContractsPanel';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Proposal } from '@/types/crm';

// Memoized Proposal Card Component
interface ProposalCardProps {
    proposal: Proposal;
    onClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
}

const ProposalCard = React.memo(function ProposalCard({ proposal, onClick, onDelete }: ProposalCardProps) {
    const formattedDate = useMemo(() =>
        new Date(proposal.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
        [proposal.created_at]
    );

    const formattedSavings = useMemo(() =>
        proposal.annual_savings.toLocaleString('es-ES', { maximumFractionDigits: 0 }),
        [proposal.annual_savings]
    );

    return (
        <div
            onClick={onClick}
            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-slate-200/60 dark:border-slate-800 rounded-[1.25rem] bg-white/40 dark:bg-slate-900/40 hover:bg-white/80 dark:hover:bg-slate-800/80 hover:shadow-sm transition-all cursor-pointer relative overflow-hidden"
        >
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-500/20 group-hover:scale-105 transition-transform">
                    <FileText size={18} strokeWidth={2} />
                </div>
                <div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm leading-tight">
                        {proposal.offer_snapshot.marketer_name}
                    </h4>
                    <p className="text-slate-500 text-xs mt-0.5">
                        {proposal.offer_snapshot.tariff_name} <span className="mx-1.5 opacity-50">•</span> {formattedDate}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-4 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 pt-3 sm:pt-0">
                <div className="text-right sm:mr-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Ahorro</p>
                    <p className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm leading-none">
                        {formattedSavings}€ <span className="text-[10px] opacity-70 font-normal">/año</span>
                    </p>
                </div>

                <div className="shrink-0 scale-90 sm:scale-100 origin-right">
                    <StatusBadge status={proposal.status} />
                </div>

                <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 hidden sm:block mx-1"></div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={onDelete}
                        title="Eliminar propuesta"
                        aria-label="Eliminar propuesta"
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                    <div className="w-8 h-8 flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors">
                        <ArrowRight size={16} />
                    </div>
                </div>
            </div>
        </div>
    );
});

export default function ClientDetailsView({ clientId }: { clientId: string }) {
    const router = useRouter();
    const {
        client,
        proposals,
        loading,
        deleting,
        error,
        refresh,
        handleDeleteClient,
        handleDeleteProposal
    } = useClientDetails(clientId);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const handleSimulate = useCallback(() => {
        if (!client) return;
        sessionStorage.setItem('pendingClientPreload', JSON.stringify({
            client_id: client.id,
            client_name: client.name,
            cups: client.cups ?? '',
        }));
        router.push('/dashboard/simulator');
    }, [client, router]);

    const kpis = useMemo(() => {
        const signed = proposals.filter(p => p.status === 'accepted').length;
        const bestSaving = proposals.length > 0
            ? Math.max(...proposals.map(p => p.annual_savings || 0))
            : null;
        const lastDate = proposals.length > 0
            ? new Date(Math.max(...proposals.map(p => new Date(p.created_at).getTime())))
            : null;
        return { signed, bestSaving, lastDate, total: proposals.length };
    }, [proposals]);

    const handleEditSuccess = () => {
        refresh();
        setIsEditModalOpen(false);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !client) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
                <User size={32} className="mb-3 opacity-30" />
                <p>{error || 'Cliente no encontrado'}</p>
                <button onClick={() => router.back()} className="mt-4 text-indigo-500 font-medium hover:underline text-sm">Volver</button>
            </div>
        );
    }


    const onConfirmDeleteProposal = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm('¿Seguro que deseas eliminar esta propuesta permanentemente?')) return;
        await handleDeleteProposal(id);
    };

    return (
        <div className="min-h-screen pb-12 mt-4 md:mt-0 font-sans">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 md:py-6">
                
                {/* ═══ COMPACT HEADER: Back + Name + Status + Actions — all in one line ═══ */}
                <div className="flex items-center gap-4 mb-5">
                    <button
                        onClick={() => router.back()}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                        aria-label="Volver"
                        title="Volver a CRM"
                    >
                        <ChevronLeft size={18} />
                    </button>

                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        client.type === 'company'
                        ? 'bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10'
                        : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10'
                    }`}>
                        {client.type === 'company' ? <Building2 size={18} /> : <User size={18} />}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-lg font-bold text-slate-900 dark:text-white break-words capitalize">
                                {client.name.toLowerCase()}
                            </h1>
                            <StatusBadge status={client.status} />
                        </div>
                    </div>

                    {/* Quick contact + actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        {client.phone && (
                            <a href={`tel:${client.phone}`} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors" title={client.phone}>
                                <Phone size={15} />
                            </a>
                        )}
                        {client.email && (
                            <a href={`mailto:${client.email}`} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors" title={client.email}>
                                <Mail size={15} />
                            </a>
                        )}
                        <div className="w-[1px] h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
                        <button onClick={() => setIsEditModalOpen(true)} className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5">
                            <Edit3 size={13} /> Editar
                        </button>
                        <button onClick={() => setIsDeleteModalOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" aria-label="Eliminar Cliente" title="Eliminar Cliente">
                            <Trash2 size={15} />
                        </button>
                    </div>
                </div>

                {/* ═══ PROPERTY STRIP: All key data in a horizontal dense grid ═══ */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 mb-5 shadow-card">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-x-6 gap-y-3">
                        <PropertyCell label="CUPS" value={client.cups} mono />
                        <PropertyCell label="Compañía" value={client.current_supplier} />
                        <PropertyCell label="Tarifa" value={client.tariff_type} />
                        <PropertyCell label="Potencia" value={client.contracted_power ? `${client.contracted_power['p1'] || '-'} kW` : undefined} />
                        <PropertyCell label="Dirección" value={client.address} />
                        <PropertyCell label="Email" value={client.email} href={client.email ? `mailto:${client.email}` : undefined} />
                        <PropertyCell label="Teléfono" value={client.phone} href={client.phone ? `tel:${client.phone}` : undefined} />
                    </div>
                </div>

                {/* ═══ KPI STRIP + SIMULATE BUTTON ═══ */}
                <div className="flex flex-wrap items-center gap-3 mb-5">
                    {/* KPI pills */}
                    <div className="flex flex-wrap gap-2 flex-1">
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 shadow-sm">
                            <FileText size={14} className="text-indigo-400 shrink-0" />
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{kpis.total} propuestas</span>
                        </div>
                        {kpis.signed > 0 && (
                            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 rounded-lg px-3 py-2 shadow-sm">
                                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{kpis.signed} firmada{kpis.signed > 1 ? 's' : ''}</span>
                            </div>
                        )}
                        {kpis.bestSaving !== null && kpis.bestSaving > 0 && (
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 shadow-sm">
                                <TrendingDown size={14} className="text-emerald-500 shrink-0" />
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                    Mejor ahorro: <span className="text-emerald-600 dark:text-emerald-400">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(kpis.bestSaving)}/año</span>
                                </span>
                            </div>
                        )}
                        {kpis.lastDate && (
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 shadow-sm">
                                <CalendarDays size={14} className="text-slate-400 shrink-0" />
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    Última sim. {kpis.lastDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Simulate CTA */}
                    <button
                        type="button"
                        onClick={handleSimulate}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-energy-600 hover:bg-energy-700 text-white text-sm font-bold shadow-button transition-colors shrink-0"
                    >
                        <Zap size={15} strokeWidth={2.5} />
                        Simular ahora
                    </button>
                </div>

                {/* ═══ MAIN CONTENT: Asymmetric 2-column layout ═══ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                    
                    {/* LEFT COLUMN */}
                    <div className="space-y-5">
                        {/* Propuestas */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-card">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Propuestas</h3>
                                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                    {proposals.length}
                                </span>
                            </div>

                            {proposals.length === 0 ? (
                                <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center">
                                    <p className="text-xs text-slate-400">Sin propuestas. Sube una factura para simular.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {proposals.map(proposal => (
                                        <ProposalCard
                                            key={proposal.id}
                                            proposal={proposal}
                                            onClick={() => router.push(`/dashboard/proposals/${proposal.id}`)}
                                            onDelete={(e) => onConfirmDeleteProposal(proposal.id, e)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Contratos */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-card">
                            <ContractsPanel clientId={clientId} />
                        </div>

                        {/* Documentos */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-card">
                            <DocumentsPanel clientId={clientId} />
                        </div>
                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="space-y-5">
                        {/* Tareas */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-card">
                            <TasksPanel clientId={clientId} />
                        </div>

                        {/* Facturas OCR */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-card overflow-hidden">
                            <InvoiceHistoryPanel clientId={clientId} />
                        </div>

                        {/* Actividad */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-card">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Actividad</h3>
                                <Clock size={14} className="text-slate-400" />
                            </div>
                            <ActivityTimeline clientId={clientId} />
                        </div>
                    </div>
                </div>

                {/* Edit Modal */}
                <CreateClientModal
                    key={isEditModalOpen ? 'open' : 'closed'}
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onSuccess={handleEditSuccess}
                    clientToEdit={client}
                />

                {/* Delete Confirmation Modal */}
                <AnimatePresence>
                    {isDeleteModalOpen && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                role="dialog"
                                aria-modal="true"
                                aria-label="Confirmar eliminación de cliente"
                                className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center"
                            >
                                <div className="mx-auto w-12 h-12 bg-red-50 dark:bg-red-500/10 rounded-xl flex items-center justify-center text-red-500 mb-4">
                                    <AlertTriangle size={22} />
                                </div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Eliminar Cliente</h3>
                                <p className="text-slate-500 text-xs mb-5">Acción irreversible. Se eliminarán facturas y propuestas.</p>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg text-sm transition-colors">
                                        Cancelar
                                    </button>
                                    <button onClick={handleDeleteClient} disabled={deleting} className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50">
                                        {deleting ? 'Borrando...' : 'Eliminar'}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function PropertyCell({ label, value, mono, href }: { label: string; value?: string; mono?: boolean; href?: string }) {
    const display = value || '—';
    const valueClass = mono
        ? 'font-mono text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800 px-1 py-0.5 rounded break-all'
        : 'text-sm text-slate-800 dark:text-slate-200 font-medium break-words';

    return (
        <div className="min-w-0">
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
            {href && value ? (
                <a href={href} className={`${valueClass} text-indigo-500 hover:text-indigo-600 block`}>{display}</a>
            ) : (
                <p className={valueClass} title={value}>{display}</p>
            )}
        </div>
    );
}
