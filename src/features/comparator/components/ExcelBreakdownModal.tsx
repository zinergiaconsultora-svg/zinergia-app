'use client';

import React, { useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/utils/format';
import { InvoiceData, SavingsResult } from '@/types/crm';

interface ExcelBreakdownModalProps {
    isOpen: boolean;
    onClose: () => void;
    result: SavingsResult;
    invoiceData?: InvoiceData;
}

const ANNUAL_FACTOR = 11.3;
const ELECTRICITY_TAX_RATE = 0.0511;
const VAT_RATE = 0.21;

interface BreakdownRow {
    label: string;
    qty?: string;
    unit?: string;
    price?: string;
    amount: number | null;
    bold?: boolean;
    neg?: boolean;
}

function fmt(value: number | null | undefined, digits = 2): string {
    if (value === null || value === undefined || isNaN(value)) return '—';
    return value.toFixed(digits);
}

function buildClientSide(invoice?: InvoiceData): { rows: BreakdownRow[]; subtotal: number; total: number } {
    const rows: BreakdownRow[] = [];
    if (!invoice) {
        return { rows, subtotal: 0, total: 0 };
    }
    const days = invoice.period_days || 0;

    // Energía P1-P6
    let energySum = 0;
    for (let p = 1; p <= 6; p++) {
        const kwh = (invoice[`energy_p${p}` as keyof InvoiceData] as number) || 0;
        if (kwh > 0) {
            rows.push({ label: `Consumo P${p}`, qty: fmt(kwh, 0), unit: 'kWh', amount: null });
            energySum += kwh;
        }
    }
    if (energySum === 0) rows.push({ label: 'Consumo total', qty: '0', unit: 'kWh', amount: null });

    // Potencia P1-P6
    for (let p = 1; p <= 6; p++) {
        const kw = (invoice[`power_p${p}` as keyof InvoiceData] as number) || 0;
        if (kw > 0) {
            rows.push({ label: `Potencia P${p}`, qty: `${fmt(kw, 2)} kW × ${days} días`, unit: '', amount: null });
        }
    }

    const bono = 0;
    const excesos = 0;
    const reactiva = 0;
    const otros = 0;
    const alquiler = 0;
    const totalAmount = invoice.total_amount || 0;

    rows.push({ label: 'Bono social', amount: bono });
    rows.push({ label: 'Excesos potencia', amount: excesos });
    rows.push({ label: 'Energía reactiva', amount: reactiva });
    rows.push({ label: 'Otros conceptos', amount: otros });

    // No reconstruimos el subtotal de la factura del cliente desde piezas (la factura solo nos da el total).
    // Mostramos el TOTAL como dato real y dejamos vacíos los desgloses intermedios.
    rows.push({ label: 'Alquiler equipos', amount: alquiler });
    rows.push({ label: 'TOTAL FACTURA (real)', amount: totalAmount, bold: true });

    return { rows, subtotal: 0, total: totalAmount };
}

function buildSimulationSide(result: SavingsResult, invoice?: InvoiceData): { rows: BreakdownRow[]; subtotal: number; total: number; tax: number; vat: number; base: number; } {
    const rows: BreakdownRow[] = [];
    const audit = result.calculation_audit;
    if (!audit) {
        rows.push({ label: 'Sin desglose disponible', amount: null });
        return { rows, subtotal: 0, total: result.offer_annual_cost / ANNUAL_FACTOR, tax: 0, vat: 0, base: 0 };
    }
    const days = invoice?.period_days || 0;

    // Líneas por periodo (consumo + potencia) — reconstruidas para mostrar cantidades y precios unitarios
    const tariff = result.offer;
    const periodKey = (p: number) => `p${p}` as keyof typeof tariff.energy_price;
    for (let p = 1; p <= 6; p++) {
        const kwh = (invoice?.[`energy_p${p}` as keyof InvoiceData] as number) || 0;
        const price = tariff.energy_price[periodKey(p)] || 0;
        if (kwh > 0) {
            rows.push({
                label: `Consumo P${p}`,
                qty: fmt(kwh, 0),
                unit: 'kWh',
                price: `${fmt(price, 6)} €/kWh`,
                amount: kwh * price,
            });
        }
    }

    for (let p = 1; p <= 6; p++) {
        const kw = (invoice?.[`power_p${p}` as keyof InvoiceData] as number) || 0;
        const pricePerKwDay = tariff.power_price[periodKey(p)] || 0;
        if (kw > 0) {
            const amount = kw * days * pricePerKwDay;
            rows.push({
                label: `Potencia P${p}`,
                qty: `${fmt(kw, 2)} kW × ${days} días`,
                unit: '',
                price: `${fmt(pricePerKwDay, 6)} €/kW·día`,
                amount,
            });
        }
    }

    // Resumen línea por línea desde el motor (consistente con el cálculo real)
    rows.push({ label: 'Bono social', amount: audit.lines.find(l => l.label.startsWith('Financiacion bono'))?.amount ?? 0 });
    rows.push({ label: 'Compensación excedentes', amount: audit.lines.find(l => l.label.startsWith('Compensacion'))?.amount ?? 0, neg: true });

    rows.push({ label: 'SUBTOTAL', amount: audit.subtotalBeforeTax, bold: true });
    rows.push({ label: `Impuesto eléctrico (× ${(ELECTRICITY_TAX_RATE * 100).toFixed(2)}%)`, amount: audit.electricityTax });
    rows.push({ label: 'Alquiler equipos', amount: invoice?.rental_cost ?? 0 });
    rows.push({ label: 'BASE IMPONIBLE', amount: audit.taxableBase, bold: true });
    rows.push({ label: `IVA (× ${(VAT_RATE * 100).toFixed(0)}%)`, amount: audit.vat });
    rows.push({ label: 'TOTAL SIMULADO', amount: audit.simulatedInvoiceTotal, bold: true });

    return {
        rows,
        subtotal: audit.subtotalBeforeTax,
        total: audit.simulatedInvoiceTotal,
        tax: audit.electricityTax,
        vat: audit.vat,
        base: audit.taxableBase,
    };
}

export const ExcelBreakdownModal: React.FC<ExcelBreakdownModalProps> = ({ isOpen, onClose, result, invoiceData }) => {
    const clientSide = useMemo(() => buildClientSide(invoiceData), [invoiceData]);
    const simSide = useMemo(() => buildSimulationSide(result, invoiceData), [result, invoiceData]);

    const periodSavings = clientSide.total - simSide.total;
    const annualSavings = periodSavings * ANNUAL_FACTOR;
    const savingsPercent = clientSide.total > 0 ? (periodSavings / clientSide.total) * 100 : 0;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Desglose comparativo — ${result.offer.tariff_name}`}>
            <div className="space-y-4">
                <p className="text-sm text-slate-600">
                    Comparativa al detalle (formato Excel manual de Zinergia). Lado izquierdo = factura real del cliente.
                    Lado derecho = simulación con los precios de <strong>{result.offer.marketer_name}</strong>.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Cliente */}
                    <section className="border border-slate-200 rounded-xl overflow-hidden">
                        <header className="bg-slate-100 px-4 py-2 font-bold text-slate-700 text-sm">
                            Factura actual del cliente
                        </header>
                        <table className="w-full text-xs">
                            <tbody>
                                {clientSide.rows.map((row, i) => (
                                    <tr key={i} className={`border-t border-slate-100 ${row.bold ? 'bg-amber-50 font-bold' : ''}`}>
                                        <td className="px-3 py-1.5 text-slate-700">{row.label}</td>
                                        <td className="px-3 py-1.5 text-slate-500 text-right whitespace-nowrap">
                                            {row.qty ? `${row.qty} ${row.unit || ''}` : ''}
                                        </td>
                                        <td className="px-3 py-1.5 text-slate-900 text-right whitespace-nowrap">
                                            {row.amount !== null ? formatCurrency(row.amount) : ''}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>

                    {/* Simulación */}
                    <section className="border border-emerald-200 rounded-xl overflow-hidden">
                        <header className="bg-emerald-50 px-4 py-2 font-bold text-emerald-700 text-sm">
                            Simulación — {result.offer.marketer_name} {result.offer.tariff_name}
                        </header>
                        <table className="w-full text-xs">
                            <tbody>
                                {simSide.rows.map((row, i) => (
                                    <tr key={i} className={`border-t border-emerald-50 ${row.bold ? 'bg-emerald-50 font-bold' : ''}`}>
                                        <td className="px-3 py-1.5 text-slate-700">{row.label}</td>
                                        <td className="px-3 py-1.5 text-slate-500 text-right whitespace-nowrap">
                                            {row.qty ? `${row.qty} ${row.unit || ''}` : ''}
                                            {row.price && <div className="text-[10px] text-slate-400">{row.price}</div>}
                                        </td>
                                        <td className={`px-3 py-1.5 text-right whitespace-nowrap ${row.neg ? 'text-rose-600' : 'text-slate-900'}`}>
                                            {row.amount !== null ? (row.neg ? `−${formatCurrency(Math.abs(row.amount))}` : formatCurrency(row.amount)) : ''}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                </div>

                {/* Diferencia */}
                <div className="rounded-xl border border-emerald-300 bg-emerald-50/60 px-5 py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                        <div>
                            <p className="text-slate-500">Diferencia este periodo</p>
                            <p className={`text-xl font-bold ${periodSavings >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {periodSavings >= 0 ? '−' : '+'}{formatCurrency(Math.abs(periodSavings))}
                            </p>
                        </div>
                        <div>
                            <p className="text-slate-500">% ahorro</p>
                            <p className={`text-xl font-bold ${savingsPercent >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {savingsPercent.toFixed(1)}%
                            </p>
                        </div>
                        <div>
                            <p className="text-slate-500">Ahorro anual estimado (× 11.3)</p>
                            <p className={`text-xl font-bold ${annualSavings >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {annualSavings >= 0 ? '' : '−'}{formatCurrency(Math.abs(annualSavings))}
                            </p>
                        </div>
                    </div>
                </div>

                <p className="text-[11px] text-slate-400">
                    El factor anual fijo 11.3 asume facturas mensuales de ~32 días. Si el periodo facturado difiere mucho,
                    los totales anuales podrían sobreestimar/subestimar el ahorro real.
                </p>
            </div>
        </Modal>
    );
};
