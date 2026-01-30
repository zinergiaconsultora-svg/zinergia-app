'use client';

import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { DemoModeAlert } from '@/components/ui/DemoModeAlert';
import { DigitalProposalCard } from '@/features/comparator/components/DigitalProposalCard';
import { SavingsResult } from '@/types/crm';

interface SimulatorResultsProps {
    results: SavingsResult[];
    isMockMode: boolean;
    onReset: () => void;
    powerType: string;
}

export const SimulatorResults: React.FC<SimulatorResultsProps> = ({
    results,
    isMockMode,
    onReset,
    powerType
}) => {
    return (
        <motion.div
            key="s3"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        >
            {/* Demo Mode Alert */}
            <DemoModeAlert show={isMockMode} />

            {/* Header mejorado */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between mb-6"
            >
                <button
                    onClick={onReset}
                    className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-medium text-sm transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg px-2 py-1 font-display"
                    aria-label="Comenzar nueva simulación"
                >
                    <ChevronLeft size={16} aria-hidden="true" />
                    Nueva simulación
                </button>
                <div className="text-right">
                    <h2 className="font-display text-2xl font-bold text-slate-900">Propuestas de Ahorro</h2>
                    <p className="text-sm text-slate-500 font-body">
                        Las 3 mejores opciones para tu tarifa <span className="font-semibold text-emerald-600">{powerType}</span>
                    </p>
                </div>
            </motion.div>

            {/* Grid de resultados con stagger */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start"
            >
                {results.slice(0, 3).map((result, idx) => (
                    <motion.div
                        key={result.offer.id}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.15, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                    >
                        <DigitalProposalCard
                            result={idx === 0 ? result : { ...result, optimization_result: undefined }}
                            title={idx === 0 ? "Mejor Opción Ahorro" : "Alternativa Competitiva"}
                            isSecondary={idx > 0}
                            onReset={onReset}
                            onEmail={() => { }}
                        />
                    </motion.div>
                ))}
            </motion.div>
        </motion.div>
    );
};
