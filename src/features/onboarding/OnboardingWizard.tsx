'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap, User, ArrowRight, ArrowLeft, Check,
    Sparkles, FileText, Send, Users, X,
    GraduationCap, ChevronRight,
} from 'lucide-react';
import { getAgentProfileAction, updateAgentProfileAction, AgentProfile } from '@/app/actions/profile';

const STORAGE_KEY = 'zinergia_onboarding_done_v1';

// ── Helpers ──────────────────────────────────────────────────────────────────

function StepDots({ total, current }: { total: number; current: number }) {
    return (
        <div className="flex items-center gap-1.5 justify-center mb-6">
            {Array.from({ length: total }).map((_, i) => (
                <div
                    key={i}
                    className={`rounded-full transition-all duration-300 ${i === current
                        ? 'w-6 h-2 bg-indigo-600'
                        : i < current
                            ? 'w-2 h-2 bg-indigo-300'
                            : 'w-2 h-2 bg-slate-200'
                        }`}
                />
            ))}
        </div>
    );
}

// ── Steps ────────────────────────────────────────────────────────────────────

function StepWelcome({ profile, onNext, onSkip }: {
    profile: AgentProfile;
    onNext: () => void;
    onSkip: () => void;
}) {
    const firstName = profile.full_name?.split(' ')[0] ?? profile.email?.split('@')[0] ?? 'agente';

    return (
        <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-500/30">
                <Zap size={32} className="text-white" fill="currentColor" />
            </div>

            <div>
                <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-2">Bienvenido a Zinergia</p>
                <h1 className="text-3xl font-black text-slate-900 mb-3">
                    Hola, {firstName} 👋
                </h1>
                <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">
                    En menos de 2 minutos tendrás todo configurado para tu primera venta energética.
                </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
                {[
                    { icon: <FileText size={16} />, label: 'Sube factura', color: 'bg-blue-50 text-blue-600' },
                    { icon: <Sparkles size={16} />, label: 'Simula ahorro', color: 'bg-violet-50 text-violet-600' },
                    { icon: <Send size={16} />, label: 'Envía oferta', color: 'bg-emerald-50 text-emerald-600' },
                ].map((item, i) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${item.color}`}>
                            {item.icon}
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500">{item.label}</span>
                    </div>
                ))}
            </div>

            <div className="space-y-2">
                <button
                    type="button"
                    onClick={onNext}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25"
                >
                    Empezar <ArrowRight size={16} />
                </button>
                <button type="button" onClick={onSkip} className="w-full text-xs text-slate-400 hover:text-slate-600 py-2 transition-colors">
                    Omitir configuración
                </button>
            </div>
        </div>
    );
}

function StepProfile({ profile, onNext, onBack }: {
    profile: AgentProfile;
    onNext: (data: { full_name: string; phone: string }) => void;
    onBack: () => void;
}) {
    const [fullName, setFullName] = useState(profile.full_name ?? '');
    const [phone, setPhone] = useState(profile.phone ?? '');
    const [isPending, start] = useTransition();
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim()) { setError('El nombre es obligatorio'); return; }
        start(async () => {
            try {
                await updateAgentProfileAction({ full_name: fullName.trim(), phone: phone.trim() || undefined });
                onNext({ full_name: fullName.trim(), phone: phone.trim() });
            } catch {
                setError('Error al guardar. Inténtalo de nuevo.');
            }
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-center mb-2">
                <div className="w-12 h-12 mx-auto bg-indigo-50 rounded-2xl flex items-center justify-center mb-3">
                    <User size={20} className="text-indigo-600" />
                </div>
                <h2 className="text-xl font-black text-slate-900">Tu perfil de agente</h2>
                <p className="text-sm text-slate-400 mt-1">Así te reconocerán tus clientes y tu equipo</p>
            </div>

            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                        Nombre completo <span className="text-rose-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={fullName}
                        onChange={e => { setFullName(e.target.value); setError(''); }}
                        placeholder="Tu nombre y apellidos"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 outline-none text-sm transition-all bg-slate-50 focus:bg-white"
                        autoFocus
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                        Teléfono <span className="text-slate-400 font-normal normal-case">(opcional)</span>
                    </label>
                    <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+34 600 000 000"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 outline-none text-sm transition-all bg-slate-50 focus:bg-white"
                    />
                </div>
                <div>
                    <label htmlFor="ob-email" className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Email</label>
                    <input
                        id="ob-email"
                        type="email"
                        value={profile.email ?? ''}
                        disabled
                        placeholder="tu@email.com"
                        className="w-full px-4 py-3 rounded-xl border border-slate-100 text-sm text-slate-400 bg-slate-50 cursor-not-allowed"
                    />
                </div>
            </div>

            {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}

            <div className="flex gap-2 pt-1">
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="Volver al paso anterior"
                    className="w-10 h-12 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all shrink-0"
                >
                    <ArrowLeft size={16} />
                </button>
                <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-indigo-600/20"
                >
                    {isPending ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <>Guardar y continuar <ArrowRight size={16} /></>
                    )}
                </button>
            </div>
        </form>
    );
}

function StepHowItWorks({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
    const steps = [
        {
            num: '1',
            title: 'Añade a tu cliente',
            desc: 'Crea su ficha y sube la factura energética. La IA extrae todos los datos automáticamente.',
            icon: <Users size={18} />,
            color: 'bg-blue-50 text-blue-600 border-blue-100',
        },
        {
            num: '2',
            title: 'Simula el ahorro',
            desc: 'El simulador compara tu tarifa actual con las mejores ofertas del mercado en tiempo real.',
            icon: <Sparkles size={18} />,
            color: 'bg-violet-50 text-violet-600 border-violet-100',
        },
        {
            num: '3',
            title: 'Envía la propuesta',
            desc: 'Genera un PDF profesional o compártela por WhatsApp. El cliente firma digitalmente.',
            icon: <Send size={18} />,
            color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        },
    ];

    return (
        <div className="space-y-5">
            <div className="text-center">
                <h2 className="text-xl font-black text-slate-900">Así funciona Zinergia</h2>
                <p className="text-sm text-slate-400 mt-1">3 pasos para cerrar una venta</p>
            </div>

            <div className="space-y-3">
                {steps.map((s, i) => (
                    <div key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${s.color}`}>
                            {s.icon}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-800">{s.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{s.desc}</p>
                        </div>
                        <div className="ml-auto text-xs font-black text-slate-200 text-2xl leading-none self-center">
                            {s.num}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex gap-2 pt-1">
                <button type="button" onClick={onBack} aria-label="Volver al paso anterior"
                    className="w-10 h-12 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all shrink-0">
                    <ArrowLeft size={16} />
                </button>
                <button type="button" onClick={onNext}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20">
                    Entendido <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );
}

function StepReady({ name, onDone, onNavigate }: {
    name: string;
    onDone: () => void;
    onNavigate: (href: string) => void;
}) {
    const actions = [
        { label: 'Añadir mi primer cliente', href: '/dashboard/clients', icon: <Users size={16} />, color: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20' },
        { label: 'Ir al simulador', href: '/dashboard/simulator', icon: <Sparkles size={16} />, color: 'bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-600/20' },
        { label: 'Ver la Academy', href: '/dashboard/academy', icon: <GraduationCap size={16} />, color: 'bg-slate-100 hover:bg-slate-200 text-slate-700' },
    ];

    return (
        <div className="text-center space-y-6">
            <div className="relative w-20 h-20 mx-auto">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-500/30">
                    <Check size={32} className="text-white" strokeWidth={3} />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center text-white text-xs">✨</div>
            </div>

            <div>
                <h2 className="text-2xl font-black text-slate-900">¡Todo listo, {name.split(' ')[0]}!</h2>
                <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
                    Ya eres un agente Zinergia. ¿Por dónde quieres empezar?
                </p>
            </div>

            <div className="space-y-2">
                {actions.map((a, i) => (
                    <button
                        key={i}
                        type="button"
                        onClick={() => onNavigate(a.href)}
                        className={`w-full py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm ${a.color}`}
                    >
                        {a.icon} {a.label} <ChevronRight size={14} className="ml-auto" />
                    </button>
                ))}
            </div>

            <button type="button" onClick={onDone} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                Ir al dashboard
            </button>
        </div>
    );
}

// ── Main Wizard ───────────────────────────────────────────────────────────────

const SLIDE = {
    initial: (dir: number) => ({ x: dir * 40, opacity: 0 }),
    animate: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: -dir * 40, opacity: 0 }),
};

export function OnboardingWizard() {
    const router = useRouter();
    const [profile, setProfile] = useState<AgentProfile | null>(null);
    const [show, setShow] = useState(false);
    const [step, setStep] = useState(0);
    const [dir, setDir] = useState(1);
    const [currentName, setCurrentName] = useState('');

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (localStorage.getItem(STORAGE_KEY)) return; // Already done

        getAgentProfileAction().then(p => {
            if (!p) return;
            // Only show for agents with incomplete profile
            if (p.role === 'agent' && !p.full_name) {
                setProfile(p);
                setShow(true);
            }
        }).catch(() => { });
    }, []);

    const done = () => {
        localStorage.setItem(STORAGE_KEY, '1');
        setShow(false);
    };

    const goTo = (next: number) => {
        setDir(next > step ? 1 : -1);
        setStep(next);
    };

    const handleNavigate = (href: string) => {
        done();
        router.push(href);
    };

    if (!show || !profile) return null;

    const TOTAL_STEPS = 4;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            />

            {/* Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
                {/* Skip button (visible on steps 0-2) */}
                {step < 3 && (
                    <button
                        type="button"
                        onClick={done}
                        className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-xl text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
                        title="Omitir"
                    >
                        <X size={16} />
                    </button>
                )}

                <div className="p-7">
                    <StepDots total={TOTAL_STEPS} current={step} />

                    <AnimatePresence mode="wait" custom={dir}>
                        <motion.div
                            key={step}
                            custom={dir}
                            variants={SLIDE}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            transition={{ duration: 0.22, ease: 'easeInOut' }}
                        >
                            {step === 0 && (
                                <StepWelcome
                                    profile={profile}
                                    onNext={() => goTo(1)}
                                    onSkip={done}
                                />
                            )}
                            {step === 1 && (
                                <StepProfile
                                    profile={profile}
                                    onNext={({ full_name }) => { setCurrentName(full_name); goTo(2); }}
                                    onBack={() => goTo(0)}
                                />
                            )}
                            {step === 2 && (
                                <StepHowItWorks
                                    onNext={() => goTo(3)}
                                    onBack={() => goTo(1)}
                                />
                            )}
                            {step === 3 && (
                                <StepReady
                                    name={currentName || profile.email || 'agente'}
                                    onDone={done}
                                    onNavigate={handleNavigate}
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
