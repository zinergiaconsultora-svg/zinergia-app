'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Upload, FileText, Building2, Info, TrendingUp } from 'lucide-react';
import { DashboardCard } from '../DashboardCard';

interface ProfileSettings {
    companyName: string;
    nif: string;
    address: string;
    defaultMargin: number;
    defaultVat: number;
    logoUrl: string | null;
}

interface SettingsProfileTabProps {
    settings: ProfileSettings;
    loading: boolean;
    saveSuccess: boolean;
    handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function SettingsProfileTab({
    settings,
    loading,
    handleFileUpload,
}: SettingsProfileTabProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid grid-cols-1 md:grid-cols-12 gap-6"
        >
            {/* LEFT COLUMN: CONTEXT */}
            <div className="col-span-1 md:col-span-4 space-y-6">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-sm text-blue-800 shadow-sm">
                    <p className="font-bold flex items-center gap-2 mb-3 text-base">
                        <Shield size={18} />
                        Identidad Verificada
                    </p>
                    <p className="opacity-90 leading-relaxed mb-4">
                        Para operar con la Central y emitir facturas, necesitamos validar tu identidad fiscal.
                    </p>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-blue-700/80">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <span>Sube tu CIF o Modelo 036</span>
                        </div>
                        <div className="flex items-center gap-2 text-blue-700/80">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <span>DNI del Administrador</span>
                        </div>
                        <div className="flex items-center gap-2 text-blue-700/80">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <span>Escrituras (si aplica)</span>
                        </div>
                    </div>
                </div>

                <DashboardCard
                    title="Estado de Validación"
                    icon={Shield}
                    className="h-auto"
                >
                    <div className="mt-2 flex flex-col items-center text-center p-2">
                        <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-3">
                            <Info size={32} />
                        </div>
                        <p className="font-bold text-slate-800">Pendiente de Documentación</p>
                        <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
                            Sube los archivos requeridos para activar tu *Wallet* de comisiones.
                        </p>
                    </div>
                </DashboardCard>
            </div>

            {/* RIGHT COLUMN: DOCUMENT UPLOAD */}
            <div className="col-span-1 md:col-span-8 space-y-6">
                <DashboardCard
                    title="Documentación Fiscal"
                    icon={FileText}
                    subtitle="Sube tus archivos para extracción automática de datos"
                    className="h-auto"
                >
                    <div className="space-y-6 mt-2">
                        {/* UPLOAD ZONE */}
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 bg-slate-50/50 hover:bg-white hover:border-energy-400 hover:shadow-lg hover:shadow-energy-500/10 transition-all cursor-pointer group flex flex-col items-center justify-center text-center">
                            <div className="w-20 h-20 rounded-full bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                <Upload size={32} className="text-slate-400 group-hover:text-energy-600 transition-colors" />
                            </div>
                            <h4 className="text-lg font-bold text-slate-700 mb-1 group-hover:text-energy-700 transition-colors">
                                Arrastra tus documentos aquí
                            </h4>
                            <p className="text-sm text-slate-400 mb-6 max-w-sm">
                                Aceptamos PDF, JPG o PNG. Nuestro sistema procesará la imagen para extraer Razón Social, NIF y Dirección automáticamente.
                            </p>
                            <button type="button" className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-900/20 group-hover:bg-energy-600 group-hover:shadow-energy-600/30 transition-all">
                                Seleccionar Archivos
                            </button>
                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    title="Elegir archivo"
                                    aria-label="Subir documento para extracción de datos"
                                />
                                <button type="button" className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-900/20 group-hover:bg-energy-600 group-hover:shadow-energy-600/30 transition-all pointer-events-none">
                                    {loading ? 'Procesando...' : 'Seleccionar Archivos'}
                                </button>
                            </div>
                        </div>

                        {/* EXTRACTED DATA PREVIEW */}
                        {settings.nif !== 'B12345678' && (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-4">
                                <h5 className="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-2">
                                    <TrendingUp size={16} />
                                    Datos Extraídos
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-xs text-emerald-600 block">Razón Social</span>
                                        <span className="font-bold text-emerald-900">{settings.companyName}</span>
                                    </div>
                                    <div>
                                        <span className="text-xs text-emerald-600 block">NIF/CIF</span>
                                        <span className="font-bold text-emerald-900">{settings.nif}</span>
                                    </div>
                                    <div className="md:col-span-2">
                                        <span className="text-xs text-emerald-600 block">Dirección Fiscal</span>
                                        <span className="font-bold text-emerald-900">{settings.address}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SEPARATION OF ROLES / MOCKED LIST */}
                        <div>
                            <h5 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                                <Building2 size={16} className="text-slate-400" />
                                Documentos Subidos
                            </h5>
                            <div className="space-y-3">
                                {/* Empty State Mock */}
                                <div className="p-4 bg-white border border-slate-100 rounded-xl flex items-center gap-4 opacity-60">
                                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                                        <FileText size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="h-2 w-32 bg-slate-100 rounded mb-2" />
                                        <div className="h-2 w-20 bg-slate-50 rounded" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </DashboardCard>
            </div>
        </motion.div>
    );
}
