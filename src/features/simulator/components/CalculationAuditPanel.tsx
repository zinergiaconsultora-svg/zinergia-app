'use client';

import React, { useState } from 'react';
import { AlertTriangle, Calculator, CheckCircle2, ChevronDown, Gauge, Info, Receipt, Zap } from 'lucide-react';
import { InvoiceSimulationResult, SimulationLine } from '@/lib/comparison/invoice-simulator';
import { formatCurrency } from '@/lib/utils/format';

interface CalculationAuditPanelProps {
    audit: InvoiceSimulationResult;
}

export function CalculationAuditPanel({ audit }: CalculationAuditPanelProps) {
    const [expanded, setExpanded] = useState(false);
    const importantAlerts = audit.alerts.filter(alert => alert.level !== 'info');
    const infoAlerts = audit.alerts.filter(alert => alert.level === 'info');
    const periodSaving = audit.currentInvoiceTotal - audit.simulatedInvoiceTotal;
    const lineGroups = buildLineGroups(audit.lines);

    return (
        <section className="mb-4 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Header + chips */}
            <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600 shrink-0">
                        <Calculator className="h-4 w-4" />
                    </div>
                    <h3 className="text-xs font-extrabold text-slate-900 truncate">Desglose auditable</h3>
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                    <AuditChip label="Comercializadora" value={audit.company} />
                    <AuditChip label="Periodos" value={audit.activePeriods.map(period => period.toUpperCase()).join(' · ')} />
                </div>
            </div>

            {/* Summary metrics row — always visible */}
            <div className="grid grid-cols-4 gap-px bg-slate-100 border-y border-slate-100">
                <AuditMetric label="Factura actual" value={formatCurrency(audit.currentInvoiceTotal, 2)} muted />
                <AuditMetric label="Total simulado" value={formatCurrency(audit.simulatedInvoiceTotal, 2)} strong />
                <AuditMetric label="Ahorro periodo" value={formatCurrency(periodSaving, 2)} positive={periodSaving >= 0} />
                <AuditMetric label="Ahorro anual" value={formatCurrency(audit.annualSavings, 0)} positive={audit.annualSavings >= 0} />
            </div>

            {/* Alerts */}
            {importantAlerts.length > 0 && (
                <div className="px-4 pt-3 space-y-1.5">
                    {importantAlerts.map(alert => (
                        <div
                            key={alert.code}
                            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] ${
                                alert.level === 'critical'
                                    ? 'bg-red-50 text-red-700'
                                    : 'bg-amber-50 text-amber-700'
                            }`}
                        >
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>{alert.message}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Collapsible breakdown toggle */}
            <div className="px-4 py-2.5">
                <button
                    type="button"
                    onClick={() => setExpanded(v => !v)}
                    className={`flex items-center gap-2 w-full text-left text-xs font-bold transition-colors py-1.5 px-3 -mx-3 rounded-lg ${
                        expanded
                            ? 'text-indigo-700 bg-indigo-50'
                            : 'text-indigo-600 hover:bg-indigo-50/60'
                    }`}
                >
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                    {expanded ? 'Ocultar desglose' : `Ver desglose (${audit.lines.length} conceptos)`}
                </button>

                {expanded && (
                    <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100">
                        <table className="w-full min-w-[600px] text-xs">
                            <thead>
                                <tr className="bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                    <th className="px-3 py-1.5 w-[100px]">Bloque</th>
                                    <th className="px-3 py-1.5">Concepto</th>
                                    <th className="px-3 py-1.5 text-right w-[80px]">Importe</th>
                                    <th className="px-3 py-1.5 hidden sm:table-cell">Criterio</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
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
                                <AuditTotalRow label="Subtotal" value={audit.subtotalBeforeTax} />
                                <AuditTotalRow label="Imp. eléctrico" value={audit.electricityTax} />
                                <AuditTotalRow label="Base imponible" value={audit.taxableBase} />
                                <AuditTotalRow label="IVA" value={audit.vat} />
                                <tr className="bg-emerald-50">
                                    <td className="px-3 py-2">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Total
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 font-extrabold text-emerald-950">Total simulado</td>
                                    <td className="px-3 py-2 text-right text-sm font-black text-emerald-700 tabular-nums">{formatCurrency(audit.simulatedInvoiceTotal, 2)}</td>
                                    <td className="px-3 py-2 text-[10px] text-emerald-600 hidden sm:table-cell">Incluye impuestos y alquiler</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Footer chips */}
            <div className="px-4 pb-3 flex flex-wrap gap-1.5 text-[10px] text-slate-400">
                <span className="rounded-full bg-slate-50 px-2.5 py-0.5">{audit.energyPricingMode === 'single' ? 'Precio único' : 'Por periodos'}</span>
                <span className="rounded-full bg-slate-50 px-2.5 py-0.5">{audit.tariffName}</span>
                {infoAlerts.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-blue-600">
                        <Info className="h-2.5 w-2.5" />
                        {infoAlerts.length} nota{infoAlerts.length === 1 ? '' : 's'}
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
        <div className="bg-white px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className={`mt-0.5 text-base font-black tabular-nums ${muted ? 'text-slate-400 line-through' : positive ? 'text-emerald-700' : strong ? 'text-slate-950' : 'text-slate-800'}`}>
                {value}
            </p>
        </div>
    );
}

function AuditChip({ label, value }: { label: string; value: string }) {
    return (
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
            <span className="text-slate-400">{label}: </span>{value}
        </span>
    );
}

function AuditLineRow({ group, line }: { group: AuditGroup | null; line: SimulationLine }) {
    const Icon = group?.icon;
    return (
        <tr>
            <td className="px-3 py-2 align-top">
                {group && Icon && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${group.tone}`}>
                        <Icon className="h-3 w-3" />
                        {group.title}
                    </span>
                )}
            </td>
            <td className="px-3 py-2 font-semibold text-slate-800">{line.label}</td>
            <td className="px-3 py-2 text-right font-bold text-slate-950 tabular-nums">{formatCurrency(line.amount, 2)}</td>
            <td className="px-3 py-2 text-[10px] leading-relaxed text-slate-500 hidden sm:table-cell">{line.formula}</td>
        </tr>
    );
}

function AuditTotalRow({ label, value }: { label: string; value: number }) {
    return (
        <tr className="bg-slate-50">
            <td className="px-3 py-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">
                    <Calculator className="h-2.5 w-2.5" />
                    Cierre
                </span>
            </td>
            <td className="px-3 py-1.5 font-bold text-slate-700 text-[11px]">{label}</td>
            <td className="px-3 py-1.5 text-right font-bold text-slate-950 tabular-nums">{formatCurrency(value, 2)}</td>
            <td className="px-3 py-1.5 hidden sm:table-cell" />
        </tr>
    );
}
