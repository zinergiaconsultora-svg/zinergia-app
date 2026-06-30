'use client';

import { useEffect, useState } from 'react';
import {
    acceptPublicProposalAction,
    trackPublicProposalViewAction,
    type PublicProposal,
} from '@/app/actions/publicProposal';
import confetti from 'canvas-confetti';
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
    const [sliderVal, setSliderVal] = useState(50);

    const expiresAt = proposal.public_expires_at
        ? new Date(proposal.public_expires_at as string).toLocaleDateString('es-ES', {
            day: '2-digit', month: 'long', year: 'numeric',
        })
        : null;

    const monthlySavings = Math.round(proposal.annual_savings / 12);
    const savingsPercent = Math.round(proposal.savings_percent);

    useEffect(() => {
        trackPublicProposalViewAction(token).catch(() => {
            // El tracking es auxiliar: la propuesta debe seguir visible aunque falle.
        });
    }, [token]);

    useEffect(() => {
        if (step === 'done') {
            const duration = 4 * 1000;
            const end = Date.now() + duration;

            (function frame() {
                confetti({
                    particleCount: 4,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0, y: 0.8 },
                    colors: ['#6366f1', '#10b981', '#3b82f6', '#f59e0b']
                });
                confetti({
                    particleCount: 4,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1, y: 0.8 },
                    colors: ['#6366f1', '#10b981', '#3b82f6', '#f59e0b']
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            }());
        }
    }, [step]);

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
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center px-4 py-12" aria-labelledby="proposal-heading">

            {/* Logo */}
            <header className="mb-8 flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                    <Zap className="text-indigo-400" size={22} aria-hidden="true" />
                    <span className="text-white font-bold text-xl tracking-tight">Zinergia</span>
                </div>
                <h1 id="proposal-heading" className="text-slate-400 text-xs">Propuesta de Ahorro Energético</h1>
            </header>

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
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 text-center">
                                {proposal.client_name && (
                                    <p className="text-slate-400 text-sm mb-2">
                                        Estudio para <span className="text-white font-semibold">{proposal.client_name}</span>
                                    </p>
                                )}
                                <div className="text-5xl sm:text-6xl font-black text-white mb-1 break-words tabular-nums">
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

                            {/* Slider Comparativo Interactivo Antes/Después */}
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden">
                                <p className="text-slate-400 text-xs mb-4 uppercase tracking-wider text-center font-bold">Desliza para ver la diferencia de coste</p>
                                
                                <div className="relative h-28 rounded-2xl bg-slate-950 overflow-hidden flex items-center">
                                    {/* Antes (Coste actual) */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-red-950/40 via-red-900/10 to-transparent flex flex-col justify-center px-6">
                                        <p className="text-xs text-red-400 font-bold uppercase tracking-wider">Pagas ahora</p>
                                        <p className="text-3xl font-black text-slate-400 line-through decoration-red-500/80 decoration-2">{formatCurrency(proposal.current_annual_cost)}</p>
                                        <p className="text-[10px] text-slate-500 font-mono">Coste anterior estimado / año</p>
                                    </div>
                                    
                                    {/* Después (Con Zinergia) con clip-path dinámico revelador */}
                                    <div 
                                        className="absolute inset-0 bg-gradient-to-r from-emerald-950/50 via-indigo-900/30 to-indigo-950/60 border-l border-emerald-400/50 flex flex-col justify-center px-6 transition-all duration-75"
                                        style={{ 
                                            clipPath: `inset(0 0 0 ${sliderVal}%)`,
                                            left: 0
                                        }}
                                    >
                                        <div className="ml-auto text-right">
                                            <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Con Zinergia</p>
                                            <p className="text-3xl font-black text-white">{formatCurrency(proposal.offer_annual_cost)}</p>
                                            <p className="text-[10px] text-emerald-300/80 font-bold">¡Ahorras {formatCurrency(proposal.annual_savings)}/año! ({savingsPercent}%)</p>
                                        </div>
                                    </div>

                                    {/* Línea divisoria del slider */}
                                    <div 
                                        className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-400 via-emerald-300 to-indigo-500 pointer-events-none"
                                        style={{ left: `${100 - sliderVal}%` }}
                                    >
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white text-indigo-950 shadow-lg border border-emerald-400 flex items-center justify-center text-[10px] font-bold">
                                            ↔
                                        </div>
                                    </div>
                                </div>

                                {/* Control Deslizante de entrada */}
                                <div className="mt-4 flex items-center gap-3">
                                    <span className="text-[10px] text-red-400 font-bold uppercase shrink-0">Antes</span>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="100" 
                                        value={100 - sliderVal} 
                                        onChange={(e) => setSliderVal(100 - Number(e.target.value))}
                                        className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                        aria-label="Deslizador de comparación de antes y después"
                                    />
                                    <span className="text-[10px] text-emerald-400 font-bold uppercase shrink-0">Zinergia</span>
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
                                <label className="block" htmlFor="signer-name">
                                    <span className="text-slate-400 text-xs uppercase tracking-wider flex items-center gap-1 mb-2">
                                        <User size={11} aria-hidden="true" />
                                        Nombre completo del firmante
                                    </span>
                                    <input
                                        id="signer-name"
                                        type="text"
                                        value={signedName}
                                        onChange={(e) => setSignedName(e.target.value)}
                                        placeholder="Ej: María García López"
                                        autoComplete="name"
                                        required
                                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/30 transition-all"
                                    />
                                </label>

                                {/* Canvas firma */}
                                <div className="relative bg-slate-950/60 border border-white/10 rounded-2xl p-2.5 shadow-2xl backdrop-blur-xl group hover:border-indigo-500/30 transition-all duration-300">
                                    <div className="absolute top-2 right-3 flex items-center gap-1.5 z-10">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Panel Activo</span>
                                    </div>
                                    <SignaturePad
                                        onSignature={setSignatureData}
                                        label="Traza tu firma digital en el recuadro"
                                    />
                                </div>
                            </div>

                            {/* Texto legal */}
                            <p className="text-slate-500 text-xs text-center px-4">
                                Esta firma electrónica tiene validez legal conforme al Reglamento eIDAS (UE) 910/2014 y la Ley 59/2003 de Firma Electrónica.
                            </p>

                            {/* Error */}
                            {result && !result.success && (
                                <div role="alert" className="bg-red-900/30 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
                                    <AlertCircle size={16} className="text-red-400 shrink-0" aria-hidden="true" />
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
            <footer className="mt-10 text-center text-slate-600 text-xs space-y-1">
                <p>Zinergia · Comparador de Tarifas Eléctricas</p>
                <p>Propuesta generada con tecnología IA · Datos basados en tu factura real</p>
            </footer>
        </main>
    );
}
