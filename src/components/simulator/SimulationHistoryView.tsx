/**
 * Simulation History View
 * Shows past simulations with ability to reload and compare
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Trash2, RotateCcw, Calendar, DollarSign } from 'lucide-react';
import { getSimulationHistory, deleteSimulation } from '@/services/simulatorService';
import { InvoiceData, SavingsResult } from '@/types/crm';

export function SimulationHistoryView({ onLoadSimulation }: { onLoadSimulation: (invoiceData: InvoiceData, results: SavingsResult[]) => void }) {
    const [history, setHistory] = React.useState<Array<{ id: string; invoice_data: InvoiceData; results: SavingsResult[]; total_savings: number; created_at: string }>>([]);
    const [loading, setLoading] = React.useState(false);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const simulations = await getSimulationHistory();
            setHistory(simulations);
        } catch (error) {
            console.error('Error loading history:', error);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        loadHistory();
    }, []);

    const handleDelete = async (id: string) => {
        try {
            await deleteSimulation(id);
            setHistory(prev => prev.filter(h => h.id !== id));
        } catch (error) {
            console.error('Error deleting simulation:', error);
        }
    };

    const handleLoad = (simulation: { id: string; invoice_data: InvoiceData; results: SavingsResult[]; total_savings: number; created_at: string }) => {
        onLoadSimulation(simulation.invoice_data, simulation.results);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-slate-600" />
                    <h3 className="text-lg font-bold text-slate-900">Historial de Simulaciones</h3>
                </div>
                <button
                    onClick={loadHistory}
                    disabled={loading}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                >
                    <RotateCcw className={`w-5 h-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* History List */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-600">Cargando historial...</p>
                </div>
            ) : history.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl">
                    <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-500">No hay simulaciones guardadas</p>
                    <p className="text-sm text-slate-400 mt-2">
                        Las simulaciones se guardarán automáticamente aquí
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {history.map((sim) => (
                        <motion.div
                            key={sim.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-slate-200"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    {/* Header */}
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-emerald-100 rounded-lg">
                                            <DollarSign className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900">
                                                Ahorro Anual: {formatCurrency(sim.total_savings)}
                                            </p>
                                            <p className="text-sm text-slate-500">
                                                {formatDate(sim.created_at)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                        <div>
                                            <p className="text-slate-500 text-xs">Cliente</p>
                                            <p className="font-medium text-slate-900 truncate">
                                                {sim.invoice_data.client_name || 'N/A'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-xs">Compañía</p>
                                            <p className="font-medium text-slate-900 truncate">
                                                {sim.invoice_data.company_name || 'N/A'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-xs">Tarifa</p>
                                            <p className="font-medium text-slate-900 truncate">
                                                {sim.invoice_data.tariff_name || 'N/A'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-xs">Ofertas</p>
                                            <p className="font-medium text-slate-900">
                                                {sim.results?.length || 0}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Best Offer Badge */}
                                    {sim.results && sim.results.length > 0 && (
                                        <div className="mt-3 p-3 bg-emerald-50 rounded-lg">
                                            <p className="text-xs text-emerald-700 font-medium mb-1">
                                                Mejor Oferta
                                            </p>
                                            <p className="text-sm font-semibold text-emerald-900">
                                                {sim.results[0].offer.marketer_name} - {sim.results[0].offer.tariff_name}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => handleLoad(sim)}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        Ver
                                    </button>
                                    <button
                                        onClick={() => handleDelete(sim.id)}
                                        className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4 inline mr-1" />
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
