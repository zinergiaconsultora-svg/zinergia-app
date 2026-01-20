'use client';

import React, { useEffect, useState } from 'react';
import { crmService } from '@/services/crmService';
import {
    BookOpen,
    Download,
    FileText,
    Video,
    ExternalLink,
    Lock,
    Search,
    Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Resource {
    id: string;
    title: string;
    description: string;
    category: string;
    file_url: string;
    file_type: string;
    role_restriction: string;
    created_at: string;
}

export const AcademyView: React.FC = () => {
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('all');

    useEffect(() => {
        async function loadResources() {
            try {
                const data = await crmService.getAcademyResources();
                setResources(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        loadResources();
    }, []);

    const categories = [
        { id: 'all', label: 'Todos', icon: Layers },
        { id: 'training', label: 'Formación', icon: Video },
        { id: 'contract', label: 'Contratos', icon: FileText },
        { id: 'marketing', label: 'Marketing', icon: ExternalLink }
    ];

    const filteredResources = resources.filter(res => {
        const matchesSearch = res.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            res.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = activeCategory === 'all' || res.category === activeCategory;
        return matchesSearch && matchesCategory;
    });

    const getIcon = (type: string) => {
        switch (type) {
            case 'video': return <Video size={20} />;
            case 'pdf': return <FileText size={20} />;
            default: return <ExternalLink size={20} />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-widest flex items-center gap-1.5">
                            <BookOpen size={12} />
                            Recursos
                        </span>
                    </div>
                    <h1 className="text-4xl font-medium text-slate-900 tracking-tight leading-none">
                        Zinergia Academy<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">.</span>
                    </h1>
                    <p className="text-slate-500 mt-4 max-w-lg font-light">
                        Bienvenido al centro de formación y recursos. Aquí encontrarás todo el material necesario para tu crecimiento en la red Nexus.
                    </p>
                </div>

                <div className="flex flex-col gap-4 w-full md:w-auto">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar recursos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full md:w-80 bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar snap-x">
                {categories.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all flex-shrink-0 border whitespace-nowrap snap-center ${activeCategory === cat.id
                            ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20'
                            : 'bg-white text-slate-600 border-slate-100 hover:border-indigo-200'
                            }`}
                    >
                        <cat.icon size={18} />
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Resource Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                    {filteredResources.map((res) => (
                        <motion.div
                            layout
                            key={res.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="group bg-white/70 backdrop-blur-xl border border-white/60 rounded-[2.5rem] p-8 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-500 flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex justify-between items-start mb-6">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border border-white/50 ${res.category === 'training' ? 'bg-amber-50 text-amber-600' :
                                        res.category === 'contract' ? 'bg-indigo-50 text-indigo-600' :
                                            'bg-emerald-50 text-emerald-600'
                                        }`}>
                                        {getIcon(res.file_type)}
                                    </div>
                                    {res.role_restriction !== 'agent' && (
                                        <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                            <Lock size={12} />
                                            {res.role_restriction}
                                        </span>
                                    )}
                                </div>

                                <h3 className="text-xl font-medium text-slate-900 mb-3 group-hover:text-indigo-600 transition-colors">
                                    {res.title}
                                </h3>
                                <p className="text-slate-500 font-light text-sm mb-6 line-clamp-2">
                                    {res.description}
                                </p>
                            </div>

                            <a
                                href={res.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-4 bg-slate-50 hover:bg-indigo-50 text-slate-900 hover:text-indigo-600 rounded-2xl font-medium transition-all flex items-center justify-center gap-2 border border-slate-100 hover:border-indigo-100"
                            >
                                <Download size={18} />
                                Descargar Recurso
                            </a>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {filteredResources.length === 0 && (
                <div className="py-20 text-center">
                    <p className="text-slate-500 font-light">No se encontraron recursos que coincidan con tu búsqueda.</p>
                </div>
            )}
        </div>
    );
};
