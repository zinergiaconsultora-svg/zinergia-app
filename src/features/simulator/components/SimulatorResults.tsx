'use client';

import React from 'react';
import { ChevronLeft, Lightbulb, TrendingDown, Zap, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { DemoModeAlert } from '@/components/ui/DemoModeAlert';
import { Modal } from '@/components/ui/Modal';
import { sendProposalEmail } from '@/app/actions/email';

import { DigitalProposalCard } from '@/features/comparator/components/DigitalProposalCard';
import { SavingsResult, Proposal } from '@/types/crm';
import { OptimizationRecommendation, AuditOpportunity } from '@/lib/aletheia/types';
import { OpportunityCard } from './Results/OpportunityCard';
import { ProposalPDF } from '@/features/proposal/components/ProposalPDF';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { InvoiceData } from '@/types/crm';

interface SimulatorResultsProps {
    results: SavingsResult[];
    isMockMode: boolean;
    onReset: () => void;
    powerType: string;
    optimizationRecommendations?: OptimizationRecommendation[];
    opportunities?: AuditOpportunity[];
    clientProfile?: { tags: string[]; sales_argument: string; };
    invoiceData?: InvoiceData;
}

export const SimulatorResults: React.FC<SimulatorResultsProps> = ({
    results,
    isMockMode,
    onReset,
    powerType,
    optimizationRecommendations = [],
    opportunities = [],
    invoiceData,
    clientProfile
}) => {
    const [isExporting, setIsExporting] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [showEmailModal, setShowEmailModal] = React.useState(false);
    const [emailAddress, setEmailAddress] = React.useState('');
    const [isSendingEmail, setIsSendingEmail] = React.useState(false);

    const pdfRef = React.useRef<HTMLDivElement>(null);

    const handleExportPDF = async () => {
        if (!invoiceData || !results[0] || !pdfRef.current) return;
        setIsExporting(true);
        try {
            const canvas = await html2canvas(pdfRef.current, {
                scale: 2, // Retain high quality
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');


            // Just fit width, as it's A4 designed
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgX = 0;
            const imgY = 0;
            const imgFinalWidth = pdfWidth;
            const imgFinalHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', imgX, imgY, imgFinalWidth, imgFinalHeight);

            // If height exceeds A4, we might need multi-page logic, but ProposalPDF is designed for single/double page flow.
            // For now, let's assume it fits or scales down. 
            // Better strategy: If content is long, html2canvas capture might be too tall.
            // But ProposalPDF styles are 'min-h-[297mm]' (A4). 
            // If content overflows, we might want to split.
            // For MVP, simple image placement is standard.

            pdf.save(`zinergia-proposal-${invoiceData.client_name || 'draft'}.pdf`);
        } catch (error) {
            console.error('Error exporting PDF:', error);
            alert('Error al generar el PDF');
        } finally {
            setIsExporting(false);
        }
    };

    const handleSaveProposal = async () => {
        if (!invoiceData || !results[0]) return;
        setIsSaving(true);
        try {
            // Dynamic import to avoid SSR issues with crmService if any
            const { crmService } = await import('@/services/crmService');

            // Reconstruct AletheiaResult structure for saving
            const aletheiaSummary = {
                client_profile: clientProfile || { tags: [], sales_argument: '' },
                opportunities: opportunities,
                optimization_recommendations: optimizationRecommendations,
                // These are needed for the type but technically redundant if we just want the summary
                analysis_meta: { invoice_days: invoiceData.period_days, projected_annual_kwh: 0, seasonality_factor_applied: 1 },
                current_status: { annual_projected_cost: 0, avg_price_kwh: 0, inefficiencies_detected: [] },
                top_proposals: []
            };

            await crmService.logSimulation(
                invoiceData,
                results[0],
                invoiceData.client_name,
                aletheiaSummary as any // Cast as partial AletheiaResult is acceptable for the service logic
            );
            alert('Propuesta guardada correctamente en CRM');
        } catch (error) {
            console.error('Error saving proposal:', error);
            alert('Error al guardar la propuesta');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendEmail = async () => {
        if (!emailAddress || !invoiceData || !results[0]) return;
        setIsSendingEmail(true);
        try {
            // Construct a temporary Proposal object for the PDF generator
            const tempProposal: Proposal = {
                id: 'draft-' + Date.now(),
                client_id: 'temp',
                created_at: new Date().toISOString(),
                status: 'draft',
                offer_snapshot: results[0].offer,
                calculation_data: invoiceData,
                current_annual_cost: results[0].current_annual_cost,
                offer_annual_cost: results[0].offer_annual_cost,
                annual_savings: results[0].annual_savings,
                savings_percent: results[0].savings_percent,
                aletheia_summary: {
                    client_profile: clientProfile || { tags: [], sales_argument: '' },
                    opportunities: opportunities || [],
                    recommendations: optimizationRecommendations || []
                }
            };

            const response = await sendProposalEmail(
                emailAddress,
                invoiceData.client_name || 'Cliente',
                tempProposal
            );

            if (response.success) {
                alert('Email enviado correctamente con la propuesta adjunta.');
                setShowEmailModal(false);
                setEmailAddress('');
            } else {
                alert('Error al enviar el email: ' + response.error);
            }
        } catch (error) {
            console.error('Error sending email:', error);
            alert('Error al enviar el email');
        } finally {
            setIsSendingEmail(false);
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'HIGH': return 'text-red-600 bg-red-50 border-red-200';
            case 'MEDIUM': return 'text-amber-600 bg-amber-50 border-amber-200';
            case 'LOW': return 'text-blue-600 bg-blue-50 border-blue-200';
            default: return 'text-slate-600 bg-slate-50 border-slate-200';
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'POWER_OPTIMIZATION': return <Zap className="w-5 h-5" />;
            case 'ENERGY_SHIFT':
            case 'EFFICIENCY_AUDIT': return <TrendingDown className="w-5 h-5" />;
            default: return <Lightbulb className="w-5 h-5" />;
        }
    };

    return (
        <>
            {/* Hidden PDF Container */}
            <div className="absolute left-[-9999px] top-0">
                <div ref={pdfRef}>
                    {invoiceData && results[0] && (
                        <ProposalPDF
                            invoiceData={invoiceData}
                            result={results[0]} // Pass the best result
                            recommendations={optimizationRecommendations}
                            opportunities={opportunities}
                            clientProfile={clientProfile}
                        />
                    )}
                </div>
            </div>

            <motion.div
                key="s3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
            >
                {/* Demo Mode Alert */}
                <DemoModeAlert show={isMockMode} />

                {/* Header mejorado */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between mb-6"
                >
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onReset}
                            className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-medium text-sm transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg px-2 py-1 font-display"
                            aria-label="Comenzar nueva simulación"
                        >
                            <ChevronLeft size={16} aria-hidden="true" />
                            Nueva simulación
                        </button>
                        {invoiceData && (
                            <>
                                <button
                                    onClick={handleSaveProposal}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-lg px-4 py-2 font-display disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Zap size={16} aria-hidden="true" />
                                            Guardar en CRM
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={handleExportPDF}
                                    disabled={isExporting}
                                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg px-4 py-2 font-display disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isExporting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Exportando...
                                        </>
                                    ) : (
                                        <>
                                            <Download size={16} aria-hidden="true" />
                                            Exportar PDF
                                        </>
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                    <div className="text-right">
                        <h2 className="font-display text-2xl font-bold text-slate-900">Análisis Completo</h2>
                        <p className="text-sm text-slate-500 font-body">
                            Optimizaciones y mejores propuestas para tarifa <span className="font-semibold text-emerald-600">{powerType}</span>
                        </p>
                    </div>
                </motion.div>

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
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <h4 className="font-semibold text-sm">{rec.title}</h4>
                                                    <p className="text-xs mt-1 opacity-90">{rec.description}</p>
                                                    {rec.action_items && rec.action_items.length > 0 && (
                                                        <ul className="mt-2 space-y-1">
                                                            {rec.action_items.slice(0, 3).map((item, i) => (
                                                                <li key={i} className="text-xs flex items-start gap-2">
                                                                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-current mt-1.5 opacity-70" />
                                                                    <span>{item}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                                {rec.annual_savings > 0 && (
                                                    <div className="text-right flex-shrink-0">
                                                        <div className="text-2xl font-bold">
                                                            {rec.annual_savings.toFixed(0)}€
                                                        </div>
                                                        <div className="text-xs opacity-75">ahorro/año</div>
                                                    </div>
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

                {/* Grid de resultados con stagger */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                    className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start"
                >
                    {results.slice(0, 3).map((result, idx) => (
                        <motion.div
                            key={result.offer.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.15, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                        >
                            <DigitalProposalCard
                                result={idx === 0 ? result : { ...result, optimization_result: undefined }}
                                title={idx === 0 ? "Mejor Opción Ahorro" : "Alternativa Competitiva"}
                                isSecondary={idx > 0}
                                onReset={onReset}
                                onEmail={() => setShowEmailModal(true)}
                            />
                        </motion.div>
                    ))}
                </motion.div>
            </motion.div>

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
                            onClick={() => setShowEmailModal(false)}
                            className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium"
                        >
                            Cancelar
                        </button>
                        <button
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
