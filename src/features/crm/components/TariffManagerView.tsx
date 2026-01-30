'use client';

import React, { useEffect, useState, useMemo } from 'react';
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
    Upload,
    LayoutGrid,
    Table as TableIcon,
    Filter,
    X,
    FileText,
    TrendingUp,
    MousePointer2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TariffForm from './TariffForm';

/**
 * Enhanced Tariff Manager View 2.0
 * "Master-Detail" Design Pattern
 */
export default function TariffManagerView() {
    const router = useRouter();
    const [offers, setOffers] = useState<Offer[]>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [selectedMarketer, setSelectedMarketer] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    // Selection State (for Right Panel)
    const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null); // For 2-step delete

    // Modal State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formOffer, setFormOffer] = useState<Offer | null>(null); // Offer being edited in modal
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Initial Load
    useEffect(() => {
        loadOffers();
    }, []);

    async function loadOffers() {
        try {
            setLoading(true);
            const data = await crmService.getOffers();
            setOffers(data);
        } catch (error) {
            console.error('Error loading offers', error);
        } finally {
            setLoading(false);
        }
    }

    // --- Derived State ---
    const marketers = useMemo(() => {
        const counts: Record<string, number> = {};
        offers.forEach(o => {
            const m = o.marketer_name || 'Otras';
            counts[m] = (counts[m] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
    }, [offers]);

    const filteredOffers = useMemo(() => {
        return offers.filter(offer => {
            const matchesSearch =
                offer.tariff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                offer.marketer_name.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesMarketer = selectedMarketer === 'ALL' || offer.marketer_name === selectedMarketer;

            return matchesSearch && matchesMarketer;
        });
    }, [offers, searchTerm, selectedMarketer]);

    const activeOffer = useMemo(() =>
        offers.find(o => o.id === selectedOfferId) || null,
        [offers, selectedOfferId]);

    // --- Handlers ---
    const handleCreate = () => {
        setFormOffer(null);
        setIsFormOpen(true);
    };

    const handleEdit = (offer: Offer) => {
        setFormOffer(offer);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();

        console.log('Intentando borrar tarifa:', id);

        // Use 2-step confirmation logic
        if (deleteConfirmId !== id) {
            setDeleteConfirmId(id);
            // Auto-reset after 3 seconds
            setTimeout(() => setDeleteConfirmId(null), 3000);
            return;
        }

        try {
            setLoading(true);
            await crmService.deleteOffer(id);
            setDeleteConfirmId(null);
            setSelectedOfferId(null);
            await loadOffers();
        } catch (error: unknown) {
            console.error('Error deleting', error);
            const message = error instanceof Error ? error.message : 'Error desconocido';
            alert(`❌ ERROR: No se pudo eliminar. Detalles: ${message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (offer: Partial<Offer>) => {
        try {
            await crmService.saveOffer(offer);
            await loadOffers();
            setIsFormOpen(false);
        } catch (error) {
            console.error('Error saving', error);
            alert('Error al guardar');
        }
    };

    // CSV parsing helper
    const parseNumber = (val: string | undefined): number => {
        if (!val) return 0;
        const normalized = val.toString().trim().replace(',', '.');
        const parsed = parseFloat(normalized);
        return isNaN(parsed) ? 0 : parsed;
    };

    const handleCsvImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const text = await file.text();
            const lines = text.trim().split('\n');
            if (lines.length < 2) throw new Error('CSV vacío');

            const headers = lines[0].split(',').map(h => h.trim());
            let imported = 0;

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                if (values.length < 9) continue;

                const row: Record<string, string> = {};
                headers.forEach((header, idx) => {
                    row[header] = values[idx] || '';
                });

                const newOffer: Partial<Offer> = {
                    marketer_name: row['COMPAÑIA'] || row['COMPANIA'] || '',
                    tariff_name: row['TARIFA'] || '',
                    logo_color: 'bg-slate-800',
                    type: 'fixed',
                    power_price: {
                        p1: parseNumber(row['PRECIO_POTENCIA_P1']),
                        p2: parseNumber(row['PRECIO_POTENCIA_P2']),
                        p3: parseNumber(row['PRECIO_POTENCIA_P3']),
                        p4: 0, p5: 0, p6: 0,
                    },
                    energy_price: {
                        p1: parseNumber(row['PRECIO_ENERGIA_P1']),
                        p2: parseNumber(row['PRECIO_ENERGIA_P2']),
                        p3: parseNumber(row['PRECIO_ENERGIA_P3']),
                        p4: 0, p5: 0, p6: 0,
                    },
                    fixed_fee: parseNumber(row['DERECHOS_ENGANCHE']),
                    contract_duration: '12 meses',
                };
                await crmService.saveOffer(newOffer);
                imported++;
            }
            alert(`✅ Importadas ${imported} tarifas correctamente`);
            loadOffers();
        } catch (error) {
            console.error('Error importing CSV:', error);
            alert('❌ Error al importar CSV');
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="h-screen bg-[#F8F9FC] font-sans text-slate-900 flex overflow-hidden">
            <AnimatePresence>
                {isFormOpen && (
                    <TariffForm
                        isOpen={isFormOpen}
                        initialData={formOffer}
                        onClose={() => setIsFormOpen(false)}
                        onSave={handleSave}
                    />
                )}
            </AnimatePresence>

            {/* --- PANEL 1: SIDEBAR (Filters) 250px --- */}
            <aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-20 shrink-0">
                <div className="p-5 border-b border-slate-100 flex items-center gap-3">
                    <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl p-2.5 text-white shadow-lg shadow-indigo-200 shrink-0">
                        <Zap size={18} fill="currentColor" />
                    </div>
                    <div>
                        <h1 className="font-bold text-[15px] tracking-tight text-slate-900">Gestor Tarifas</h1>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">v2.0 Master</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
                    <button
                        onClick={() => router.back()}
                        className="w-full flex items-center gap-2 text-slate-400 hover:text-slate-800 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors text-xs font-semibold mb-4"
                    >
                        <ChevronLeft size={14} />
                        Volver
                    </button>

                    <div className="px-2 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtros de Mercado</div>

                    <button
                        onClick={() => setSelectedMarketer('ALL')}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${selectedMarketer === 'ALL'
                            ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100'
                            : 'text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        <div className="flex items-center gap-2.5">
                            <Filter size={14} className={selectedMarketer === 'ALL' ? 'text-indigo-500' : 'text-slate-400'} />
                            <span>Mostrar Todo</span>
                        </div>
                        <span className="bg-white/80 px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-100/50 text-slate-500">
                            {offers.length}
                        </span>
                    </button>

                    <div className="h-px bg-slate-100 my-2 mx-2" />

                    {marketers.map(([name, count]) => (
                        <button
                            key={name}
                            onClick={() => setSelectedMarketer(name)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group ${selectedMarketer === name
                                ? 'bg-indigo-50/50 text-indigo-700 font-semibold'
                                : 'text-slate-500 hover:bg-slate-50 border border-transparent'
                                }`}
                        >
                            <div className="flex items-center gap-2.5 truncate">
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedMarketer === name ? 'bg-indigo-500' : 'bg-slate-300 group-hover:bg-indigo-300'
                                    }`} />
                                <span className="truncate max-w-[140px]">{name}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-normal">
                                {count}
                            </span>
                        </button>
                    ))}
                </div>
            </aside>

            {/* --- PANEL 2: MAIN LIST (Master) --- */}
            <main className="flex-1 flex flex-col bg-[#F8F9FC] border-r border-slate-200 min-w-[400px]">
                {/* Search Header */}
                <div className="h-16 px-6 border-b border-slate-200 bg-white/50 backdrop-blur-sm flex items-center justify-between shrink-0 gap-4">
                    <div className="relative flex-1 max-w-lg">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm transition-all focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none shadow-sm placeholder:text-slate-400"
                        />
                    </div>
                    <div className="flex gap-2 shrink-0">
                        {/* View Toggles & Actions */}
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                aria-label="Vista cuadrícula"
                            >
                                <LayoutGrid size={14} />
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                className={`p-1.5 rounded transition-all ${viewMode === 'table' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                aria-label="Vista tabla"
                            >
                                <TableIcon size={14} />
                            </button>
                        </div>
                        <button
                            onClick={handleCreate}
                            className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10"
                            aria-label="Nueva Tarifa"
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                </div>

                {/* List Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center p-10"><div className="w-6 h-6 border-2 border-indigo-500 rounded-full animate-spin border-t-transparent" /></div>
                    ) : (
                        <div className={viewMode === 'grid' ? "grid grid-cols-1 xl:grid-cols-2 gap-4" : "space-y-2"}>
                            {filteredOffers.map(offer => (
                                <motion.div
                                    key={offer.id}
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    onClick={() => setSelectedOfferId(offer.id === selectedOfferId ? null : offer.id)}
                                    className={`
                                        group relative rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md
                                        ${selectedOfferId === offer.id
                                            ? 'bg-white border-indigo-500 ring-1 ring-indigo-500 shadow-md z-10'
                                            : 'bg-white border-slate-200 hover:border-indigo-300'
                                        }
                                    `}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shadow-sm ${offer.logo_color || 'bg-slate-800'}`}>
                                                {offer.marketer_name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className={`text-[11px] font-bold leading-tight ${selectedOfferId === offer.id ? 'text-indigo-900' : 'text-slate-900'}`}>{offer.tariff_name}</h3>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] text-slate-500">{offer.marketer_name}</span>
                                                    {offer.type === 'indexed'
                                                        ? <span className="w-1.5 h-1.5 rounded-full bg-purple-500 ring-2 ring-purple-100" />
                                                        : <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mini Specs */}
                                    <div className="grid grid-cols-3 gap-px bg-slate-100 rounded-lg border border-slate-100 overflow-hidden">
                                        <div className="bg-slate-50 p-2 text-center group-hover:bg-white transition-colors">
                                            <div className="text-[9px] text-slate-400 font-bold uppercase">P1</div>
                                            <div className="text-[10px] font-mono font-medium text-slate-700">{Number(offer.energy_price?.p1).toFixed(4)}</div>
                                        </div>
                                        <div className="bg-slate-50 p-2 text-center group-hover:bg-white transition-colors">
                                            <div className="text-[9px] text-slate-400 font-bold uppercase">P2</div>
                                            <div className="text-[10px] font-mono font-medium text-slate-700">{Number(offer.energy_price?.p2).toFixed(4)}</div>
                                        </div>
                                        <div className="bg-slate-50 p-2 text-center group-hover:bg-white transition-colors">
                                            <div className="text-[9px] text-slate-400 font-bold uppercase">P3</div>
                                            <div className="text-[10px] font-mono font-medium text-slate-700">{Number(offer.energy_price?.p3).toFixed(4)}</div>
                                        </div>
                                    </div>
                                    {/* Action Footer for Card */}
                                    <div className="mt-3 flex justify-end">
                                        <button
                                            onClick={(e) => handleDelete(offer.id, e)}
                                            className={`p-1.5 rounded transition-colors ${deleteConfirmId === offer.id ? 'bg-rose-600 text-white' : 'text-slate-300 hover:text-rose-500 hover:bg-rose-50'}`}
                                            title="Eliminar"
                                            aria-label={deleteConfirmId === offer.id ? "Confirmar borrado" : "Eliminar tarifa"}
                                        >
                                            {deleteConfirmId === offer.id ? <span className="text-[9px] font-bold px-1">¿Borrar?</span> : <Trash2 size={14} />}
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* --- PANEL 3: INSPECTOR (Detail) 350px+ --- */}
            <aside className="w-[400px] bg-white border-l border-slate-200 flex flex-col z-10 shadow-xl shadow-slate-200/50">
                {activeOffer ? (
                    <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
                        {/* Detail Header */}
                        <div className="h-48 bg-slate-50 border-b border-slate-200 p-6 flex flex-col items-center justify-center text-center relative shrink-0">
                            <button
                                onClick={() => setSelectedOfferId(null)}
                                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/50 transition-colors"
                                aria-label="Cerrar detalles"
                            >
                                <X size={18} />
                            </button>
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg mb-4 ${activeOffer.logo_color || 'bg-slate-800'}`}>
                                {activeOffer.marketer_name.substring(0, 2).toUpperCase()}
                            </div>
                            <h2 className="text-base font-bold text-slate-900 leading-tight">{activeOffer.tariff_name}</h2>
                            <span className="text-sm font-medium text-slate-500 mt-1">{activeOffer.marketer_name}</span>

                            <div className="absolute bottom-4 left-6 flex gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border bg-white ${activeOffer.type === 'indexed'
                                    ? 'text-purple-600 border-purple-200'
                                    : 'text-emerald-600 border-emerald-200'
                                    }`}>
                                    {activeOffer.type === 'indexed' ? 'Indexado' : 'Fijo'}
                                </span>
                            </div>
                        </div>

                        {/* Detail Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                            {/* Prices Card */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    <TrendingUp size={14} />
                                    <span>Precios Energía</span>
                                </div>
                                <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                                    {[1, 2, 3, 4, 5, 6].map(p => {
                                        const key = `p${p}` as keyof typeof activeOffer.energy_price;
                                        const val = activeOffer.energy_price?.[key];
                                        return (
                                            <div key={p} className="flex justify-between items-center p-3 text-sm">
                                                <span className="font-semibold text-slate-600">Periodo {p}</span>
                                                <span className="font-mono font-medium text-slate-900">{Number(val || 0).toFixed(6)} €</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Power Prices Card */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    <Zap size={14} />
                                    <span>Precios Potencia</span>
                                </div>
                                <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                                    {[1, 2, 3, 4, 5, 6].map(p => {
                                        const key = `p${p}` as keyof typeof activeOffer.power_price;
                                        const val = activeOffer.power_price?.[key];
                                        return (
                                            <div key={p} className="flex justify-between items-center p-3 text-sm">
                                                <span className="font-semibold text-slate-600">Periodo {p}</span>
                                                <span className="font-mono font-medium text-slate-900">{Number(val || 0).toFixed(6)} €</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Meta Card */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    <FileText size={14} />
                                    <span>Condiciones</span>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">Permanencia</span>
                                        <span className="font-semibold text-slate-900">{activeOffer.contract_duration}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">Fijo Mensual</span>
                                        <span className="font-semibold text-slate-900">{activeOffer.fixed_fee ? `${activeOffer.fixed_fee} €` : '-'}</span>
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Detail Footer Actions */}
                        <div className="p-6 border-t border-slate-200 bg-white flex gap-3 shrink-0 pb-10">
                            <button
                                onClick={() => handleEdit(activeOffer)}
                                className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 border border-indigo-200"
                            >
                                <Edit3 size={16} />
                                Editar Tarifa
                            </button>
                            <button
                                onClick={(e) => handleDelete(activeOffer.id, e)}
                                className={`
                                    min-w-[48px] px-3 rounded-xl flex items-center justify-center transition-all border
                                    ${deleteConfirmId === activeOffer.id
                                        ? 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700 w-auto'
                                        : 'bg-white hover:bg-rose-50 text-slate-300 hover:text-rose-600 border-slate-200 hover:border-rose-200 w-12'
                                    }
                                `}
                                aria-label="Eliminar Tarifa"
                            >
                                {deleteConfirmId === activeOffer.id ? (
                                    <span className="text-xs font-bold whitespace-nowrap">¿Confirmar?</span>
                                ) : (
                                    <Trash2 size={18} />
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* EMPTY STATE for Right Panel */
                    <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-slate-50/50">
                        <div className="w-16 h-16 bg-white rounded-full shadow-sm border border-slate-100 flex items-center justify-center mb-4">
                            <MousePointer2 size={32} className="text-slate-300" />
                        </div>
                        <h3 className="text-slate-900 font-bold text-lg mb-2">Selecciona una Tarifa</h3>
                        <p className="text-slate-500 text-sm max-w-[200px]">Haz clic en cualquier tarifa de la lista para ver sus detalles completos, editarla o eliminarla.</p>

                        <div className="mt-8 pt-8 border-t border-slate-200 w-full">
                            <div className="bg-indigo-50 rounded-xl p-4 text-left">
                                <h4 className="text-indigo-900 font-bold text-xs uppercase mb-2 flex items-center gap-2">
                                    <Upload size={12} />
                                    Importación Rápida
                                </h4>
                                <p className="text-indigo-700/80 text-xs mb-3">Puedes importar múltiples tarifas usando un archivo CSV.</p>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept=".csv"
                                    className="hidden"
                                    onChange={handleCsvImport}
                                    aria-label="Subir archivo CSV de tarifas"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-xs font-bold transition-colors"
                                >
                                    {isImporting ? 'Importando...' : 'Subir CSV'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </aside>
        </div>
    );
}
