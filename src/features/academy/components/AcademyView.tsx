'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { crmService } from '@/services/crmService';
import {
    BookOpen,
    Download,
    FileText,
    Video,
    ExternalLink,
    Lock,
    Search,
    Layers,
    CheckCircle2,
    Circle,
    GraduationCap,
    ChevronDown,
    ChevronUp,
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

const ONBOARDING_STEPS = [
    { id: 'profile', label: 'Completa tu perfil de agente' },
    { id: 'first_client', label: 'Añade tu primer cliente' },
    { id: 'first_simulation', label: 'Realiza tu primera simulación' },
    { id: 'first_proposal', label: 'Envía tu primera propuesta' },
    { id: 'first_resource', label: 'Descarga un recurso de la Academia' },
];

const VIEWED_KEY = 'academy_viewed';
const ONBOARDING_KEY = 'academy_onboarding';

function getViewed(): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
        return new Set(JSON.parse(localStorage.getItem(VIEWED_KEY) ?? '[]'));
    } catch {
        return new Set();
    }
}

function saveViewed(ids: Set<string>) {
    localStorage.setItem(VIEWED_KEY, JSON.stringify([...ids]));
}

function getOnboarding(): Record<string, boolean> {
    if (typeof window === 'undefined') return {};
    try {
        return JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? '{}');
    } catch {
        return {};
    }
}

function saveOnboarding(state: Record<string, boolean>) {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state));
}

function OnboardingChecklist() {
    const [checked, setChecked] = useState<Record<string, boolean>>(() => getOnboarding());
    const [open, setOpen] = useState(false);

    const done = Object.values(checked).filter(Boolean).length;
    const allDone = done === ONBOARDING_STEPS.length;

    const toggle = (id: string) => {
        const next = { ...checked, [id]: !checked[id] };
        setChecked(next);
        saveOnboarding(next);
    };

    if (allDone && !open) {
        return (
            <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-sm font-semibold">
                <CheckCircle2 size={16} className="text-emerald-500" />
                Onboarding completado — eres un agente Zinergia listo para vender
            </div>
        );
    }

    return (
        <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl overflow-hidden shadow-sm">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center">
                        <GraduationCap size={15} className="text-indigo-600" />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-bold text-slate-800">Checklist de inicio</p>
                        <p className="text-xs text-slate-400">{done}/{ONBOARDING_STEPS.length} pasos completados</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-indigo-500 rounded-full transition-all [width:var(--bar-w)]"
                            style={{ '--bar-w': `${(done / ONBOARDING_STEPS.length) * 100}%` } as React.CSSProperties}
                        />
                    </div>
                    {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 pb-4 space-y-2 border-t border-slate-100">
                            {ONBOARDING_STEPS.map(step => (
                                <button
                                    key={step.id}
                                    type="button"
                                    onClick={() => toggle(step.id)}
                                    className="w-full flex items-center gap-3 py-2.5 text-left group"
                                >
                                    {checked[step.id]
                                        ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                        : <Circle size={16} className="text-slate-300 group-hover:text-indigo-400 shrink-0 transition-colors" />
                                    }
                                    <span className={`text-sm transition-colors ${checked[step.id] ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                        {step.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export const AcademyView: React.FC = () => {
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [viewed, setViewed] = useState<Set<string>>(new Set());

    useEffect(() => {
        setViewed(getViewed());
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
        { id: 'marketing', label: 'Marketing', icon: ExternalLink },
    ];

    const filteredResources = useMemo(() =>
        resources.filter(res => {
            const matchesSearch =
                res.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                res.description?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = activeCategory === 'all' || res.category === activeCategory;
            return matchesSearch && matchesCategory;
        }),
        [resources, searchTerm, activeCategory]
    );

    const viewedCount = useMemo(() => resources.filter(r => viewed.has(r.id)).length, [resources, viewed]);

    const handleDownload = (id: string) => {
        const next = new Set(viewed).add(id);
        setViewed(next);
        saveViewed(next);
    };

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
        <div className="p-6 md:p-8 max-w-7xl mx-auto font-sans space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-widest flex items-center gap-1.5">
                            <BookOpen size={12} />
                            Recursos
                        </span>
                        {resources.length > 0 && (
                            <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                                {viewedCount}/{resources.length} vistos
                            </span>
                        )}
                    </div>
                    <h1 className="text-4xl font-medium text-slate-900 tracking-tight leading-none">
                        Zinergia Academy<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">.</span>
                    </h1>
                    <p className="text-slate-500 mt-4 max-w-lg font-light">
                        Centro de formación y recursos para tu crecimiento en Zinergia.
                    </p>
                </div>

                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar recursos..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full md:w-80 bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none shadow-sm"
                    />
                </div>
            </div>

            {/* Onboarding checklist */}
            <OnboardingChecklist />

            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar snap-x">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        type="button"
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
            {filteredResources.length === 0 ? (
                <div className="py-20 text-center">
                    {resources.length === 0 ? (
                        <div className="max-w-sm mx-auto">
                            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <GraduationCap size={28} className="text-indigo-400" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Academia en construcción</h3>
                            <p className="text-slate-500 text-sm">El equipo Zinergia está preparando los primeros materiales formativos. Vuelve pronto.</p>
                        </div>
                    ) : (
                        <p className="text-slate-500 font-light">No se encontraron recursos para tu búsqueda.</p>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                        {filteredResources.map(res => (
                            <motion.div
                                layout
                                key={res.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="group bg-white/70 backdrop-blur-xl border border-white/60 rounded-[2.5rem] p-8 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-500 flex flex-col justify-between relative"
                            >
                                {viewed.has(res.id) && (
                                    <div className="absolute top-5 right-5">
                                        <CheckCircle2 size={16} className="text-emerald-400" />
                                    </div>
                                )}

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
                                    onClick={() => handleDownload(res.id)}
                                    className="w-full py-4 bg-slate-50 hover:bg-indigo-50 text-slate-900 hover:text-indigo-600 rounded-2xl font-medium transition-all flex items-center justify-center gap-2 border border-slate-100 hover:border-indigo-100"
                                >
                                    <Download size={18} />
                                    {viewed.has(res.id) ? 'Descargar de nuevo' : 'Descargar recurso'}
                                </a>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};
