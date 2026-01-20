'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { crmService } from '@/services/crmService';
import { Offer } from '@/types/crm';
import {
    Plus,
    Zap,
    Search,
    Edit3,
    Trash2,
    ChevronLeft,
    Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TariffForm from './TariffForm';

/**
 * Main view for managing Energy Offers (Tariffs).
 * Allows users to:
 * - List all active tariffs
 * - Search by name or marketer
 * - Create new tariffs
 * - Edit existing tariffs
 * - Duplicate tariffs
 * - Delete tariffs (soft delete)
 */
/**
 * Main view for managing Energy Offers (Tariffs).
 * Allows users to:
 * - List all active tariffs
 * - Search by name or marketer
 * - Create new tariffs
 * - Edit existing tariffs
 * - Duplicate tariffs
 * - Delete tariffs (soft delete)
 */
export default function TariffManagerView() {
    const router = useRouter();
    const [offers, setOffers] = useState<Offer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);

    useEffect(() => {
        loadOffers();
    }, []);

    async function loadOffers() {
        try {
            setLoading(true); // Ensure loading state resetting
            const data = await crmService.getOffers();
            setOffers(data);
        } catch (error) {
            console.error('Error loading offers', error);
        } finally {
            setLoading(false);
        }
    }

    const handleCreate = () => {
        setSelectedOffer(null);
        setIsFormOpen(true);
    };

    const handleEdit = (offer: Offer) => {
        setSelectedOffer(offer);
        setIsFormOpen(true);
    };

    const handleDuplicate = (offer: Offer) => {
        // Create a copy without ID and append "(Copia)" to name
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...rest } = offer;
        const copy: Partial<Offer> & { type?: 'fixed' | 'indexed' } = {
            ...rest,
            tariff_name: `${rest.tariff_name} (Copia)`,
            // Ensure type is preserved or default
            type: offer.type || 'fixed'
        };
        setSelectedOffer(copy as Offer); // Cast to trick specific form handling if needed
        setIsFormOpen(true);
    };

    // TODO: Implement Delete
    const handleDelete = async (id: string) => {
        if (confirm('¿Estás seguro de que quieres eliminar esta tarifa?')) {
            try {
                await crmService.deleteOffer(id);
                loadOffers();
            } catch (error) {
                console.error('Error deleting offer', error);
            }
        }
    };

    const handleSave = async (offer: Partial<Offer>) => {
        try {
            await crmService.saveOffer(offer);
            await loadOffers(); // Reload list
            setIsFormOpen(false);
        } catch (error) {
            console.error('Error saving offer', error);
            alert('Error al guardar la tarifa. Intenta de nuevo.');
        }
    };

    const filteredOffers = offers.filter(offer =>
        offer.tariff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        offer.marketer_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <div className="min-h-screen bg-[#F8F9FC] pb-20 font-sans selection:bg-indigo-500/30 selection:text-indigo-900">
            <AnimatePresence>
                {isFormOpen && (
                    <TariffForm
                        isOpen={isFormOpen}
                        initialData={selectedOffer}
                        onClose={() => setIsFormOpen(false)}
                        onSave={handleSave}
                    />
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="sticky top-0 z-20 bg-[#F8F9FC]/80 backdrop-blur-xl border-b border-slate-200/60 transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="w-10 h-10 rounded-xl bg-white/60 border border-slate-200/60 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-white hover:scale-105 transition-all shadow-sm group"
                            title="Volver"
                        >
                            <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                        </button>
                        <div>
                            <h1 className="text-xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                                <span className="bg-indigo-100/50 text-indigo-600 p-1.5 rounded-lg">
                                    <Zap size={18} fill="currentColor" />
                                </span>
                                Gestor de Tarifas
                            </h1>
                            <p className="text-xs text-slate-500 font-medium ml-1">Catálogo de precios y ofertas</p>
                        </div>
                    </div>

                    <button
                        onClick={handleCreate}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-slate-900/10 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 flex items-center gap-2 text-sm"
                    >
                        <Plus size={16} />
                        <span>Nueva Tarifa</span>
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Search & Filters */}
                <div className="mb-8 relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                        <Search size={18} />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar tarifa, comercializadora..."
                        className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm hover:border-slate-300 hover:shadow-md"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-medium text-slate-400 animate-pulse">Cargando catálogo...</span>
                    </div>
                ) : filteredOffers.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-[2rem] border border-slate-200 border-dashed">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <Zap className="text-slate-300" size={32} />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 mb-1">Catálogo vacío</h3>
                        <p className="text-slate-500 text-xs max-w-xs mx-auto mb-6">No se encontraron tarifas. Crea la primera para empezar.</p>
                        <button onClick={handleCreate} className="text-indigo-600 font-semibold text-sm hover:underline hover:text-indigo-700 transition-colors">Crear tarifa ahora</button>
                    </div>
                ) : (
                    <motion.div
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                    >
                        {filteredOffers.map((offer) => (
                            <motion.div
                                key={offer.id}
                                variants={itemVariants}
                                className="bg-white rounded-[1.5rem] border border-slate-100 p-5 relative group hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] transition-all duration-300 hover:-translate-y-1 hover:border-indigo-100/50"
                            >
                                {/* Card Header */}
                                <div className="flex justify-between items-start mb-5">
                                    <div className="flex gap-3.5 items-center">
                                        <div className={`w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center text-white shadow-md shadow-indigo-900/5 ${offer.logo_color || 'bg-slate-800'}`}>
                                            <span className="text-base font-bold tracking-tighter">
                                                {offer.marketer_name.substring(0, 2).toUpperCase()}
                                            </span>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-900 leading-tight text-base mb-0.5">{offer.tariff_name}</h3>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] text-slate-500 font-medium">{offer.marketer_name}</span>
                                                {offer.type === 'indexed' ? (
                                                    <span className="text-[9px] font-bold bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-md border border-purple-100 uppercase tracking-wider">
                                                        Indexado
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md border border-emerald-100 uppercase tracking-wider">
                                                        Fijo
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Action Dot Menu (Visible on Group Hover) */}
                                    <div className="flex gap-1 opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleEdit(offer)}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                            title="Editar"
                                        >
                                            <Edit3 size={15} />
                                        </button>
                                        <button
                                            onClick={() => handleDuplicate(offer)}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                            title="Duplicar"
                                        >
                                            <Copy size={15} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(offer.id)}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>

                                {/* Data Grid (Stats) */}
                                <div className="grid grid-cols-3 gap-2 mb-5">
                                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-center">
                                        <span className="text-[9px] uppercase tracking-wide font-bold text-slate-400 block mb-0.5">P1 (Punta)</span>
                                        <span className="text-xs font-semibold text-slate-700">{Number(offer.energy_price.p1).toFixed(4)} <span className="text-[9px] font-normal text-slate-400">€</span></span>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-center">
                                        <span className="text-[9px] uppercase tracking-wide font-bold text-slate-400 block mb-0.5">P3 (Llano)</span>
                                        <span className="text-xs font-semibold text-slate-700">{Number(offer.energy_price.p3 || 0).toFixed(4)} <span className="text-[9px] font-normal text-slate-400">€</span></span>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-center">
                                        <span className="text-[9px] uppercase tracking-wide font-bold text-slate-400 block mb-0.5">P6 (Valle)</span>
                                        <span className="text-xs font-semibold text-slate-700">{Number(offer.energy_price.p6 || 0).toFixed(4)} <span className="text-[9px] font-normal text-slate-400">€</span></span>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between pt-3 border-t border-slate-100/80">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                                        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Activa</span>
                                    </div>
                                    <div className="text-[10px] font-medium text-slate-400 flex items-center gap-1.5">
                                        <span>{offer.contract_duration}</span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </div>
        </div>
    );
}
