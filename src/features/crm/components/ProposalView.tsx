'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Printer,
    Share2,
    Save,
    Search,
    User,
    Check,
    X,
    Building2,
    ShieldCheck,
    Leaf,
    CheckCircle2,
    Trash2
} from 'lucide-react';
import { InvoiceData, SavingsResult, Client, Proposal, ProposalStatus } from '@/types/crm';
import { crmService } from '@/services/crmService';
import { ZinergiaLogo } from '@/components/ui/ZinergiaLogo';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, formatDate, formatPercent } from '@/lib/utils/format';

interface ProposalViewProps {
    initialProposal?: Proposal;
}

export default function ProposalView({ initialProposal }: ProposalViewProps) {
    const router = useRouter();
    const [data, setData] = useState<{ result: SavingsResult, invoice: InvoiceData } | null>(null);
    const [status, setStatus] = useState<ProposalStatus>(initialProposal?.status || 'draft');
    const [loading, setLoading] = useState(true);

    // Save Logic State
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (initialProposal) {
            setData({
                result: {
                    offer: initialProposal.offer_snapshot,
                    annual_savings: initialProposal.annual_savings,
                    current_annual_cost: initialProposal.current_annual_cost,
                    offer_annual_cost: initialProposal.offer_annual_cost,
                    savings_percent: initialProposal.savings_percent,
                    optimization_result: initialProposal.optimization_result || undefined,
                },
                invoice: initialProposal.calculation_data
            });
            setLoading(false);
            return;
        }

        const storedResult = sessionStorage.getItem('comparator_result');
        const storedInvoice = sessionStorage.getItem('comparator_invoice');

        if (storedResult && storedInvoice) {
            setData({
                result: JSON.parse(storedResult),
                invoice: JSON.parse(storedInvoice)
            });
        } else {
            router.push('/dashboard/comparator');
        }
        setLoading(false);
    }, [router, initialProposal]);

    const loadClients = async () => {
        try {
            const data = await crmService.getClients();
            setClients(data);
        } catch (error) {
            console.error('Failed to load clients', error);
        }
    };

    const handleOpenSaveModal = () => {
        loadClients();
        setIsSaveModalOpen(true);
    };

    const handleSave = async () => {
        if (!selectedClient || !data) return;
        setSaving(true);
        try {
            await crmService.saveProposal({
                client_id: selectedClient.id,
                franchise_id: '', // Handled by service
                status: 'draft',
                offer_snapshot: data.result.offer,
                calculation_data: data.invoice,
                annual_savings: data.result.annual_savings,
                current_annual_cost: data.result.current_annual_cost,
                offer_annual_cost: data.result.offer_annual_cost,
                savings_percent: data.result.savings_percent,
                optimization_result: data.result.optimization_result || undefined,
            });
            // Success! Redirect to client
            router.push(`/dashboard/clients/${selectedClient.id}`);
        } catch (error) {
            console.error('Failed to save proposal', error);
            alert('Error al guardar la propuesta. Inténtalo de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (newStatus: ProposalStatus) => {
        if (!initialProposal) return;
        try {
            await crmService.updateProposalStatus(initialProposal.id, newStatus);
            setStatus(newStatus);
        } catch (error) {
            console.error('Failed to update status', error);
            alert('Error al actualizar el estado.');
        }
    };

    const handleDelete = async () => {
        if (!initialProposal) return;
        if (!confirm('¿Estás seguro de eliminar esta propuesta?')) return;

        try {
            await crmService.deleteProposal(initialProposal.id);
            router.back();
        } catch (error) {
            console.error('Failed to delete proposal', error);
            alert('Error al eliminar la propuesta.');
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500 text-xs">Cargando...</div>;
    if (!data) return <div className="min-h-screen flex items-center justify-center text-slate-500 text-xs">No hay datos de propuesta disponibles.</div>;


    const { result, invoice } = data;
    const currentCost = result.current_annual_cost;
    const newCost = result.offer_annual_cost;
    const maxVal = Math.max(currentCost, newCost);
    const currentPct = (currentCost / maxVal) * 100;
    const newPct = (newCost / maxVal) * 100;

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="bg-slate-50 min-h-screen font-sans text-slate-900 pb-24 print:pb-0 print:bg-white relative">
            {/* =================================================================================
                MOBILE / SCREEN VIEW (Hidden on Print) 
               ================================================================================= */}
            <div className="print:hidden max-w-md mx-auto p-4 space-y-4">

                {/* Mobile Header */}
                <header className="flex items-center justify-between mb-2">
                    <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-500 hover:text-slate-900" aria-label="Volver" title="Volver">
                        <ArrowLeft size={20} />
                    </button>

                    {initialProposal ? (
                        <select
                            value={status}
                            onChange={(e) => handleStatusChange(e.target.value as ProposalStatus)}
                            className="bg-transparent text-xs font-bold text-slate-900 uppercase tracking-widest outline-none border-none text-center cursor-pointer appearance-none"
                            aria-label="Cambiar Estado"
                            title="Cambiar Estado"
                        >
                            <option value="draft">Borrador</option>
                            <option value="sent">Enviada</option>
                            <option value="accepted">Aceptada</option>
                            <option value="rejected">Rechazada</option>
                            <option value="expired">Expirada</option>
                        </select>
                    ) : (
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Propuesta</span>
                    )}

                    <button className="p-2 -mr-2 text-slate-500 hover:text-slate-900" aria-label="Compartir" title="Compartir">
                        <Share2 size={20} />
                    </button>
                </header>

                {/* Hero Savings Card (Banking App Style) */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <ZinergiaLogo className="w-24 grayscale" />
                    </div>

                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Tu Ahorro Anual Estimado</p>
                    <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-4xl font-black text-green-600 tracking-tight">
                            {result.annual_savings.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€
                        </span>
                    </div>

                    {/* Compact Interactive Bar Chart */}
                    <div className="space-y-3">
                        {/* Current Bar */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400">
                                <span>Actual (Estimado)</span>
                                <span>{formatCurrency(currentCost)}</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-slate-300 rounded-full transition-all duration-1000"
                                    ref={(el) => { if (el) el.style.width = `${currentPct}%`; }}
                                ></div>
                            </div>
                        </div>

                        {/* New Bar */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] uppercase font-bold text-green-700">
                                <span>Con Zinergia</span>
                                <span>{formatCurrency(newCost)}</span>
                            </div>
                            <div className="h-2 w-full bg-green-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-green-500 rounded-full transition-all duration-1000"
                                    ref={(el) => { if (el) el.style.width = `${newPct}%`; }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Vertical Comparison Flow */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <h3 className="text-xs font-bold text-slate-900 mb-4 px-1">Optimización del Suministro</h3>

                    <div className="relative pl-4 space-y-6">
                        {/* Connecting Line */}
                        <div className="absolute left-[27px] top-3 bottom-6 w-0.5 bg-gradient-to-b from-slate-200 to-green-300"></div>

                        {/* From */}
                        <div className="flex items-center gap-4 relative">
                            <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center z-10 text-[10px] font-bold text-slate-500">
                                A
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] uppercase text-slate-400 font-bold">Comercializadora Actual</p>
                                <p className="text-xs text-slate-500 font-medium line-through decoration-slate-300 decoration-2">
                                    {formatCurrency(result.current_annual_cost / 12)} / mes
                                </p>
                            </div>
                        </div>

                        {/* To */}
                        <div className="flex items-center gap-4 relative">
                            <div className={`w-6 h-6 rounded-full ${result.offer.logo_color} border-2 border-white shadow-sm flex items-center justify-center z-10 text-[10px] font-bold text-white`}>
                                {result.offer.marketer_name.charAt(0)}
                            </div>
                            <div className="flex-1 bg-green-50/50 p-2 rounded-lg -ml-2">
                                <p className="text-[10px] uppercase text-green-700 font-bold">{result.offer.marketer_name}</p>
                                <p className="text-sm text-green-700 font-black">
                                    {formatCurrency(result.offer_annual_cost / 12)} / mes
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Technical Power Optimization Section (Screen) */}
                {result.optimization_result && result.optimization_result.annual_optimization_savings > 0 && (
                    <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 space-y-3">
                        <div className="flex items-center gap-2 text-amber-900">
                            <ShieldCheck size={16} />
                            <h3 className="text-xs font-bold uppercase tracking-tight">Optimización de Potencia</h3>
                        </div>
                        <p className="text-[10px] text-amber-800 leading-relaxed">
                            Su instalación permite un ajuste técnico para reducir costes fijos sin afectar al suministro.
                        </p>

                        <div className="bg-white/60 backdrop-blur rounded-xl p-3 overflow-x-auto">
                            <table className="w-full text-[10px]">
                                <thead>
                                    <tr className="text-slate-400 font-bold uppercase">
                                        <th className="text-left pb-2">Periodo</th>
                                        <th className="text-center pb-2">Actual</th>
                                        <th className="text-center pb-2 text-amber-700">Óptima</th>
                                    </tr>
                                </thead>
                                <tbody className="font-medium">
                                    {[1, 2, 3, 4, 5, 6].map(p => (
                                        <tr key={p} className="border-t border-amber-100/50">
                                            <td className="py-1.5 text-slate-500 font-bold">P{p}</td>
                                            <td className="py-1.5 text-center text-slate-400">
                                                {invoice[`power_p${p}` as keyof InvoiceData]}<span className="text-[8px] ml-0.5">kW</span>
                                            </td>
                                            <td className="py-1.5 text-center text-amber-700 font-bold bg-amber-100/30 rounded">
                                                {result.optimization_result?.optimized_powers[`p${p}`]}<span className="text-[8px] ml-0.5">kW</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between items-center pt-1">
                            <span className="text-[9px] font-bold text-amber-900 uppercase">Ahorro Técnico:</span>
                            <span className="text-sm font-black text-amber-600">
                                +{formatCurrency(result.optimization_result.annual_optimization_savings)}/año
                            </span>
                        </div>
                    </div>
                )}

                {/* Agent Concierge Card (Sticky Bottom Trigger) */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 pb-6 flex items-center gap-3 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)] z-50 md:hidden">
                    {!initialProposal && (
                        <button
                            onClick={handleOpenSaveModal}
                            className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg"
                        >
                            <Save size={16} />
                            <span>Guardar</span>
                        </button>
                    )}
                    <button
                        onClick={() => window.print()}
                        className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
                        aria-label="Imprimir"
                        title="Imprimir"
                    >
                        <Printer size={20} />
                    </button>
                </div>

                {/* Desktop Only Actions */}
                <div className="hidden md:flex flex-col items-center gap-4 pt-4">
                    {initialProposal && (
                        <div className="flex items-center gap-2 mb-2 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
                            <span className="text-xs font-bold text-slate-500 uppercase">Estado:</span>
                            <select
                                value={status}
                                onChange={(e) => handleStatusChange(e.target.value as ProposalStatus)}
                                className="bg-transparent text-sm font-bold text-indigo-700 outline-none border-none cursor-pointer"
                                aria-label="Cambiar Estado"
                                title="Cambiar Estado"
                            >
                                <option value="draft">Borrador</option>
                                <option value="sent">Enviada</option>
                                <option value="accepted">Aceptada</option>
                                <option value="rejected">Rechazada</option>
                                <option value="expired">Expirada</option>
                            </select>
                        </div>
                    )}

                    <div className="flex gap-4">
                        {!initialProposal && (
                            <button
                                onClick={handleOpenSaveModal}
                                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-sm flex items-center gap-3 shadow-xl hover:bg-indigo-700 transition-all hover:-translate-y-1 active:scale-95"
                            >
                                <Save size={18} />
                                Guardar en Cliente
                            </button>
                        )}
                        {initialProposal && (
                            <button
                                onClick={handleDelete}
                                className="bg-red-50 text-red-600 px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm border border-red-100 hover:bg-red-100 transition-all active:scale-95"
                            >
                                <Trash2 size={18} />
                                Eliminar
                            </button>
                        )}
                        <button
                            onClick={() => window.print()}
                            className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold text-sm flex items-center gap-3 shadow-xl hover:bg-black transition-all hover:-translate-y-1 active:scale-95"
                        >
                            <Printer size={18} />
                            Descargar PDF
                        </button>
                    </div>
                </div>
            </div>


            {/* =================================================================================
                PRINT VIEW (Visible only on Print) - The Formal Audit
               ================================================================================= */}
            <div className="hidden print:block max-w-[210mm] mx-auto bg-white p-[15mm] text-xs leading-relaxed h-[297mm] relative">

                {/* Header */}
                <header className="flex justify-between items-start border-b border-slate-900 pb-6 mb-8">
                    <div className="w-56">
                        <ZinergiaLogo className="mb-2 scale-110 origin-left" />
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Consultoría & Auditoría Energética</p>
                    </div>
                    <div className="text-right">
                        <h1 className="text-sm font-bold text-slate-900 mb-1 uppercase tracking-wide">Informe de Optimización</h1>
                        <p className="text-slate-400 text-[9px] mb-3">Ref: {initialProposal?.id || Math.random().toString(36).substr(2, 9).toUpperCase()}</p>

                        <div className="text-[9px] text-slate-600 flex flex-col items-end gap-0.5">
                            <p><strong>Fecha:</strong> {formatDate(new Date())}</p>
                            <p><strong>Cliente:</strong> {initialProposal ? 'Cliente Registrado' : 'Cliente Estimado'}</p>
                        </div>
                    </div>
                </header>

                {/* Intro */}
                <section className="mb-6">
                    <div className="flex items-start gap-4 p-4 bg-slate-50 rounded border border-slate-100">
                        <div className="flex-1">
                            <h2 className="text-[10px] font-bold text-slate-900 uppercase tracking-wide mb-2">Dictamen de Auditoría</h2>
                            <p className="text-justify text-slate-600 text-[10px] leading-relaxed">
                                Tras el análisis técnico del suministro, se certifica que la estructura de costes actual presenta ineficiencias corregibles.
                                La implementación de la tarifa indexada <strong className="text-slate-900">{result.offer.tariff_name}</strong> permitiría reducir
                                el gasto operativo anual en un <strong className="text-green-700">{formatPercent(result.savings_percent)}</strong>, manteniendo la calidad del suministro.
                            </p>
                        </div>
                        <div className="text-right pl-6 border-l border-slate-200">
                            <p className="text-[9px] uppercase text-slate-400 font-bold mb-1">Ahorro Anual Proyectado</p>
                            <p className="text-2xl font-black text-green-700 tracking-tight">{formatCurrency(result.annual_savings)}</p>
                        </div>
                    </div>
                </section>

                {/* Formal Data Table */}
                <section className="mb-6">
                    <h2 className="text-[10px] font-bold text-slate-900 uppercase tracking-wide mb-3 pl-2 border-l-2 border-slate-900">
                        Análisis Económico Desglosado
                    </h2>

                    <div className="rounded border border-slate-200 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-500 text-[9px] uppercase tracking-wider">
                                    <th className="p-2 font-semibold">Concepto de Facturación</th>
                                    <th className="p-2 font-semibold text-right">Situación Actual</th>
                                    <th className="p-2 font-semibold text-right bg-green-50/50 text-green-800">Propuesta Zinergia</th>
                                    <th className="p-2 font-semibold text-right">Impacto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[10px] text-slate-700">
                                <tr>
                                    <td className="p-2">Término de Energía (Variable)</td>
                                    <td className="p-2 text-right">{(result.current_annual_cost * 0.7).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</td>
                                    <td className="p-2 text-right bg-green-50/20">{(result.offer_annual_cost * 0.7).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</td>
                                    <td className="p-2 text-right text-green-600">-{((result.current_annual_cost - result.offer_annual_cost) * 0.7).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</td>
                                </tr>
                                <tr>
                                    <td className="p-2">Término de Potencia (Fijo)</td>
                                    <td className="p-2 text-right">{(result.current_annual_cost * 0.3).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</td>
                                    <td className="p-2 text-right bg-green-50/20">{(result.offer_annual_cost * 0.3).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</td>
                                    <td className="p-2 text-right text-green-600">-{((result.current_annual_cost - result.offer_annual_cost) * 0.3).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</td>
                                </tr>
                                <tr className="font-bold text-slate-900 border-t border-slate-300 bg-slate-50/30">
                                    <td className="p-2">TOTAL ANUAL ESTIMADO</td>
                                    <td className="p-2 text-right">{result.current_annual_cost.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</td>
                                    <td className="p-2 text-right bg-green-50 text-green-900">{result.offer_annual_cost.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</td>
                                    <td className="p-2 text-right text-green-600 bg-green-100">-{result.annual_savings.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* --- Optimization Section (New Strategy) --- */}
                {
                    result.optimization_result && result.optimization_result.annual_optimization_savings > 0 && (
                        <section className="mb-6 bg-amber-50 p-4 rounded border border-amber-200 break-inside-avoid print:block">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-amber-100 rounded text-amber-600 print:hidden">
                                    <ShieldCheck size={20} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-[10px] font-bold text-amber-900 uppercase tracking-wide mb-2">
                                        Oportunidad de Optimización Técnica (Maxímetro)
                                    </h3>
                                    <p className="text-[9px] text-amber-800 mb-3 leading-relaxed">
                                        Hemos detectado que su potencia contratada está sobredimensionada respecto a su demanda máxima real.
                                        Ajustando los términos de potencia al margen de seguridad óptimo (Max + 5%), obtendría un ahorro adicional garantizado.
                                    </p>

                                    <div className="bg-white border border-amber-100 rounded-lg overflow-hidden">
                                        <div className="grid grid-cols-7 gap-0 text-center text-[8px] border-b border-amber-50 bg-amber-50/30">
                                            <div className="font-bold text-amber-900 text-left px-3 py-2 border-r border-amber-50">Periodo</div>
                                            {[1, 2, 3, 4, 5, 6].map(p => (
                                                <div key={p} className="font-bold text-amber-700 py-2 border-r border-amber-50 last:border-r-0">P{p}</div>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-7 gap-0 text-center text-[8px] border-b border-slate-50">
                                            <div className="font-medium text-slate-400 text-left px-3 py-2 border-r border-slate-50">Actual (kW)</div>
                                            {[1, 2, 3, 4, 5, 6].map(p => (
                                                <div key={`cur${p}`} className="text-slate-400 py-2 border-r border-slate-50 last:border-r-0">
                                                    {invoice[`power_p${p}` as keyof InvoiceData]}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-7 gap-0 text-center text-[8px] bg-green-50/20">
                                            <div className="font-bold text-green-700 text-left px-3 py-2 border-r border-green-50">Óptima (kW)</div>
                                            {[1, 2, 3, 4, 5, 6].map(p => (
                                                <div key={`opt${p}`} className="font-bold text-green-700 py-2 border-r border-green-50 last:border-r-0">
                                                    {result.optimization_result?.optimized_powers[`p${p}`]}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-amber-200 text-right">
                                        <span className="text-[9px] font-bold text-amber-900 uppercase mr-2">Ahorro Extra Adicional:</span>
                                        <span className="text-xl font-black text-amber-600">
                                            +{formatCurrency(result.optimization_result.annual_optimization_savings)} <span className="text-xs text-amber-500">/año</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )
                }

                {/* Trust Badges & QR - The "Pro" Touch */}
                <section className="mb-6 grid grid-cols-2 gap-8">
                    {/* QR Bridge */}
                    <div className="flex items-center gap-4 border border-slate-200 rounded p-3 bg-white">
                        <div className="w-16 h-16 bg-slate-900 text-white flex items-center justify-center text-[9px] text-center p-1 leading-tight rounded">
                            [QR CODE]
                        </div>
                        <div className="flex-1">
                            <p className="text-[9px] font-bold text-slate-900 uppercase mb-1">Activación Digital</p>
                            <p className="text-[8px] text-slate-500 leading-snug">Escanee este código para acceder a su expediente digital, firmar el contrato o contactar con su gestor personal.</p>
                        </div>
                    </div>

                    {/* Certifications */}
                    <div className="flex flex-col justify-center gap-2 pl-4 border-l border-slate-200">
                        <div className="flex items-center gap-2 text-slate-600">
                            <Leaf size={14} className="text-green-600" />
                            <span className="text-[9px] font-bold uppercase">Energía 100% Verde Certificada</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                            <ShieldCheck size={14} className="text-blue-600" />
                            <span className="text-[9px] font-bold uppercase">Regulación CNMC 3/2020</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                            <CheckCircle2 size={14} className="text-slate-900" />
                            <span className="text-[9px] font-bold uppercase">Precio Indexado Transparente</span>
                        </div>
                    </div>
                </section>

                {/* Legal Footer */}
                <footer className="absolute bottom-[15mm] left-[15mm] right-[15mm] border-t border-slate-200 pt-4">
                    <div className="flex justify-between items-end">
                        <div className="text-[8px] text-slate-400 leading-tight space-y-1 w-2/3">
                            <p>Zinergia Consultores Energéticos S.L. - CIF B-12345678 - Inscrita en RM Madrid.</p>
                            <p>El presente informe tiene validez de 7 días. Los cálculos se basan en datos históricos facilitados y curvas de carga estándar. El ahorro real puede variar según el perfil de consumo futuro.</p>
                            <p>Información confidencial destinada exclusivamente al destinatario.</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-bold text-slate-900 mb-1">Departamento de Operaciones</p>
                            <div className="h-8 w-24 border-b border-slate-300"></div>
                            <p className="text-[8px] text-slate-400 mt-1">Firma y Sello</p>
                        </div>
                    </div>
                </footer>

            </div >

            {/* SAVE PROPOSAL MODAL */}
            <AnimatePresence>
                {isSaveModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                            onClick={() => setIsSaveModalOpen(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">Guardar Propuesta</h3>
                                    <p className="text-sm text-slate-500">Asigna este estudio a un cliente de tu cartera.</p>
                                </div>
                                <button
                                    onClick={() => setIsSaveModalOpen(false)}
                                    className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
                                    title="Cerrar"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-6">
                                {/* Search Bar */}
                                <div className="relative mb-6">
                                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                        <Search size={18} className="text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Buscar cliente..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                        autoFocus
                                    />
                                </div>

                                {/* List */}
                                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                                    {filteredClients.length === 0 ? (
                                        <div className="text-center py-8 text-slate-400">
                                            <p>No se encontraron clientes.</p>
                                        </div>
                                    ) : (
                                        filteredClients.map(client => (
                                            <div
                                                key={client.id}
                                                onClick={() => setSelectedClient(client)}
                                                className={`p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-all border ${selectedClient?.id === client.id ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/10' : 'bg-white border-slate-100 hover:border-indigo-100 hover:bg-slate-50'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${client.type === 'company' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                                                        {client.type === 'company' ? <Building2 size={18} /> : <User size={18} />}
                                                    </div>
                                                    <div>
                                                        <h4 className={`font-bold text-sm ${selectedClient?.id === client.id ? 'text-indigo-700' : 'text-slate-900'}`}>{client.name}</h4>
                                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                                            <span>{client.cups || 'Sin CUPS'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {selectedClient?.id === client.id && (
                                                    <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                                                        <Check size={16} strokeWidth={3} />
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                                <button
                                    onClick={() => setIsSaveModalOpen(false)}
                                    className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!selectedClient || saving}
                                    className="flex-[2] py-3.5 bg-slate-900 text-white font-bold rounded-xl shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Guardando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save size={18} />
                                            <span>Confirmar y Guardar</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
}
