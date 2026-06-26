'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Gauge, ShieldCheck, LineChart, Clock, Sun, Sunset, Moon, TrendingDown } from 'lucide-react';
import { analyzeConsumption, type ContractingStrategy } from '@/lib/aletheia/consumptionProfile';
import { crmToAletheiaInvoice } from '@/lib/aletheia/adapter';
import type { InvoiceData } from '@/types/crm';
import type { TariffPeriod } from '@/lib/aletheia/types';

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

interface EnergyBands {
    total: number;
    punta: number;
    llano: number;
    valle: number;
    puntaPct: number;
    llanoPct: number;
    vallePct: number;
}

/**
 * Reparte la energía consumida en tres franjas legibles para el cliente:
 * Punta (cara), Llano (media) y Valle (barata). En 2.0TD se mapea P1/P2/P3;
 * en 3.0TD/6.1TD se agrupa P1=punta, P6=valle y el resto como llano.
 */
function computeEnergyBands(
    energy: Record<TariffPeriod, number>,
    tariffType: '2.0TD' | '3.0TD' | '6.1TD',
): EnergyBands | null {
    const v = (p: TariffPeriod) => energy[p] || 0;
    let punta: number;
    let llano: number;
    let valle: number;

    if (tariffType === '2.0TD') {
        punta = v('p1');
        llano = v('p2');
        valle = v('p3');
    } else {
        punta = v('p1');
        valle = v('p6');
        llano = v('p2') + v('p3') + v('p4') + v('p5');
    }

    const total = punta + llano + valle;
    if (total <= 0) return null;

    return {
        total,
        punta,
        llano,
        valle,
        puntaPct: Math.round((punta / total) * 100),
        llanoPct: Math.round((llano / total) * 100),
        vallePct: Math.round((valle / total) * 100),
    };
}

const BAND_META = [
    { key: 'punta', label: 'Punta', icon: Sun, bar: 'bg-rose-400', dot: 'text-rose-500', hint: 'Horas caras' },
    { key: 'llano', label: 'Llano', icon: Sunset, bar: 'bg-amber-300', dot: 'text-amber-500', hint: 'Horas medias' },
    { key: 'valle', label: 'Valle', icon: Moon, bar: 'bg-emerald-400', dot: 'text-emerald-500', hint: 'Horas baratas' },
] as const;

/**
 * Muestra el factor de carga, la distribución del consumo por franjas horarias
 * y la estrategia de contratación recomendada (fijo / indexado / fijo con
 * discriminación) calculados a partir de la factura. Da al agente un argumento
 * técnico cuantificado y visual antes de presentar la oferta.
 */
export const ConsumptionProfileCard: React.FC<Props> = ({ invoiceData }) => {
    const aletheiaInvoice = crmToAletheiaInvoice(invoiceData);
    const totalEnergy = Object.values(aletheiaInvoice.energy_consumption).reduce((a, b) => a + (b || 0), 0);
    if (totalEnergy <= 0) return null;

    const { profile, strategy } = analyzeConsumption(aletheiaInvoice);
    const style = STRATEGY_STYLE[strategy.strategy];
    const gaugePct = Math.max(4, Math.min(100, profile.loadFactorPct));
    const bands = computeEnergyBands(aletheiaInvoice.energy_consumption, aletheiaInvoice.tariff_type);

    // Potencia: contratada vs demanda real (maxímetro). Palanca de ahorro concreta.
    const periods: TariffPeriod[] = aletheiaInvoice.tariff_type === '2.0TD'
        ? ['p1', 'p2', 'p3']
        : ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
    const contractedPeak = Math.max(0, ...periods.map(p => aletheiaInvoice.contracted_power[p] || 0));
    const realPeak = aletheiaInvoice.max_demand
        ? Math.max(0, ...periods.map(p => aletheiaInvoice.max_demand![p] || 0))
        : 0;
    const showPowerInsight = profile.powerOvercontracted && realPeak > 0 && contractedPeak > 0;
    const powerMarginPct = showPowerInsight ? Math.round(((contractedPeak - realPeak) / contractedPeak) * 100) : 0;

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

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,300px)_1fr] gap-4">
                {/* Columna izquierda: factor de carga + reparto horario */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-4">
                    {/* Factor de carga */}
                    <div>
                        <div className="flex items-baseline justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Factor de carga</span>
                            <span className="text-xs font-medium text-slate-400">{CLASS_LABEL[profile.classification]}</span>
                        </div>
                        <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-slate-900 tabular-nums">{profile.loadFactorPct}</span>
                            <span className="text-base font-semibold text-slate-400">%</span>
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-[width]"
                                style={{ width: `${gaugePct}%` }}
                            />
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                            <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                                <dt className="text-[10px] text-slate-400">Demanda pico</dt>
                                <dd className="font-bold tabular-nums text-slate-800">{profile.peakKw.toFixed(1)} kW</dd>
                            </div>
                            <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                                <dt className="text-[10px] text-slate-400">Demanda media</dt>
                                <dd className="font-bold tabular-nums text-slate-800">{profile.avgKw.toFixed(1)} kW</dd>
                            </div>
                        </dl>
                    </div>

                    {/* Reparto del consumo por franjas */}
                    {bands && (
                        <div className="border-t border-slate-100 pt-3">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reparto del consumo</span>
                            <div className="mt-2 flex h-3.5 w-full overflow-hidden rounded-full bg-slate-100">
                                {bands.puntaPct > 0 && <div className="bg-rose-400 transition-[width]" style={{ width: `${bands.puntaPct}%` }} />}
                                {bands.llanoPct > 0 && <div className="bg-amber-300 transition-[width]" style={{ width: `${bands.llanoPct}%` }} />}
                                {bands.vallePct > 0 && <div className="bg-emerald-400 transition-[width]" style={{ width: `${bands.vallePct}%` }} />}
                            </div>
                            <ul className="mt-2.5 space-y-1">
                                {BAND_META.map(({ key, label, icon: Icon, dot, hint }) => {
                                    const pct = key === 'punta' ? bands.puntaPct : key === 'llano' ? bands.llanoPct : bands.vallePct;
                                    const kwh = key === 'punta' ? bands.punta : key === 'llano' ? bands.llano : bands.valle;
                                    return (
                                        <li key={key} className="flex items-center gap-2 text-xs">
                                            <Icon className={`h-3.5 w-3.5 shrink-0 ${dot}`} />
                                            <span className="font-medium text-slate-700">{label}</span>
                                            <span className="text-[10px] text-slate-400">{hint}</span>
                                            <span className="ml-auto tabular-nums text-slate-500">{Math.round(kwh)} kWh</span>
                                            <span className="w-9 text-right font-bold tabular-nums text-slate-800">{pct}%</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Columna derecha: estrategia recomendada */}
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

                    {/* Palanca de ahorro: potencia sobrecontratada */}
                    {showPowerInsight && (
                        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                            <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            <div className="text-xs leading-relaxed">
                                <span className="font-bold text-emerald-800">Potencia ajustable ({powerMarginPct}% de margen).</span>{' '}
                                <span className="text-emerald-700">
                                    Tienes {contractedPeak.toFixed(1)} kW contratados pero tu máximo real registrado es {realPeak.toFixed(1)} kW.
                                    Bajar la potencia reduce el término fijo sin afectar al suministro.
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
