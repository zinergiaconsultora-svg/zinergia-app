'use client';

import React from 'react';
import { InvoiceData, Offer } from '../../../types/crm';
import { ArrowDown, X } from 'lucide-react';

interface PriceTableProps {
    invoice: InvoiceData;
    offer: Offer;
}

export const PriceComparisonTable: React.FC<PriceTableProps> = ({ invoice, offer }) => {
    // Helper to determine if we have custom prices
    const hasCustomPrices = (invoice.current_energy_price_p1 || 0) > 0;

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h4 className="font-bold text-slate-800">Detalle de Precios Unitarios</h4>
                <p className="text-sm text-slate-500">Comparativa directa por periodo (P1-P6)</p>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                        <tr>
                            <th className="px-6 py-4">Periodo</th>
                            <th className="px-6 py-4 text-center">Tu Precio (Energía)</th>
                            <th className="px-6 py-4 text-center text-energy-600">Oferta Zinergia</th>
                            <th className="px-6 py-4 text-center">Diferencia</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {[1, 2, 3, 4, 5, 6].map((p) => {
                            const pKey = `p${p}` as 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6'; // Type assertion
                            const currentPrice = invoice[`current_energy_price_${pKey}`] || 0.18; // Default fallback for display
                            const offerPrice = offer.energy_price[pKey];
                            const diff = ((offerPrice - currentPrice) / currentPrice) * 100;
                            const isCheaper = diff < 0;

                            return (
                                <tr key={p} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-400">P{p}</td>
                                    <td className="px-6 py-4 text-center font-medium text-slate-600">
                                        {hasCustomPrices ? (
                                            `${currentPrice.toFixed(6)} €/kWh`
                                        ) : (
                                            <span className="text-slate-400 italic" title="Precio estimado de mercado">~{currentPrice.toFixed(2)} (Est.)</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center font-bold text-slate-900">
                                        {offerPrice.toFixed(6)} €/kWh
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${isCheaper ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {isCheaper ? <ArrowDown size={12} /> : <X size={12} />}
                                            {Math.abs(diff).toFixed(1)}%
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {!hasCustomPrices && (
                <div className="px-6 py-3 bg-amber-50 text-amber-700 text-xs font-medium border-t border-amber-100 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Estás comparando contra una estimación de mercado. Para mayor precisión, configura tus precios actuales en el paso anterior.
                </div>
            )}
        </div>
    );
};
