'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FileText, CreditCard, Lock } from 'lucide-react';
import { DashboardCard } from '../DashboardCard';

interface CommercialSettings {
    companyName: string;
    defaultMargin: number;
    defaultVat: number;
}

interface SettingsCommercialTabProps {
    settings: CommercialSettings;
    onChangeMargin: (v: number) => void;
    onChangeVat: (v: number) => void;
}

export function SettingsCommercialTab({
    settings,
    onChangeMargin,
    onChangeVat,
}: SettingsCommercialTabProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid grid-cols-1 md:grid-cols-12 gap-6"
        >
            {/* LEFT: PREVIEW */}
            <div className="col-span-1 md:col-span-4">
                <div className="bg-slate-900 rounded-3xl p-6 text-white h-full relative overflow-hidden shadow-xl min-h-[400px]">
                    <div className="relative z-10">
                        <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                            <FileText size={18} className="text-energy-400" />
                            Previsualización PDF
                        </h3>
                        <p className="text-slate-400 text-sm mb-6 max-w-[30ch]">
                            Así aparecerán tus textos legales al pie de cada contrato generado.
                        </p>

                        <div className="bg-white rounded-lg p-4 shadow-lg text-slate-300 scale-90 origin-top-left border-4 border-slate-800">
                            <div className="space-y-4 mb-8">
                                <div className="w-full h-2 bg-slate-100 rounded" />
                                <div className="w-3/4 h-2 bg-slate-100 rounded" />
                                <div className="w-1/2 h-2 bg-slate-100 rounded" />
                            </div>
                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-[10px] text-slate-500 font-bold mb-1">CLÁUSULA RGPD:</p>
                                <p className="text-[8px] text-slate-400 leading-relaxed text-justify">
                                    En cumplimiento de la normativa vigente... sus datos serán tratados por <strong>{settings.companyName}</strong> con la finalidad de...
                                </p>
                            </div>
                        </div>
                    </div>
                    {/* Decoding circle bg */}
                    <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-energy-500/20 rounded-full blur-3xl" />
                </div>
            </div>

            {/* RIGHT: CONFIG */}
            <div className="col-span-1 md:col-span-8 space-y-6">
                <DashboardCard
                    title="Condiciones Económicas (Defecto)"
                    icon={CreditCard}
                    subtitle="Valores iniciales para nuevas ofertas"
                    className="h-auto"
                >
                    <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Margen Comercial (€/kWh)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    id="margin-input"
                                    aria-label="Margen Comercial"
                                    value={settings.defaultMargin}
                                    onChange={(e) => onChangeMargin(parseFloat(e.target.value))}
                                    className="w-full pl-3 pr-10 py-2 rounded-lg border border-slate-200 focus:border-energy-500 outline-none font-bold text-lg"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="vat-select" className="text-sm font-bold text-slate-700">IVA Aplicable</label>
                                <select
                                    id="vat-select"
                                    aria-label="IVA Aplicable"
                                    value={settings.defaultVat}
                                    onChange={(e) => onChangeVat(parseInt(e.target.value))}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-energy-500 outline-none font-bold"
                                >
                                    <option value={21}>21%</option>
                                    <option value={10}>10%</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </DashboardCard>

                <DashboardCard
                    title="Textos Legales y RGPD"
                    icon={Lock}
                    subtitle="Configura la letra pequeña de tus contratos"
                    className="h-auto"
                >
                    <div className="mt-2 text-sm text-slate-500 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <p>💡 <strong>¿Para qué sirve esto?</strong> Este texto se añade automáticamente al final de todos los PDFs de ofertas y contratos para cumplir con la Ley de Protección de Datos.</p>
                    </div>
                    <textarea
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-energy-500 outline-none transition-all text-sm h-32 resize-y font-mono text-slate-600 leading-relaxed"
                        placeholder="Escribe aquí tu cláusula legal..."
                        defaultValue="En cumplimiento del Reglamento (UE) 2016/679..."
                    />
                </DashboardCard>
            </div>
        </motion.div>
    );
}
