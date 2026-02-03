import React, { useRef, useState, useEffect, useMemo } from 'react';
import { SavingsResult } from '../../../types/crm';
import { Download, Mail, ShieldCheck, Zap, Loader2, FileText, TrendingDown, Lightbulb } from 'lucide-react';
import dynamic from 'next/dynamic';
import { formatCurrency } from '@/lib/utils/format';

// Dynamic import for QR code to reduce bundle size
const QRCodeSVG = dynamic(
    () => import('qrcode.react').then((mod) => mod.QRCodeSVG),
    { ssr: false, loading: () => <div className="w-20 h-20 bg-slate-100 rounded-2xl animate-pulse" /> }
);

interface DigitalProposalCardProps {
    result: SavingsResult;
    onReset?: () => void;
    onEmail: () => void;
    title?: string;
    isSecondary?: boolean;
    initialNotes?: string;
    onNotesChange?: (notes: string) => void;
}

export const DigitalProposalCard: React.FC<DigitalProposalCardProps> = ({
    result,
    onReset,
    onEmail,
    title = "Recomendación Principal",
    isSecondary = false,
    initialNotes,
    onNotesChange
}) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [advisorNotes, setAdvisorNotes] = useState(initialNotes || '');
    const [offerValidity] = useState('48 horas');

    // Generate document ID and date - memoized to prevent recalculation on every render
    const documentId = useMemo(() =>
        `ZIN-${new Date().getFullYear()}-${result.offer.id.slice(0, 6).toUpperCase()}`,
        [result.offer.id]
    );
    const documentDate = useMemo(() =>
        new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
        []
    );

    // Sync notes with parent
    useEffect(() => {
        if (onNotesChange) {
            onNotesChange(advisorNotes);
        }
    }, [advisorNotes, onNotesChange]);

    const handleWhatsAppShare = () => {
        const text = `Hola, te adjunto la propuesta de Zinergia con un ahorro de ${formatCurrency(result.annual_savings)}. Puedes ver los detalles aquí: ${window.location.href}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleDownloadPdf = async () => {
        if (!cardRef.current) {
            console.error('[PDF] cardRef is null');
            return;
        }
        setIsGeneratingPdf(true);

        try {
            const printWindow = window.open('', '_blank', 'width=900,height=700');
            if (!printWindow) {
                alert('Permite las ventanas emergentes para descargar el PDF');
                setIsGeneratingPdf(false);
                return;
            }

            // Enhanced print styles for professional PDF
            const printStyles = `
                @page { 
                    size: A4; 
                    margin: 12mm 15mm; 
                }
                @media print { 
                    body { 
                        margin: 0 !important; 
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    } 
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                }
                * { box-sizing: border-box; }
                body { 
                    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; 
                    background: #fff; 
                    color: #1e293b;
                    line-height: 1.5;
                    font-size: 11px;
                }
                .pdf-container { max-width: 100%; }
                .pdf-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    padding-bottom: 16px;
                    border-bottom: 2px solid #1e293b;
                    margin-bottom: 20px;
                }
                .pdf-logo-section { display: flex; align-items: center; gap: 12px; }
                .pdf-logo {
                    width: 48px;
                    height: 48px;
                    background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 24px;
                }
                .pdf-company-name {
                    font-size: 28px;
                    font-weight: 800;
                    letter-spacing: -0.5px;
                    color: #1e293b;
                }
                .pdf-company-name span { color: #4f46e5; }
                .pdf-tagline {
                    font-size: 9px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    color: #64748b;
                }
                .pdf-doc-info { text-align: right; }
                .pdf-doc-label {
                    font-size: 8px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    color: #94a3b8;
                    margin-bottom: 2px;
                }
                .pdf-doc-value {
                    font-size: 11px;
                    font-weight: 700;
                    font-family: 'Consolas', monospace;
                    color: #1e293b;
                }
                .pdf-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    background: #ecfdf5;
                    color: #059669;
                    border-radius: 20px;
                    font-size: 9px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-top: 8px;
                }
                .pdf-executive-summary {
                    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
                    color: white;
                    border-radius: 16px;
                    padding: 24px;
                    margin-bottom: 20px;
                    display: grid;
                    grid-template-columns: 1fr auto;
                    gap: 24px;
                    align-items: center;
                }
                .pdf-savings-amount {
                    font-size: 42px;
                    font-weight: 900;
                    letter-spacing: -1px;
                    line-height: 1;
                }
                .pdf-savings-label {
                    font-size: 10px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    color: #a5b4fc;
                    margin-bottom: 8px;
                }
                .pdf-savings-note {
                    font-size: 10px;
                    color: #94a3b8;
                    margin-top: 8px;
                    max-width: 280px;
                }
                .pdf-percent-circle {
                    width: 80px;
                    height: 80px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 50%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    border: 3px solid #10b981;
                }
                .pdf-percent-value {
                    font-size: 24px;
                    font-weight: 900;
                    color: #10b981;
                }
                .pdf-percent-label {
                    font-size: 8px;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: #64748b;
                }
                .pdf-comparison-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 12px;
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid rgba(255,255,255,0.1);
                }
                .pdf-comparison-item { text-align: center; }
                .pdf-comparison-label {
                    font-size: 8px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: #64748b;
                    margin-bottom: 4px;
                }
                .pdf-comparison-value {
                    font-size: 14px;
                    font-weight: 700;
                }
                .pdf-section {
                    margin-bottom: 16px;
                    padding: 16px;
                    background: #f8fafc;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                }
                .pdf-section-title {
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    color: #64748b;
                    margin-bottom: 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .pdf-section-dot {
                    width: 6px;
                    height: 6px;
                    background: #4f46e5;
                    border-radius: 50%;
                }
                .pdf-offer-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .pdf-offer-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .pdf-offer-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    font-weight: 700;
                    color: white;
                }
                .pdf-offer-label {
                    font-size: 8px;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: #94a3b8;
                }
                .pdf-offer-value {
                    font-size: 12px;
                    font-weight: 700;
                    color: #1e293b;
                }
                .pdf-price-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 10px;
                }
                .pdf-price-table th {
                    background: #1e293b;
                    color: white;
                    padding: 8px 10px;
                    text-align: left;
                    font-weight: 600;
                    font-size: 9px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .pdf-price-table th:first-child { border-radius: 8px 0 0 0; }
                .pdf-price-table th:last-child { border-radius: 0 8px 0 0; }
                .pdf-price-table td {
                    padding: 8px 10px;
                    border-bottom: 1px solid #e2e8f0;
                }
                .pdf-price-table tr:nth-child(even) td { background: #f8fafc; }
                .pdf-price-table .highlight { 
                    color: #059669; 
                    font-weight: 700; 
                }
                .pdf-optimization {
                    background: #ecfdf5;
                    border: 1px solid #a7f3d0;
                    border-radius: 12px;
                    padding: 16px;
                    margin-bottom: 16px;
                }
                .pdf-optimization-title {
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: #059669;
                    margin-bottom: 12px;
                }
                .pdf-optimization-grid {
                    display: grid;
                    grid-template-columns: repeat(6, 1fr);
                    gap: 8px;
                    text-align: center;
                }
                .pdf-optimization-item label {
                    display: block;
                    font-size: 8px;
                    font-weight: 600;
                    color: #64748b;
                    margin-bottom: 2px;
                }
                .pdf-optimization-item span {
                    font-size: 13px;
                    font-weight: 800;
                    color: #1e293b;
                }
                .pdf-notes {
                    background: #fffbeb;
                    border-left: 4px solid #f59e0b;
                    padding: 12px 16px;
                    border-radius: 0 8px 8px 0;
                    margin-bottom: 16px;
                }
                .pdf-notes-title {
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #92400e;
                    margin-bottom: 6px;
                }
                .pdf-notes-content {
                    font-size: 11px;
                    color: #78350f;
                    font-style: italic;
                }
                .pdf-footer {
                    display: grid;
                    grid-template-columns: 1fr auto 1fr;
                    gap: 24px;
                    padding-top: 16px;
                    border-top: 2px solid #e2e8f0;
                    margin-top: 20px;
                    align-items: start;
                }
                .pdf-footer-legal {
                    font-size: 8px;
                    color: #94a3b8;
                    line-height: 1.6;
                }
                .pdf-footer-qr {
                    text-align: center;
                }
                .pdf-footer-qr-box {
                    width: 64px;
                    height: 64px;
                    padding: 4px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    margin: 0 auto 6px;
                }
                .pdf-footer-qr-label {
                    font-size: 8px;
                    color: #64748b;
                    font-weight: 600;
                }
                .pdf-footer-contact {
                    text-align: right;
                }
                .pdf-footer-company {
                    font-size: 12px;
                    font-weight: 700;
                    color: #1e293b;
                    margin-bottom: 4px;
                }
                .pdf-footer-contact-item {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 6px;
                    font-size: 9px;
                    color: #64748b;
                    margin-bottom: 2px;
                }
                .pdf-signature-line {
                    margin-top: 24px;
                    padding-top: 16px;
                    border-top: 1px dashed #cbd5e1;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 48px;
                }
                .pdf-signature-box {
                    text-align: center;
                }
                .pdf-signature-line-inner {
                    border-bottom: 1px solid #1e293b;
                    height: 40px;
                    margin-bottom: 4px;
                }
                .pdf-signature-label {
                    font-size: 8px;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
            `;

            // Copy stylesheets but override with custom print styles
            const styles = Array.from(document.styleSheets)
                .map(sheet => {
                    try {
                        if (sheet.href) return `<link rel="stylesheet" href="${sheet.href}">`;
                        return `<style>${Array.from(sheet.cssRules).map(r => r.cssText).join('\n')}</style>`;
                    } catch { return sheet.href ? `<link rel="stylesheet" href="${sheet.href}">` : ''; }
                }).join('\n');

            printWindow.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Auditoría Energética - ${documentId}</title>
${styles}
<style>${printStyles}</style>
</head><body>
<div class="pdf-container">
    <!-- PROFESSIONAL PDF HEADER -->
    <div class="pdf-header">
        <div class="pdf-logo-section">
            <div class="pdf-logo">⚡</div>
            <div>
                <div class="pdf-company-name">ZINER<span>GIA</span></div>
                <div class="pdf-tagline">Consultoría Energética Inteligente</div>
            </div>
        </div>
        <div class="pdf-doc-info">
            <div class="pdf-doc-label">Documento Nº</div>
            <div class="pdf-doc-value">${documentId}</div>
            <div class="pdf-doc-label" style="margin-top:8px">Fecha</div>
            <div class="pdf-doc-value">${documentDate}</div>
            <div class="pdf-badge">
                <span>✓</span> Auditoría Certificada
            </div>
        </div>
    </div>

    <!-- EXECUTIVE SUMMARY -->
    <div class="pdf-executive-summary">
        <div>
            <div class="pdf-savings-label">Ahorro Anual Estimado</div>
            <div class="pdf-savings-amount">${formatCurrency(result.annual_savings)}</div>
            <div class="pdf-savings-note">
                Proyección basada en el análisis de consumo real aportado. Incluye optimización de potencia cuando aplica.
            </div>
            <div class="pdf-comparison-grid">
                <div class="pdf-comparison-item">
                    <div class="pdf-comparison-label">Coste Actual</div>
                    <div class="pdf-comparison-value" style="color:#f87171">${formatCurrency(result.current_annual_cost)}</div>
                </div>
                <div class="pdf-comparison-item">
                    <div class="pdf-comparison-label">Nuevo Coste</div>
                    <div class="pdf-comparison-value" style="color:#10b981">${formatCurrency(result.offer_annual_cost)}</div>
                </div>
                <div class="pdf-comparison-item">
                    <div class="pdf-comparison-label">Validez</div>
                    <div class="pdf-comparison-value" style="color:#a5b4fc">${offerValidity}</div>
                </div>
            </div>
        </div>
        <div class="pdf-percent-circle">
            <div class="pdf-percent-value">${Math.round(result.savings_percent)}%</div>
            <div class="pdf-percent-label">Ahorro</div>
        </div>
    </div>

    <!-- OFFER DETAILS -->
    <div class="pdf-section">
        <div class="pdf-section-title">
            <span class="pdf-section-dot"></span>
            Datos de la Oferta
        </div>
        <div class="pdf-offer-grid">
            <div class="pdf-offer-item">
                <div class="pdf-offer-icon" style="background:${result.offer.logo_color || '#4f46e5'}">
                    ${result.offer.marketer_name.charAt(0)}
                </div>
                <div>
                    <div class="pdf-offer-label">Comercializadora</div>
                    <div class="pdf-offer-value">${result.offer.marketer_name}</div>
                </div>
            </div>
            <div class="pdf-offer-item">
                <div class="pdf-offer-icon" style="background:#64748b">📋</div>
                <div>
                    <div class="pdf-offer-label">Tarifa</div>
                    <div class="pdf-offer-value">${result.offer.tariff_name}</div>
                </div>
            </div>
            <div class="pdf-offer-item">
                <div class="pdf-offer-icon" style="background:#0ea5e9">📅</div>
                <div>
                    <div class="pdf-offer-label">Permanencia</div>
                    <div class="pdf-offer-value">${result.offer.contract_duration || 'Sin compromiso'}</div>
                </div>
            </div>
            <div class="pdf-offer-item">
                <div class="pdf-offer-icon" style="background:#8b5cf6">💡</div>
                <div>
                    <div class="pdf-offer-label">Tipo</div>
                    <div class="pdf-offer-value">${result.offer.type === 'indexed' ? 'Indexada' : 'Precio Fijo'}</div>
                </div>
            </div>
        </div>
    </div>

    <!-- PRICE COMPARISON TABLE -->
    <div class="pdf-section">
        <div class="pdf-section-title">
            <span class="pdf-section-dot"></span>
            Desglose de Precios
        </div>
        <table class="pdf-price-table">
            <thead>
                <tr>
                    <th>Periodo</th>
                    <th>Precio Potencia (€/kW/día)</th>
                    <th>Precio Energía (€/kWh)</th>
                </tr>
            </thead>
            <tbody>
                ${['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((p, i) => {
                const powerPrice = result.offer.power_price[p as keyof typeof result.offer.power_price];
                const energyPrice = result.offer.energy_price[p as keyof typeof result.offer.energy_price];
                if (powerPrice === 0 && energyPrice === 0 && i > 2) return '';
                return `
                        <tr>
                            <td><strong>${p.toUpperCase()}</strong></td>
                            <td class="highlight">${powerPrice.toFixed(6)}</td>
                            <td class="highlight">${energyPrice.toFixed(6)}</td>
                        </tr>
                    `;
            }).join('')}
            </tbody>
        </table>
    </div>

    ${result.optimization_result ? `
    <!-- OPTIMIZATION SECTION -->
    <div class="pdf-optimization">
        <div class="pdf-optimization-title">⚡ Optimización de Potencias Aplicada</div>
        <div class="pdf-optimization-grid">
            ${Object.entries(result.optimization_result.optimized_powers).map(([p, val]) => `
                <div class="pdf-optimization-item">
                    <label>${p.toUpperCase()}</label>
                    <span>${val} kW</span>
                </div>
            `).join('')}
        </div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid #a7f3d0;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:10px;font-weight:600;color:#065f46">Ahorro Técnico Adicional</span>
            <span style="font-size:14px;font-weight:800;color:#059669">+${formatCurrency(result.optimization_result.annual_optimization_savings)}</span>
        </div>
    </div>
    ` : ''}

    ${advisorNotes ? `
    <!-- ADVISOR NOTES -->
    <div class="pdf-notes">
        <div class="pdf-notes-title">Observaciones del Auditor</div>
        <div class="pdf-notes-content">"${advisorNotes}"</div>
    </div>
    ` : ''}

    <!-- FOOTER -->
    <div class="pdf-footer">
        <div class="pdf-footer-legal">
            <strong>Aviso Legal:</strong> Este documento constituye una simulación económica basada en los datos de consumo aportados. 
            Los precios finales están sujetos a la validación de la comercializadora seleccionada. 
            Zinergia actúa como intermediario, no como suministrador de energía. 
            Las variaciones regulatorias (BOE) pueden afectar los precios indicados.
        </div>
        <div class="pdf-footer-qr">
            <div class="pdf-footer-qr-box">
                <img src="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="white" width="100" height="100"/><text x="50" y="55" text-anchor="middle" font-size="10">QR</text></svg>')}" alt="QR" style="width:100%;height:100%"/>
            </div>
            <div class="pdf-footer-qr-label">Verificar documento</div>
        </div>
        <div class="pdf-footer-contact">
            <div class="pdf-footer-company">Zinergia Consultoría</div>
            <div class="pdf-footer-contact-item">
                <span>📞</span> 900 123 456
            </div>
            <div class="pdf-footer-contact-item">
                <span>🌐</span> www.zinergia.es
            </div>
            <div class="pdf-footer-contact-item">
                <span>📍</span> España
            </div>
        </div>
    </div>

    <!-- SIGNATURE LINES -->
    <div class="pdf-signature-line">
        <div class="pdf-signature-box">
            <div class="pdf-signature-line-inner"></div>
            <div class="pdf-signature-label">Firma del Cliente</div>
        </div>
        <div class="pdf-signature-box">
            <div class="pdf-signature-line-inner"></div>
            <div class="pdf-signature-label">Firma del Asesor</div>
        </div>
    </div>
</div>
</body></html>`);

            printWindow.document.close();

            setTimeout(() => {
                printWindow.focus();
                printWindow.print();
                setTimeout(() => { printWindow.close(); setIsGeneratingPdf(false); }, 1000);
            }, 800);

        } catch (error) {
            console.error('[PDF] Error:', error);
            alert('Error al generar PDF.');
            setIsGeneratingPdf(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto font-sans">
            <div ref={cardRef}>
                {/* --- DIGITAL CONTRACT CARD (Screen View) --- */}
                <div className="relative mb-4 group transition-all duration-300 hover:translate-y-[-2px]">
                    {/* Glassmorphism Container */}
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-xl rounded-[2rem] border border-white/40 shadow-xl shadow-slate-200/50"></div>

                    <div className="relative z-10 p-1">
                        {/* Header - Minimalist */}
                        <div className="p-6 pb-2 md:flex md:justify-between md:items-start">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${isSecondary ? 'bg-white text-slate-400' : 'bg-slate-900 text-white'}`}>
                                    <Zap size={20} className={isSecondary ? 'opacity-50' : ''} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-medium tracking-tight text-slate-900">
                                        Zinergia <span className="opacity-40 font-light">Propuesta</span>
                                    </h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className={`w-1.5 h-1.5 rounded-full ${isSecondary ? 'bg-amber-400' : 'bg-emerald-500 animate-pulse'}`}></div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 md:mt-0 flex gap-2">
                                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                                    {documentDate}
                                </span>
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className="p-2 sm:p-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
                            {/* LEFT: Financial Core */}
                            <div className="lg:col-span-8">
                                {/* Savings Card - Dark Premium */}
                                <div className="h-full relative overflow-hidden bg-slate-900 text-white rounded-[1.75rem] p-6 shadow-2xl shadow-slate-900/20 flex flex-col justify-between group-hover:shadow-slate-900/30 transition-shadow">
                                    {/* Abstract shapes */}
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl -ml-20 -mb-20"></div>

                                    <div>
                                        <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-[0.2em] mb-2">Ahorro Estimado</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-5xl md:text-6xl font-light tracking-tighter">
                                                {formatCurrency(result.annual_savings).replace('€', '')}
                                            </span>
                                            <span className="text-2xl text-slate-400 font-light">€</span>
                                        </div>
                                        <p className="text-slate-400 text-sm mt-2 font-light max-w-xs">
                                            Reducción anual proyectada basada en tu consumo real.
                                        </p>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-3 gap-8 mt-8 pt-8 border-t border-white/5">
                                        <div>
                                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Actual</div>
                                            <div className="text-lg font-medium text-slate-300">{formatCurrency(result.current_annual_cost)}</div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-bold text-emerald-500/80 uppercase tracking-widest mb-1">Nuevo</div>
                                            <div className="text-lg font-medium text-white">{formatCurrency(result.offer_annual_cost)}</div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Eficiencia</div>
                                            <div className="text-lg font-medium text-emerald-400">+{Math.round(result.savings_percent)}%</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT: Details & Actions */}
                            <div className="lg:col-span-4 flex flex-col gap-2">
                                {/* Offer Details */}
                                <div className="bg-white/50 rounded-3xl p-5 border border-white/60">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 ${result.offer.logo_color || 'bg-slate-800'} rounded-xl flex items-center justify-center text-white font-bold shadow-sm`}>
                                                {result.offer.marketer_name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Comercializadora</p>
                                                <p className="text-sm font-semibold text-slate-900">{result.offer.marketer_name}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100">
                                                <FileText size={18} />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tarifa</p>
                                                <p className="text-sm font-semibold text-slate-900 line-clamp-1">{result.offer.tariff_name}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex-1 bg-slate-50/50 rounded-3xl p-2 border border-white/60 flex flex-col justify-end gap-2">
                                    <button
                                        onClick={handleWhatsAppShare}
                                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-medium text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2 group/btn"
                                    >
                                        <span>Compartir</span>
                                        <svg className="w-4 h-4 opacity-80 group-hover/btn:translate-x-0.5 transition-transform" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.316 1.592 5.43 0 9.856-4.426 9.858-9.855.002-5.43-4.425-9.851-9.857-9.851-5.43 0-9.854 4.427-9.856 9.856-.001 2.189.633 4.068 1.842 5.756l-1.103 4.028 4.1-.1.076.01.076-.01z" /></svg>
                                    </button>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={onEmail}
                                            className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-medium text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <Mail size={16} className="text-slate-400" />
                                            <span>Email</span>
                                        </button>
                                        <button
                                            onClick={handleDownloadPdf}
                                            disabled={isGeneratingPdf}
                                            className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-medium text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            {isGeneratingPdf ? <Loader2 size={16} className="animate-spin text-indigo-500" /> : <Download size={16} className="text-slate-400" />}
                                            <span>PDF</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Optimization Strip */}
                        {result.optimization_result && (
                            <div className="mx-2 mb-2 p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100/50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Potencia Optimizada Incluida</span>
                                </div>
                                <span className="text-xs font-bold text-emerald-600">
                                    +{formatCurrency(result.optimization_result.annual_optimization_savings)} extra
                                </span>
                            </div>
                        )}

                        {/* Advisor Notes Section */}
                        <div className="mx-2 mb-2">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-start pt-3 pointer-events-none">
                                    <svg className="w-4 h-4 text-amber-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </div>
                                <textarea
                                    className="w-full pl-10 pr-4 py-3 bg-amber-50/30 border border-amber-100/50 rounded-xl text-xs text-amber-900 placeholder-amber-400/70 focus:ring-2 focus:ring-amber-200/50 focus:border-amber-200/50 transition-all resize-none min-h-[60px]"
                                    placeholder="Añadir notas del asesor para el cliente..."
                                    value={advisorNotes}
                                    onChange={(e) => setAdvisorNotes(e.target.value)}
                                />
                                <div className="absolute bottom-2 right-3 text-[9px] font-bold text-amber-400/60 uppercase tracking-widest pointer-events-none">
                                    Notas Privadas
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};
