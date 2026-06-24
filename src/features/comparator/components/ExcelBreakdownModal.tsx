'use client';

import React, { useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/utils/format';
import { InvoiceData, SavingsResult } from '@/types/crm';
import { ArrowRight, TrendingDown, Zap, Gauge, Receipt, Scale, Info } from 'lucide-react';

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
    type?: 'energy' | 'power' | 'tax' | 'total' | 'misc';
}

function fmt(value: number | null | undefined, digits = 2): string {
    if (value === null || value === undefined || isNaN(value)) return '—';
    return value.toFixed(digits);
}

function buildClientSide(invoice?: InvoiceData): { rows: BreakdownRow[]; subtotal: number; total: number } {
    const rows: BreakdownRow[] = [];
    if (!invoice) return { rows, subtotal: 0, total: 0 };
    const days = invoice.period_days || 0;

    for (let p = 1; p <= 6; p++) {
        const kwh = (invoice[`energy_p${p}` as keyof InvoiceData] as number) || 0;
        if (kwh > 0) {
            rows.push({ label: `Energía P${p}`, qty: fmt(kwh, 0), unit: 'kWh', amount: null, type: 'energy' });
        }
    }

    for (let p = 1; p <= 6; p++) {
        const kw = (invoice[`power_p${p}` as keyof InvoiceData] as number) || 0;
        if (kw > 0) {
            rows.push({ label: `Potencia P${p}`, qty: `${fmt(kw, 2)} kW × ${days}d`, unit: '', amount: null, type: 'power' });
        }
    }

    rows.push({ label: 'Bono social', amount: 0, type: 'misc' });
    rows.push({ label: 'Excesos potencia', amount: 0, type: 'misc' });
    rows.push({ label: 'Energía reactiva', amount: 0, type: 'misc' });
    rows.push({ label: 'Otros conceptos', amount: 0, type: 'misc' });
    rows.push({ label: 'Alquiler equipos', amount: 0, type: 'misc' });

    const totalAmount = invoice.total_amount || 0;
    rows.push({ label: 'TOTAL FACTURA', amount: totalAmount, bold: true, type: 'total' });

    return { rows, subtotal: 0, total: totalAmount };
}

function buildSimulationSide(result: SavingsResult, invoice?: InvoiceData): { rows: BreakdownRow[]; subtotal: number; total: number; tax: number; vat: number; base: number } {
    const rows: BreakdownRow[] = [];
    const audit = result.calculation_audit;
    if (!audit) {
        rows.push({ label: 'Sin desglose disponible', amount: null });
        return { rows, subtotal: 0, total: result.offer_annual_cost / ANNUAL_FACTOR, tax: 0, vat: 0, base: 0 };
    }
    const days = invoice?.period_days || 0;
    const tariff = result.offer;
    const periodKey = (p: number) => `p${p}` as keyof typeof tariff.energy_price;

    for (let p = 1; p <= 6; p++) {
        const kwh = (invoice?.[`energy_p${p}` as keyof InvoiceData] as number) || 0;
        const price = tariff.energy_price?.[periodKey(p)] || 0;
        if (kwh > 0) {
            rows.push({
                label: `Energía P${p}`,
                qty: fmt(kwh, 0),
                unit: 'kWh',
                price: `${fmt(price, 6)} €/kWh`,
                amount: kwh * price,
                type: 'energy',
            });
        }
    }

    for (let p = 1; p <= 6; p++) {
        const kw = (invoice?.[`power_p${p}` as keyof InvoiceData] as number) || 0;
        const pricePerKwDay = tariff.power_price?.[periodKey(p)] || 0;
        if (kw > 0) {
            rows.push({
                label: `Potencia P${p}`,
                qty: `${fmt(kw, 2)} kW × ${days}d`,
                unit: '',
                price: `${fmt(pricePerKwDay, 6)} €/kW·día`,
                amount: kw * days * pricePerKwDay,
                type: 'power',
            });
        }
    }

    rows.push({ label: 'Bono social', amount: audit.lines.find(l => l.label.startsWith('Financiacion bono'))?.amount ?? 0, type: 'misc' });
    rows.push({ label: 'Compensación excedentes', amount: audit.lines.find(l => l.label.startsWith('Compensacion'))?.amount ?? 0, neg: true, type: 'misc' });
    rows.push({ label: 'SUBTOTAL', amount: audit.subtotalBeforeTax, bold: true, type: 'total' });
    rows.push({ label: `Imp. eléctrico (${(ELECTRICITY_TAX_RATE * 100).toFixed(2)}%)`, amount: audit.electricityTax, type: 'tax' });
    rows.push({ label: 'Alquiler equipos', amount: invoice?.rental_cost ?? 0, type: 'misc' });
    rows.push({ label: 'BASE IMPONIBLE', amount: audit.taxableBase, bold: true, type: 'total' });
    rows.push({ label: `IVA (${(VAT_RATE * 100).toFixed(0)}%)`, amount: audit.vat, type: 'tax' });
    rows.push({ label: 'TOTAL SIMULADO', amount: audit.simulatedInvoiceTotal, bold: true, type: 'total' });

    return {
        rows,
        subtotal: audit.subtotalBeforeTax,
        total: audit.simulatedInvoiceTotal,
        tax: audit.electricityTax,
        vat: audit.vat,
        base: audit.taxableBase,
    };
}

function RowIcon({ type }: { type?: string }) {
    const cls = 'shrink-0';
    switch (type) {
        case 'energy': return <Zap size={12} className={`${cls} text-amber-500`} />;
        case 'power': return <Gauge size={12} className={`${cls} text-blue-500`} />;
        case 'tax': return <Receipt size={12} className={`${cls} text-slate-400`} />;
        default: return <div className="w-3" />;
    }
}

export const ExcelBreakdownModal: React.FC<ExcelBreakdownModalProps> = ({ isOpen, onClose, result, invoiceData }) => {
    const clientSide = useMemo(() => buildClientSide(invoiceData), [invoiceData]);
    const simSide = useMemo(() => buildSimulationSide(result, invoiceData), [result, invoiceData]);

    const periodSavings = clientSide.total - simSide.total;
    const annualSavings = periodSavings * ANNUAL_FACTOR;
    const savingsPercent = clientSide.total > 0 ? (periodSavings / clientSide.total) * 100 : 0;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Desglose — ${result.offer.marketer_name} · ${result.offer.tariff_name}`} size="xl">
            <div className="space-y-5">
                {/* Hero savings strip */}
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 p-4">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.15),transparent_70%)]" />
                    <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4 sm:gap-6">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Factura actual</p>
                                <p className="text-lg font-bold text-white/60 line-through tabular-nums">{formatCurrency(clientSide.total)}</p>
                            </div>
                            <ArrowRight size={16} className="text-emerald-400 shrink-0" />
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Simulada</p>
                                <p className="text-lg font-bold text-white tabular-nums">{formatCurrency(simSide.total)}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Ahorras</p>
                            <p className="text-2xl font-black text-emerald-400 tabular-nums">{formatCurrency(Math.abs(periodSavings))}</p>
                            <p className="text-xs font-bold text-emerald-300/80">{savingsPercent.toFixed(1)}% menos</p>
                        </div>
                    </div>
                </div>

                {/* Side-by-side tables */}
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {/* Client invoice */}
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                        <div className="bg-slate-50 px-4 py-2.5 flex items-center gap-2 border-b border-slate-200">
                            <div className="w-2 h-2 rounded-full bg-slate-400" />
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Factura actual</span>
                            {invoiceData?.company_name && (
                                <span className="text-[10px] text-slate-400 ml-auto">{invoiceData.company_name}</span>
                            )}
                        </div>
                        <div className="divide-y divide-slate-100">
                            {clientSide.rows.map((row, i) => (
                                <div
                                    key={i}
                                    className={`grid grid-cols-[20px_1fr_minmax(92px,auto)_88px] items-center gap-2 px-3 py-2 text-xs ${
                                        row.bold ? 'bg-slate-50 font-bold' : ''
                                    } ${row.type === 'total' ? 'border-t-2 border-slate-200' : ''}`}
                                >
                                    <RowIcon type={row.type} />
                                    <span className="flex-1 text-slate-700 truncate">{row.label}</span>
                                    <span className="text-slate-400 tabular-nums whitespace-nowrap">
                                        {row.qty ? `${row.qty} ${row.unit || ''}` : ''}
                                    </span>
                                    <span className="w-20 text-right font-semibold text-slate-900 tabular-nums">
                                        {row.amount !== null ? formatCurrency(row.amount) : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Simulation */}
                    <div className="overflow-hidden rounded-xl border border-emerald-200">
                        <div className="bg-emerald-50 px-4 py-2.5 flex items-center gap-2 border-b border-emerald-200">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Simulación</span>
                            <span className="text-[10px] text-emerald-500 ml-auto">{result.offer.marketer_name}</span>
                        </div>
                        <div className="divide-y divide-emerald-50">
                            {simSide.rows.map((row, i) => (
                                <div
                                    key={i}
                                    className={`grid grid-cols-[20px_1fr_minmax(128px,auto)_88px] items-center gap-2 px-3 py-2 text-xs ${
                                        row.bold ? 'bg-emerald-50/70 font-bold' : ''
                                    } ${row.type === 'total' ? 'border-t-2 border-emerald-200' : ''}`}
                                >
                                    <RowIcon type={row.type} />
                                    <span className="flex-1 text-slate-700 truncate">{row.label}</span>
                                    <span className="text-slate-400 tabular-nums whitespace-nowrap text-right">
                                        {row.qty ? `${row.qty} ${row.unit || ''}` : ''}
                                        {row.price && <span className="block text-[10px] text-emerald-500/70">{row.price}</span>}
                                    </span>
                                    <span className={`w-20 text-right font-semibold tabular-nums ${
                                        row.neg ? 'text-rose-600' : row.bold ? 'text-emerald-700' : 'text-slate-900'
                                    }`}>
                                        {row.amount !== null ? (row.neg ? `−${formatCurrency(Math.abs(row.amount))}` : formatCurrency(row.amount)) : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Annual projection */}
                <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-100/50 border border-emerald-200 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0 mt-0.5">
                            <Scale size={16} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <h4 className="text-sm font-bold text-slate-900">Proyección anual</h4>
                                <TrendingDown size={14} className="text-emerald-600" />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ahorro este periodo</p>
                                    <p className={`text-xl font-black tabular-nums ${periodSavings >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                        {periodSavings >= 0 ? '−' : '+'}{formatCurrency(Math.abs(periodSavings))}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">% de mejora</p>
                                    <p className={`text-xl font-black tabular-nums ${savingsPercent >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                        {savingsPercent.toFixed(1)}%
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ahorro anual (× 11.3)</p>
                                    <p className={`text-xl font-black tabular-nums ${annualSavings >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                        {annualSavings >= 0 ? '' : '−'}{formatCurrency(Math.abs(annualSavings))}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Didactic note */}
                <div className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                    <Info size={13} className="text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                        <strong className="text-slate-600">¿Cómo se calcula?</strong> Aplicamos los precios de la nueva tarifa a tu consumo real (kWh y kW contratados),
                        sumamos impuestos y cargos obligatorios, y comparamos con tu factura actual.
                        El factor ×11.3 estima el ahorro anual asumiendo ~32 días por periodo facturado.
                    </p>
                </div>
            </div>
        </Modal>
    );
};
