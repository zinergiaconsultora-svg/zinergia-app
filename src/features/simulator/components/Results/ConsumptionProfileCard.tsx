'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Gauge, ShieldCheck, LineChart, Clock } from 'lucide-react';
import { analyzeConsumption, type ContractingStrategy } from '@/lib/aletheia/consumptionProfile';
import { crmToAletheiaInvoice } from '@/lib/aletheia/adapter';
import type { InvoiceData } from '@/types/crm';

interface Props {
    invoiceData: InvoiceData;
}

const STRATEGY_STYLE: Record<ContractingStrategy, { icon: React.ReactNode; accent: string; chip: string }> = {
    fijo: {
        icon: <ShieldCheck className="w-4 h-4" />,
        accent: 'text-indigo-700',
        chip: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    indexado: {
        icon: <LineChart className="w-4 h-4" />,
        accent: 'text-emerald-700',
        chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    fijo_discriminacion: {
        icon: <Clock className="w-4 h-4" />,
        accent: 'text-amber-700',
        chip: 'bg-amber-50 text-amber-700 border-amber-200',
    },
};

const CLASS_LABEL: Record<string, string> = {
    flat: 'Plano',
    moderate: 'Mixto',
    peaky: 'Picudo',
};

const CONFIDENCE_LABEL: Record<string, string> = {
    alta: 'Confianza alta',
    media: 'Confianza media',
    baja: 'Confianza baja',
};

/**
 * Muestra el factor de carga y la estrategia de contratación recomendada
 * (fijo / indexado / fijo con discriminación) calculados a partir de la factura.
 * Da al agente un argumento técnico cuantificado antes de presentar la oferta.
 */
export const ConsumptionProfileCard: React.FC<Props> = ({ invoiceData }) => {
    const aletheiaInvoice = crmToAletheiaInvoice(invoiceData);
    const totalEnergy = Object.values(aletheiaInvoice.energy_consumption).reduce((a, b) => a + (b || 0), 0);
    if (totalEnergy <= 0) return null;

    const { profile, strategy } = analyzeConsumption(aletheiaInvoice);
    const style = STRATEGY_STYLE[strategy.strategy];
    const gaugePct = Math.max(4, Math.min(100, profile.loadFactorPct));

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mb-8"
        >
            <div className="flex items-center gap-2 mb-4">
                <Gauge className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-semibold text-slate-900">Perfil de Consumo y Estrategia</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,260px)_1fr] gap-4">
                {/* Factor de carga */}
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-baseline justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Factor de carga</span>
                        <span className="text-xs font-medium text-slate-400">{CLASS_LABEL[profile.classification]}</span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-slate-900 tabular-nums">{profile.loadFactorPct}</span>
                        <span className="text-base font-semibold text-slate-400">%</span>
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-[width]"
                            style={{ width: `${gaugePct}%` }}
                        />
                    </div>
                    <dl className="mt-4 space-y-1.5 text-xs text-slate-600">
                        <div className="flex justify-between">
                            <dt>Demanda pico</dt>
                            <dd className="font-semibold tabular-nums">{profile.peakKw.toFixed(1)} kW</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt>Demanda media</dt>
                            <dd className="font-semibold tabular-nums">{profile.avgKw.toFixed(1)} kW</dd>
                        </div>
                    </dl>
                </div>

                {/* Estrategia recomendada */}
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${style.chip}`}>
                            {style.icon}
                            {strategy.label}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400">{CONFIDENCE_LABEL[strategy.confidence]}</span>
                    </div>

                    {profile.narrative && (
                        <p className="mt-3 text-sm text-slate-600 leading-relaxed">{profile.narrative}</p>
                    )}

                    <ul className="mt-3 space-y-1.5">
                        {strategy.rationale.map((reason, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current ${style.accent}`} />
                                <span>{reason}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </motion.div>
    );
};
