'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, ChevronRight, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useClients } from '../hooks/useClients';
import ClientCard from './ClientCard';
import dynamic from 'next/dynamic';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { Button } from '@/components/ui/primitives/Button';
import { Input } from '@/components/ui/primitives/Input';

const CreateClientModal = dynamic(() => import('./CreateClientModal'), {
    ssr: false,
    loading: () => null
});

import { Client } from '@/types/crm';

interface ClientsViewProps {
    initialData?: Client[];
}

// Animation variants defined outside component to prevent recreation
const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

export default function ClientsView({ initialData }: ClientsViewProps) {
    const { clients, loading, refresh } = useClients(initialData);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const router = useRouter();

    // Memoize filtered clients to prevent recalculation on every render
    const filteredClients = useMemo(() =>
        clients.filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.cups?.toLowerCase().includes(searchTerm.toLowerCase())
        ),
        [clients, searchTerm]
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 relative overflow-hidden font-sans selection:bg-energy-500/30 selection:text-energy-900">
            <AmbientBackground />

            <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12 py-12 relative z-10">

                {/* HEADER */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
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

                    <div className="flex-1 max-w-md flex gap-4">
                        <div className="relative group flex-1">
                            <Input
                                placeholder="Buscar por nombre o CUPS..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                icon={<Search size={18} />}
                                className="rounded-2xl py-6"
                            />
                        </div>
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

                {/* CONTENT GRID */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    {loading ? (
                        // Skeleton
                        [1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="bg-white/40 rounded-[2rem] p-8 h-64 animate-pulse border border-white/40" />
                        ))
                    ) : filteredClients.length === 0 ? (
                        // Empty State
                        <motion.div variants={itemVariants} className="col-span-full py-32 flex flex-col items-center justify-center text-center">
                            <div className="w-24 h-24 bg-gradient-to-tr from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-[2rem] shadow-xl shadow-energy-500/5 flex items-center justify-center mb-6 border border-white/60 dark:border-white/10">
                                <User size={40} className="text-slate-300 dark:text-slate-600" strokeWidth={1} />
                            </div>
                            <h3 className="text-2xl font-medium text-slate-900 dark:text-white mb-2">No se encontraron clientes</h3>
                            <p className="text-slate-500 dark:text-slate-400 font-light max-w-md">
                                Prueba con otra búsqueda o añade un nuevo cliente a tu cartera.
                            </p>
                        </motion.div>
                    ) : (
                        // Client Cards - Antigravity Style
                        filteredClients.map(client => (
                            <motion.div key={client.id} variants={itemVariants}>
                                <ClientCard client={client} />
                            </motion.div>
                        ))
                    )}
                </motion.div>
            </div>

            <CreateClientModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={refresh}
            />
        </div>
    );
}
