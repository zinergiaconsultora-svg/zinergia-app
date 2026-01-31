'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useClientDetails } from '../hooks/useClientDetails';
import {
    ChevronLeft,
    User,
    Building2,
    Zap,
    FileText,
    Phone,
    Mail,
    MapPin,
    Edit3,
    Trash2,
    AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CreateClientModal from './CreateClientModal';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Proposal } from '@/types/crm';

// Memoized Proposal Card Component
interface ProposalCardProps {
    proposal: Proposal;
    onClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
}

const ProposalCard = React.memo(function ProposalCard({ proposal, onClick, onDelete }: ProposalCardProps) {
    // Memoize formatted values to prevent recalculation on every render
    const formattedDate = useMemo(() =>
        new Date(proposal.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
        [proposal.created_at]
    );

    const formattedSavings = useMemo(() =>
        proposal.annual_savings.toLocaleString('es-ES', { maximumFractionDigits: 0 }),
        [proposal.annual_savings]
    );

    return (
        <div
            onClick={onClick}
            className="group bg-white/60 backdrop-blur-xl border border-white/60 rounded-[2rem] p-6 hover:bg-white/90 hover:border-energy-100 hover:shadow-lg hover:shadow-energy-500/5 transition-all cursor-pointer relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 p-16 bg-gradient-to-bl from-energy-50/50 to-transparent rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-energy-50 to-blue-50 border border-energy-100/50 flex items-center justify-center text-energy-600 shadow-sm group-hover:scale-105 transition-transform">
                        <FileText size={20} strokeWidth={1.5} />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 text-lg">
                            {proposal.offer_snapshot.marketer_name}
                        </h4>
                        <p className="text-slate-500 text-sm">
                            {proposal.offer_snapshot.tariff_name} • {formattedDate}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4 pl-16 sm:pl-0">
                    <div className="text-right mr-2">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Ahorro Est.</p>
                        <p className="text-emerald-600 font-bold text-xl">
                            {formattedSavings}€<span className="text-sm font-medium text-emerald-600/70">/año</span>
                        </p>
                    </div>

                    <StatusBadge status={proposal.status} />

                    <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden sm:block"></div>

                    <button
                        onClick={onDelete}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        title="Eliminar propuesta"
                        aria-label="Eliminar propuesta"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
});

interface ClientDetailsViewProps {
    clientId: string;
}

export default function ClientDetailsView({ clientId }: ClientDetailsViewProps) {
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

    const handleEditSuccess = () => {
        refresh();
        setIsEditModalOpen(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] bg-[#F8F9FC]">
                <AmbientBackground />
                <div className="w-8 h-8 border-4 border-energy-500 border-t-transparent rounded-full animate-spin relative z-10" />
            </div>
        );
    }

    if (error || !client) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 bg-[#F8F9FC]">
                <AmbientBackground />
                <div className="relative z-10 flex flex-col items-center">
                    <User size={48} className="mb-4 opacity-50" />
                    <p>{error || 'Cliente no encontrado'}</p>
                    <button
                        onClick={() => router.back()}
                        className="mt-4 text-energy-600 font-bold hover:underline"
                    >
                        Volver
                    </button>
                </div>
            </div>
        );
    }

    const sections = [
        {
            title: 'Información Personal',
            icon: <User className="text-blue-500" size={20} />,
            items: [
                { label: 'Nombre', value: client.name },
                { label: 'Email', value: client.email, isLink: true, type: 'email' },
                { label: 'Teléfono', value: client.phone, isLink: true, type: 'tel' },
                { label: 'Dirección', value: client.address },
                { label: 'Tipo', value: client.type === 'particular' ? 'Particular' : 'Empresa' }
            ]
        },
        {
            title: 'Datos de Suministro',
            icon: <Zap className="text-energy-500" size={20} />,
            items: [
                { label: 'CUPS', value: client.cups, isMono: true },
                { label: 'Comercializadora', value: client.current_supplier },
                { label: 'Tarifa', value: client.tariff_type },
                { label: 'Potencia', value: client.contracted_power ? `${client.contracted_power['p1'] || '-'} kW` : '-' }
            ]
        },
        {
            title: 'Estado del Contrato',
            icon: <FileText className="text-emerald-500" size={20} />,
            items: [
                { label: 'Estado', value: <StatusBadge status={client.status} /> },
                { label: 'Fecha Alta', value: new Date(client.created_at).toLocaleDateString('es-ES') },
                { label: 'Última Modificación', value: client.updated_at ? new Date(client.updated_at).toLocaleDateString('es-ES') : '-' }
            ]
        }
    ];

    const onConfirmDeleteProposal = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm('¿Estás seguro de eliminar esta propuesta?')) return;
        await handleDeleteProposal(id);
    };

    return (
        <div className="min-h-screen bg-[#F8F9FC] pb-20 relative overflow-hidden font-sans selection:bg-energy-500/30 selection:text-energy-900">
            <AmbientBackground />

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 relative z-10">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
                    <button
                        onClick={() => router.back()}
                        className="group flex items-center gap-2 text-slate-500 hover:text-energy-600 transition-colors self-start"
                    >
                        <div className="w-10 h-10 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/60 flex items-center justify-center group-hover:bg-white/80 transition-all hover:-translate-x-1">
                            <ChevronLeft size={20} />
                        </div>
                        <span className="font-medium">Volver</span>
                    </button>

                    <div className="flex gap-3 self-end sm:self-auto w-full sm:w-auto">
                        <button
                            onClick={() => setIsEditModalOpen(true)}
                            className="flex-1 sm:flex-none h-10 px-4 rounded-xl bg-white/60 backdrop-blur-xl border border-white/60 text-energy-600 font-medium hover:bg-energy-50 transition-all flex items-center justify-center gap-2"
                        >
                            <Edit3 size={16} />
                            <span>Editar</span>
                        </button>
                        <button
                            onClick={() => setIsDeleteModalOpen(true)}
                            className="w-10 h-10 rounded-xl bg-white/60 backdrop-blur-xl border border-white/60 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center shrink-0"
                            aria-label="Eliminar Cliente"
                            title="Eliminar Cliente"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6 md:space-y-8"
                >
                    {/* Hero Card */}
                    <div className="bg-white/70 backdrop-blur-2xl border border-white/60 rounded-[2rem] md:rounded-[2.5rem] p-5 md:p-8 relative overflow-hidden shadow-sm">
                        <div className="absolute top-0 right-0 p-20 bg-gradient-to-bl from-energy-50/50 to-transparent rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

                        <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start relative z-10">
                            <div className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl md:rounded-[2rem] flex items-center justify-center text-3xl md:text-4xl shadow-inner border border-white/50 shrink-0 ${client.type === 'company'
                                ? 'bg-blue-50 text-blue-600'
                                : 'bg-energy-50 text-energy-600'
                                }`}>
                                {client.type === 'company' ? <Building2 size={32} className="md:w-10 md:h-10" strokeWidth={1.5} /> : <User size={32} className="md:w-10 md:h-10" strokeWidth={1.5} />}
                            </div>

                            <div className="flex-1 space-y-4 w-full">
                                <div>
                                    <div className="flex flex-wrap items-center gap-3 mb-2">
                                        <h1 className="text-xl md:text-2xl font-medium text-slate-900 tracking-tight break-all md:break-normal">{client.name}</h1>
                                        <StatusBadge status={client.status} />
                                    </div>
                                    <p className="text-slate-500 font-light flex items-center gap-2 text-sm md:text-base">
                                        <MapPin size={16} className="text-energy-400 shrink-0" />
                                        <span className="break-all">{client.address || 'Sin dirección registrada'}</span>
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    {client.email && (
                                        <a href={`mailto:${client.email}`} className="px-3 md:px-4 py-2 rounded-xl bg-white/50 border border-white/60 text-slate-600 text-xs md:text-sm font-medium hover:bg-energy-50 hover:text-energy-600 hover:border-energy-100 transition-all flex items-center gap-2 truncate max-w-full">
                                            <Mail size={14} className="md:w-4 md:h-4" />
                                            <span className="truncate">{client.email}</span>
                                        </a>
                                    )}
                                    {client.phone && (
                                        <a href={`tel:${client.phone}`} className="px-3 md:px-4 py-2 rounded-xl bg-white/50 border border-white/60 text-slate-600 text-xs md:text-sm font-medium hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-100 transition-all flex items-center gap-2">
                                            <Phone size={14} className="md:w-4 md:h-4" />
                                            {client.phone}
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {sections.map((section, idx) => (
                            <div key={idx} className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-[2.5rem] p-8 hover:bg-white/70 transition-colors">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-10 h-10 rounded-2xl bg-white/80 shadow-sm flex items-center justify-center text-slate-600">
                                        {React.cloneElement(section.icon as React.ReactElement, { size: 18, strokeWidth: 1.5 } as React.SVGAttributes<SVGElement>)}
                                    </div>
                                    <h3 className="font-medium text-base text-slate-900">{section.title}</h3>
                                </div>

                                <div className="space-y-5">
                                    {section.items.map((item, i) => (
                                        <div key={i} className="flex flex-col gap-1">
                                            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                                                {item.label}
                                            </span>
                                            <div className={`text-base text-slate-700 ${'isMono' in item && item.isMono ? 'font-mono tracking-tight bg-slate-50/50 px-2 py-1 rounded-lg border border-slate-100/50 w-fit' : 'font-light'}`}>
                                                {renderValue(item)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Proposals History Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-lg font-medium text-slate-900">Historial de Propuestas</h3>
                        </div>

                        {proposals.length === 0 ? (
                            <div className="text-center py-10 bg-white/40 border border-white/60 rounded-[2rem]">
                                <p className="text-slate-400">No hay propuestas registradas</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
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

                </motion.div>

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
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                className="relative bg-white/90 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] shadow-2xl p-8 max-w-sm w-full text-center overflow-hidden"
                            >
                                <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-4 border border-red-100">
                                    <AlertTriangle size={28} strokeWidth={1.5} />
                                </div>
                                <h3 className="text-xl font-medium text-slate-900 mb-2">¿Eliminar Cliente?</h3>
                                <p className="text-slate-500 font-light mb-8 leading-relaxed">
                                    Esta acción es irreversible. Se eliminarán todos los datos asociados.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setIsDeleteModalOpen(false)}
                                        className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleDeleteClient}
                                        disabled={deleting}
                                        className="flex-1 py-3 px-4 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
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


function renderValue(item: {
    label: string;
    value: string | number | undefined | React.ReactNode;
    isLink?: boolean;
    type?: string;
    isMono?: boolean;
}) {
    if (!item.value) return <span className="text-slate-300">-</span>;
    if (React.isValidElement(item.value)) return item.value;

    const valueStr = String(item.value);

    if (item.isLink && item.type === 'email') {
        return <a href={`mailto:${valueStr}`} className="text-energy-600 hover:text-energy-700 transition-colors">{valueStr}</a>;
    }
    if (item.isLink && item.type === 'tel') {
        return <a href={`tel:${valueStr}`} className="text-emerald-600 hover:text-emerald-700 transition-colors">{valueStr}</a>;
    }
    return valueStr;
}

