'use client';

import React from 'react';
import { toast } from 'sonner';
import { sendProposalEmail } from '@/app/actions/email';
import { SavingsResult, Proposal, InvoiceData } from '@/types/crm';
import { OptimizationRecommendation, AuditOpportunity, AletheiaResult } from '@/lib/aletheia/types';
import { EnergyHistoryEntry } from '@/lib/anomalyDetector';
import { Zap, TrendingDown, Lightbulb } from 'lucide-react';
import { SupervisedConfirmationState } from './SupervisedConfirmationPanel';

interface UseSimulatorResultsActionsArgs {
    results: SavingsResult[];
    invoiceData?: InvoiceData;
    savedProposalId?: string | null;
    optimizationRecommendations?: OptimizationRecommendation[];
    opportunities?: AuditOpportunity[];
    clientProfile?: { tags: string[]; sales_argument: string };
}

export function useSimulatorResultsActions({
    results,
    invoiceData,
    savedProposalId,
    optimizationRecommendations = [],
    opportunities = [],
    clientProfile,
}: UseSimulatorResultsActionsArgs) {
    const [isPresenting, setIsPresenting] = React.useState(false);
    const [isComparing, setIsComparing] = React.useState(false);
    const [isExporting, setIsExporting] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [showExportMenu, setShowExportMenu] = React.useState(false);
    const exportMenuRef = React.useRef<HTMLDivElement>(null);
    const [energyHistory, setEnergyHistory] = React.useState<EnergyHistoryEntry[]>([]);
    const [shareUrl, setShareUrl] = React.useState<string | null>(null);
    const [isGeneratingLink, setIsGeneratingLink] = React.useState(false);
    const [showShareMenu, setShowShareMenu] = React.useState(false);
    const shareMenuRef = React.useRef<HTMLDivElement>(null);
    const [linkCopied, setLinkCopied] = React.useState(false);
    const [supervisedConfirmation, setSupervisedConfirmation] = React.useState<SupervisedConfirmationState>({
        savings: false,
        commission: false,
        sips: false,
        alerts: false,
        calculation: false,
    });
    const isSupervisedConfirmed = Object.values(supervisedConfirmation).every(Boolean);

    const requireSupervisedConfirmation = (actionLabel: string) => {
        if (isSupervisedConfirmed) return true;
        toast.error(`Antes de ${actionLabel}, confirma la revisión supervisada.`);
        return false;
    };

    // Fetch energy history for contextual anomaly explanations
    React.useEffect(() => {
        if (!invoiceData?.cups) return;
        import('@/app/actions/ocr-jobs').then(({ getCupsEnergyHistory }) => {
            getCupsEnergyHistory(invoiceData.cups!).then(history => {
                setEnergyHistory(history.map(h => ({ month: h.month, totalEnergy: h.totalEnergy })));
            }).catch(() => { /* non-critical, ignore */ });
        });
    }, [invoiceData?.cups]);

    // Cerrar el menú al hacer click fuera
    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
                setShowExportMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    // Cerrar share menu al hacer click fuera
    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
                setShowShareMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleGetShareUrl = async (): Promise<string | null> => {
        if (!requireSupervisedConfirmation('compartir la propuesta')) return null;
        if (shareUrl) return shareUrl;
        if (!savedProposalId) return null;
        setIsGeneratingLink(true);
        try {
            const { generatePublicLinkAction } = await import('@/app/actions/publicProposal');
            const result = await generatePublicLinkAction(savedProposalId);
            setShareUrl(result.url);
            return result.url;
        } catch {
            toast.error('No se pudo generar el enlace de compartir');
            return null;
        } finally {
            setIsGeneratingLink(false);
        }
    };

    const handleShareWhatsApp = async () => {
        const url = await handleGetShareUrl();
        if (!url) return;
        const client = invoiceData?.client_name ? ` para ${invoiceData.client_name}` : '';
        const bestSaving = results[0]?.savings_percent;
        const msg = `Propuesta energética Zinergia${client}${bestSaving ? ` — ahorro hasta ${bestSaving.toFixed(0)}%` : ''}:\n${url}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
        setShowShareMenu(false);
    };

    const handleShareEmail = async () => {
        const url = await handleGetShareUrl();
        if (!url) return;
        const client = invoiceData?.client_name || 'tu empresa';
        const bestSaving = results[0]?.savings_percent;
        const subject = `Propuesta de optimización energética — Zinergia`;
        const body = `Hola,\n\nTe comparto la propuesta de optimización energética para ${client}${bestSaving ? `, con un ahorro estimado del ${bestSaving.toFixed(0)}%` : ''}:\n\n${url}\n\nSaludos,\nZinergia`;
        window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_self');
        setShowShareMenu(false);
    };

    const handleCopyLink = async () => {
        const url = await handleGetShareUrl();
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch {
            toast.error('No se pudo copiar el enlace');
        }
        setShowShareMenu(false);
    };

    const [showEmailModal, setShowEmailModal] = React.useState(false);
    const [emailAddress, setEmailAddress] = React.useState('');
    const [isSendingEmail, setIsSendingEmail] = React.useState(false);

    const handleExportPDF = async () => {
        if (!invoiceData || !results[0]) return;
        if (!requireSupervisedConfirmation('exportar el PDF')) return;
        setIsExporting(true);
        try {
            const [{ pdf }, { ProposalPDFDocument }] = await Promise.all([
                import('@react-pdf/renderer'),
                import('@/features/proposal/components/ProposalPDFDocument'),
            ]);

            const element = React.createElement(ProposalPDFDocument, {
                invoiceData,
                results,
                recommendations: optimizationRecommendations,
                opportunities,
                clientProfile,
            });

            // @react-pdf/renderer pdf() accepts Document elements; cast needed as props differ
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const blob = await pdf(element as any).toBlob();

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `zinergia-propuesta-${(invoiceData.client_name ?? 'borrador').replace(/\s+/g, '-')}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('PDF generado correctamente');
        } catch (error) {
            console.error('Error al generar PDF:', error);
            toast.error('Error al generar el PDF');
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportCSV = () => {
        if (!invoiceData || results.length === 0) return;
        const rows: string[][] = [];

        // Header info
        rows.push(['ZINERGIA — Comparativa de Tarifas']);
        rows.push(['Generado', new Date().toLocaleDateString('es-ES')]);
        rows.push([]);
        rows.push(['DATOS DE LA FACTURA']);
        rows.push(['Cliente', invoiceData.client_name ?? '—']);
        rows.push(['CUPS', invoiceData.cups ?? '—']);
        rows.push(['Comercializadora actual', invoiceData.company_name ?? '—']);
        rows.push(['Tarifa actual', invoiceData.tariff_name ?? '—']);
        rows.push(['Período (días)', String(invoiceData.period_days)]);
        rows.push(['Fecha factura', invoiceData.invoice_date ?? '—']);
        rows.push([]);
        rows.push(['CONSUMO POR PERÍODO (kWh)']);
        rows.push(['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
        rows.push([1,2,3,4,5,6].map(p =>
            String((invoiceData[`energy_p${p}` as keyof InvoiceData] as number) || 0)
        ));
        rows.push([]);
        rows.push(['POTENCIA POR PERÍODO (kW)']);
        rows.push(['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
        rows.push([1,2,3,4,5,6].map(p =>
            String((invoiceData[`power_p${p}` as keyof InvoiceData] as number) || 0)
        ));
        rows.push([]);
        rows.push(['COMPARATIVA DE TARIFAS']);
        rows.push(['#', 'Comercializadora', 'Tarifa', 'Coste anual (€)', 'Ahorro vs actual (€)', 'Ahorro (%)']);
        const currentCost = results[0].current_annual_cost;
        rows.push(['ACTUAL', invoiceData.company_name ?? '—', invoiceData.tariff_name ?? '—',
            currentCost.toFixed(2), '0,00', '0,0%']);
        results.forEach((r, i) => {
            rows.push([
                String(i + 1),
                r.offer.marketer_name,
                r.offer.tariff_name,
                r.offer_annual_cost.toFixed(2),
                r.annual_savings.toFixed(2),
                `${r.savings_percent.toFixed(1)}%`,
            ]);
        });

        const csvContent = rows.map(r =>
            r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')
        ).join('\r\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zinergia-comparativa-${invoiceData.client_name?.replace(/\s+/g, '-') || 'factura'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setShowExportMenu(false);
        toast.success('CSV exportado correctamente');
    };

    const handleSaveProposal = async () => {
        if (!invoiceData || !results[0]) return;
        if (!requireSupervisedConfirmation('guardar la propuesta')) return;
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
                aletheiaSummary as AletheiaResult
            );
            toast.success('Propuesta guardada correctamente en CRM');
        } catch (error) {
            console.error('Error saving proposal:', error);
            toast.error('Error al guardar la propuesta');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendEmail = async () => {
        if (!emailAddress || !invoiceData || !results[0]) return;
        if (!requireSupervisedConfirmation('enviar la propuesta')) return;
        setIsSendingEmail(true);
        try {
            // Construct a temporary Proposal object for the PDF generator
            const tempProposal: Proposal = {
                id: 'draft-' + Date.now(),
                client_id: 'temp',
                created_at: new Date().toISOString(),
                status: 'draft',
                offer_snapshot: results[0].offer,
                calculation_data: {
                    ...invoiceData,
                    calculation_audit: results[0].calculation_audit,
                } as InvoiceData,
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
                toast.success('Email enviado correctamente con la propuesta adjunta.');
                setShowEmailModal(false);
                setEmailAddress('');

                // Update proposal status to 'sent' if we have the saved proposal ID
                if (savedProposalId) {
                    const { crmService } = await import('@/services/crmService');
                    await crmService.updateProposalStatus(savedProposalId, 'sent').catch(() => {
                        // Non-critical: don't block UX if status update fails
                    });
                }
            } else {
                toast.error('Error al enviar el email: ' + response.error);
            }
        } catch (error) {
            console.error('Error sending email:', error);
            toast.error('Error al enviar el email');
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

    return {
        isPresenting, setIsPresenting, isComparing, setIsComparing, isExporting, isSaving,
        showExportMenu, setShowExportMenu, exportMenuRef, energyHistory, isGeneratingLink,
        showShareMenu, setShowShareMenu, shareMenuRef, linkCopied, supervisedConfirmation,
        setSupervisedConfirmation, showEmailModal, setShowEmailModal, emailAddress, setEmailAddress,
        isSendingEmail, handleShareWhatsApp, handleShareEmail, handleCopyLink, handleExportPDF,
        handleExportCSV, handleSaveProposal, handleSendEmail, getPriorityColor, getIcon,
    };
}
