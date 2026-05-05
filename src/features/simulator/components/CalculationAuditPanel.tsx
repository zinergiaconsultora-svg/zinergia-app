'use client';

import React from 'react';
import { AlertTriangle, Calculator, CheckCircle2, Info } from 'lucide-react';
import { InvoiceSimulationResult } from '@/lib/comparison/invoice-simulator';

interface CalculationAuditPanelProps {
    audit: InvoiceSimulationResult;
}

export function CalculationAuditPanel({ audit }: CalculationAuditPanelProps) {
    const importantAlerts = audit.alerts.filter(alert => alert.level !== 'info');

    return (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                        <Calculator className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900">Calculo auditable de la mejor propuesta</h3>
                        <p className="mt-1 text-xs text-slate-500">
                            {audit.energyPricingMode === 'single'
                                ? 'La energia se ha calculado con kWh totales porque la tarifa tiene precio unico.'
                                : 'La energia se ha calculado periodo a periodo con P1-P6.'}
                        </p>
                    </div>
                </div>
                <div className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    {audit.activePeriods.map(period => period.toUpperCase()).join(' · ')}
                </div>
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

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {audit.lines.map(line => (
                    <div key={line.label} className="rounded-lg bg-slate-50 px-3 py-2">
                        <div className="text-xs font-medium text-slate-500">{line.label}</div>
                        <div className="mt-1 text-base font-semibold text-slate-900">{line.amount.toFixed(2)} €</div>
                        <div className="mt-1 text-[11px] leading-snug text-slate-400">{line.formula}</div>
                    </div>
                ))}
                <div className="rounded-lg bg-emerald-50 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Total simulado
                    </div>
                    <div className="mt-1 text-base font-semibold text-emerald-900">{audit.simulatedInvoiceTotal.toFixed(2)} €</div>
                    <div className="mt-1 text-[11px] leading-snug text-emerald-700">
                        Incluye impuesto electrico, alquiler e IVA.
                    </div>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-3 py-1">Factura actual: {audit.currentInvoiceTotal.toFixed(2)} €</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">Ahorro periodo: {audit.periodSavings.toFixed(2)} €</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">Ahorro anual: {audit.annualSavings.toFixed(2)} €</span>
                {audit.alerts.some(alert => alert.level === 'info') && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                        <Info className="h-3 w-3" />
                        Revisar SIPS para comision
                    </span>
                )}
            </div>
        </div>
    );
}
