import React, { useRef, useState } from 'react';
import { SavingsResult } from '../../../types/crm';
import { Check, Download, Mail, ShieldCheck, Zap, Loader2, FileText, Calendar, Building2, ArrowRight } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { formatCurrency } from '@/lib/utils/format';

interface ProposalCardProps {
    result: SavingsResult;
    onReset: () => void;
    onEmail: () => void;
}

export const DigitalProposalCard: React.FC<ProposalCardProps> = ({ result, onReset, onEmail }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const handleDownloadPdf = async () => {
        if (!cardRef.current) return;
        setIsGeneratingPdf(true);

        try {
            await new Promise(resolve => setTimeout(resolve, 500)); // Ensure fonts load
            const canvas = await html2canvas(cardRef.current, {
                scale: 2, // High resolution
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgWidth = 210;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`Propuesta_Zinergia_${result.offer.marketer_name.replace(/\s+/g, '_')}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Hubo un error al generar el PDF. Por favor intente nuevamente.");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto font-sans">
            {/* --- DIGITAL CONTRACT CARD --- */}
            <div
                ref={cardRef}
                className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 relative mb-10 print:shadow-none print:border print:rounded-none"
            >
                {/* Header - Corporate & Elegant */}
                <div className="bg-slate-900 text-white p-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/10">
                                <Zap className="text-yellow-400 fill-yellow-400" size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-light tracking-wide text-white">Zinergia <span className="font-bold">Propuesta</span></h2>
                                <p className="text-slate-400 text-xs uppercase tracking-widest font-medium mt-1">Solución Energética Inteligente</p>
                            </div>
                        </div>
                        <div className="text-right hidden md:block">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                                <Check size={12} className="stroke-[3]" /> Verificado y Optimizado
                            </div>
                            <p className="text-slate-500 text-[10px] mt-2 font-mono">ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                        </div>
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-10 md:p-14">

                    {/* Primary Value Prop */}
                    <div className="flex flex-col md:flex-row gap-12 items-center mb-14">
                        <div className="flex-1 space-y-4 text-center md:text-left">
                            <div className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider rounded-lg mb-2">
                                Recomendación Principal
                            </div>
                            <h3 className="text-5xl font-extralight text-slate-900 leading-tight">
                                {result.offer.marketer_name}
                            </h3>
                            <p className="text-xl text-slate-500 font-light">
                                Tarifa <span className="font-medium text-slate-800">{result.offer.tariff_name}</span>
                            </p>

                            <div className="flex flex-wrap gap-3 mt-4 justify-center md:justify-start">
                                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-md">
                                    <ShieldCheck size={14} className="text-slate-400" />
                                    Sin Permanencia
                                </span>
                                <span className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-md border border-green-100">
                                    <Zap size={14} className="fill-green-700" />
                                    100% Renovable
                                </span>
                            </div>
                        </div>

                        {/* SAVINGS HIGHLIGHT BOX */}
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-500"></div>
                            <div className="relative bg-white border border-slate-100 shadow-xl rounded-2xl p-8 text-center min-w-[280px]">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Ahorro Anual Proy.</h4>
                                <div className="text-6xl font-black text-slate-900 tracking-tighter mb-2">
                                    {formatCurrency(result.annual_savings)}
                                </div>
                                <div className="w-full h-px bg-slate-100 my-4"></div>
                                <div className="flex justify-between items-center text-sm px-2">
                                    <span className="text-slate-400 font-medium">Coste Actual</span>
                                    <span className="text-slate-400 line-through decoration-red-300 decoration-2">{formatCurrency(result.current_annual_cost)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm px-2 mt-1">
                                    <span className="text-indigo-600 font-bold">Nuevo Coste</span>
                                    <span className="text-slate-900 font-bold">{formatCurrency(result.offer_annual_cost)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Terms Grid */}
                    <div className="grid md:grid-cols-3 gap-6 bg-slate-50 rounded-2xl p-6 border border-slate-100">
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                                <FileText size={20} />
                            </div>
                            <div>
                                <h5 className="font-bold text-slate-800 text-sm">Gestión Integral</h5>
                                <p className="text-xs text-slate-500 leading-relaxed mt-1">Nos encargamos de todo el trámite de cambio sin cortes de luz ni molestias.</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                                <Calendar size={20} />
                            </div>
                            <div>
                                <h5 className="font-bold text-slate-800 text-sm">Precio Garantizado</h5>
                                <p className="text-xs text-slate-500 leading-relaxed mt-1">Precios fijos durante 12 meses. Sin sorpresas ni subidas de IPC.</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                                <Building2 size={20} />
                            </div>
                            <div>
                                <h5 className="font-bold text-slate-800 text-sm">Soporte B2B</h5>
                                <p className="text-xs text-slate-500 leading-relaxed mt-1">Gestor personal asignado para optimización continua de potencia.</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer / Legal */}
                    <div className="mt-10 pt-6 border-t border-slate-100 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-[10px] text-slate-400 max-w-lg">
                            Esta propuesta es una estimación basada en los datos proporcionados. La contratación final está sujeta a la aprobación de la comercializadora. Precios sin IVA incluido.
                        </p>
                        <div className="h-8 opacity-50 grayscale hover:grayscale-0 transition-all">
                            {/* Placeholder for Zinergia Logo Small */}
                            <div className="text-lg font-black tracking-tight text-slate-300">ZINERGIA</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- ACTION BUTTONS --- */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pb-12">
                <button
                    onClick={onReset}
                    className="px-8 py-3.5 rounded-xl font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors text-sm"
                >
                    Nueva Simulación
                </button>

                <div className="flex gap-3">
                    <button
                        onClick={handleDownloadPdf}
                        disabled={isGeneratingPdf}
                        className="group relative px-8 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:border-indigo-200 hover:text-indigo-600 hover:shadow-lg hover:shadow-indigo-50 transition-all flex items-center gap-2 disabled:opacity-70"
                    >
                        {isGeneratingPdf ? <Loader2 size={18} className="animate-spin text-indigo-500" /> : <Download size={18} className="group-hover:-translate-y-0.5 transition-transform" />}
                        <span>{isGeneratingPdf ? 'Generando PDF...' : 'Descargar PDF'}</span>
                    </button>

                    <button
                        onClick={onEmail}
                        className="group px-8 py-3.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-indigo-600 transition-all shadow-xl shadow-slate-900/20 hover:shadow-indigo-500/30 transform active:scale-[0.98] flex items-center gap-2"
                    >
                        <Mail size={18} />
                        <span>Enviar por Email</span>
                        <ArrowRight size={16} className="opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
                    </button>
                </div>
            </div>
        </div>
    );
};
