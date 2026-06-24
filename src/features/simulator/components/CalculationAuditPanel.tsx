'use client';

import React from 'react';
import { AlertTriangle, Calculator, CheckCircle2, Gauge, Info, Receipt, Zap } from 'lucide-react';
import { InvoiceSimulationResult, SimulationLine } from '@/lib/comparison/invoice-simulator';
import { formatCurrency } from '@/lib/utils/format';

interface CalculationAuditPanelProps {
    audit: InvoiceSimulationResult;
}

export function CalculationAuditPanel({ audit }: CalculationAuditPanelProps) {
    const importantAlerts = audit.alerts.filter(alert => alert.level !== 'info');
    const infoAlerts = audit.alerts.filter(alert => alert.level === 'info');
    const periodSaving = audit.currentInvoiceTotal - audit.simulatedInvoiceTotal;
    const lineGroups = buildLineGroups(audit.lines);

    return (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                        <Calculator className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-extrabold text-slate-900">Desglose auditable de la propuesta activa</h3>
                        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
                            {audit.energyPricingMode === 'single'
                                ? 'La energía se ha calculado con kWh totales porque la tarifa tiene precio único.'
                                : 'La energía se ha calculado periodo a periodo con P1-P6.'}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <AuditChip label="Comercializadora" value={audit.company} />
                    <AuditChip label="Periodos" value={audit.activePeriods.map(period => period.toUpperCase()).join(' · ')} />
                </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <AuditMetric label="Factura actual" value={formatCurrency(audit.currentInvoiceTotal, 2)} muted />
                <AuditMetric label="Total simulado" value={formatCurrency(audit.simulatedInvoiceTotal, 2)} strong />
                <AuditMetric label="Ahorro periodo" value={formatCurrency(periodSaving, 2)} positive={periodSaving >= 0} />
                <AuditMetric label="Ahorro anual" value={formatCurrency(audit.annualSavings, 0)} positive={audit.annualSavings >= 0} />
            </div>

            {importantAlerts.length > 0 && (
                <div className="mt-4 space-y-2">
                    {importantAlerts.map(alert => (
                        <div
                            key={alert.code}
                            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                                alert.level === 'critical'
                                    ? 'border-red-200 bg-red-50 text-red-700'
                                    : 'border-amber-200 bg-amber-50 text-amber-700'
                            }`}
                        >
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{alert.message}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full min-w-[760px] text-sm">
                    <thead>
                        <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                            <th className="px-4 py-2">Bloque</th>
                            <th className="px-4 py-2">Concepto</th>
                            <th className="px-4 py-2 text-right">Importe</th>
                            <th className="px-4 py-2">Criterio de cálculo</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {lineGroups.map(group => (
                            <React.Fragment key={group.title}>
                                {group.lines.map((line, index) => (
                                    <AuditLineRow
                                        key={`${group.title}-${line.label}`}
                                        group={index === 0 ? group : null}
                                        line={line}
                                    />
                                ))}
                            </React.Fragment>
                        ))}
                        <AuditTotalRow label="Subtotal antes de impuestos" value={audit.subtotalBeforeTax} detail="Suma de energía, potencia y conceptos trasladados." />
                        <AuditTotalRow label="Impuesto eléctrico" value={audit.electricityTax} detail="Aplicado sobre subtotal antes de impuestos." />
                        <AuditTotalRow label="Base imponible" value={audit.taxableBase} detail="Subtotal + impuesto eléctrico + alquiler de equipo." />
                        <AuditTotalRow label="IVA" value={audit.vat} detail="IVA aplicado a la base imponible." />
                        <tr className="bg-emerald-50">
                            <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Resultado
                                </span>
                            </td>
                            <td className="px-4 py-3 font-extrabold text-emerald-950">Total simulado</td>
                            <td className="px-4 py-3 text-right text-base font-black text-emerald-700 tabular-nums">{formatCurrency(audit.simulatedInvoiceTotal, 2)}</td>
                            <td className="px-4 py-3 text-xs text-emerald-700">Incluye impuesto eléctrico, alquiler e IVA.</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-3 py-1">Modo energía: {audit.energyPricingMode === 'single' ? 'precio único' : 'periodos'}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">Tarifa: {audit.tariffName}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">Ahorro periodo: {formatCurrency(audit.periodSavings, 2)}</span>
                {infoAlerts.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                        <Info className="h-3 w-3" />
                        {infoAlerts.length} nota{infoAlerts.length === 1 ? '' : 's'} informativa{infoAlerts.length === 1 ? '' : 's'}
                    </span>
                )}
            </div>
        </section>
    );
}

interface AuditGroup {
    title: string;
    icon: typeof Zap;
    tone: string;
    lines: SimulationLine[];
}

function buildLineGroups(lines: SimulationLine[]): AuditGroup[] {
    const power = lines.filter(line => line.label.toLowerCase().includes('potencia'));
    const energy = lines.filter(line => line.label.toLowerCase().includes('energia') || line.label.toLowerCase().includes('energía'));
    const other = lines.filter(line => !power.includes(line) && !energy.includes(line));

    return [
        { title: 'Energía', icon: Zap, tone: 'bg-amber-50 text-amber-700', lines: energy },
        { title: 'Potencia', icon: Gauge, tone: 'bg-blue-50 text-blue-700', lines: power },
        { title: 'Otros conceptos', icon: Receipt, tone: 'bg-slate-100 text-slate-700', lines: other },
    ].filter(group => group.lines.length > 0);
}

function AuditMetric({ label, value, muted = false, strong = false, positive = false }: { label: string; value: string; muted?: boolean; strong?: boolean; positive?: boolean }) {
    return (
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className={`mt-1 text-lg font-black tabular-nums ${muted ? 'text-slate-500 line-through' : positive ? 'text-emerald-700' : strong ? 'text-slate-950' : 'text-slate-800'}`}>
                {value}
            </p>
        </div>
    );
}

function AuditChip({ label, value }: { label: string; value: string }) {
    return (
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            <span className="text-slate-400">{label}: </span>{value}
        </span>
    );
}

function AuditLineRow({ group, line }: { group: AuditGroup | null; line: SimulationLine }) {
    const Icon = group?.icon;
    return (
        <tr>
            <td className="px-4 py-3 align-top">
                {group && Icon && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${group.tone}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {group.title}
                    </span>
                )}
            </td>
            <td className="px-4 py-3 font-semibold text-slate-800">{line.label}</td>
            <td className="px-4 py-3 text-right font-bold text-slate-950 tabular-nums">{formatCurrency(line.amount, 2)}</td>
            <td className="px-4 py-3 text-xs leading-relaxed text-slate-500">{line.formula}</td>
        </tr>
    );
}

function AuditTotalRow({ label, value, detail }: { label: string; value: number; detail: string }) {
    return (
        <tr className="bg-slate-50">
            <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">
                    <Calculator className="h-3.5 w-3.5" />
                    Cierre
                </span>
            </td>
            <td className="px-4 py-3 font-bold text-slate-800">{label}</td>
            <td className="px-4 py-3 text-right font-bold text-slate-950 tabular-nums">{formatCurrency(value, 2)}</td>
            <td className="px-4 py-3 text-xs text-slate-500">{detail}</td>
        </tr>
    );
}
