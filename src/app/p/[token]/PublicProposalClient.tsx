'use client';

import { useState } from 'react';
import { Proposal } from '@/types/crm';
import { acceptPublicProposalAction } from '@/app/actions/publicProposal';
import dynamic from 'next/dynamic';

const SignaturePad = dynamic(
    () => import('@/components/SignaturePad').then(m => m.SignaturePad),
    { ssr: false, loading: () => <div className="w-full h-36 bg-white/10 rounded-xl animate-pulse" /> }
);
import { formatCurrency } from '@/lib/utils/format';
import {
    CheckCircle2, Zap, TrendingDown, ShieldCheck, Clock,
    Loader2, AlertCircle, PenLine, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PublicProposal extends Proposal {
    client_name?: string;
}

interface Props {
    proposal: PublicProposal;
    token: string;
}

type Step = 'view' | 'sign' | 'done';

export default function PublicProposalClient({ proposal, token }: Props) {
    const [step, setStep] = useState<Step>(
        proposal.status === 'accepted' || !!(proposal.public_accepted_at as string | null) ? 'done' : 'view'
    );
    const [accepting, setAccepting] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const [signatureData, setSignatureData] = useState<string | null>(null);
    const [signedName, setSignedName] = useState('');

    const expiresAt = proposal.public_expires_at
        ? new Date(proposal.public_expires_at as string).toLocaleDateString('es-ES', {
            day: '2-digit', month: 'long', year: 'numeric',
        })
        : null;

    const monthlySavings = Math.round(proposal.annual_savings / 12);
    const savingsPercent = Math.round(proposal.savings_percent);

    const handleAccept = async () => {
        if (!signatureData) return;
        setAccepting(true);
        try {
            const res = await acceptPublicProposalAction(token, signatureData, signedName);
            setResult(res);
            if (res.success) setStep('done');
        } catch {
            setResult({ success: false, message: 'Error inesperado. Inténtalo de nuevo.' });
        } finally {
            setAccepting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center px-4 py-12">

            {/* Logo */}
            <div className="mb-8 flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                    <Zap className="text-indigo-400" size={22} />
                    <span className="text-white font-bold text-xl tracking-tight">Zinergia</span>
                </div>
                <span className="text-slate-400 text-xs">Propuesta de Ahorro Energético</span>
            </div>

            <div className="w-full max-w-lg">
                <AnimatePresence mode="wait">

                    {/* PASO 1: Vista de propuesta */}
                    {step === 'view' && (
                        <motion.div
                            key="view"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4"
                        >
                            {/* Hero savings */}
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center">
                                {proposal.client_name && (
                                    <p className="text-slate-400 text-sm mb-2">
                                        Estudio para <span className="text-white font-semibold">{proposal.client_name}</span>
                                    </p>
                                )}
                                <div className="text-6xl font-black text-white mb-1">
                                    {formatCurrency(proposal.annual_savings)}
                                </div>
                                <p className="text-indigo-400 font-semibold text-lg">de ahorro al año</p>
                                <div className="flex items-center justify-center gap-4 mt-4 text-sm text-slate-300">
                                    <span className="flex items-center gap-1">
                                        <TrendingDown size={14} className="text-emerald-400" />
                                        {savingsPercent}% menos
                                    </span>
                                    <span className="text-slate-600">·</span>
                                    <span className="flex items-center gap-1">
                                        <span className="text-emerald-400 font-bold">{formatCurrency(monthlySavings)}</span>
                                        /mes
                                    </span>
                                </div>
                            </div>

                            {/* Comparativa */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
                                    <p className="text-slate-400 text-xs mb-2 uppercase tracking-wider">Pagas ahora</p>
                                    <p className="text-2xl font-bold text-slate-300 line-through decoration-red-400">
                                        {formatCurrency(proposal.current_annual_cost)}
                                    </p>
                                    <p className="text-slate-500 text-xs mt-1">al año</p>
                                </div>
                                <div className="bg-indigo-600/20 border border-indigo-500/30 rounded-2xl p-5 text-center">
                                    <p className="text-indigo-300 text-xs mb-2 uppercase tracking-wider">Con Zinergia</p>
                                    <p className="text-2xl font-bold text-white">
                                        {formatCurrency(proposal.offer_annual_cost)}
                                    </p>
                                    <p className="text-indigo-300 text-xs mt-1">al año</p>
                                </div>
                            </div>

                            {/* Oferta */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-slate-400 text-xs uppercase tracking-wider">Oferta seleccionada</span>
                                    <span className="text-xs bg-indigo-600/30 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                                        {proposal.offer_snapshot.type === 'fixed' ? 'Tarifa fija' : 'Tarifa indexada'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0"
                                        style={{ ['--logo-bg' as string]: proposal.offer_snapshot.logo_color || '#4f46e5', backgroundColor: 'var(--logo-bg)' }}
                                    >
                                        {proposal.offer_snapshot.marketer_name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-white font-semibold">{proposal.offer_snapshot.marketer_name}</p>
                                        <p className="text-slate-400 text-xs">{proposal.offer_snapshot.tariff_name} · {proposal.offer_snapshot.contract_duration}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Optimización */}
                            {proposal.optimization_result && (
                                <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-2xl p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <ShieldCheck size={14} className="text-emerald-400" />
                                        <span className="text-emerald-300 text-xs font-semibold uppercase tracking-wider">Optimización de potencia incluida</span>
                                    </div>
                                    <p className="text-slate-300 text-sm">
                                        Ahorro adicional de <span className="text-emerald-400 font-bold">{formatCurrency(proposal.optimization_result.annual_optimization_savings)}/año</span> ajustando tus potencias.
                                    </p>
                                </div>
                            )}

                            {/* Notas del asesor */}
                            {proposal.notes && (
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                                    <p className="text-slate-400 text-xs mb-1 uppercase tracking-wider">Nota de tu asesor</p>
                                    <p className="text-slate-200 text-sm">{proposal.notes}</p>
                                </div>
                            )}

                            {/* Expiración */}
                            {expiresAt && (
                                <div className="flex items-center gap-2 text-slate-400 text-xs justify-center">
                                    <Clock size={12} />
                                    <span>Oferta válida hasta el <span className="text-slate-300">{expiresAt}</span></span>
                                </div>
                            )}

                            {/* CTA → paso firma */}
                            <button
                                type="button"
                                onClick={() => setStep('sign')}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg rounded-2xl shadow-2xl shadow-indigo-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                <PenLine size={20} />
                                Aceptar y firmar
                            </button>
                            <p className="text-slate-500 text-xs text-center">
                                Sin permanencia · Sin coste de cambio · Cancelación gratuita
                            </p>
                        </motion.div>
                    )}

                    {/* PASO 2: Firma digital */}
                    {step === 'sign' && (
                        <motion.div
                            key="sign"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-5"
                        >
                            {/* Cabecera del paso */}
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                                <div className="flex items-center gap-3 mb-1">
                                    <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center">
                                        <PenLine size={16} className="text-indigo-400" />
                                    </div>
                                    <h2 className="text-white font-bold text-lg">Firma el documento</h2>
                                </div>
                                <p className="text-slate-400 text-sm">
                                    Al firmar confirmas que aceptas la propuesta de ahorro de <span className="text-white font-semibold">{formatCurrency(proposal.annual_savings)}/año</span> con <span className="text-white font-semibold">{proposal.offer_snapshot.marketer_name}</span>.
                                </p>
                            </div>

                            {/* Campo nombre firmante */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                                <label className="block">
                                    <span className="text-slate-400 text-xs uppercase tracking-wider flex items-center gap-1 mb-2">
                                        <User size={11} />
                                        Nombre completo del firmante
                                    </span>
                                    <input
                                        type="text"
                                        value={signedName}
                                        onChange={(e) => setSignedName(e.target.value)}
                                        placeholder="Ej: María García López"
                                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/30 transition-all"
                                    />
                                </label>

                                {/* Canvas firma */}
                                <div className="bg-white rounded-2xl p-2">
                                    <SignaturePad
                                        onSignature={setSignatureData}
                                        label="Traza tu firma"
                                    />
                                </div>
                            </div>

                            {/* Texto legal */}
                            <p className="text-slate-500 text-xs text-center px-4">
                                Esta firma electrónica tiene validez legal conforme al Reglamento eIDAS (UE) 910/2014 y la Ley 59/2003 de Firma Electrónica.
                            </p>

                            {/* Error */}
                            {result && !result.success && (
                                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
                                    <AlertCircle size={16} className="text-red-400 shrink-0" />
                                    <p className="text-red-300 text-sm">{result.message}</p>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setStep('view')}
                                    className="flex-1 py-3.5 rounded-xl border border-white/10 text-slate-300 text-sm font-medium hover:bg-white/5 transition-colors"
                                >
                                    Volver
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAccept}
                                    disabled={!signatureData || !signedName.trim() || accepting}
                                    className="flex-[2] py-3.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {accepting ? (
                                        <><Loader2 size={16} className="animate-spin" /> Procesando...</>
                                    ) : (
                                        <><CheckCircle2 size={16} /> Confirmar firma</>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* PASO 3: Confirmación */}
                    {step === 'done' && (
                        <motion.div
                            key="done"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center space-y-4"
                        >
                            <div className="w-20 h-20 bg-emerald-600/20 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle2 size={40} className="text-emerald-400" />
                            </div>
                            <div>
                                <h2 className="text-white font-black text-2xl mb-2">¡Firmado!</h2>
                                <p className="text-slate-300 text-sm">
                                    {result?.message || 'Tu propuesta ha sido aceptada y firmada correctamente.'}
                                </p>
                            </div>

                            {/* Resumen firmado */}
                            <div className="bg-white/5 rounded-2xl p-4 text-left space-y-2">
                                {signedName && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Firmado por</span>
                                        <span className="text-white font-medium">{signedName}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Oferta</span>
                                    <span className="text-white font-medium">{proposal.offer_snapshot.marketer_name}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Ahorro anual</span>
                                    <span className="text-emerald-400 font-bold">{formatCurrency(proposal.annual_savings)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Fecha</span>
                                    <span className="text-white font-medium">{new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                                </div>
                            </div>

                            <p className="text-slate-500 text-xs">
                                Tu asesor recibirá una notificación y gestionará el cambio de tarifa en breve.
                            </p>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="mt-10 text-center text-slate-600 text-xs space-y-1">
                <p>Zinergia · Comparador de Tarifas Eléctricas</p>
                <p>Propuesta generada con tecnología IA · Datos basados en tu factura real</p>
            </div>
        </div>
    );
}
