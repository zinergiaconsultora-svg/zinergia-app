'use client';

import React, { useState } from 'react';
import { Offer, TariffPrice } from '@/types/crm';
import { X, Save, Check, ArrowDown } from 'lucide-react';
import { motion } from 'framer-motion';

interface TariffFormProps {
    isOpen: boolean;
    initialData?: Offer | null;
    onClose: () => void;
    onSave: (offer: Partial<Offer> & { type?: 'fixed' | 'indexed' }) => Promise<void>;
}

const COLORS = [
    'bg-blue-600', 'bg-blue-500', 'bg-sky-500',
    'bg-indigo-600', 'bg-violet-600', 'bg-purple-600',
    'bg-emerald-500', 'bg-green-600', 'bg-lime-600',
    'bg-amber-500', 'bg-orange-500', 'bg-red-500',
    'bg-rose-600', 'bg-pink-600', 'bg-slate-800'
];

export default function TariffForm({ isOpen, initialData, onClose, onSave }: TariffFormProps) {
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<Offer> & { type?: 'fixed' | 'indexed' }>(
        initialData ? {
            ...initialData,
            type: (initialData as any).type || 'fixed' // Safe fallback
        } : {
            marketer_name: '',
            tariff_name: '',
            contract_duration: '12 meses',
            logo_color: 'bg-blue-600',
            power_price: { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 },
            energy_price: { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 },
            fixed_fee: 0,
            type: 'fixed'
        }
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            console.error('Failed to save tariff:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePriceChange = (
        type: 'power_price' | 'energy_price',
        period: keyof TariffPrice,
        value: string
    ) => {
        const numValue = parseFloat(value) || 0;
        setFormData(prev => ({
            ...prev,
            [type]: {
                ...prev[type]!,
                [period]: numValue
            }
        }));
    };

    const copyP1ToAll = (type: 'power_price' | 'energy_price') => {
        const p1Value = formData[type]?.p1 || 0;
        setFormData(prev => ({
            ...prev,
            [type]: {
                p1: p1Value,
                p2: p1Value,
                p3: p1Value,
                p4: p1Value,
                p5: p1Value,
                p6: p1Value
            }
        }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                onClick={onClose}
            />

            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden"
            >
                <form onSubmit={handleSubmit} className="p-8">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-2xl font-semibold text-slate-900">
                                {initialData ? 'Editar Tarifa' : 'Nueva Tarifa'}
                            </h2>
                            <p className="text-slate-500 text-sm mt-1">Define los precios de potencia y energía.</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                            title="Cerrar"
                            aria-label="Cerrar modal"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        {/* LEFT COLUMN: Basic Info */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Información General</h3>

                            <div className="bg-slate-50 p-1 rounded-xl flex gap-1 mb-4">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'fixed' })}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${formData.type === 'fixed'
                                        ? 'bg-white text-indigo-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    Precio Fijo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'indexed' })}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${formData.type === 'indexed'
                                        ? 'bg-white text-indigo-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    Indexado (Pass-through)
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Comercializadora</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="Ej: Naturgy"
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none font-medium"
                                        value={formData.marketer_name}
                                        onChange={e => setFormData({ ...formData, marketer_name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Nombre Tarifa</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="Ej: Tarifa Compromiso 2.0"
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none font-medium"
                                        value={formData.tariff_name}
                                        onChange={e => setFormData({ ...formData, tariff_name: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Duración</label>
                                        <input
                                            type="text"
                                            placeholder="12 meses"
                                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none font-medium text-sm"
                                            value={formData.contract_duration}
                                            onChange={e => setFormData({ ...formData, contract_duration: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Fee Fijo (€/mes)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none font-medium text-sm"
                                            value={formData.fixed_fee || 0}
                                            onChange={e => setFormData({ ...formData, fixed_fee: parseFloat(e.target.value) })}
                                            title="Coste fijo mensual"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Color Distintivo</label>
                                    <div className="flex flex-wrap gap-2">
                                        {COLORS.map(color => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, logo_color: color })}
                                                className={`w-8 h-8 rounded-full ${color} transition-all ${formData.logo_color === color
                                                    ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110 shadow-lg'
                                                    : 'hover:scale-110 opacity-70 hover:opacity-100'
                                                    }`}
                                                title={`Seleccionar color ${color.replace('bg-', '')}`}
                                                aria-label={`Seleccionar color ${color.replace('bg-', '')}`}
                                            >
                                                {formData.logo_color === color && (
                                                    <Check className="w-4 h-4 text-white mx-auto" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Prices */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Tabla de Precios</h3>

                            <div className="bg-slate-50/50 rounded-2xl border border-slate-200 overflow-hidden">
                                <div className="grid grid-cols-3 gap-0 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 bg-slate-100/50">
                                    <div className="p-3 text-center">Periodo</div>
                                    <div className="p-2 text-center text-indigo-600 flex flex-col items-center gap-1">
                                        <span>Potencia</span>
                                        <button
                                            type="button"
                                            onClick={() => copyP1ToAll('power_price')}
                                            className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full hover:bg-indigo-100 flex items-center gap-1"
                                            title="Copiar P1 a todos"
                                        >
                                            <ArrowDown size={10} /> Copiar
                                        </button>
                                    </div>
                                    <div className="p-2 text-center text-emerald-600 flex flex-col items-center gap-1">
                                        <span>Energía</span>
                                        <button
                                            type="button"
                                            onClick={() => copyP1ToAll('energy_price')}
                                            className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full hover:bg-emerald-100 flex items-center gap-1"
                                            title="Copiar P1 a todos"
                                        >
                                            <ArrowDown size={10} /> Copiar
                                        </button>
                                    </div>
                                </div>
                                {['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((period) => (
                                    <div key={period} className="grid grid-cols-3 gap-0 border-b border-slate-100 last:border-0 hover:bg-white transition-colors group">
                                        <div className="p-3 flex items-center justify-center font-bold text-slate-400 bg-slate-50/50 text-xs">
                                            {period.toUpperCase()}
                                        </div>
                                        <div className="p-2 border-l border-slate-100 relative">
                                            <input
                                                type="number"
                                                step="0.000001"
                                                className="w-full h-8 text-center bg-transparent focus:bg-indigo-50/50 rounded-lg text-sm font-semibold text-slate-700 outline-none transition-all placeholder:text-slate-300"
                                                placeholder="0.000000"
                                                value={formData.power_price?.[period as keyof TariffPrice] || ''}
                                                onChange={e => handlePriceChange('power_price', period as keyof TariffPrice, e.target.value)}
                                                title={`Precio Potencia ${period.toUpperCase()}`}
                                            />
                                        </div>
                                        <div className="p-2 border-l border-slate-100 relative">
                                            <input
                                                type="number"
                                                step="0.000001"
                                                className="w-full h-8 text-center bg-transparent focus:bg-emerald-50/50 rounded-lg text-sm font-semibold text-slate-700 outline-none transition-all placeholder:text-slate-300"
                                                placeholder="0.000000"
                                                value={formData.energy_price?.[period as keyof TariffPrice] || ''}
                                                onChange={e => handlePriceChange('energy_price', period as keyof TariffPrice, e.target.value)}
                                                title={`Precio Energía ${period.toUpperCase()}`}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-8 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Save size={18} />
                            )}
                            {initialData ? 'Guardar Cambios' : 'Crear Tarifa'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
