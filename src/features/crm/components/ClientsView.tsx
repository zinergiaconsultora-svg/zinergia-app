'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, ChevronRight, User } from 'lucide-react';
import { useClients } from '../hooks/useClients';
import ClientCard from './ClientCard';
import CreateClientModal from './CreateClientModal';
import { AmbientBackground } from '@/components/ui/AmbientBackground';

export default function ClientsView() {
    const { clients, loading, refresh } = useClients();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const router = useRouter();

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.cups?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-[#F8F9FC] pb-20 relative overflow-hidden font-sans selection:bg-energy-500/30 selection:text-energy-900">
            <AmbientBackground />

            <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12 py-12 relative z-10">

                {/* HEADER */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <button
                                onClick={() => router.back()}
                                className="w-10 h-10 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/60 flex items-center justify-center text-slate-500 hover:text-energy-600 hover:bg-white/80 transition-all hover:-translate-x-1 active:scale-95"
                            >
                                <ChevronRight size={20} className="rotate-180" />
                            </button>
                            <span className="text-[11px] font-medium text-energy-600 bg-energy-50 px-3 py-1 rounded-full border border-energy-100 uppercase tracking-widest">
                                Cartera
                            </span>
                        </div>
                        <h1 className="text-4xl font-medium text-slate-900 tracking-tight leading-none">
                            Mis Clientes<span className="text-transparent bg-clip-text bg-gradient-to-r from-energy-600 to-energy-400">.</span>
                        </h1>
                    </div>

                    <div className="flex-1 max-w-md flex gap-4">
                        <div className="relative group flex-1">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                <Search className="text-slate-400 group-focus-within:text-energy-500 transition-colors" size={18} />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar por nombre o CUPS..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:bg-white/80 focus:ring-2 focus:ring-energy-500/20 focus:scale-[1.02] transition-all outline-none shadow-sm"
                            />
                        </div>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="h-[52px] px-6 bg-slate-900 text-white rounded-2xl font-medium transition-all shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30 hover:-translate-y-1 active:scale-95 flex items-center gap-2 flex-shrink-0"
                        >
                            <Plus size={20} />
                            <span className="hidden sm:inline">Nuevo</span>
                        </button>
                    </div>
                </div>

                {/* CONTENT GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        // Skeleton
                        [1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="bg-white/40 rounded-[2rem] p-8 h-64 animate-pulse border border-white/40" />
                        ))
                    ) : filteredClients.length === 0 ? (
                        // Empty State
                        <div className="col-span-full py-32 flex flex-col items-center justify-center text-center">
                            <div className="w-24 h-24 bg-gradient-to-tr from-white to-slate-50 rounded-[2rem] shadow-xl shadow-energy-500/5 flex items-center justify-center mb-6 border border-white/60">
                                <User size={40} className="text-slate-300" strokeWidth={1} />
                            </div>
                            <h3 className="text-2xl font-medium text-slate-900 mb-2">No se encontraron clientes</h3>
                            <p className="text-slate-500 font-light max-w-md">
                                Prueba con otra búsqueda o añade un nuevo cliente a tu cartera.
                            </p>
                        </div>
                    ) : (
                        // Client Cards - Antigravity Style
                        filteredClients.map(client => (
                            <ClientCard key={client.id} client={client} />
                        ))
                    )}
                </div>
            </div>

            <CreateClientModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={refresh}
            />
        </div>
    );
}
