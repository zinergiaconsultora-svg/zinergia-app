import React, { useRef, useState, useEffect } from 'react';
import { SavingsResult } from '../../../types/crm';
import { Download, Mail, ShieldCheck, Zap, Loader2, FileText, Phone, MapPin, Globe } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatCurrency } from '@/lib/utils/format';

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

    // Generate document ID and date
    const documentId = `ZIN-${new Date().getFullYear()}-${result.offer.id.slice(0, 6).toUpperCase()}`;
    const documentDate = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

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
            const printContent = cardRef.current.outerHTML;

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
                <div
                    className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 relative mb-4 print:shadow-none print:border print:rounded-none bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]"
                >
                    {/* Header - Corporate & Elegant */}
                    <div className="p-5 md:p-6 relative overflow-hidden bg-white border-b border-slate-100">
                        <div className={`absolute top-0 left-0 right-0 h-[2px] ${isSecondary ? 'bg-slate-300' : 'bg-indigo-600/80'}`}></div>

                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 ${isSecondary ? 'bg-slate-50' : 'bg-indigo-50/50'} rounded-lg flex items-center justify-center border border-slate-100`}>
                                    <Zap className={isSecondary ? 'text-slate-400 fill-slate-400' : 'text-indigo-600 fill-indigo-600'} size={16} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold tracking-tight text-slate-900">Zinergia <span className="font-light text-slate-500">Propuesta</span></h2>
                                    <p className="text-slate-400 text-[9px] uppercase tracking-[0.2em] font-bold mt-1 opacity-80">Solución Energética Inteligente</p>
                                </div>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100/50">
                                    <ShieldCheck size={14} className="opacity-80" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Ahorro Validado</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-400">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <span className="text-[10px] font-medium uppercase tracking-widest">{title}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Areas */}
                    <div className="p-2 sm:p-3 grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3">
                        {/* LEFT: Financial Summary */}
                        <div className="lg:col-span-8 space-y-2 sm:space-y-3">
                            {/* Savings Hero Section */}
                            <div className="relative overflow-hidden bg-slate-900 text-white rounded-[1.5rem] p-4 sm:p-5 shadow-xl shadow-slate-900/10">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -ml-12 -mb-12"></div>

                                <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                                    <div>
                                        <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white/10 backdrop-blur-sm rounded-lg border border-white/10 mb-3">
                                            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Ahorro Anual Estimado</span>
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-4xl font-black tracking-tight">{formatCurrency(result.annual_savings)}</span>
                                            <span className="text-indigo-400 font-bold text-xs">/ año</span>
                                        </div>
                                        <p className="text-slate-400 text-[11px] mt-1.5 max-w-[200px] leading-relaxed">
                                            Ahorro directo proyectado basado en tu consumo real actual.
                                        </p>
                                    </div>

                                    <div className="flex flex-col items-start sm:items-end w-full sm:w-auto">
                                        <div className="w-full sm:w-20 h-20 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 flex flex-col items-center justify-center relative group">
                                            <div className="text-2xl font-black text-emerald-400">{Math.round(result.savings_percent)}%</div>
                                            <div className="text-[8px] font-bold text-slate-500 uppercase tracking-tight mt-0.5">Eficiencia</div>
                                            <svg className="absolute inset-0 w-full h-full -rotate-90 p-1">
                                                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/5" />
                                                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="3"
                                                    strokeDasharray={`${(result.savings_percent / 100) * 213} 213`}
                                                    className="text-emerald-500/40" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Facts Bar */}
                                <div className="grid grid-cols-3 gap-2 mt-5 pt-5 border-t border-white/10">
                                    <div className="text-center sm:text-left">
                                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Costo Actual</div>
                                        <div className="text-xs font-bold text-slate-300">{formatCurrency(result.current_annual_cost)}</div>
                                    </div>
                                    <div className="text-center sm:text-left">
                                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Nuevo Costo</div>
                                        <div className="text-xs font-bold text-white">{formatCurrency(result.offer_annual_cost)}</div>
                                    </div>
                                    <div className="text-center sm:text-left">
                                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Validez</div>
                                        <div className="text-xs font-bold text-indigo-400">{offerValidity}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Offer Details Grid */}
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                <div className="p-3 sm:p-3.5 bg-slate-50 rounded-[1.25rem] border border-slate-100 flex items-center gap-3 sm:gap-4">
                                    <div className={`w-8 h-8 sm:w-10 sm:h-10 ${result.offer.logo_color || 'bg-slate-200'} rounded-xl shadow-sm flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                                        {result.offer.marketer_name.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{result.offer.marketer_name}</p>
                                        <p className="text-xs font-bold text-slate-900 truncate tracking-tight">{result.offer.tariff_name}</p>
                                    </div>
                                </div>

                                <div className="p-3 sm:p-3.5 bg-slate-50 rounded-[1.25rem] border border-slate-100 flex items-center gap-3 sm:gap-4">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-indigo-600 shrink-0">
                                        <FileText size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">Permanencia</p>
                                        <p className="text-xs font-bold text-slate-900 truncate tracking-tight">{result.offer.contract_duration || 'Sin compromiso'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Share Buttons (Digital Only) */}
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                <button
                                    onClick={handleWhatsAppShare}
                                    className="flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl sm:rounded-2xl font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.316 1.592 5.43 0 9.856-4.426 9.858-9.855.002-5.43-4.425-9.851-9.857-9.851-5.43 0-9.854 4.427-9.856 9.856-.001 2.189.633 4.068 1.842 5.756l-1.103 4.028 4.1-.1.076.01.076-.01z" />
                                    </svg>
                                    <span>Compartir por WhatsApp</span>
                                </button>
                                <button
                                    onClick={onEmail}
                                    className="flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl sm:rounded-2xl font-bold text-xs transition-all shadow-lg shadow-slate-900/10 active:scale-95"
                                >
                                    <Mail size={16} />
                                    <span>Enviar por Email</span>
                                </button>
                            </div>

                            {/* Optimization Highlights */}
                            {result.optimization_result && (
                                <div className="bg-emerald-50/30 rounded-2xl border border-emerald-100/50 p-3 sm:p-5">
                                    <div className="flex items-center gap-2 mb-3 sm:mb-4">
                                        <div className="p-1 px-2 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold uppercase tracking-widest">Optimización Activa</div>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-2 overflow-x-auto no-scrollbar pb-1">
                                        {Object.entries(result.optimization_result.optimized_powers).map(([p, val]) => (
                                            <div key={p} className="flex flex-col min-w-0">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{p.toUpperCase()}</span>
                                                <span className="text-sm font-black text-slate-700">{val} <span className="text-[10px] font-normal text-slate-400">kW</span></span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-emerald-100/50 flex justify-between items-center px-2">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Ahorro Técnico Potencia</span>
                                        <span className="text-sm font-black text-emerald-600">+{formatCurrency(result.optimization_result.annual_optimization_savings)}</span>
                                    </div>
                                </div>
                            )}

                            {/* Advisor Notes */}
                            <div className="bg-amber-50/40 rounded-2xl border border-amber-100/60 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                                        <Zap size={16} />
                                    </div>
                                    <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider">Notas del Asesor</h3>
                                </div>
                                <textarea
                                    value={advisorNotes}
                                    onChange={(e) => setAdvisorNotes(e.target.value)}
                                    placeholder="Ej: Recomendamos contratar este mes para aprovechar la bonificación de bienvenida..."
                                    className="w-full bg-white/50 border border-amber-200/50 rounded-xl p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 outline-none transition-all resize-none h-20"
                                />
                            </div>
                        </div>

                        {/* RIGHT: QR & Visual */}
                        <div className="lg:col-span-4 space-y-3">
                            <div className="bg-slate-50 rounded-[1.5rem] p-5 border border-slate-100 text-center flex flex-col items-center justify-center h-full sm:min-h-[260px]">
                                <div className="relative mb-5">
                                    <div className="w-20 h-20 bg-white rounded-2xl shadow-lg border border-slate-100 flex items-center justify-center p-2 relative z-10 overflow-hidden">
                                        <QRCodeSVG
                                            value={typeof window !== 'undefined' ? window.location.href : ''}
                                            size={64}
                                            level="H"
                                            includeMargin={false}
                                        />
                                    </div>
                                    <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-xl animate-pulse -z-0"></div>
                                </div>

                                <div className="space-y-1.5">
                                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-tight">Escanea para contratar</h4>
                                    <p className="text-[9px] text-slate-400 leading-normal px-2">
                                        Acceso directo a la formalización digital del contrato. Sin papeleo.
                                    </p>
                                </div>

                                <div className="mt-8 pt-6 border-t border-slate-200/50 w-full hidden lg:block">
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2">
                                            <span>Autenticidad</span>
                                            <span className="text-indigo-600">Verificada</span>
                                        </div>
                                        <div className="flex gap-1 justify-center">
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <div key={i} className="w-1.5 h-6 bg-slate-200/60 rounded-full"></div>
                                            ))}
                                            <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                                            {[1, 2, 3, 4].map(i => (
                                                <div key={i + 10} className="w-2 h-6 bg-slate-100 rounded-full"></div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ACTION BAR */}
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <button
                    onClick={handleDownloadPdf}
                    disabled={isGeneratingPdf}
                    className="flex-1 flex items-center justify-center gap-3 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                >
                    {isGeneratingPdf ? (
                        <>
                            <Loader2 size={20} className="animate-spin" />
                            <span>Generando Auditoría...</span>
                        </>
                    ) : (
                        <>
                            <Download size={20} />
                            <span>Descargar Auditoría PDF</span>
                        </>
                    )}
                </button>

                {onReset && (
                    <button
                        onClick={onReset}
                        className="sm:px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all active:scale-95"
                    >
                        Nueva Simulación
                    </button>
                )}
            </div>
        </div>
    );
};
