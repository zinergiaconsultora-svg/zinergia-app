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
    Trash2
} from 'lucide-react';
import { InvoiceData, SavingsResult, Client, Proposal, ProposalStatus } from '@/types/crm';
import { crmService } from '@/services/crmService';
import { motion, AnimatePresence } from 'framer-motion';
import { DigitalProposalCard } from '@/features/comparator/components/DigitalProposalCard';

interface ProposalViewProps {
    initialProposal?: Proposal;
}

export default function ProposalView({ initialProposal }: ProposalViewProps) {
    const router = useRouter();
    const [data, setData] = useState<{ result: SavingsResult, invoice: InvoiceData } | null>(null);
    const [status, setStatus] = useState<ProposalStatus>(initialProposal?.status || 'draft');
    const [loading, setLoading] = useState(true);
    const [notes, setNotes] = useState(initialProposal?.notes || '');

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
            const proposalData = {
                client_id: selectedClient.id,
                status: 'draft' as ProposalStatus,
                offer_snapshot: data.result.offer,
                calculation_data: data.invoice,
                annual_savings: data.result.annual_savings,
                current_annual_cost: data.result.current_annual_cost,
                offer_annual_cost: data.result.offer_annual_cost,
                savings_percent: data.result.savings_percent,
                notes: notes,
                optimization_result: data.result.optimization_result || undefined,
            };

            await crmService.saveProposal(proposalData);

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
                                    <option value="accepted">Aceptada</option>
                                    <option value="rejected">Rechazada</option>
                                    <option value="expired">Expirada</option>
                                </select>
                            </div>
                        )}

                        <div className="flex gap-2">
                            {initialProposal ? (
                                <button
                                    onClick={handleDelete}
                                    className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-500 rounded-lg border border-red-100 hover:bg-red-100 transition-all"
                                    title="Eliminar Propuesta"
                                >
                                    <Trash2 size={16} />
                                </button>
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

            <div className="max-w-4xl mx-auto pt-4 px-4">
                <DigitalProposalCard
                    result={result}
                    initialNotes={notes}
                    onNotesChange={setNotes}
                    onReset={() => router.push('/dashboard/comparator')}
                    onEmail={() => { /* Email already handled in Comparator logic */ }}
                    title={initialProposal ? "Estudio Personalizado" : "Mejor Opción Detectada"}
                />
            </div>

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
        </div>
    );
}
