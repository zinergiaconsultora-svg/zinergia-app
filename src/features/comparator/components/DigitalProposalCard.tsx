import React, { useRef, useState, useEffect, useMemo } from 'react';
import { SavingsResult } from '../../../types/crm';
import { toast } from 'sonner';
import { Download, Mail, Zap, Loader2, FileText, Lightbulb } from 'lucide-react';
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
                toast.error('Permite las ventanas emergentes para descargar el PDF');
                setIsGeneratingPdf(false);
                return;
            }

            // Minimalist & Powerful Print Styles
            const printStyles = `
                @page { 
                    size: A4; 
                    margin: 15mm 20mm; 
                }
                @media print { 
                    body { 
                        margin: 0 !important; 
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    } 
                }
                * { box-sizing: border-box; }
                body { 
                    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; 
                    background: #fff; 
                    color: #0f172a;
                    line-height: 1.5;
                    font-size: 11px;
                }
                .pdf-container { max-width: 100%; }
                
                /* HEADER SECTION */
                .pdf-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    padding-bottom: 24px;
                    border-bottom: 1px solid #e2e8f0;
                    margin-bottom: 32px;
                }
                .pdf-logo-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .pdf-zinergia-logo {
                    width: 32px;
                    height: 32px;
                    display: block;
                }
                .pdf-brand-text {
                    font-size: 22px;
                    font-weight: 800;
                    letter-spacing: -1px;
                    color: #0f172a;
                    line-height: 1;
                }
                .pdf-brand-text span { font-weight: 300; }
                .pdf-tagline {
                    font-size: 8px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    color: #64748b;
                    margin-top: 4px;
                }
                .pdf-meta {
                    text-align: right;
                }
                .pdf-meta-label {
                    font-size: 7px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: #94a3b8;
                    margin-bottom: 2px;
                }
                .pdf-meta-value {
                    font-size: 11px;
                    font-weight: 600;
                    color: #334155;
                    margin-bottom: 8px;
                }
                .pdf-badge {
                    display: inline-block;
                    padding: 4px 8px;
                    background: #f1f5f9;
                    border: 1px solid #e2e8f0;
                    color: #475569;
                    font-size: 8px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    border-radius: 4px;
                }

                /* HERO / IMPACT SECTION */
                .pdf-hero {
                    text-align: center;
                    margin-bottom: 40px;
                    padding: 40px 0;
                }
                .pdf-hero-label {
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 3px;
                    color: #10b981;
                    margin-bottom: 16px;
                }
                .pdf-hero-amount {
                    font-size: 64px;
                    font-weight: 300;
                    letter-spacing: -2px;
                    color: #0f172a;
                    line-height: 1;
                    margin-bottom: 8px;
                }
                .pdf-hero-sub {
                    font-size: 12px;
                    color: #64748b;
                    font-weight: 400;
                    max-width: 400px;
                    margin: 0 auto;
                }

                /* GRID Kpis */
                .pdf-kpi-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 24px;
                    margin-bottom: 40px;
                    border-top: 1px solid #e2e8f0;
                    border-bottom: 1px solid #e2e8f0;
                    padding: 24px 0;
                }
                .pdf-kpi { text-align: center; }
                .pdf-kpi-title {
                    font-size: 8px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    color: #94a3b8;
                    margin-bottom: 8px;
                }
                .pdf-kpi-val {
                    font-size: 20px;
                    font-weight: 600;
                    color: #0f172a;
                }
                .pdf-kpi-highlight { color: #10b981; }
                .pdf-kpi-old { color: #64748b; text-decoration: line-through; font-size: 14px; }

                /* TWO COL LAYOUT */
                .pdf-cols {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 32px;
                    margin-bottom: 32px;
                }
                .pdf-section-title {
                    font-size: 9px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    color: #0f172a;
                    margin-bottom: 16px;
                    border-bottom: 1px solid #0f172a;
                    padding-bottom: 8px;
                }

                /* OFFER SPECS */
                .pdf-specs {
                    background: #f8fafc;
                    padding: 20px;
                    border-radius: 8px;
                }
                .pdf-spec-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px dashed #e2e8f0;
                }
                .pdf-spec-row:last-child { border: none; }
                .pdf-spec-label {
                    font-size: 10px;
                    color: #64748b;
                    font-weight: 500;
                }
                .pdf-spec-val {
                    font-size: 11px;
                    color: #0f172a;
                    font-weight: 700;
                }

                /* TABLES */
                .pdf-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .pdf-table th {
                    text-align: left;
                    font-size: 8px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: #64748b;
                    padding: 8px 0;
                    border-bottom: 1px solid #cbd5e1;
                }
                .pdf-table td {
                    padding: 10px 0;
                    font-size: 11px;
                    border-bottom: 1px solid #f1f5f9;
                    color: #334155;
                }
                .pdf-table td strong { color: #0f172a; }

                /* NOTES & OPTIMIZATION */
                .pdf-box {
                    padding: 16px;
                    border-left: 2px solid #0f172a;
                    background: #f8fafc;
                    margin-bottom: 24px;
                }
                .pdf-box.optim {
                    border-color: #10b981;
                    background: #ecfdf5;
                }
                .pdf-box-title {
                    font-size: 9px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 8px;
                }
                .pdf-optim-grid {
                    display: flex;
                    gap: 16px;
                    margin-top: 12px;
                }
                .pdf-optim-item { font-size: 10px; }
                .pdf-optim-item strong { font-size: 12px; color: #065f46; }

                /* FOOTER */
                .pdf-footer {
                    margin-top: 60px;
                    padding-top: 24px;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    font-size: 8px;
                    color: #94a3b8;
                }
                .pdf-disclaimer {
                    max-width: 60%;
                    line-height: 1.6;
                }
                .pdf-signature {
                    width: 150px;
                    border-top: 1px solid #cbd5e1;
                    padding-top: 8px;
                    text-align: center;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
            `;

            // Copy stylesheets but override with custom print styles
            const styles = Array.from(document.styleSheets)
                .map(sheet => {
                    try {
                        if (sheet.href) return `<link rel="stylesheet" href="\${sheet.href}">`;
                        return `<style>\${Array.from(sheet.cssRules).map(r => r.cssText).join('\\n')}</style>`;
                    } catch { return sheet.href ? `<link rel="stylesheet" href="\${sheet.href}">` : ''; }
                }).join('\\n');

            // True minimalist Zinergia SVG
            const zinergiaLogo = `<svg class="pdf-zinergia-logo" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="100" height="100" rx="20" fill="#0F172A"/>
                <path d="M70 30L30 30L55 50L30 70L70 70" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="70" cy="50" r="4" fill="#10B981"/>
            </svg>`;

            printWindow.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Auditoría Energética - ${documentId}</title>
${styles}
<style>${printStyles}</style>
</head><body>
<div class="pdf-container">
    
    <!-- HEADER -->
    <div class="pdf-header">
        <div>
            <div class="pdf-logo-wrapper">
                ${zinergiaLogo}
                <div class="pdf-brand-text">ZINER<span>GIA</span></div>
            </div>
            <div class="pdf-tagline">Estudio Energético Profesional</div>
        </div>
        <div class="pdf-meta">
            <div class="pdf-meta-label">ID Documento</div>
            <div class="pdf-meta-value">${documentId}</div>
            <div class="pdf-meta-label">Fecha de Emisión</div>
            <div class="pdf-meta-value">${documentDate}</div>
            <div class="pdf-badge">Validación Oficial</div>
        </div>
    </div>

    <!-- HERO IMPACT -->
    <div class="pdf-hero">
        <div class="pdf-hero-label">Beneficio Anual Proyectado</div>
        <div class="pdf-hero-amount">${formatCurrency(result.annual_savings)}</div>
        <div class="pdf-hero-sub">
            Reducción neta estimada sobre tu factura actual, basada en el análisis de ${offerValidity} y optimizaciones técnicas aplicadas.
        </div>
    </div>

    <!-- KPIs -->
    <div class="pdf-kpi-grid">
        <div class="pdf-kpi">
            <div class="pdf-kpi-title">Gasto Anual Actual</div>
            <div class="pdf-kpi-old">${formatCurrency(result.current_annual_cost)}</div>
        </div>
        <div class="pdf-kpi">
            <div class="pdf-kpi-title">Inversión Optimizada</div>
            <div class="pdf-kpi-val pdf-kpi-highlight">${formatCurrency(result.offer_annual_cost)}</div>
        </div>
        <div class="pdf-kpi">
            <div class="pdf-kpi-title">Eficiencia Energética</div>
            <div class="pdf-kpi-val">+${Math.round(result.savings_percent)}%</div>
        </div>
    </div>

    <!-- MAIN COLS -->
    <div class="pdf-cols">
        <!-- LEFT: Offer Details -->
        <div>
            <div class="pdf-section-title">Detalles de la Oferta Estratégica</div>
            <div class="pdf-specs">
                <div class="pdf-spec-row">
                    <span class="pdf-spec-label">Comercializadora Asignada</span>
                    <span class="pdf-spec-val">${result.offer.marketer_name}</span>
                </div>
                <div class="pdf-spec-row">
                    <span class="pdf-spec-label">Tarifa Seleccionada</span>
                    <span class="pdf-spec-val">${result.offer.tariff_name}</span>
                </div>
                <div class="pdf-spec-row">
                    <span class="pdf-spec-label">Modalidad de Contratos</span>
                    <span class="pdf-spec-val">${result.offer.type === 'indexed' ? 'Indexada al Mercado' : 'Precio Fijo Garantizado'}</span>
                </div>
                <div class="pdf-spec-row">
                    <span class="pdf-spec-label">Compromiso / Permanencia</span>
                    <span class="pdf-spec-val">${result.offer.contract_duration || 'Sin Asignar'}</span>
                </div>
            </div>
        </div>

        <!-- RIGHT: Pricing -->
        <div>
            <div class="pdf-section-title">Estructura de Precios (Condiciones Base)</div>
            <table class="pdf-table">
                <thead>
                    <tr>
                        <th>Tramo</th>
                        <th>Término Potencia (€/kW)</th>
                        <th>Término Energía (€/kWh)</th>
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
                                <td>${powerPrice.toFixed(6)}</td>
                                <td>${energyPrice.toFixed(6)}</td>
                            </tr>
                        `;
                }).join('')}
                </tbody>
            </table>
        </div>
    </div>

    <!-- OPTIMIZATION & NOTES -->
    ${result.optimization_result ? `
    <div class="pdf-box optim">
        <div class="pdf-box-title" style="color: #059669;">Auditoría de Potencias Aplicada</div>
        <div style="font-size:10px; color:#065f46;">Ajuste técnico que añade <strong>${formatCurrency(result.optimization_result.annual_optimization_savings)}</strong> al ahorro anual. Nuevos tramos:</div>
        <div class="pdf-optim-grid">
            ${Object.entries(result.optimization_result.optimized_powers).map(([p, val]) => `
                <div class="pdf-optim-item">${p.toUpperCase()}: <strong>${val}kW</strong></div>
            `).join('')}
        </div>
    </div>
    ` : ''}

    ${advisorNotes ? `
    <div class="pdf-box">
        <div class="pdf-box-title">Nota del Consultor Energético</div>
        <div style="font-size: 11px; font-style: italic; color: #475569;">"${advisorNotes}"</div>
    </div>
    ` : ''}

    <!-- FOOTER -->
    <div class="pdf-footer">
        <div class="pdf-disclaimer">
            Confidencial y propietario. Esta simulación proyectada se basa en el consumo real suministrado. 
            Precios y datos finales están sujetos a la aprobación técnica por parte de la comercializadora. 
            Zinergia no asume responsabilidad frente a variaciones de peajes y cargos gubernamentales (BOE).
        </div>
        <div class="pdf-signature">
            Conformidad Cliente
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
            toast.error('Error al generar PDF.');
            setIsGeneratingPdf(false);
        }
    };

    return (
        <div className="w-full font-sans">
            <div ref={cardRef}>
                <div className="relative mb-4 group transition-all duration-200 hover:-translate-y-1">
                    {/* Minimalist Container */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
                        
                        {/* Header Minimalist */}
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${isSecondary ? 'bg-white text-slate-400 border border-slate-200' : 'bg-slate-900 text-white'}`}>
                                    <Zap size={14} className={isSecondary ? 'opacity-50' : ''} />
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                                        Zinergia <span className="font-normal text-slate-500">Propuesta</span>
                                    </h2>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className={`w-1.5 h-1.5 rounded-full ${isSecondary ? 'bg-amber-400' : 'bg-emerald-500'}`}></div>
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
                                    </div>
                                </div>
                            </div>
                            <span className="text-[10px] font-medium text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded-md">
                                {documentDate}
                            </span>
                        </div>

                        {/* Main Body */}
                        <div className="p-4 flex-1 flex flex-col gap-4">
                            
                            {/* Savings Block - Clean and Focus */}
                            <div className="text-center md:text-left flex flex-col md:flex-row md:justify-between md:items-end gap-2">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">Ahorro Estimado</p>
                                    <div className="flex justify-center md:justify-start items-baseline gap-1">
                                        <span className="text-4xl font-light tracking-tight text-slate-900">
                                            {formatCurrency(result.annual_savings).replace('€', '')}
                                        </span>
                                        <span className="text-xl text-slate-500 font-light">€</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Beneficio anual proyectado.</p>
                                </div>

                                {/* Offer Details Inline */}
                                <div className="flex-shrink-0 text-left bg-slate-50 rounded-xl p-3 border border-slate-100 mt-2 md:mt-0 min-w-[160px]">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-6 h-6 ${result.offer.logo_color || 'bg-slate-800'} rounded-md flex items-center justify-center text-white text-[10px] font-bold shadow-sm`}>
                                            {result.offer.marketer_name.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">Comercializadora</p>
                                            <p className="text-xs font-semibold text-slate-900 truncate">{result.offer.marketer_name}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-white border border-slate-200 rounded-md flex items-center justify-center text-slate-400">
                                            <FileText size={12} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">Tarifa</p>
                                            <p className="text-xs font-medium text-slate-700 truncate">{result.offer.tariff_name}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Stats Grid Minimal */}
                            <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100">
                                <div className="text-center md:text-left">
                                    <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Coste Actual</div>
                                    <div className="text-sm font-medium text-slate-700">{formatCurrency(result.current_annual_cost)}</div>
                                </div>
                                <div className="text-center md:text-left">
                                    <div className="text-[10px] uppercase font-semibold border-b-2 border-emerald-400 inline-block text-slate-600 tracking-wider">Nuevo Coste</div>
                                    <div className="text-sm font-semibold text-emerald-700">{formatCurrency(result.offer_annual_cost)}</div>
                                </div>
                                <div className="text-center md:text-left">
                                    <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Mejora</div>
                                    <div className="text-sm font-medium text-emerald-500">+{Math.round(result.savings_percent)}%</div>
                                </div>
                            </div>

                            {/* Optimization Minimal Strip */}
                            {result.optimization_result && (
                                <div className="px-3 py-2 bg-emerald-50/50 rounded-lg border border-emerald-100/50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                        <span className="text-[10px] font-medium text-emerald-700 uppercase tracking-widest">Ahorro técnico incluido</span>
                                    </div>
                                    <span className="text-[11px] font-bold text-emerald-600">
                                        +{formatCurrency(result.optimization_result.annual_optimization_savings)} extra
                                    </span>
                                </div>
                            )}

                            {/* Advisor Notes - Compact */}
                            <div className="mt-2">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-start pt-2 pointer-events-none">
                                        <Lightbulb size={12} className="text-amber-500/70" />
                                    </div>
                                    <textarea
                                        className="w-full pl-8 pr-3 py-2 bg-amber-50/20 border border-amber-100/40 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:ring-1 focus:ring-amber-200/50 focus:border-amber-300 transition-all resize-none min-h-[44px]"
                                        placeholder="Nota visible para el cliente (opcional)..."
                                        value={advisorNotes}
                                        onChange={(e) => setAdvisorNotes(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Actions Footer */}
                        <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                            <button
                                onClick={handleWhatsAppShare}
                                className="flex-1 min-w-0 py-2 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                            >
                                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.316 1.592 5.43 0 9.856-4.426 9.858-9.855.002-5.43-4.425-9.851-9.857-9.851-5.43 0-9.854 4.427-9.856 9.856-.001 2.189.633 4.068 1.842 5.756l-1.103 4.028 4.1-.1.076.01.076-.01z" /></svg>
                                <span>WhatsApp</span>
                            </button>
                            <div className="flex flex-1 gap-2">
                                <button
                                    onClick={onEmail}
                                    className="flex-1 py-2 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-medium text-xs transition-colors flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                                >
                                    <Mail size={14} className="text-slate-400" />
                                    <span>Enviar</span>
                                </button>
                                <button
                                    onClick={handleDownloadPdf}
                                    disabled={isGeneratingPdf}
                                    className="flex-1 py-2 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-medium text-xs transition-colors flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                                >
                                    {isGeneratingPdf ? <Loader2 size={14} className="animate-spin text-indigo-500" /> : <Download size={14} className="text-slate-400" />}
                                    <span>PDF</span>
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

