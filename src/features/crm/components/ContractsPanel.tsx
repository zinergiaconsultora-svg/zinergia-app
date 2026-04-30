'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Zap,
    Flame,
    Combine,
    CalendarDays,
    AlertTriangle,
    XCircle,
    Plus,
    Trash2,
    Loader2,
    FileText,
} from 'lucide-react';
import { Contract, ContractStatus, ContractType } from '@/types/crm';
import { contractsService } from '@/services/crm/contracts';

const TYPE_CONFIG: Record<ContractType, { icon: React.ElementType; label: string; color: string }> = {
    electricidad: { icon: Zap, label: 'Electricidad', color: 'text-amber-500' },
    gas: { icon: Flame, label: 'Gas', color: 'text-blue-500' },
    dual: { icon: Combine, label: 'Dual', color: 'text-purple-500' },
};

const STATUS_CONFIG: Record<ContractStatus, { label: string; color: string; bg: string }> = {
    active: { label: 'Activo', color: 'text-emerald-700', bg: 'bg-emerald-50' },
    pending_switch: { label: 'En trámite', color: 'text-blue-700', bg: 'bg-blue-50' },
    cancelled: { label: 'Cancelado', color: 'text-slate-500', bg: 'bg-slate-100' },
    expired: { label: 'Expirado', color: 'text-red-600', bg: 'bg-red-50' },
};

function daysUntil(dateStr?: string): number | null {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

interface ContractsPanelProps {
    clientId: string;
}

export default function ContractsPanel({ clientId }: ContractsPanelProps) {
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        marketer_name: '',
        tariff_name: '',
        contract_type: 'electricidad' as ContractType,
        end_date: '',
        annual_savings: '',
    });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const data = await contractsService.getContractsByClient(clientId);
            if (cancelled) return;
            setContracts(data);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [clientId]);

    const load = useCallback(async () => {
        const data = await contractsService.getContractsByClient(clientId);
        setContracts(data);
    }, [clientId]);

    const handleCreate = async () => {
        if (!form.marketer_name.trim()) return;
        await contractsService.createContract({
            client_id: clientId,
            marketer_name: form.marketer_name.trim(),
            tariff_name: form.tariff_name.trim() || undefined,
            contract_type: form.contract_type,
            end_date: form.end_date || undefined,
            annual_savings: form.annual_savings ? parseFloat(form.annual_savings) : undefined,
        });
        setForm({ marketer_name: '', tariff_name: '', contract_type: 'electricidad', end_date: '', annual_savings: '' });
        setShowForm(false);
        load();
    };

    const handleCancel = async (id: string) => {
        await contractsService.updateContract(id, { status: 'cancelled' });
        load();
    };

    const handleDelete = async (id: string) => {
        await contractsService.deleteContract(id);
        load();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Contratos</h3>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                    title="Nuevo contrato"
                >
                    <Plus size={16} />
                </button>
            </div>

            {showForm && (
                <div className="mb-4 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-2">
                    <input
                        type="text"
                        placeholder="Comercializadora *"
                        value={form.marketer_name}
                        onChange={e => setForm(f => ({ ...f, marketer_name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        autoFocus
                    />
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Tarifa"
                            value={form.tariff_name}
                            onChange={e => setForm(f => ({ ...f, tariff_name: e.target.value }))}
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        />
                        <select
                            value={form.contract_type}
                            onChange={e => setForm(f => ({ ...f, contract_type: e.target.value as ContractType }))}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        >
                            <option value="electricidad">Electricidad</option>
                            <option value="gas">Gas</option>
                            <option value="dual">Dual</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="date"
                            placeholder="Fecha fin"
                            value={form.end_date}
                            onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        />
                        <input
                            type="number"
                            placeholder="Ahorro €/año"
                            value={form.annual_savings}
                            onChange={e => setForm(f => ({ ...f, annual_savings: e.target.value }))}
                            className="w-28 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        />
                    </div>
                    <button
                        onClick={handleCreate}
                        disabled={!form.marketer_name.trim()}
                        className="w-full py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                    >
                        Crear Contrato
                    </button>
                </div>
            )}

            {contracts.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">Sin contratos registrados</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {contracts.map(contract => {
                        const typeConf = TYPE_CONFIG[contract.contract_type];
                        const statusConf = STATUS_CONFIG[contract.status];
                        const TypeIcon = typeConf.icon;
                        const days = daysUntil(contract.end_date);
                        const isExpiring = days !== null && days >= 0 && days <= 90 && contract.status === 'active';

                        return (
                            <div key={contract.id} className="p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                <div className="flex items-center gap-2.5">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${contract.status === 'active' ? 'bg-amber-50' : 'bg-slate-50'}`}>
                                        <TypeIcon size={15} className={typeConf.color} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{contract.marketer_name}</p>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${statusConf.bg} ${statusConf.color}`}>
                                                {statusConf.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                            {contract.tariff_name && (
                                                <span className="text-[10px] text-slate-400">{contract.tariff_name}</span>
                                            )}
                                            {contract.end_date && (
                                                <span className={`text-[10px] flex items-center gap-0.5 ${isExpiring ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>
                                                    {isExpiring && <AlertTriangle size={9} />}
                                                    <CalendarDays size={9} />
                                                    {new Date(contract.end_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    {days !== null && ` (${days}d)`}
                                                </span>
                                            )}
                                            {contract.annual_savings && (
                                                <span className="text-[10px] text-emerald-600">
                                                    {contract.annual_savings.toFixed(0)}€/año ahorro
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {contract.status === 'active' && (
                                            <button
                                                onClick={() => handleCancel(contract.id)}
                                                className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                title="Cancelar contrato"
                                            >
                                                <XCircle size={13} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDelete(contract.id)}
                                            className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
