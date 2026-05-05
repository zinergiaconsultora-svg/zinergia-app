'use client';

import React, { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Wallet,
    TrendingUp,
    Clock,
    ArrowUpRight,
    ArrowDownRight,
    CreditCard,
    DollarSign,
    CheckCircle2,
    XCircle,
    Calendar,
    Briefcase,
    ShieldCheck,
    Users,
    ChevronDown,
    ChevronUp,
    Download,
    Loader2,
    Building2,
    AlertCircle,
} from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { clearCommissionAction, payCommissionAction } from '@/app/actions/commissions';
import {
    approveWithdrawalAction,
    rejectWithdrawalAction,
    markWithdrawalPaidAction,
    saveIbanAction,
    getAllWithdrawalsAction,
} from '@/app/actions/withdrawals';
import { Commission, WithdrawalRequest } from '@/types/crm';
import { exportCommissionsToCSV } from '@/lib/utils/exportCsv';

interface WalletViewProps {
    canManage?: boolean;
    allCommissions?: Commission[];
}

function maskIban(iban: string): string {
    if (iban.length < 8) return iban;
    return iban.slice(0, 4) + '****' + iban.slice(-4);
}

const WITHDRAWAL_STATUS: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
    pending: { label: 'Pendiente', color: 'text-amber-700', bg: 'bg-amber-100', icon: Clock },
    approved: { label: 'Aprobada', color: 'text-blue-700', bg: 'bg-blue-100', icon: CheckCircle2 },
    rejected: { label: 'Rechazada', color: 'text-red-700', bg: 'bg-red-100', icon: XCircle },
    paid: { label: 'Pagada', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: CheckCircle2 },
};

function WithdrawModal({
    iban,
    commissions,
    onClose,
    onWithdraw,
}: {
    available: number;
    iban: string | null;
    commissions: Commission[];
    onClose: () => void;
    onWithdraw: (amount: number, ids: string[]) => Promise<{ success: boolean; error?: string }>;
}) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [showIbanForm, setShowIbanForm] = useState(!iban);
    const [ibanInput, setIbanInput] = useState(iban || '');
    const [ibanSaving, setIbanSaving] = useState(false);

    const selectedTotal = commissions
        .filter(c => selected.has(c.id))
        .reduce((sum, c) => sum + (c.agent_commission || 0), 0);

    const handleSaveIban = async () => {
        setIbanSaving(true);
        const result = await saveIbanAction(ibanInput);
        setIbanSaving(false);
        if (result.success) {
            toast.success('IBAN guardado');
            setShowIbanForm(false);
        } else {
            toast.error(result.error);
        }
    };

    const toggleAll = () => {
        if (selected.size === commissions.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(commissions.map(c => c.id)));
        }
    };

    const handleSubmit = async () => {
        if (selected.size === 0) return toast.error('Selecciona comisiones');
        setLoading(true);
        await onWithdraw(selectedTotal, [...selected]);
        setLoading(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                role="dialog"
                aria-modal="true"
                aria-label="Solicitar retiro de comisiones"
                className="bg-white rounded-2xl shadow-floating w-full max-w-lg max-h-[85vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-lg font-black text-slate-900">Solicitar Retiro</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Selecciona las comisiones aprobadas que deseas retirar
                    </p>
                </div>

                {showIbanForm ? (
                    <div className="p-6 space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                            <Building2 size={18} className="text-amber-600 shrink-0" />
                            <p className="text-xs text-amber-800">Necesitas configurar tu IBAN para recibir los pagos</p>
                        </div>
                        <input
                            type="text"
                            value={ibanInput}
                            onChange={e => setIbanInput(e.target.value.toUpperCase())}
                            placeholder="ES00 0000 0000 0000 0000 0000"
                            aria-label="IBAN"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-energy-500 focus:border-energy-500 outline-none"
                            maxLength={30}
                        />
                        <button
                            onClick={handleSaveIban}
                            disabled={ibanSaving || ibanInput.length < 15}
                            className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-40 transition-colors"
                        >
                            {ibanSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Guardar IBAN'}
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 overflow-y-auto p-6 space-y-2">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold text-slate-500">{commissions.length} comisiones disponibles</span>
                                <button onClick={toggleAll} className="text-xs font-bold text-energy-600 hover:text-energy-800">
                                    {selected.size === commissions.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                                </button>
                            </div>
                            {commissions.map(comm => (
                                <label
                                    key={comm.id}
                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                        selected.has(comm.id) ? 'border-energy-500 bg-energy-50' : 'border-slate-100 hover:border-slate-200'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selected.has(comm.id)}
                                        onChange={() => {
                                            const next = new Set(selected);
                                            if (selected.has(comm.id)) { next.delete(comm.id); } else { next.add(comm.id); }
                                            setSelected(next);
                                        }}
                                        className="w-4 h-4 rounded text-energy-600"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 truncate">
                                            {comm.proposals?.clients?.name || `Propuesta ${comm.proposal_id.slice(0, 6)}`}
                                        </p>
                                        <p className="text-xs text-slate-400">{formatDate(comm.created_at)}</p>
                                    </div>
                                    <span className="text-sm font-bold text-emerald-600">{formatCurrency(comm.agent_commission)}</span>
                                </label>
                            ))}
                        </div>
                        <div className="p-6 border-t border-slate-100 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500">IBAN destino</span>
                                <span className="text-sm font-mono text-slate-700">{iban ? maskIban(iban) : 'No configurado'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-900">Total a retirar</span>
                                <span className="text-lg font-black text-energy-600">{formatCurrency(selectedTotal)}</span>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading || selected.size === 0}
                                    className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-40 transition-colors"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmar Retiro'}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </motion.div>
        </div>
    );
}

export default function WalletView({ canManage = false, allCommissions: initialAll = [] }: WalletViewProps) {
    const {
        commissions,
        withdrawals,
        growth,
        iban,
        loading,
        userRole,
        userId,
        pendingBalance,
        availableBalance,
        totalEarned,
        totalWithdrawn,
        franchisePersonal,
        franchiseNetwork,
        clearedCommissions,
        handleSimulateSale,
        handleWithdraw,
        reloadCommissions,
    } = useWallet();

    const [allCommissions, setAllCommissions] = useState<Commission[]>(initialAll);
    const [adminFilter, setAdminFilter] = useState<'pending' | 'cleared' | 'paid' | 'all'>('pending');
    const [showAdmin, setShowAdmin] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [allWithdrawals, setAllWithdrawals] = useState<(WithdrawalRequest & { profiles?: { full_name: string; email: string } })[]>([]);
    const [showWithdrawalsAdmin, setShowWithdrawalsAdmin] = useState(true);
    const [rejectionId, setRejectionId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const handleClear = (id: string) => {
        startTransition(async () => {
            const result = await clearCommissionAction(id);
            if (result.success) {
                setAllCommissions(prev => prev.map(c => c.id === id ? { ...c, status: 'cleared' } : c));
            } else {
                toast.error(result.error);
            }
        });
    };

    const handlePay = (id: string) => {
        startTransition(async () => {
            const result = await payCommissionAction(id);
            if (result.success) {
                setAllCommissions(prev => prev.map(c => c.id === id ? { ...c, status: 'paid' } : c));
                reloadCommissions();
            } else {
                toast.error(result.error);
            }
        });
    };

    const handleLoadAdminWithdrawals = async () => {
        const data = await getAllWithdrawalsAction();
        setAllWithdrawals(data);
    };

    const handleApproveWithdrawal = async (id: string) => {
        const result = await approveWithdrawalAction(id);
        if (result.success) {
            toast.success('Solicitud aprobada');
            handleLoadAdminWithdrawals();
        } else {
            toast.error(result.error);
        }
    };

    const handleRejectWithdrawal = async () => {
        if (!rejectionId || !rejectionReason.trim()) return;
        const result = await rejectWithdrawalAction(rejectionId, rejectionReason.trim());
        setRejectionId(null);
        setRejectionReason('');
        if (result.success) {
            toast.success('Solicitud rechazada');
            handleLoadAdminWithdrawals();
        } else {
            toast.error(result.error);
        }
    };

    const handleMarkPaid = async (id: string) => {
        const result = await markWithdrawalPaidAction(id);
        if (result.success) {
            toast.success('Solicitud marcada como pagada');
            handleLoadAdminWithdrawals();
            reloadCommissions();
        } else {
            toast.error(result.error);
        }
    };

    const filteredAdmin = adminFilter === 'all'
        ? allCommissions
        : allCommissions.filter(c => c.status === adminFilter);

    const adminCounts = {
        pending: allCommissions.filter(c => c.status === 'pending').length,
        cleared: allCommissions.filter(c => c.status === 'cleared').length,
        paid: allCommissions.filter(c => c.status === 'paid').length,
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-energy-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Wallet className="text-energy-600" />
                        Mi Cartera
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Gestión de comisiones y pagos.</p>
                </div>
                <button
                    onClick={handleSimulateSale}
                    className="px-3 py-1.5 text-xs font-mono font-bold text-slate-400 border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-energy-600 transition-colors"
                >
                    DEV: SIMULAR VENTA
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="md:col-span-1 bg-slate-900 rounded-xl p-6 text-white shadow-card relative overflow-hidden flex flex-col justify-between min-h-[220px] group border border-slate-800"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50 pointer-events-none"></div>
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-energy-500 rounded-full blur-[80px] opacity-20 group-hover:opacity-30 transition-opacity"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-8">
                            <div className="bg-white/10 backdrop-blur-md p-2.5 rounded-xl border border-white/10 shrink-0">
                                <CreditCard size={20} className="text-white" />
                            </div>
                            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-500/30 backdrop-blur-sm">
                                Wallet Activa
                            </span>
                        </div>
                        <div>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Saldo Disponible</p>
                            <h2 className="text-4xl lg:text-5xl font-black tracking-tighter text-white tabular-nums">
                                {formatCurrency(availableBalance)}
                            </h2>
                            {userRole === 'franchise' && (
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-medium">
                                    <span>Personal: <span className="text-white">{formatCurrency(franchisePersonal)}</span></span>
                                    <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                                    <span>Red: <span className="text-emerald-400">+{formatCurrency(franchiseNetwork)}</span></span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="relative z-10 mt-auto pt-6 flex items-center justify-between border-t border-white/10">
                        <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Retirado</p>
                            <p className="text-sm font-medium text-white">{formatCurrency(totalWithdrawn)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">
                                {userRole === 'franchise' ? 'Franquicia' : 'Agente'}
                            </p>
                            <div className="flex items-center gap-1.5 justify-end">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
                                <p className="text-xs font-mono text-slate-200 truncate max-w-[80px]" title={userId}>
                                    ID-{userId.slice(0, 4)}
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 h-full">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white p-6 rounded-xl border border-slate-200 shadow-card flex flex-col justify-center relative overflow-hidden group min-h-[160px]"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Clock size={80} className="text-amber-500 transform rotate-12" />
                        </div>
                        <div className="flex items-center gap-3 mb-3 relative z-10">
                            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl"><Clock size={20} /></div>
                            <span className="text-sm font-bold text-slate-500 uppercase tracking-wide">Pendiente</span>
                        </div>
                        <p className="text-3xl font-black text-slate-900 tracking-tight relative z-10">{formatCurrency(pendingBalance)}</p>
                        <div className="mt-2 flex items-center gap-2 relative z-10">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            <p className="text-xs text-slate-400 font-medium">Validacion en curso</p>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white p-6 rounded-xl border border-slate-200 shadow-card flex flex-col justify-center relative overflow-hidden group min-h-[160px]"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <TrendingUp size={80} className="text-energy-600 transform -rotate-6" />
                        </div>
                        <div className="flex items-center gap-3 mb-3 relative z-10">
                            <div className="p-2.5 bg-energy-50 text-energy-600 rounded-xl"><TrendingUp size={20} /></div>
                            <span className="text-sm font-bold text-slate-500 uppercase tracking-wide">Ingresos Totales</span>
                        </div>
                        <p className="text-3xl font-black text-slate-900 tracking-tight relative z-10">{formatCurrency(totalEarned)}</p>
                        <p className={`text-xs font-bold mt-2 flex items-center gap-1 w-fit px-2 py-0.5 rounded-full relative z-10 ${
                            (growth.growth_percent ?? 0) > 0
                                ? 'text-emerald-600 bg-emerald-50'
                                : (growth.growth_percent ?? 0) < 0
                                    ? 'text-red-600 bg-red-50'
                                    : 'text-slate-500 bg-slate-50'
                        }`}>
                            {(growth.growth_percent ?? 0) > 0 ? <ArrowUpRight size={12} /> : (growth.growth_percent ?? 0) < 0 ? <ArrowDownRight size={12} /> : null}
                            {(growth.growth_percent ?? 0) > 0 ? '+' : ''}{(growth.growth_percent ?? 0).toFixed(1)}% vs mes anterior
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="sm:col-span-2 bg-gradient-to-r from-energy-500 to-energy-600 p-px rounded-xl shadow-card"
                    >
                        <div className="bg-white rounded-[11px] p-4 flex flex-col sm:flex-row sm:items-center justify-between h-full gap-4 sm:gap-0">
                            <div className="flex items-center gap-4 pl-2">
                                <div className="bg-energy-50 p-3 rounded-2xl text-energy-600"><DollarSign size={24} /></div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 leading-tight">Solicitar Retiro</h3>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        {availableBalance > 0
                                            ? `${formatCurrency(availableBalance)} disponibles para retirar`
                                            : 'Sin saldo disponible aun'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={isPending || availableBalance <= 0}
                                onClick={() => setShowWithdrawModal(true)}
                                className="w-full sm:w-auto bg-slate-900 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 text-center"
                            >
                                Retirar Fondos
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>

            <AnimatePresence>
                {showWithdrawModal && (
                    <WithdrawModal
                        available={availableBalance}
                        iban={iban}
                        commissions={clearedCommissions}
                        onClose={() => setShowWithdrawModal(false)}
                        onWithdraw={handleWithdraw}
                    />
                )}
            </AnimatePresence>

            {/* Withdrawal History */}
            {withdrawals.length > 0 && (
                <div className="bg-white rounded-xl shadow-card border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                        <h3 className="font-bold text-slate-900 text-sm">Historial de Retiros</h3>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {withdrawals.map(w => {
                            const cfg = WITHDRAWAL_STATUS[w.status] || WITHDRAWAL_STATUS.pending;
                            const StatusIcon = cfg.icon;
                            return (
                                <div key={w.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cfg.bg}`}>
                                            <StatusIcon size={18} className={cfg.color} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">Retiro {formatCurrency(w.amount)}</p>
                                            <p className="text-xs text-slate-400 flex items-center gap-2">
                                                <Calendar size={10} /> {formatDate(w.created_at)}
                                                <span className="text-slate-300">|</span>
                                                IBAN: {maskIban(w.iban)}
                                            </p>
                                            {w.rejection_reason && (
                                                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                                    <AlertCircle size={10} /> {w.rejection_reason}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${cfg.bg} ${cfg.color}`}>
                                        {cfg.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ADMIN: Withdrawal Approvals */}
            {canManage && (
                <div className="bg-white rounded-xl shadow-card border border-slate-200 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => {
                            setShowWithdrawalsAdmin(v => !v);
                            if (!showWithdrawalsAdmin) handleLoadAdminWithdrawals();
                        }}
                        className="w-full p-6 flex justify-between items-center hover:bg-slate-50/50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-violet-100 rounded-xl"><DollarSign size={18} className="text-violet-600" /></div>
                            <div className="text-left">
                                <h3 className="font-bold text-slate-900 text-sm">Solicitudes de Retiro</h3>
                                <p className="text-xs text-slate-500">Aprobar, rechazar o marcar como pagadas</p>
                            </div>
                        </div>
                        {showWithdrawalsAdmin ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                    </button>

                    {showWithdrawalsAdmin && (
                        <div className="divide-y divide-slate-50">
                            {allWithdrawals.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm">No hay solicitudes de retiro</div>
                            ) : allWithdrawals.map(w => {
                                const cfg = WITHDRAWAL_STATUS[w.status] || WITHDRAWAL_STATUS.pending;
                                return (
                                    <div key={w.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900">
                                                {w.profiles?.full_name || 'Agente'}
                                                <span className="text-slate-400 font-normal ml-2 text-xs">{w.profiles?.email}</span>
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {formatCurrency(w.amount)} | IBAN: {maskIban(w.iban)} | {formatDate(w.created_at)}
                                            </p>
                                            {w.rejection_reason && (
                                                <p className="text-xs text-red-600 mt-1">Motivo: {w.rejection_reason}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${cfg.bg} ${cfg.color}`}>
                                                {cfg.label}
                                            </span>
                                            {w.status === 'pending' && (
                                                <>
                                                    <button onClick={() => handleApproveWithdrawal(w.id)} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors">Aprobar</button>
                                                    <button onClick={() => { setRejectionId(w.id); setRejectionReason(''); }} className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-bold rounded-lg hover:bg-red-200 transition-colors">Rechazar</button>
                                                </>
                                            )}
                                            {w.status === 'approved' && (
                                                <button onClick={() => handleMarkPaid(w.id)} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors">Marcar Pagada</button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Rejection Dialog */}
            <AnimatePresence>
                {rejectionId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setRejectionId(null)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            role="dialog"
                            aria-modal="true"
                            aria-label="Motivo del rechazo"
                            className="bg-white rounded-2xl shadow-floating w-full max-w-md p-6 space-y-4"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="font-bold text-slate-900">Motivo del rechazo</h3>
                            <textarea
                                value={rejectionReason}
                                onChange={e => setRejectionReason(e.target.value)}
                                placeholder="Explica por que se rechaza esta solicitud..."
                                aria-label="Motivo del rechazo"
                                className="w-full p-3 rounded-xl border border-slate-200 text-sm resize-none focus:ring-2 focus:ring-energy-500 outline-none"
                                rows={3}
                            />
                            <div className="flex gap-3">
                                <button onClick={() => setRejectionId(null)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">Cancelar</button>
                                <button onClick={handleRejectWithdrawal} disabled={!rejectionReason.trim()} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-40 transition-colors">Rechazar</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ADMIN: Commission Management */}
            {canManage && (
                <div className="bg-white rounded-xl shadow-card border border-slate-200 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setShowAdmin(v => !v)}
                        className="w-full p-6 flex justify-between items-center hover:bg-slate-50/50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 rounded-xl"><ShieldCheck size={18} className="text-indigo-600" /></div>
                            <div className="text-left">
                                <h3 className="font-bold text-slate-900 text-sm">Panel de Comisiones</h3>
                                <p className="text-xs text-slate-500">
                                    {adminCounts.pending} pendientes | {adminCounts.cleared} aprobadas | {adminCounts.paid} pagadas
                                </p>
                            </div>
                        </div>
                        {showAdmin ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                    </button>

                    {showAdmin && (
                        <>
                            <div className="px-6 pb-3 flex items-center justify-between gap-2 border-b border-slate-100">
                                <div className="flex gap-2 overflow-x-auto no-scrollbar whitespace-nowrap">
                                    {(['pending', 'cleared', 'paid', 'all'] as const).map(f => (
                                        <button
                                            type="button"
                                            key={f}
                                            onClick={() => setAdminFilter(f)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${adminFilter === f ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                        >
                                            {f === 'pending' ? `Pendientes (${adminCounts.pending})` :
                                             f === 'cleared' ? `Aprobadas (${adminCounts.cleared})` :
                                             f === 'paid'    ? `Pagadas (${adminCounts.paid})` : 'Todas'}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const label = adminFilter === 'all' ? 'comisiones' : `comisiones-${adminFilter}`;
                                        exportCommissionsToCSV(filteredAdmin, label);
                                    }}
                                    disabled={filteredAdmin.length === 0}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 transition-colors shrink-0"
                                >
                                    <Download size={13} />
                                    CSV
                                </button>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {filteredAdmin.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                                        <Users size={32} className="opacity-30" />
                                        No hay comisiones en este estado.
                                    </div>
                                ) : filteredAdmin.map(comm => (
                                    <div key={comm.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors gap-4">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-xs ${
                                                comm.status === 'paid'    ? 'bg-green-100 text-green-600' :
                                                comm.status === 'cleared' ? 'bg-indigo-100 text-indigo-600' :
                                                                             'bg-amber-100 text-amber-600'
                                            }`}>
                                                {comm.status === 'paid' ? <CheckCircle2 size={16} /> :
                                                 comm.status === 'cleared' ? <Wallet size={16} /> : <Clock size={16} />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-900 truncate">
                                                    {comm.proposals?.clients?.name || `Propuesta ${comm.proposal_id.slice(0, 6)}`}
                                                </p>
                                                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                                                    <Calendar size={10} />
                                                    {formatDate(comm.created_at)}
                                                    <span className="text-slate-300">|</span>
                                                    Agente: <span className="font-mono">{comm.agent_id.slice(0, 8)}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-end gap-3 shrink-0">
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-slate-900">{formatCurrency(comm.agent_commission)}</p>
                                                <p className="text-xs text-slate-400">Franquicia: {formatCurrency(comm.franchise_commission ?? 0)}</p>
                                            </div>
                                            {comm.status === 'pending' && (
                                                <button type="button" onClick={() => handleClear(comm.id)} disabled={isPending} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50">Aprobar</button>
                                            )}
                                            {comm.status === 'cleared' && (
                                                <button type="button" onClick={() => handlePay(comm.id)} disabled={isPending} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50">Marcar Pagada</button>
                                            )}
                                            {comm.status === 'paid' && (
                                                <span className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-bold rounded-lg">Pagada</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Recent Transactions */}
            <div className="bg-white rounded-xl shadow-card border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900 text-sm">Movimientos Recientes</h3>
                </div>
                <div className="divide-y divide-slate-50">
                    {commissions.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 text-sm">No hay movimientos registrados aun.</div>
                    ) : commissions.slice(0, 20).map((comm) => (
                        <div key={comm.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    comm.status === 'paid' ? 'bg-green-100 text-green-600' :
                                    comm.status === 'cleared' ? 'bg-energy-100 text-energy-600' :
                                    'bg-slate-100 text-slate-500'
                                }`}>
                                    {comm.status === 'paid' ? <CheckCircle2 size={18} /> :
                                     comm.status === 'cleared' ? <Wallet size={18} /> : <Clock size={18} />}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900">Comision #{comm.proposal_id.substring(0, 6)}</p>
                                    <p className="text-xs text-slate-500 flex items-center gap-2">
                                        <Calendar size={10} /> {formatDate(comm.created_at)}
                                        {comm.proposals?.clients?.name && <span className="flex items-center gap-1"><Briefcase size={10} /> {comm.proposals.clients.name}</span>}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-slate-900">+{formatCurrency(comm.agent_commission)}</p>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                    comm.status === 'paid' ? 'bg-green-100 text-green-700' :
                                    comm.status === 'cleared' ? 'bg-energy-100 text-energy-700' :
                                    'bg-amber-100 text-amber-700'
                                }`}>
                                    {comm.status === 'cleared' ? 'Disponible' : comm.status === 'paid' ? 'Pagado' : 'Pendiente'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
