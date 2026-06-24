'use client';

import React from 'react';
import {
    AlertTriangle,
    BarChart3,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    Copy,
    Download,
    FileText,
    GitCompare,
    Lightbulb,
    Mail,
    MessageCircle,
    Presentation,
    Share2,
    ShieldCheck,
    TableProperties,
    Target,
    TrendingDown,
    Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { DemoModeAlert } from '@/components/ui/DemoModeAlert';
import { Modal } from '@/components/ui/Modal';

import { DigitalProposalCard } from '@/features/comparator/components/DigitalProposalCard';
import { SavingsResult } from '@/types/crm';
import { OptimizationRecommendation, AuditOpportunity } from '@/lib/aletheia/types';
import { detectAnomalies } from '@/lib/anomalyDetector';
import { AnomalyPanel } from '@/components/AnomalyPanel';
import { OpportunityCard } from './Results/OpportunityCard';
import { InvoiceData } from '@/types/crm';
import dynamic from 'next/dynamic';
import { CalculationAuditPanel } from './CalculationAuditPanel';
import { SupervisedRecommendationPanel } from './SupervisedRecommendationPanel';
import { SupervisedRecommendationResult } from '@/lib/supervised/recommender';
import { SupervisedConfirmationPanel } from './SupervisedConfirmationPanel';
import { useSimulatorResultsActions } from './useSimulatorResultsActions';
import { formatCurrency } from '@/lib/utils/format';

const PresentationModal = dynamic(() => import('./PresentationModal'), { ssr: false });
const CompareModal = dynamic(() => import('./CompareModal'), { ssr: false });

interface SimulatorResultsProps {
    results: SavingsResult[];
    isMockMode: boolean;
    onReset: () => void;
    powerType: string;
    optimizationRecommendations?: OptimizationRecommendation[];
    opportunities?: AuditOpportunity[];
    clientProfile?: { tags: string[]; sales_argument: string; };
    invoiceData?: InvoiceData;
    savedProposalId?: string | null;
    supervisedRecommendation?: SupervisedRecommendationResult;
}

export const SimulatorResults: React.FC<SimulatorResultsProps> = ({
    results,
    isMockMode,
    onReset,
    powerType,
    optimizationRecommendations = [],
    opportunities = [],
    invoiceData,
    clientProfile,
    savedProposalId,
    supervisedRecommendation,
}) => {
    const rankedResults = React.useMemo(
        () => results.filter(result => result.annual_savings > 0),
        [results],
    );
    const visibleResults = rankedResults.length > 0 ? rankedResults : results;
    const [selectedOfferId, setSelectedOfferId] = React.useState(visibleResults[0]?.offer.id ?? '');

    React.useEffect(() => {
        if (!visibleResults.length) return;
        const stillExists = visibleResults.some(result => result.offer.id === selectedOfferId);
        if (!stillExists) setSelectedOfferId(visibleResults[0].offer.id);
    }, [selectedOfferId, visibleResults]);

    const selectedResult = visibleResults.find(result => result.offer.id === selectedOfferId) ?? visibleResults[0] ?? results[0];
    const actionResults = React.useMemo(() => {
        if (!selectedResult) return results;
        return [
            selectedResult,
            ...results.filter(result => result.offer.id !== selectedResult.offer.id),
        ];
    }, [results, selectedResult]);

    const {
        isPresenting, setIsPresenting, isComparing, setIsComparing, isExporting, isSaving,
        showExportMenu, setShowExportMenu, exportMenuRef, energyHistory, isGeneratingLink,
        showShareMenu, setShowShareMenu, shareMenuRef, linkCopied, supervisedConfirmation,
        setSupervisedConfirmation, showEmailModal, setShowEmailModal, emailAddress, setEmailAddress,
        isSendingEmail, handleShareWhatsApp, handleShareEmail, handleCopyLink, handleExportPDF,
        handleExportCSV, handleSaveProposal, handleSendEmail, getPriorityColor, getIcon,
    } = useSimulatorResultsActions({ results: actionResults, invoiceData, savedProposalId, optimizationRecommendations, opportunities, clientProfile });

    return (
        <>

            <motion.div
                key="s3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
            >
                {/* Demo Mode Alert */}
                <DemoModeAlert show={isMockMode} />

                {/* Anomalías detectadas en la factura */}
                {invoiceData && (() => {
                    const anomalies = detectAnomalies(invoiceData, energyHistory);
                    return anomalies.length > 0 ? (
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                            className="mb-6"
                        >
                            <AnomalyPanel anomalies={anomalies} />
                        </motion.div>
                    ) : null;
                })()}

                {/* Header mejorado */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6"
                >
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900">Análisis Completo</h2>
                            <p className="text-xs sm:text-sm text-slate-500 font-body mt-0.5">
                                Mejores propuestas para tarifa <span className="font-semibold text-emerald-600">{powerType}</span>
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onReset}
                            className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-600 font-medium text-xs sm:text-sm transition-colors rounded-lg px-2 py-1.5 shrink-0"
                            aria-label="Comenzar nueva simulación"
                        >
                            <ChevronLeft size={14} aria-hidden="true" />
                            <span className="hidden sm:inline">Nueva simulación</span>
                            <span className="sm:hidden">Volver</span>
                        </button>
                    </div>
                    {/* Action buttons row — wraps on mobile */}
                    {invoiceData && (
                        <div className="flex flex-wrap gap-2">
                                        {/* Presentation mode */}
                                <button
                                    type="button"
                                    onClick={() => setIsPresenting(true)}
                                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm transition-colors rounded-lg px-3 py-2"
                                >
                                    <Presentation size={15} />
                                    <span className="hidden sm:inline">Presentar</span>
                                </button>

                                {/* Compare with history */}
                                {invoiceData?.cups && (
                                    <button
                                        type="button"
                                        onClick={() => setIsComparing(true)}
                                        className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm transition-colors rounded-lg px-3 py-2"
                                    >
                                        <GitCompare size={15} />
                                        <span className="hidden sm:inline">Comparar</span>
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={handleSaveProposal}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-lg px-3 py-2 font-display disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span className="hidden sm:inline">Guardando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Zap size={14} aria-hidden="true" />
                                            <span className="hidden sm:inline">Guardar en CRM</span>
                                            <span className="sm:hidden">Guardar</span>
                                        </>
                                    )}
                                </button>
                                {/* Share dropdown */}
                                {savedProposalId && (
                                    <div className="relative" ref={shareMenuRef}>
                                        <button
                                            type="button"
                                            onClick={() => setShowShareMenu(v => !v)}
                                            disabled={isGeneratingLink}
                                            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm transition-colors rounded-lg px-4 py-2 font-display disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isGeneratingLink ? (
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <Share2 size={15} />
                                            )}
                                            Compartir
                                        </button>
                                        {showShareMenu && (
                                            <div className="absolute left-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-slate-200 shadow-xl z-20 overflow-hidden">
                                                <button
                                                    type="button"
                                                    onClick={handleShareWhatsApp}
                                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-green-50 transition-colors"
                                                >
                                                    <MessageCircle size={14} className="text-green-500" />
                                                    Enviar por WhatsApp
                                                </button>
                                                <div className="border-t border-slate-100" />
                                                <button
                                                    type="button"
                                                    onClick={handleShareEmail}
                                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                                >
                                                    <Mail size={14} className="text-slate-400" />
                                                    Enviar por email
                                                </button>
                                                <div className="border-t border-slate-100" />
                                                <button
                                                    type="button"
                                                    onClick={handleCopyLink}
                                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                                >
                                                    {linkCopied
                                                        ? <Check size={14} className="text-emerald-500" />
                                                        : <Copy size={14} className="text-slate-400" />
                                                    }
                                                    {linkCopied ? '¡Copiado!' : 'Copiar enlace'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {/* Export dropdown */}
                                <div className="relative" ref={exportMenuRef}>
                                    <button
                                        type="button"
                                        onClick={() => setShowExportMenu(v => !v)}
                                        disabled={isExporting}
                                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg px-3 py-2 font-display disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isExporting ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Exportando...
                                            </>
                                        ) : (
                                            <>
                                                <Download size={16} />
                                                Exportar
                                                <ChevronDown size={13} className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                                            </>
                                        )}
                                    </button>
                                    {showExportMenu && (
                                        <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl border border-slate-200 shadow-xl z-20 overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() => { setShowExportMenu(false); handleExportPDF(); }}
                                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                            >
                                                <FileText size={14} className="text-slate-400" />
                                                Propuesta PDF
                                            </button>
                                            <div className="border-t border-slate-100" />
                                            <button
                                                type="button"
                                                onClick={handleExportCSV}
                                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                            >
                                                <TableProperties size={14} className="text-slate-400" />
                                                Comparativa CSV
                                            </button>
                                        </div>
                                    )}
                                </div>
                        </div>
                    )}
                </motion.div>

                {selectedResult && (
                    <DecisionCommandCenter
                        result={selectedResult}
                        invoiceData={invoiceData}
                        optionCount={visibleResults.length}
                    />
                )}

                {/* Sección de Optimizaciones */}
                {optimizationRecommendations && optimizationRecommendations.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="mb-8"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Lightbulb className="w-5 h-5 text-amber-500" />
                            <h3 className="text-lg font-semibold text-slate-900">Recomendaciones de Optimización</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            {optimizationRecommendations.slice(0, 3).map((rec, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 + idx * 0.1 }}
                                    className={`p-4 rounded-lg border-2 ${getPriorityColor(rec.priority)} bg-white`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 mt-0.5">
                                            {getIcon(rec.type)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex flex-col gap-2">
                                                {rec.annual_savings > 0 && (
                                                    <div className="text-xl font-bold">
                                                        {rec.annual_savings.toFixed(0)}€
                                                        <span className="text-xs font-medium opacity-75 ml-1">ahorro/año</span>
                                                    </div>
                                                )}
                                                <h4 className="font-semibold text-sm">{rec.title}</h4>
                                                <p className="text-xs opacity-90">{rec.description}</p>
                                                {rec.action_items && rec.action_items.length > 0 && (
                                                    <ul className="mt-1 space-y-1">
                                                        {rec.action_items.slice(0, 3).map((item, i) => (
                                                            <li key={i} className="text-xs flex items-start gap-2">
                                                                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-current mt-1.5 opacity-70" />
                                                                <span>{item}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Sección de Oportunidades de Auditoría (Reactiva / Maxímetro) */}
                {opportunities && opportunities.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="mb-8"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-2 bg-amber-100 rounded-lg">
                                <TrendingDown className="w-5 h-5 text-amber-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">Anomalías Detectadas</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {opportunities.map((opp, idx) => (
                                <OpportunityCard
                                    key={idx}
                                    opportunity={opp}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Separador */}
                {optimizationRecommendations && optimizationRecommendations.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-4 my-8"
                    >
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
                        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-200">
                            <Zap className="w-4 h-4 text-emerald-600" />
                            <span className="text-sm font-semibold text-emerald-700">Top 3 Propuestas</span>
                        </div>
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
                    </motion.div>
                )}

                {selectedResult && visibleResults.length > 0 && (
                    <OfferRankingPanel
                        results={visibleResults}
                        selectedOfferId={selectedResult.offer.id}
                        onSelect={setSelectedOfferId}
                    />
                )}

                {selectedResult?.calculation_audit && (
                    <CalculationAuditPanel audit={selectedResult.calculation_audit} />
                )}

                {supervisedRecommendation && (
                    <SupervisedRecommendationPanel recommendation={supervisedRecommendation} />
                )}

                <SupervisedConfirmationPanel
                    value={supervisedConfirmation}
                    onChange={setSupervisedConfirmation}
                    recommendation={supervisedRecommendation}
                    alertCount={selectedResult?.calculation_audit?.alerts?.length || 0}
                />

                {/* Grid de resultados con stagger */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                    className="flex flex-col gap-2"
                >
                    {actionResults.filter(r => r.annual_savings > 0).map((result, idx) => (
                        <motion.div
                            key={result.offer.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.06, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                        >
                            <DigitalProposalCard
                                result={idx === 0 ? result : { ...result, optimization_result: undefined }}
                                title={idx === 0 ? "Propuesta Activa" : `Alternativa ${idx}`}
                                isSecondary={idx > 0}
                                invoiceData={invoiceData}
                                onReset={onReset}
                                onEmail={() => setShowEmailModal(true)}
                            />
                        </motion.div>
                    ))}
                </motion.div>
            </motion.div>

            {/* Presentation Modal */}
            {isPresenting && invoiceData && actionResults[0] && (
                <PresentationModal
                    results={actionResults}
                    invoiceData={invoiceData}
                    recommendations={optimizationRecommendations}
                    onClose={() => setIsPresenting(false)}
                />
            )}

            {/* Compare with history Modal */}
            {isComparing && invoiceData?.cups && actionResults[0] && (
                <CompareModal
                    cups={invoiceData.cups}
                    currentResults={actionResults}
                    currentCost={actionResults[0].current_annual_cost}
                    onClose={() => setIsComparing(false)}
                />
            )}

            {/* Email Modal */}
            <Modal
                isOpen={showEmailModal}
                onClose={() => setShowEmailModal(false)}
                title="Enviar Propuesta por Email"
            >
                <div className="space-y-4">
                    <p className="text-slate-600 text-sm">
                        Enviaremos un resumen de la propuesta de ahorro a la dirección proporcionada.
                    </p>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email del Cliente</label>
                        <input
                            type="email"
                            value={emailAddress}
                            onChange={(e) => setEmailAddress(e.target.value)}
                            placeholder="cliente@ejemplo.com"
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={() => setShowEmailModal(false)}
                            className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSendEmail}
                            disabled={isSendingEmail || !emailAddress}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSendingEmail ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                'Enviar Propuesta'
                            )}
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

function getPeriodCost(result: SavingsResult, side: 'current' | 'simulated') {
    const audit = result.calculation_audit;
    if (side === 'current') return audit?.currentInvoiceTotal ?? result.current_annual_cost / 11.3;
    return audit?.simulatedInvoiceTotal ?? result.offer_annual_cost / 11.3;
}

function getQualitySummary(result: SavingsResult) {
    const alerts = result.calculation_audit?.alerts ?? [];
    const critical = alerts.filter(alert => alert.level === 'critical').length;
    const warning = alerts.filter(alert => alert.level === 'warning').length;

    if (critical > 0) {
        return {
            label: 'Revisión crítica',
            detail: `${critical} alerta${critical === 1 ? '' : 's'} crítica${critical === 1 ? '' : 's'} antes de enviar`,
            tone: 'border-rose-200 bg-rose-50 text-rose-700',
            icon: AlertTriangle,
        };
    }

    if (warning > 0) {
        return {
            label: 'Revisar avisos',
            detail: `${warning} aviso${warning === 1 ? '' : 's'} de cálculo o datos`,
            tone: 'border-amber-200 bg-amber-50 text-amber-700',
            icon: AlertTriangle,
        };
    }

    return {
        label: 'Lista para presentar',
        detail: 'Sin alertas relevantes en la mejor lectura actual',
        tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        icon: ShieldCheck,
    };
}

function buildCommercialArgument(result: SavingsResult) {
    const periodSavings = result.calculation_audit?.periodSavings ?? result.annual_savings / 11.3;
    const commission = result.offer.estimated_agent_commission;

    if (result.savings_percent >= 20 && periodSavings > 0) {
        return `La propuesta reduce la factura de forma clara sin cambiar el consumo: ${formatCurrency(periodSavings, 0)} menos en este periodo y ${formatCurrency(result.annual_savings, 0)} estimados al año.`;
    }

    if (commission && commission > 0) {
        return `La propuesta mantiene una mejora económica defendible y una comisión estimada de ${formatCurrency(commission, 0)} para priorizar seguimiento comercial.`;
    }

    return 'La propuesta es útil si el cliente prioriza simplicidad, cambio de comercializadora o revisión de condiciones actuales.';
}

function DecisionCommandCenter({
    result,
    invoiceData,
    optionCount,
}: {
    result: SavingsResult;
    invoiceData?: InvoiceData;
    optionCount: number;
}) {
    const quality = getQualitySummary(result);
    const QualityIcon = quality.icon;
    const currentPeriod = getPeriodCost(result, 'current');
    const simulatedPeriod = getPeriodCost(result, 'simulated');
    const periodSavings = currentPeriod - simulatedPeriod;
    const commission = result.offer.estimated_agent_commission;
    const clientName = invoiceData?.client_name || 'Cliente sin nombre';

    return (
        <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="relative overflow-hidden bg-slate-950 px-5 py-5 text-white">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.20),transparent_45%)]" />
                    <div className="relative">
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-emerald-200 ring-1 ring-white/10">
                                <Target size={13} />
                                Propuesta activa
                            </span>
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${quality.tone}`}>
                                <QualityIcon size={13} />
                                {quality.label}
                            </span>
                        </div>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{clientName}</p>
                                <h3 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                                    {result.offer.marketer_name}
                                </h3>
                                <p className="mt-1 truncate text-sm text-slate-300">{result.offer.tariff_name}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-3 sm:min-w-[340px]">
                                <HeroMetric label="Actual" value={formatCurrency(currentPeriod, 0)} muted />
                                <HeroMetric label="Simulada" value={formatCurrency(simulatedPeriod, 0)} />
                                <HeroMetric label="Ahorro" value={formatCurrency(periodSavings, 0)} positive={periodSavings >= 0} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-5 py-5">
                    <div className="grid grid-cols-2 gap-3">
                        <DecisionMetric label="Ahorro anual" value={formatCurrency(result.annual_savings, 0)} strong />
                        <DecisionMetric label="Mejora" value={`${result.savings_percent.toFixed(1)}%`} strong />
                        <DecisionMetric label="Comisión" value={commission != null ? formatCurrency(commission, 0) : '—'} />
                        <DecisionMetric label="Opciones válidas" value={String(optionCount)} />
                    </div>
                    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Argumento comercial</p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-700">{buildCommercialArgument(result)}</p>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">{quality.detail}</p>
                </div>
            </div>
        </section>
    );
}

function HeroMetric({ label, value, muted = false, positive = false }: { label: string; value: string; muted?: boolean; positive?: boolean }) {
    return (
        <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className={`mt-1 text-lg font-black tabular-nums ${muted ? 'text-slate-400 line-through' : positive ? 'text-emerald-300' : 'text-white'}`}>
                {value}
            </p>
        </div>
    );
}

function DecisionMetric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
    return (
        <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className={`mt-1 tabular-nums ${strong ? 'text-xl font-black text-emerald-700' : 'text-sm font-bold text-slate-800'}`}>
                {value}
            </p>
        </div>
    );
}

function OfferRankingPanel({
    results,
    selectedOfferId,
    onSelect,
}: {
    results: SavingsResult[];
    selectedOfferId: string;
    onSelect: (offerId: string) => void;
}) {
    return (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                        <BarChart3 size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-extrabold text-slate-900">Ranking operativo de propuestas</h3>
                        <p className="text-xs text-slate-500">Selecciona una tarifa para actualizar el desglose y las acciones.</p>
                    </div>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {results.length} propuesta{results.length === 1 ? '' : 's'} con ahorro
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
                    <thead>
                        <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                            <th className="px-3 py-1">Prioridad</th>
                            <th className="px-3 py-1">Tarifa</th>
                            <th className="px-3 py-1 text-right">Coste anual</th>
                            <th className="px-3 py-1 text-right">Ahorro</th>
                            <th className="px-3 py-1 text-right">Comisión</th>
                            <th className="px-3 py-1">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((result, index) => {
                            const selected = result.offer.id === selectedOfferId;
                            const quality = getQualitySummary(result);
                            const alerts = result.calculation_audit?.alerts ?? [];
                            const commission = result.offer.estimated_agent_commission;
                            return (
                                <tr key={result.offer.id}>
                                    <td colSpan={6} className="p-0">
                                        <button
                                            type="button"
                                            onClick={() => onSelect(result.offer.id)}
                                            aria-pressed={selected}
                                            className={`grid w-full grid-cols-[92px_1fr_120px_120px_120px_150px] items-center rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                                                selected
                                                    ? 'border-emerald-300 bg-emerald-50 text-slate-900'
                                                    : 'border-slate-100 bg-slate-50/60 text-slate-700 hover:border-slate-200 hover:bg-white'
                                            }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black ${selected ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500'}`}>
                                                    {index + 1}
                                                </span>
                                                {index === 0 && <CheckCircle2 size={15} className="text-emerald-600" />}
                                            </span>
                                            <span className="min-w-0 pr-3">
                                                <span className="block truncate text-sm font-extrabold">{result.offer.marketer_name}</span>
                                                <span className="block truncate text-xs text-slate-500">{result.offer.tariff_name}</span>
                                            </span>
                                            <span className="text-right font-bold tabular-nums">{formatCurrency(result.offer_annual_cost, 0)}</span>
                                            <span className="text-right font-black text-emerald-700 tabular-nums">
                                                {formatCurrency(result.annual_savings, 0)}
                                                <span className="ml-1 text-xs font-bold text-emerald-500">({result.savings_percent.toFixed(1)}%)</span>
                                            </span>
                                            <span className="text-right font-bold tabular-nums text-indigo-700">
                                                {commission != null ? formatCurrency(commission, 0) : '—'}
                                            </span>
                                            <span className={`justify-self-start rounded-full border px-2.5 py-1 text-xs font-bold ${quality.tone}`}>
                                                {alerts.length > 0 ? `${alerts.length} aviso${alerts.length === 1 ? '' : 's'}` : 'Sin avisos'}
                                            </span>
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
