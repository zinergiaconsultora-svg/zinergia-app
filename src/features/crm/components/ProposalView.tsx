'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Save,
    Search,
    User,
    Check,
    X,
    Building2,
    Trash2,
    Link2,
    Copy,
    CheckCheck,
    BadgeCheck,
    Banknote,
} from 'lucide-react';
import { InvoiceData, SavingsResult, Client, Proposal, ProposalStatus } from '@/types/crm';
import { crmService } from '@/services/crmService';
import { getClientsAction } from '@/app/actions/clients';
import { generatePublicLinkAction } from '@/app/actions/publicProposal';
import { registerSaleAction, updateProposalStatusAction } from '@/app/actions/proposals';
import { logProposalCreatedAction } from '@/app/actions/proposalActivities';
import { formatCurrency } from '@/lib/utils/format';
import { toast } from 'sonner';
import { logger } from '@/lib/utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { DigitalProposalCard } from '@/features/comparator/components/DigitalProposalCard';
import ProposalTimeline from '@/features/crm/components/ProposalTimeline';
import type { InvoiceSimulationResult } from '@/lib/comparison/invoice-simulator';

interface ProposalViewProps {
    initialProposal?: Proposal;
}

export default function ProposalView({ initialProposal }: ProposalViewProps) {
    const router = useRouter();
    const [data, setData] = useState<{ result: SavingsResult, invoice: InvoiceData } | null>(null);
    const [status, setStatus] = useState<ProposalStatus>(initialProposal?.status || 'draft');
    const [loading, setLoading] = useState(true);
    const [notes, setNotes] = useState(initialProposal?.notes || '');

    // Public link state
    const [generatingLink, setGeneratingLink] = useState(false);
    const [publicUrl, setPublicUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Save Logic State
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Registrar venta (cierre de acuerdo)
    const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
    const [saleNote, setSaleNote] = useState('');
    const [registeringSale, setRegisteringSale] = useState(false);

    useEffect(() => {
        if (initialProposal) {
            const calculationData = initialProposal.calculation_data as InvoiceData & {
                calculation_audit?: InvoiceSimulationResult;
            };
            setData({
                result: {
                    offer: initialProposal.offer_snapshot,
                    annual_savings: initialProposal.annual_savings,
                    current_annual_cost: initialProposal.current_annual_cost,
                    offer_annual_cost: initialProposal.offer_annual_cost,
                    savings_percent: initialProposal.savings_percent,
                    optimization_result: initialProposal.optimization_result || undefined,
                    calculation_audit: calculationData.calculation_audit,
                },
                invoice: calculationData
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
            router.push('/dashboard/simulator');
        }
        setLoading(false);
    }, [router, initialProposal]);

    const loadClients = async () => {
        try {
            const data = await getClientsAction(200, 0);
            setClients(data);
        } catch (error) {
            logger.error('Failed to load clients', error);
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
            const proposalData = {
                client_id: selectedClient.id,
                status: 'draft' as ProposalStatus,
                offer_snapshot: data.result.offer,
                calculation_data: {
                    ...data.invoice,
                    calculation_audit: data.result.calculation_audit,
                } as InvoiceData,
                annual_savings: data.result.annual_savings,
                current_annual_cost: data.result.current_annual_cost,
                offer_annual_cost: data.result.offer_annual_cost,
                savings_percent: data.result.savings_percent,
                notes: notes,
                optimization_result: data.result.optimization_result || undefined,
            };

            const saved = await crmService.saveProposal(proposalData);

            logProposalCreatedAction(saved.id, selectedClient.id).catch(() => {});

            router.push(`/dashboard/clients/${selectedClient.id}`);
        } catch (error) {
            logger.error('Failed to save proposal', error);
            toast.error('Error al guardar la propuesta. Inténtalo de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    const handleGenerateLink = async () => {
        if (!initialProposal) return;
        setGeneratingLink(true);
        try {
            const { url } = await generatePublicLinkAction(initialProposal.id);
            setPublicUrl(url);
            setStatus('sent');
        } catch {
            toast.error('Error al generar el enlace.');
        } finally {
            setGeneratingLink(false);
        }
    };

    const handleCopyLink = async () => {
        if (!publicUrl) return;
        await navigator.clipboard.writeText(publicUrl);
        setCopied(true);
        toast.success('Enlace copiado');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleStatusChange = async (newStatus: ProposalStatus) => {
        if (!initialProposal) return;
        try {
            // Server action: aplica permisos, avisos y (si procede) el resto del flujo.
            await updateProposalStatusAction(initialProposal.id, newStatus);
            setStatus(newStatus);
        } catch (error) {
            logger.error('Failed to update status', error);
            toast.error('Error al actualizar el estado.');
        }
    };

    const commissionFromTariff = data?.result.offer.estimated_agent_commission ?? null;

    const handleRegisterSale = async () => {
        if (!initialProposal) return;
        setRegisteringSale(true);
        try {
            await registerSaleAction(initialProposal.id, saleNote);
            setStatus('accepted');
            setIsSaleModalOpen(false);
            setSaleNote('');
            toast.success('Venta registrada. La comisión se ha añadido a la cartera.');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo registrar la venta.');
        } finally {
            setRegisteringSale(false);
        }
    };

    const handleDelete = async () => {
        if (!initialProposal) return;
        if (!confirm('¿Estás seguro de eliminar esta propuesta?')) return;

        try {
            await crmService.deleteProposal(initialProposal.id);
            router.back();
        } catch (error) {
            logger.error('Failed to delete proposal', error);
            toast.error('Error al eliminar la propuesta.');
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500 text-xs text-sans">Cargando...</div>;
    if (!data) return <div className="min-h-screen flex items-center justify-center text-slate-500 text-xs text-sans">No hay datos de propuesta disponibles.</div>;

    const { result } = data;

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="bg-slate-50 min-h-screen font-sans text-slate-900 pb-24 print:pb-0 print:bg-white relative">
            {/* Header / Management Bar (Sticky Top) */}
            <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-2 print:hidden">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-500 hover:text-slate-900 transition-colors" aria-label="Volver" title="Volver">
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-xs font-bold text-slate-900 tracking-tight">Propuesta de Ahorro</h1>
                            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-medium">Ref: {initialProposal?.id.slice(0, 8) || 'Nueva'}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {initialProposal && (
                            status === 'accepted' ? (
                                <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                    <BadgeCheck size={13} className="text-emerald-600" />
                                    <span className="text-[11px] font-bold text-emerald-700">Venta registrada</span>
                                </div>
                            ) : (
                                <div className="hidden sm:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Estado:</span>
                                    <select
                                        value={status}
                                        onChange={(e) => handleStatusChange(e.target.value as ProposalStatus)}
                                        className="bg-transparent text-[11px] font-bold text-indigo-600 outline-none border-none cursor-pointer p-0 pr-4"
                                        aria-label="Cambiar Estado"
                                        title="Cambiar Estado"
                                    >
                                        <option value="draft">Borrador</option>
                                        <option value="sent">Enviada</option>
                                        <option value="rejected">Rechazada</option>
                                        <option value="expired">Expirada</option>
                                    </select>
                                </div>
                            )
                        )}

                        <div className="flex gap-2">
                            {initialProposal ? (
                                <>
                                    {/* Registrar venta (cerrar acuerdo) */}
                                    {status !== 'accepted' && (
                                        <button
                                            type="button"
                                            onClick={() => setIsSaleModalOpen(true)}
                                            className="flex items-center gap-1.5 px-3 h-9 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all text-xs font-bold shadow-sm shadow-emerald-600/20"
                                            title="Registrar la venta y generar la comisión"
                                        >
                                            <BadgeCheck size={14} />
                                            <span className="hidden sm:inline">Registrar venta</span>
                                        </button>
                                    )}
                                    {/* Compartir link público */}
                                    <button
                                        type="button"
                                        onClick={handleGenerateLink}
                                        disabled={generatingLink}
                                        className="flex items-center gap-1.5 px-3 h-9 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-all text-xs font-semibold disabled:opacity-60"
                                        title="Generar enlace público"
                                    >
                                        {generatingLink ? <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /> : <Link2 size={14} />}
                                        <span className="hidden sm:inline">Compartir</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-500 rounded-lg border border-red-100 hover:bg-red-100 transition-all"
                                        title="Eliminar Propuesta"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={handleOpenSaveModal}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95"
                                >
                                    <Save size={14} />
                                    <span>Guardar</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Banner enlace público generado */}
            <AnimatePresence>
                {publicUrl && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="bg-indigo-50 border-b border-indigo-100 px-4 py-3 print:hidden"
                    >
                        <div className="max-w-4xl mx-auto flex items-center gap-3">
                            <Link2 size={14} className="text-indigo-500 shrink-0" />
                            <span className="text-xs text-indigo-700 font-medium flex-1 truncate">{publicUrl}</span>
                            <button
                                type="button"
                                onClick={handleCopyLink}
                                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 shrink-0 transition-colors"
                            >
                                {copied ? <CheckCheck size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                {copied ? 'Copiado' : 'Copiar'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const text = `Hola, te comparto tu propuesta de ahorro energético de Zinergia: ${publicUrl}`;
                                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                                }}
                                className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-800 shrink-0 transition-colors"
                            >
                                WhatsApp
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Firma digital — solo visible si la propuesta fue firmada */}
            {initialProposal?.signature_data && (
                <div className="max-w-4xl mx-auto px-4 pt-4 print:hidden">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <Check size={14} className="text-emerald-600 shrink-0" />
                                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Propuesta firmada digitalmente</span>
                            </div>
                            <div className="flex flex-wrap gap-4 text-xs text-slate-500 mt-1">
                                {initialProposal.signed_name && (
                                    <span>Firmado por: <span className="font-medium text-slate-700">{initialProposal.signed_name}</span></span>
                                )}
                                {initialProposal.signed_at && (
                                    <span>Fecha: <span className="font-medium text-slate-700">{new Date(initialProposal.signed_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span>
                                )}
                            </div>
                        </div>
                        {/* Imagen de la firma */}
                        <div className="bg-white border border-emerald-100 rounded-xl p-2 shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={initialProposal.signature_data}
                                alt="Firma del cliente"
                                className="h-14 w-auto max-w-[160px] object-contain"
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-4xl mx-auto pt-4 px-4">
                <DigitalProposalCard
                    result={result}
                    invoiceData={data.invoice}
                    initialNotes={notes}
                    onNotesChange={setNotes}
                    onReset={() => router.push('/dashboard/simulator')}
                    onEmail={() => { /* Email already handled in Comparator logic */ }}
                    title={initialProposal ? "Estudio Personalizado" : "Mejor Opción Detectada"}
                    pdfApiUrl={initialProposal ? `/api/proposal/${initialProposal.id}/pdf` : undefined}
                />
            </div>

            {/* Timeline de actividad */}
            {initialProposal && (
                <div className="max-w-4xl mx-auto px-4 mt-6 print:hidden">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Historial</h3>
                        <ProposalTimeline proposalId={initialProposal.id} />
                    </div>
                </div>
            )}

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
                                    type="button"
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
                                    type="button"
                                    onClick={() => setIsSaveModalOpen(false)}
                                    className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
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

            {/* REGISTRAR VENTA MODAL */}
            <AnimatePresence>
                {isSaleModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                            onClick={() => setIsSaleModalOpen(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            role="dialog"
                            aria-modal="true"
                            aria-label="Registrar venta"
                            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                    <BadgeCheck size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">Registrar venta</h3>
                                    <p className="text-xs text-slate-500">Deja constancia del cierre y genera la comisión.</p>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                {/* Comisión de la tarifa */}
                                <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                                    <div className="flex items-center gap-2.5">
                                        <Banknote size={18} className="text-emerald-600 shrink-0" />
                                        <span className="text-sm font-semibold text-slate-700">Comisión de la tarifa</span>
                                    </div>
                                    {commissionFromTariff != null && commissionFromTariff > 0 ? (
                                        <span className="text-lg font-black text-emerald-700 tabular-nums">{formatCurrency(commissionFromTariff)}</span>
                                    ) : (
                                        <span className="text-xs text-amber-600 font-semibold text-right max-w-[55%]">Sin comisión en la tarifa — se calculará por la regla del ahorro</span>
                                    )}
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">
                                        Justificación del cierre <span className="text-red-400">*</span>
                                    </label>
                                    <textarea
                                        value={saleNote}
                                        onChange={(e) => setSaleNote(e.target.value)}
                                        rows={3}
                                        maxLength={1000}
                                        autoFocus
                                        placeholder="Ej.: Contrato firmado por el cliente el 17/06, enviado a la comercializadora. Nº contrato…"
                                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-sm text-slate-800 resize-none"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1.5">Queda registrado en el historial del cliente como prueba del acuerdo.</p>
                                </div>
                            </div>

                            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsSaleModalOpen(false)}
                                    className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRegisterSale}
                                    disabled={registeringSale || saleNote.trim().length < 3}
                                    className="flex-[2] py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {registeringSale ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Registrando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <BadgeCheck size={18} />
                                            <span>Confirmar venta</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
