'use client';

import React, { useState } from 'react';
import {
    Zap, User, Building2, Hash, Calendar, MapPin, Activity, Link2, UserCheck,
    ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { InvoiceData } from '@/types/crm';
import { Input } from '@/components/ui/primitives/Input';
import {
    SectionLabel, ConfidencePill, CorrectionBadge, LocateButton, EnergySparkline,
} from './SimulatorFormPrimitives';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FieldStat { field: string; count: number; mostFrequentValue: string | null; }

interface SimulatorContractFieldsProps {
    data: InvoiceData;
    onUpdate: <K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) => void;
    powerType: string;
    onPowerTypeOverride?: (type: '2.0' | '3.0' | '3.1') => void;
    pdfUrl?: string | null;
    getConfidence: (field: string) => number | null;
    isLowConfidence: (field: string) => boolean;
    lowConfWarn: (field: string) => string | undefined;
    locate: (value: string | number | undefined) => void;
    getFieldStat: (field: string) => FieldStat | undefined;
    isCupsValid: boolean;
    energyHistory: { month: string; totalEnergy: number }[];
    totalEnergyNow: number;
    cupsClient: { id: string; name: string } | null;
    cupsClientDismissed: boolean;
    onDismissCupsClient: () => void;
    showTariffOverride: boolean;
    onToggleTariffOverride: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const SimulatorContractFields: React.FC<SimulatorContractFieldsProps> = ({
    data, onUpdate, powerType, onPowerTypeOverride, pdfUrl,
    getConfidence, isLowConfidence, lowConfWarn, locate, getFieldStat,
    isCupsValid, energyHistory, totalEnergyNow,
    cupsClient, cupsClientDismissed, onDismissCupsClient,
    showTariffOverride, onToggleTariffOverride,
}) => {
    const hasSecondaryIssues = isLowConfidence('supply_address') || isLowConfidence('invoice_date')
        || isLowConfidence('invoice_number') || (data.client_name && data.client_name.length < 5);
    const [secondaryExpanded, setSecondaryExpanded] = useState(hasSecondaryIssues);

    return (
    <div className="space-y-5">

        {/* Tariff card */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden">
            <div className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <Zap size={18} className="text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Tarifa detectada</p>
                    <p className="text-base font-bold text-white truncate">
                        {powerType === '2.0' && 'Tensión Baja 2.0TD'}
                        {powerType === '3.0' && 'Empresa 3.0TD'}
                        {powerType === '3.1' && 'Alta Tensión 3.1TD'}
                        {data.tariff_name && <span className="ml-2 text-slate-400 text-sm font-normal">· {data.tariff_name}</span>}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">IA</span>
                    {onPowerTypeOverride && (
                        <button
                            type="button"
                            onClick={onToggleTariffOverride}
                            className="text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-1 rounded-lg transition-colors"
                        >
                            {showTariffOverride ? 'Cerrar' : 'Cambiar'}
                        </button>
                    )}
                </div>
            </div>
            {/* Override picker */}
            <AnimatePresence>
                {showTariffOverride && onPowerTypeOverride && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-white/10"
                    >
                        <div className="px-4 py-3 flex items-center gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mr-1">Forzar tipo:</span>
                            {(['2.0', '3.0', '3.1'] as const).map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => { onPowerTypeOverride(t); onToggleTariffOverride(); }}
                                    className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all ${
                                        powerType === t
                                            ? 'bg-emerald-500 border-emerald-400 text-white'
                                            : 'bg-white/5 border-white/15 text-slate-300 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    {t}TD
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

        {/* Critical fields — always visible */}
        <section>
            <SectionLabel color="bg-emerald-500" label="Datos Críticos" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-2xl bg-white/70 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 shadow-sm">
                {/* CUPS client link banner */}
                <AnimatePresence>
                    {cupsClient && !cupsClientDismissed && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="sm:col-span-2 overflow-hidden"
                        >
                            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 mb-1">
                                <UserCheck size={14} className="text-indigo-500 shrink-0" />
                                <p className="text-xs text-indigo-700 dark:text-indigo-300 flex-1">
                                    <span className="font-bold">{cupsClient.name}</span>
                                    <span className="text-indigo-500 dark:text-indigo-400 ml-1.5">— cliente en tu CRM</span>
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onUpdate('client_name', cupsClient.name as InvoiceData['client_name']);
                                        onDismissCupsClient();
                                        toast.success(`Vinculado a ${cupsClient.name}`);
                                    }}
                                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-bold hover:bg-indigo-700 transition-colors"
                                >
                                    <Link2 size={9} /> Vincular
                                </button>
                                <button type="button" onClick={onDismissCupsClient} className="text-indigo-300 hover:text-indigo-500 transition-colors text-sm leading-none">×</button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="sm:col-span-2" data-field-status={isLowConfidence('cups') ? 'warning' : isCupsValid ? undefined : 'error'}>
                    <Input label="CUPS"
                        labelBadge={<ConfidencePill value={getConfidence('cups')} />}
                        icon={<Activity size={15} />}
                        value={data.cups ?? ''} className="font-mono"
                        error={!isCupsValid && data.cups ? 'Longitud sospechosa' : undefined}
                        warning={lowConfWarn('cups') ?? (isCupsValid && !data.cups?.startsWith('ES') ? 'Debe empezar por ES' : undefined)}
                        onChange={e => onUpdate('cups', e.target.value.toUpperCase())}
                        action={pdfUrl && data.cups ? <LocateButton onClick={() => locate(data.cups)} lowConfidence={isLowConfidence('cups')} /> : undefined}
                    />
                    <AnimatePresence>
                        {energyHistory.length >= 2 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-2 overflow-hidden"
                            >
                                <EnergySparkline history={energyHistory} currentEnergy={totalEnergyNow} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <div data-field-status={isLowConfidence('company_name') ? 'warning' : undefined}>
                    <Input label="Comercializadora"
                        labelBadge={<><ConfidencePill value={getConfidence('company_name')} /><CorrectionBadge stat={getFieldStat('company_name')} /></>}
                        icon={<Building2 size={15} />}
                        value={data.company_name ?? ''} onChange={e => onUpdate('company_name', e.target.value)}
                        placeholder="Endesa, Iberdrola…"
                        warning={lowConfWarn('company_name')}
                        action={pdfUrl && data.company_name ? <LocateButton onClick={() => locate(data.company_name)} lowConfidence={isLowConfidence('company_name')} /> : undefined}
                    />
                </div>
                <div data-field-status={isLowConfidence('dni_cif') ? 'warning' : undefined}>
                    <Input label="CIF / DNI"
                        labelBadge={<><ConfidencePill value={getConfidence('dni_cif')} /><CorrectionBadge stat={getFieldStat('dni_cif')} /></>}
                        icon={<Hash size={15} />}
                        value={data.dni_cif ?? ''} onChange={e => onUpdate('dni_cif', e.target.value)}
                        placeholder="Identificación"
                        warning={lowConfWarn('dni_cif')}
                        action={pdfUrl && data.dni_cif ? <LocateButton onClick={() => locate(data.dni_cif)} lowConfidence={isLowConfidence('dni_cif')} /> : undefined}
                    />
                </div>
            </div>
        </section>

        {/* Secondary fields — collapsible */}
        <section>
            <button type="button" onClick={() => setSecondaryExpanded(v => !v)}
                className="flex items-center gap-2 mb-2 px-1 w-full text-left group"
            >
                <div className="w-1 h-4 bg-slate-300 dark:bg-slate-600 rounded-full" />
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex-1">
                    Datos Secundarios
                    {!secondaryExpanded && (
                        <span className="font-normal text-slate-300 dark:text-slate-600 ml-2 normal-case tracking-normal">
                            Titular · Dirección · Fecha · Nº Factura
                        </span>
                    )}
                </h3>
                <ChevronDown size={13} className={`text-slate-400 transition-transform ${secondaryExpanded ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
                {secondaryExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-2xl bg-white/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800">
                            <div data-field-status={isLowConfidence('client_name') ? 'warning' : undefined}>
                                <Input label="Titular / Cliente"
                                    labelBadge={<><ConfidencePill value={getConfidence('client_name')} /><CorrectionBadge stat={getFieldStat('client_name')} /></>}
                                    icon={<User size={15} />}
                                    value={data.client_name ?? ''} onChange={e => onUpdate('client_name', e.target.value)}
                                    placeholder="Nombre completo"
                                    warning={lowConfWarn('client_name') ?? (data.client_name && data.client_name.length < 5 ? 'Nombre muy corto' : undefined)}
                                    action={pdfUrl && data.client_name ? <LocateButton onClick={() => locate(data.client_name)} lowConfidence={isLowConfidence('client_name')} /> : undefined}
                                />
                            </div>
                            <div data-field-status={isLowConfidence('invoice_number') ? 'warning' : undefined}>
                                <Input label="Nº Factura"
                                    labelBadge={<ConfidencePill value={getConfidence('invoice_number')} />}
                                    icon={<Hash size={15} />}
                                    value={data.invoice_number ?? ''} onChange={e => onUpdate('invoice_number', e.target.value)}
                                    warning={lowConfWarn('invoice_number') ?? (!data.invoice_number ? 'No encontrado' : undefined)}
                                    action={pdfUrl && data.invoice_number ? <LocateButton onClick={() => locate(data.invoice_number)} lowConfidence={isLowConfidence('invoice_number')} /> : undefined}
                                />
                            </div>
                            <div data-field-status={isLowConfidence('supply_address') ? 'warning' : undefined}>
                                <Input label="Dirección"
                                    labelBadge={<ConfidencePill value={getConfidence('supply_address')} />}
                                    icon={<MapPin size={15} />}
                                    value={data.supply_address ?? ''} onChange={e => onUpdate('supply_address', e.target.value)}
                                    warning={lowConfWarn('supply_address') ?? (data.supply_address && data.supply_address.length < 10 ? 'Parece incompleta' : undefined)}
                                    action={pdfUrl && data.supply_address ? <LocateButton onClick={() => locate(data.supply_address)} lowConfidence={isLowConfidence('supply_address')} /> : undefined}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Input label="Días" type="number" icon={<Calendar size={15} />}
                                    value={data.period_days} onChange={e => onUpdate('period_days', parseInt(e.target.value) || 30)} />
                                <div data-field-status={isLowConfidence('invoice_date') ? 'warning' : undefined}>
                                    <Input label="Fecha"
                                        labelBadge={<ConfidencePill value={getConfidence('invoice_date')} />}
                                        icon={<Calendar size={15} />}
                                        value={data.invoice_date ?? ''} onChange={e => onUpdate('invoice_date', e.target.value)}
                                        warning={lowConfWarn('invoice_date')}
                                        action={pdfUrl && data.invoice_date ? <LocateButton onClick={() => locate(data.invoice_date)} lowConfidence={isLowConfidence('invoice_date')} /> : undefined}
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    </div>
    );
};

export default SimulatorContractFields;
