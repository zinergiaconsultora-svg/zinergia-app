'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Home, Building2, ArrowRight, Info } from 'lucide-react';
import type { ClientSegment } from '@/types/crm';

interface SimulatorSegmentStepProps {
    onSelect: (segment: ClientSegment) => void;
}

const OPTIONS: {
    value: ClientSegment;
    icon: React.ElementType;
    title: string;
    desc: string;
    hint: string;
}[] = [
    {
        value: 'RESIDENCIAL',
        icon: Home,
        title: 'Residencial',
        desc: 'Vivienda particular. Se compara contra el catálogo doméstico.',
        hint: 'Normalmente 2.0TD · puede tener DNI',
    },
    {
        value: 'PYME',
        icon: Building2,
        title: 'PYME / Negocio',
        desc: 'Comercio, autónomo o empresa. Catálogo de negocio.',
        hint: '2.0 / 3.0 / 3.1TD · DNI o CIF',
    },
];

export const SimulatorSegmentStep: React.FC<SimulatorSegmentStepProps> = ({ onSelect }) => {
    return (
        <motion.div
            key="s0"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
            className="max-w-3xl mx-auto"
        >
            <div className="text-center mb-6">
                <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2 tracking-tight">
                    ¿De qué tipo de cliente es esta factura?
                </h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                    No se puede deducir del DNI ni de la tarifa — selecciónalo para calcular la comparativa con el catálogo correcto.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                        <motion.button
                            key={opt.value}
                            type="button"
                            onClick={() => onSelect(opt.value)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.99 }}
                            transition={{ type: 'spring', stiffness: 340, damping: 22 }}
                            className="group text-left rounded-3xl border-2 border-emerald-200 bg-white/80 hover:border-emerald-400 hover:bg-emerald-50/40 transition-all p-6 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                            aria-label={`Cliente ${opt.title}`}
                        >
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-50 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                                <Icon size={24} className="text-emerald-600" />
                            </div>
                            <h4 className="text-lg font-bold text-slate-800 mb-1">{opt.title}</h4>
                            <p className="text-sm text-slate-500 leading-relaxed mb-3">{opt.desc}</p>
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-slate-400 font-medium">{opt.hint}</span>
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                    Elegir <ArrowRight size={13} />
                                </span>
                            </div>
                        </motion.button>
                    );
                })}
            </div>

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 mt-5">
                <Info size={12} className="shrink-0" />
                Podrás cambiarlo antes de subir la factura.
            </p>
        </motion.div>
    );
};
