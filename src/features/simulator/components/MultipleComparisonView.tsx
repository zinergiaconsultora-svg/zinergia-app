'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Upload, X, FileText, AlertCircle, CheckCircle2, BadgeEuro, Scale, TrendingDown } from 'lucide-react';
import { useMultipleComparison, ComparisonInvoice } from '../hooks/useMultipleComparison';
import { DigitalProposalCard } from '@/features/comparator/components/DigitalProposalCard';
import { buildSupervisedRecommendations, type SupervisedRecommendationKind } from '@/lib/supervised/recommender';
import type { SavingsResult } from '@/types/crm';

const RECOMMENDATION_LABELS: Record<SupervisedRecommendationKind, { label: string; icon: typeof TrendingDown; tone: string }> = {
    max_savings: {
        label: 'Mayor ahorro',
        icon: TrendingDown,
        tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    balanced: {
        label: 'Mejor equilibrio',
        icon: Scale,
        tone: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    best_viable_commission: {
        label: 'Comision viable',
        icon: BadgeEuro,
        tone: 'bg-amber-50 text-amber-700 border-amber-200',
    },
};

function buildRecommendations(results: SavingsResult[]) {
    return buildSupervisedRecommendations(results.map(result => ({
        id: result.offer.id,
        tariffName: result.offer.tariff_name,
        company: result.offer.marketer_name,
        annualSavings: result.annual_savings,
        annualCost: result.offer_annual_cost,
        estimatedAgentCommission: result.offer.estimated_agent_commission,
        criticalAlerts: result.calculation_audit?.alerts.filter(alert => alert.level === 'critical').length || 0,
        warningAlerts: result.calculation_audit?.alerts.filter(alert => alert.level === 'warning').length || 0,
        hasMissingCommission: result.offer.estimated_agent_commission == null,
    })));
}

function getRecommendationResult(results: SavingsResult[], tariffId: string): SavingsResult | undefined {
    return results.find(result => result.offer.id === tariffId);
}

function formatEuro(value: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

export const MultipleComparisonView = () => {
    const { invoices, isProcessing, addInvoice, removeInvoice, reset, canAddMore, isReady } = useMultipleComparison();

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && canAddMore) {
            addInvoice(file);
        }
    };

    const getStatusIcon = (status: ComparisonInvoice['status']) => {
        switch (status) {
            case 'analyzing':
            case 'comparing':
                return <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
            case 'analyzed':
                return <CheckCircle2 className="w-5 h-5 text-amber-600" />;
            case 'completed':
                return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
            case 'error':
                return <AlertCircle className="w-5 h-5 text-red-600" />;
            default:
                return <FileText className="w-5 h-5 text-slate-400" />;
        }
    };

    const getStatusText = (invoice: ComparisonInvoice) => {
        switch (invoice.status) {
            case 'analyzing':
                return 'Analizando...';
            case 'analyzed':
                return 'Analizado';
            case 'comparing':
                return 'Comparando...';
            case 'completed':
                return 'Completado';
            case 'error':
                return invoice.error || 'Error';
            default:
                return 'Pendiente';
        }
    };

    const totalSavings = invoices.reduce((sum, inv) => {
        return sum + (inv.results?.[0]?.annual_savings || 0);
    }, 0);

    const avgSavings = invoices.length > 0 ? totalSavings / invoices.length : 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50/30 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <h1 className="font-display text-4xl md:text-5xl font-bold text-slate-900 mb-4">
                        Comparador <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">Múltiple</span>
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Compara hasta 3 facturas diferentes y encuentra la mejor tarifa para todas
                    </p>
                </motion.div>

                {/* Upload Area */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-8"
                >
                    <div className="flex gap-4 items-center justify-center flex-wrap">
                        {[1, 2, 3].map((num) => {
                            const invoice = invoices[num - 1];
                            return (
                                <div
                                    key={num}
                                    className={`relative w-64 ${
                                        !invoice ? 'border-2 border-dashed border-slate-300' : 'border-2 border-emerald-500'
                                    } rounded-2xl p-6 transition-all ${
                                        !canAddMore && !invoice ? 'opacity-50' : ''
                                    }`}
                                >
                                    {invoice ? (
                                        <div className="space-y-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <p className="font-semibold text-slate-900 truncate">
                                                        {invoice.file.name}
                                                    </p>
                                                    <p className="text-sm text-slate-500">
                                                        {(invoice.file.size / 1024).toFixed(0)} KB
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => removeInvoice(invoice.id)}
                                                    className="p-1 hover:bg-red-100 rounded-lg transition-colors"
                                                >
                                                    <X className="w-4 h-4 text-red-600" />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                {getStatusIcon(invoice.status)}
                                                <span className="text-slate-600">{getStatusText(invoice)}</span>
                                            </div>
                                            {invoice.data && (
                                                <div className="text-xs text-slate-500 bg-slate-50 rounded p-2">
                                                    <p>Tarifa: {invoice.data.tariff_name}</p>
                                                    <p>Importe: €{invoice.data.total_amount?.toFixed(2)}</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center h-full cursor-pointer min-h-[150px]">
                                            <input
                                                type="file"
                                                accept=".pdf"
                                                onChange={handleFileUpload}
                                                disabled={!canAddMore || isProcessing}
                                                className="hidden"
                                            />
                                            <Upload className={`w-8 h-8 mb-2 ${!canAddMore ? 'text-slate-300' : 'text-slate-400'}`} />
                                            <p className="text-sm text-center text-slate-500">
                                                {canAddMore ? `Subir Factura ${num}` : 'Máximo 3 facturas'}
                                            </p>
                                        </label>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {invoices.length > 0 && (
                        <div className="flex justify-center gap-4 mt-6">
                            <button
                                onClick={reset}
                                className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
                            >
                                Limpiar Todo
                            </button>
                        </div>
                    )}
                </motion.div>

                {/* Summary Stats */}
                {invoices.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
                    >
                        <div className="bg-white rounded-xl p-6 shadow-sm">
                            <p className="text-sm text-slate-500 mb-1">Facturas Comparadas</p>
                            <p className="text-3xl font-bold text-slate-900">{invoices.length}</p>
                        </div>
                        <div className="bg-white rounded-xl p-6 shadow-sm">
                            <p className="text-sm text-slate-500 mb-1">Ahorro Promedio</p>
                            <p className="text-3xl font-bold text-emerald-600">€{avgSavings.toFixed(0)}</p>
                        </div>
                        <div className="bg-white rounded-xl p-6 shadow-sm">
                            <p className="text-sm text-slate-500 mb-1">Ahorro Total Potencial</p>
                            <p className="text-3xl font-bold text-emerald-600">€{totalSavings.toFixed(0)}</p>
                        </div>
                    </motion.div>
                )}

                {/* Results */}
                {isReady && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="space-y-8"
                    >
                        {invoices.map((invoice, index) => (
                            <div key={invoice.id} className="space-y-4">
                                <h3 className="text-xl font-bold text-slate-900">
                                    Factura {index + 1}: {invoice.data?.client_name || 'Sin nombre'}
                                </h3>
                                
                                {invoice.results && invoice.results.length > 0 && (
                                    <InvoiceRecommendationBlock
                                        invoiceId={invoice.id}
                                        invoiceData={invoice.data}
                                        results={invoice.results}
                                        onReset={reset}
                                    />
                                )}
                            </div>
                        ))}
                    </motion.div>
                )}

                {/* Processing Overlay */}
                {isProcessing && (
                    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="text-center">
                            <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-lg font-semibold text-slate-900">Comparando facturas...</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

function InvoiceRecommendationBlock({
    invoiceId,
    invoiceData,
    results,
    onReset,
}: {
    invoiceId: string;
    invoiceData?: import('@/types/crm').InvoiceData;
    results: SavingsResult[];
    onReset: () => void;
}) {
    const supervised = buildRecommendations(results);
    const recommendedResults = supervised.recommendations
        .map(recommendation => ({
            recommendation,
            result: getRecommendationResult(results, recommendation.candidate.id),
        }))
        .filter((item): item is {
            recommendation: (typeof supervised.recommendations)[number];
            result: SavingsResult;
        } => Boolean(item.result));

    const fallbackResults = results
        .filter(result => !recommendedResults.some(item => item.result.offer.id === result.offer.id))
        .slice(0, Math.max(0, 3 - recommendedResults.length))
        .map((result, index) => ({
            result,
            title: index === 0 ? 'Alternativa por ahorro' : 'Alternativa',
        }));

    return (
        <div className="space-y-4">
            {recommendedResults.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {recommendedResults.map(({ recommendation, result }) => {
                        const config = RECOMMENDATION_LABELS[recommendation.kind];
                        const Icon = config.icon;
                        return (
                            <div
                                key={`${invoiceId}-rec-${recommendation.kind}-${result.offer.id}`}
                                className={`rounded-xl border p-4 ${config.tone}`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
                                        <Icon size={14} />
                                        {config.label}
                                    </span>
                                    <span className="text-[10px] font-bold uppercase">
                                        {recommendation.confidence}
                                    </span>
                                </div>
                                <p className="mt-2 text-sm font-bold text-slate-900">
                                    {result.offer.marketer_name} · {result.offer.tariff_name}
                                </p>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <p className="opacity-70">Ahorro</p>
                                        <p className="font-bold">{formatEuro(result.annual_savings)}/año</p>
                                    </div>
                                    <div>
                                        <p className="opacity-70">Comision</p>
                                        <p className="font-bold">
                                            {result.offer.estimated_agent_commission != null
                                                ? formatEuro(result.offer.estimated_agent_commission)
                                                : 'Pendiente'}
                                        </p>
                                    </div>
                                </div>
                                <p className="mt-2 text-xs leading-snug opacity-80">{recommendation.reason}</p>
                            </div>
                        );
                    })}
                </div>
            )}

            {supervised.guardrails.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    {supervised.guardrails.map(guardrail => (
                        <p key={guardrail}>{guardrail}</p>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {recommendedResults.map(({ recommendation, result }) => (
                    <DigitalProposalCard
                        key={`${invoiceId}-${recommendation.kind}-${result.offer.id}`}
                        result={result}
                        title={RECOMMENDATION_LABELS[recommendation.kind].label}
                        isSecondary={recommendation.kind !== 'balanced'}
                        invoiceData={invoiceData}
                        onReset={onReset}
                        onEmail={() => {}}
                    />
                ))}
                {fallbackResults.map(({ result, title }) => (
                    <DigitalProposalCard
                        key={`${invoiceId}-fallback-${result.offer.id}`}
                        result={result}
                        title={title}
                        isSecondary
                        invoiceData={invoiceData}
                        onReset={onReset}
                        onEmail={() => {}}
                    />
                ))}
            </div>
        </div>
    );
}
