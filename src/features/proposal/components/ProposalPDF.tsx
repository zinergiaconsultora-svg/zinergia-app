import React from 'react';
import { InvoiceData, SavingsResult } from '@/types/crm';
import { OptimizationRecommendation, AuditOpportunity } from '@/lib/aletheia/types';

interface ProposalPDFProps {
    invoiceData: InvoiceData;
    result: SavingsResult;
    recommendations: OptimizationRecommendation[];
    opportunities: AuditOpportunity[];
    clientProfile?: { tags: string[]; sales_argument: string; };
}

export const ProposalPDF: React.FC<ProposalPDFProps> = ({
    invoiceData,
    result,
    recommendations,
    opportunities,
    clientProfile
}) => {
    return (
        <div id="proposal-pdf-content" className="bg-white p-8 w-[210mm] min-h-[297mm] mx-auto text-slate-900 font-sans">
            {/* Page 1: Executive Summary */}
            <div className="mb-12">
                <div className="flex justify-between items-center mb-8 border-b border-slate-200 pb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-emerald-700">Propuesta de Ahorro Energético</h1>
                        <p className="text-slate-500 mt-1">Preparado para: <span className="font-semibold text-slate-900">{invoiceData.client_name || 'Cliente'}</span></p>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-slate-400">Fecha</div>
                        <div className="font-medium">{new Date().toLocaleDateString('es-ES')}</div>
                    </div>
                </div>

                {/* Main Savings Card */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-8 mb-8 shadow-xl">
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <h2 className="text-emerald-400 font-medium tracking-wide text-sm uppercase mb-2">Ahorro Estimado Anual</h2>
                            <div className="text-5xl font-bold mb-1">{result.annual_savings.toFixed(0)}€</div>
                            <div className="text-emerald-400/80 text-sm">Reducción del {result.savings_percent.toFixed(1)}%</div>

                            <div className="mt-8 space-y-2">
                                <div className="flex justify-between text-sm opacity-80">
                                    <span>Coste Actual Estimado:</span>
                                    <span>{result.current_annual_cost.toFixed(0)}€/año</span>
                                </div>
                                <div className="flex justify-between text-sm font-semibold">
                                    <span>Nuevo Coste Propuesto:</span>
                                    <span>{result.offer_annual_cost.toFixed(0)}€/año</span>
                                </div>
                            </div>
                        </div>
                        <div className="border-l border-white/10 pl-8 flex flex-col justify-center">
                            <div className="text-sm opacity-60 mb-1">Propuesta Recomendada</div>
                            <div className="text-2xl font-bold mb-4">{result.offer.marketer_name}</div>
                            <div className="inline-block bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-semibold">
                                Tarifa: {result.offer.tariff_name}
                            </div>

                            {clientProfile?.sales_argument && (
                                <div className="mt-6 text-sm italic opacity-80 border-t border-white/10 pt-4">
                                    &quot;{clientProfile.sales_argument}&quot;
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Page 2: Technical Analysis */}
            <div className="break-before-auto">
                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <span className="w-8 h-1 bg-emerald-500 rounded-full"></span>
                    Análisis Técnico (Aletheia)
                </h3>

                {opportunities.length > 0 ? (
                    <div className="space-y-4 mb-8">
                        {opportunities.map((opp, idx) => (
                            <div key={idx} className="bg-amber-50 border border-amber-100 p-4 rounded-lg flex justify-between items-start">
                                <div>
                                    <div className="font-semibold text-amber-900 mb-1">Anomalía Detectada: {opp.type}</div>
                                    <div className="text-sm text-amber-800 opacity-90">{opp.message}</div>
                                </div>
                                {opp.roi_months && (
                                    <div className="text-right">
                                        <div className="text-xs text-amber-600 uppercase font-bold">Retorno Inversión</div>
                                        <div className="font-bold text-amber-900">{opp.roi_months} meses</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-4 bg-slate-50 rounded-lg text-slate-500 text-sm mb-8 italic">
                        No se detectaron anomalías críticas en la potencia o energía reactiva.
                    </div>
                )}

                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <span className="w-8 h-1 bg-blue-500 rounded-full"></span>
                    Recomendaciones de Optimización
                </h3>

                <div className="grid grid-cols-1 gap-4">
                    {recommendations.map((rec, idx) => (
                        <div key={idx} className="flex gap-4 p-4 border border-slate-100 rounded-lg shadow-sm">
                            <div className={`w-1 self-stretch rounded-full ${rec.priority === 'HIGH' ? 'bg-red-500' :
                                rec.priority === 'MEDIUM' ? 'bg-amber-500' : 'bg-blue-500'
                                }`}></div>
                            <div>
                                <h4 className="font-bold text-slate-800">{rec.title}</h4>
                                <p className="text-sm text-slate-600 mt-1">{rec.description}</p>
                                <div className="flex gap-2 mt-2">
                                    {rec.action_items?.map((item, i) => (
                                        <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            {rec.annual_savings > 0 && (
                                <div className="ml-auto text-right self-center">
                                    <div className="text-emerald-600 font-bold">+{rec.annual_savings.toFixed(0)}€</div>
                                    <div className="text-xs text-slate-400">ahorro/año</div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-12 pt-8 border-t border-slate-200 text-center text-xs text-slate-400">
                <p>Generado por Aletheia Engine | Zinergia Consultores</p>
                <p>Este documento es una simulación basada en datos históricos. Los ahorros reales pueden variar.</p>
            </div>
        </div>
    );
};
