'use client';

import React from 'react';
import { useClientForm } from '@/features/crm/hooks/useClientForm';
import { Client } from '@/types/crm';
import { X, ChevronRight, Check, User, Building2, Zap, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';

interface CreateClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    clientToEdit?: Client | null;
}

export default function CreateClientModal({ isOpen, onClose, onSuccess, clientToEdit }: CreateClientModalProps) {
    const {
        formData,
        step,
        setStep,
        loading,
        error,
        handleChange,
        handleSubmit
    } = useClientForm({ clientToEdit, onSuccess, onClose });

    // Close on escape key
    React.useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const backdropVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.2 } },
        exit: { opacity: 0, transition: { duration: 0.2 } }
    };

    const modalVariants: Variants = {
        hidden: { y: '100%', opacity: 0 },
        visible: { y: '0%', opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 300 } },
        exit: { y: '100%', opacity: 0, transition: { duration: 0.2 } }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        variants={backdropVariants}
                        onClick={onClose}
                    />

                    {/* Modal Content */}
                    <motion.div
                        className="relative w-full max-w-lg bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        variants={modalVariants}
                    >
                        {/* Drag Handle (Mobile only) */}
                        <div className="sm:hidden w-full flex justify-center pt-3 pb-1" onClick={onClose}>
                            <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
                        </div>

                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
                            <div>
                                <h3 className="text-xl font-black text-slate-900">{clientToEdit ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
                                <div className="flex gap-2 mt-1">
                                    <div className={`h-1 w-8 rounded-full transition-colors ${step >= 1 ? 'bg-energy-500' : 'bg-slate-200'}`} />
                                    <div className={`h-1 w-8 rounded-full transition-colors ${step >= 2 ? 'bg-energy-500' : 'bg-slate-200'}`} />
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
                                title="Cerrar modal"
                                aria-label="Cerrar modal"
                            >
                                <X size={18} strokeWidth={2.5} />
                            </button>
                        </div>

                        {/* Error Handling */}
                        {error && (
                            <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm">
                                <AlertTriangle size={18} />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Form */}
                        <div className="overflow-y-auto flex-1 p-6">
                            <form id="create-client-form" onSubmit={handleSubmit} className="space-y-6">
                                {step === 1 ? (
                                    <div className="space-y-5 animate-in slide-in-from-right duration-300">
                                        <div className="grid grid-cols-2 gap-3">
                                            <label className={`cursor-pointer group relative overflow-hidden p-4 rounded-2xl border transition-all ${formData.type === 'particular' ? 'border-energy-500 bg-energy-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                                                <input
                                                    type="radio"
                                                    name="type"
                                                    value="particular"
                                                    checked={formData.type === 'particular'}
                                                    onChange={(e) => handleChange('type', e.target.value)}
                                                    className="sr-only"
                                                />
                                                <div className="flex flex-col items-center gap-2">
                                                    <span className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${formData.type === 'particular' ? 'bg-energy-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                        <User size={20} />
                                                    </span>
                                                    <span className={`text-sm font-bold ${formData.type === 'particular' ? 'text-energy-700' : 'text-slate-500'}`}>Particular</span>
                                                </div>
                                            </label>

                                            <label className={`cursor-pointer group relative overflow-hidden p-4 rounded-2xl border transition-all ${formData.type === 'company' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                                                <input
                                                    type="radio"
                                                    name="type"
                                                    value="company"
                                                    checked={formData.type === 'company'}
                                                    onChange={(e) => handleChange('type', e.target.value)}
                                                    className="sr-only"
                                                />
                                                <div className="flex flex-col items-center gap-2">
                                                    <span className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${formData.type === 'company' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                        <Building2 size={20} />
                                                    </span>
                                                    <span className={`text-sm font-bold ${formData.type === 'company' ? 'text-blue-700' : 'text-slate-500'}`}>Empresa</span>
                                                </div>
                                            </label>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block ml-1">Nombre Completo</label>
                                                <input
                                                    required
                                                    value={formData.name}
                                                    onChange={(e) => handleChange('name', e.target.value)}
                                                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-energy-500 focus:ring-4 focus:ring-energy-500/10 outline-none transition-all font-semibold text-slate-800"
                                                    placeholder="Ej: Juan Pérez"
                                                    autoFocus
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block ml-1">Email</label>
                                                    <div className="relative">
                                                        <input
                                                            type="email"
                                                            value={formData.email}
                                                            onChange={(e) => handleChange('email', e.target.value)}
                                                            className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-energy-500 focus:ring-4 focus:ring-energy-500/10 outline-none transition-all font-medium text-slate-800"
                                                            placeholder="nombre@email.com"
                                                        />
                                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">@</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block ml-1">Teléfono</label>
                                                    <input
                                                        type="tel"
                                                        value={formData.phone}
                                                        onChange={(e) => handleChange('phone', e.target.value)}
                                                        className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-energy-500 focus:ring-4 focus:ring-energy-500/10 outline-none transition-all font-medium text-slate-800"
                                                        placeholder="600 123 456"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block ml-1">Dirección Completa</label>
                                                <input
                                                    value={formData.address}
                                                    onChange={(e) => handleChange('address', e.target.value)}
                                                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-energy-500 focus:ring-4 focus:ring-energy-500/10 outline-none transition-all font-medium text-slate-800"
                                                    placeholder="Calle, Número, Ciudad..."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-5 animate-in slide-in-from-right duration-300">
                                        <div className="bg-energy-50/50 p-4 rounded-2xl border border-energy-100 flex items-start gap-3">
                                            <div className="bg-energy-100 p-2 rounded-lg text-energy-600">
                                                <Zap size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-energy-900 text-sm">Datos del Suministro</h4>
                                                <p className="text-xs text-energy-700/80 mt-0.5">Introduce los datos técnicos para optimizar la oferta.</p>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block ml-1">CUPS (20-22 caracteres)</label>
                                            <input
                                                value={formData.cups}
                                                onChange={(e) => handleChange('cups', e.target.value.toUpperCase())}
                                                className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-energy-500 focus:ring-4 focus:ring-energy-500/10 outline-none transition-all font-mono font-medium text-slate-800 uppercase tracking-wide"
                                                placeholder="ES0021000000000000XX"
                                                maxLength={22}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block ml-1">Comercializadora</label>
                                                <input
                                                    value={formData.current_supplier}
                                                    onChange={(e) => handleChange('current_supplier', e.target.value)}
                                                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-energy-500 focus:ring-4 focus:ring-energy-500/10 outline-none transition-all font-medium text-slate-800"
                                                    placeholder="Ej: Endesa"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block ml-1">Tarifa Acceso</label>
                                                <div className="relative">
                                                    <select
                                                        value={formData.tariff_type}
                                                        onChange={(e) => handleChange('tariff_type', e.target.value)}
                                                        className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-energy-500 focus:ring-4 focus:ring-energy-500/10 outline-none transition-all font-medium text-slate-800 appearance-none"
                                                        title="Seleccionar tarifa de acceso"
                                                        aria-label="Seleccionar tarifa de acceso"
                                                    >
                                                        <option value="2.0TD">2.0TD</option>
                                                        <option value="3.0TD">3.0TD</option>
                                                        <option value="6.1TD">6.1TD</option>
                                                    </select>
                                                    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" size={16} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>

                        {/* Footer / Actions */}
                        <div className="p-4 bg-white border-t border-slate-100 flex gap-3">
                            {step === 2 ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="flex-1 px-4 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all"
                                    >
                                        Atrás
                                    </button>
                                    <button
                                        form="create-client-form"
                                        type="submit"
                                        disabled={loading}
                                        className="flex-[2] px-4 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-lg shadow-slate-900/20 active:scale-95 transition-all text-base flex justify-center items-center gap-2"
                                    >
                                        {loading ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <span>{clientToEdit ? 'Guardar Cambios' : 'Crear Cliente'}</span>
                                                <Check size={18} strokeWidth={3} />
                                            </>
                                        )}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="flex-1 px-4 py-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStep(2)}
                                        className="flex-[2] px-4 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-lg shadow-slate-900/20 active:scale-95 transition-all text-base flex justify-center items-center gap-2"
                                    >
                                        <span>Siguiente</span>
                                        <ChevronRight size={18} strokeWidth={3} />
                                    </button>
                                </>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
