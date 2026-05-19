import React, { useRef, useState, useEffect, useMemo } from 'react';
import { InvoiceData, SavingsResult } from '../../../types/crm';
import { toast } from 'sonner';
import { Download, Mail, Loader2, FileText, Lightbulb, TableProperties, ChevronDown, ChevronUp, Coins } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { ExcelBreakdownModal } from './ExcelBreakdownModal';
import { getMarketerLogo } from '@/lib/marketers/logos';


interface DigitalProposalCardProps {
    result: SavingsResult;
    onReset?: () => void;
    onEmail: () => void;
    title?: string;
    isSecondary?: boolean;
    initialNotes?: string;
    onNotesChange?: (notes: string) => void;
    invoiceData?: InvoiceData;
}

export const DigitalProposalCard: React.FC<DigitalProposalCardProps> = ({
    result,
    onEmail,
    title = "Recomendación Principal",
    isSecondary = false,
    initialNotes,
    onNotesChange,
    invoiceData,
}) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [advisorNotes, setAdvisorNotes] = useState(initialNotes || '');

    const documentId = useMemo(() =>
        `ZIN-${new Date().getFullYear()}-${result.offer.id.slice(0, 6).toUpperCase()}`,
        [result.offer.id]
    );

    useEffect(() => {
        if (onNotesChange) onNotesChange(advisorNotes);
    }, [advisorNotes, onNotesChange]);

    const logo = getMarketerLogo(result.offer.marketer_name);
    const commission = result.offer.estimated_agent_commission;
    const savingsFormatted = formatCurrency(result.annual_savings);
    const pctFormatted = `${Math.round(result.savings_percent)}%`;

    const handleWhatsAppShare = () => {
        const text = `Hola, te adjunto la propuesta de Zinergia con un ahorro de ${savingsFormatted}. Puedes ver los detalles aquí: ${window.location.href}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleDownloadPdf = async () => {
        if (invoiceData) {
            setIsGeneratingPdf(true);
            try {
                const [{ pdf }, { ProposalPDFDocument }] = await Promise.all([
                    import('@react-pdf/renderer'),
                    import('@/features/proposal/components/ProposalPDFDocument'),
                ]);
                const element = React.createElement(ProposalPDFDocument, {
                    invoiceData,
                    results: [result],
                    clientProfile: advisorNotes ? { tags: [], sales_argument: advisorNotes } : undefined,
                });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const blob = await pdf(element as any).toBlob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `zinergia-propuesta-${(invoiceData.client_name ?? result.offer.tariff_name ?? 'borrador').replace(/\s+/g, '-')}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success('PDF generado correctamente');
            } catch (error) {
                console.error('[PDF] Error:', error);
                toast.error('Error al generar PDF.');
            } finally {
                setIsGeneratingPdf(false);
            }
            return;
        }
        toast.error('Sin datos de factura para generar PDF');
    };

    return (
        <div className="w-full font-sans" ref={cardRef}>
            <div className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden ${isSecondary ? 'border-slate-200' : 'border-emerald-200 ring-1 ring-emerald-100'}`}>
                {/* Compact header row — always visible */}
                <button
                    type="button"
                    onClick={() => setExpanded(e => !e)}
                    className="w-full text-left"
                >
                    <div className="flex items-center gap-3 px-4 py-3">
                        {/* Rank badge */}
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${isSecondary ? 'bg-slate-100 text-slate-500' : 'bg-emerald-600 text-white shadow-sm'}`}>
                            {isSecondary ? title.replace(/\D/g, '') || '—' : '★'}
                        </div>

                        {/* Marketer logo/name */}
                        <div className="flex items-center gap-2 min-w-[120px] shrink-0">
                            {logo ? (
                                <div className="w-7 h-7 rounded-md border border-slate-200 bg-white overflow-hidden shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={logo} alt={result.offer.marketer_name} className="w-full h-full object-contain p-0.5" />
                                </div>
                            ) : (
                                <div className={`w-7 h-7 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${result.offer.logo_color || 'bg-slate-600'}`}>
                                    {result.offer.marketer_name.slice(0, 2)}
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate">{result.offer.marketer_name}</p>
                                <p className="text-[10px] text-slate-500 truncate">{result.offer.tariff_name}</p>
                            </div>
                        </div>

                        {/* Savings — the hero number */}
                        <div className="flex-1 flex items-center justify-center gap-4">
                            <div className="text-center">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Ahorro</p>
                                <p className={`text-lg font-bold tabular-nums ${isSecondary ? 'text-slate-800' : 'text-emerald-600'}`}>
                                    {savingsFormatted}
                                </p>
                            </div>
                            <div className="text-center hidden sm:block">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Mejora</p>
                                <p className="text-sm font-semibold text-emerald-500 tabular-nums">+{pctFormatted}</p>
                            </div>
                            <div className="text-center hidden sm:block">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Nuevo coste</p>
                                <p className="text-sm font-semibold text-slate-700 tabular-nums">{formatCurrency(result.offer_annual_cost)}</p>
                            </div>
                        </div>

                        {/* Commission */}
                        <div className="text-right min-w-[80px] shrink-0 hidden md:block">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Comisión</p>
                            {commission != null ? (
                                <p className="text-sm font-bold text-indigo-600 tabular-nums flex items-center justify-end gap-1">
                                    <Coins size={12} className="text-indigo-400" />
                                    {formatCurrency(commission)}
                                </p>
                            ) : (
                                <p className="text-[10px] text-slate-300">—</p>
                            )}
                        </div>

                        {/* Expand toggle */}
                        <div className="shrink-0 text-slate-400">
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                    </div>
                </button>

                {/* Expanded detail section */}
                {expanded && (
                    <div className="border-t border-slate-100 bg-slate-50/30">
                        <div className="px-4 py-3 space-y-3">
                            {/* Stats row (visible on mobile when expanded) */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <Stat label="Coste actual" value={formatCurrency(result.current_annual_cost)} muted />
                                <Stat label="Nuevo coste" value={formatCurrency(result.offer_annual_cost)} highlight />
                                <Stat label="Ahorro anual" value={savingsFormatted} positive />
                                <Stat label="Comisión" value={commission != null ? formatCurrency(commission) : '—'} commission />
                            </div>

                            {/* Optimization strip */}
                            {result.optimization_result && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100 text-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span className="text-emerald-700 font-medium">Optimización de potencia incluida:</span>
                                    <span className="font-bold text-emerald-600">
                                        +{formatCurrency(result.optimization_result.annual_optimization_savings)}
                                    </span>
                                </div>
                            )}

                            {/* Notes */}
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-start pt-2 pointer-events-none">
                                    <Lightbulb size={11} className="text-amber-400" />
                                </div>
                                <textarea
                                    className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:ring-1 focus:ring-amber-200 focus:border-amber-300 transition-all resize-none min-h-[36px]"
                                    placeholder="Nota visible para el cliente..."
                                    value={advisorNotes}
                                    onChange={(e) => setAdvisorNotes(e.target.value)}
                                />
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-1.5">
                                <ActionBtn onClick={handleWhatsAppShare} primary>
                                    <WhatsAppIcon /> WhatsApp
                                </ActionBtn>
                                <ActionBtn onClick={onEmail}>
                                    <Mail size={13} /> Enviar
                                </ActionBtn>
                                <ActionBtn onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
                                    {isGeneratingPdf ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} PDF
                                </ActionBtn>
                                <ActionBtn onClick={() => setShowBreakdown(true)}>
                                    <TableProperties size={13} /> Desglose
                                </ActionBtn>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showBreakdown && (
                <ExcelBreakdownModal
                    isOpen={showBreakdown}
                    onClose={() => setShowBreakdown(false)}
                    result={result}
                    invoiceData={invoiceData}
                />
            )}
        </div>
    );
};

function Stat({ label, value, muted, highlight, positive, commission }: {
    label: string; value: string;
    muted?: boolean; highlight?: boolean; positive?: boolean; commission?: boolean;
}) {
    const color = positive ? 'text-emerald-600' : highlight ? 'text-slate-900' : commission ? 'text-indigo-600' : 'text-slate-500';
    return (
        <div className={`rounded-lg px-3 py-2 ${commission ? 'bg-indigo-50/50 border border-indigo-100' : 'bg-white border border-slate-100'}`}>
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
            <p className={`text-sm font-bold tabular-nums ${color} ${muted ? 'line-through opacity-60' : ''}`}>{value}</p>
        </div>
    );
}

function ActionBtn({ children, onClick, primary, disabled }: {
    children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`flex-1 py-1.5 px-2 rounded-lg font-medium text-[11px] transition-colors flex items-center justify-center gap-1 active:scale-95 ${
                primary
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 shadow-sm'
            } disabled:opacity-50`}
        >
            {children}
        </button>
    );
}

function WhatsAppIcon() {
    return (
        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.316 1.592 5.43 0 9.856-4.426 9.858-9.855.002-5.43-4.425-9.851-9.857-9.851-5.43 0-9.854 4.427-9.856 9.856-.001 2.189.633 4.068 1.842 5.756l-1.103 4.028 4.1-.1.076.01.076-.01z" />
        </svg>
    );
}
