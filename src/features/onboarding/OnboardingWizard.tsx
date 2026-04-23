'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap, User, ArrowRight, ArrowLeft, Check,
    Sparkles, FileText, Send, Users, X,
    GraduationCap, ChevronRight, TrendingUp,
} from 'lucide-react';
import { getAgentProfileAction, updateAgentProfileAction, AgentProfile } from '@/app/actions/profile';

const STORAGE_KEY = 'zinergia_onboarding_done_v1';

// ── Avatar color derived from first initial ───────────────────────────────────

const AVATAR_GRADIENTS = [
    'from-violet-500 to-purple-700',
    'from-indigo-500 to-blue-700',
    'from-rose-500 to-pink-700',
    'from-emerald-500 to-teal-700',
    'from-amber-500 to-orange-700',
    'from-cyan-500 to-sky-700',
];

function getAvatarGradient(name: string): string {
    if (!name.trim()) return AVATAR_GRADIENTS[0];
    const code = name.trim().toUpperCase().charCodeAt(0);
    return AVATAR_GRADIENTS[code % AVATAR_GRADIENTS.length];
}

// ── Animated counter ──────────────────────────────────────────────────────────

function useAnimatedCounter(target: number, durationMs: number): number {
    const [count, setCount] = useState(0);

    useEffect(() => {
        const startTime = Date.now();
        const tick = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / durationMs, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(target * eased));
            if (progress >= 1) clearInterval(tick);
        }, 16);
        return () => clearInterval(tick);
    }, [target, durationMs]);

    return count;
}

// ── Floating orbs (animated dark background blobs) ────────────────────────────

function FloatingOrbs() {
    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-[299]">
            <motion.div
                animate={{ x: [0, 35, -20, 0], y: [0, -45, 25, 0] }}
                transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-700/20 rounded-full blur-3xl"
            />
            <motion.div
                animate={{ x: [0, -30, 40, 0], y: [0, 35, -20, 0] }}
                transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
                className="absolute -bottom-32 -right-32 w-[28rem] h-[28rem] bg-violet-700/20 rounded-full blur-3xl"
            />
            <motion.div
                animate={{ x: [0, 25, -15, 0], y: [0, 20, -35, 0] }}
                transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
                className="absolute top-1/3 left-1/4 w-64 h-64 bg-cyan-700/15 rounded-full blur-3xl"
            />
        </div>
    );
}

// ── Step progress dots ────────────────────────────────────────────────────────

function StepDots({ total, current }: { total: number; current: number }) {
    return (
        <div className="flex items-center gap-2 justify-center mb-8" role="progressbar" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={total} aria-label={`Paso ${current + 1} de ${total}`}>
            {Array.from({ length: total }).map((_, i) => (
                <motion.div
                    key={i}
                    animate={{
                        width: i === current ? 24 : 8,
                        backgroundColor: i === current ? '#818cf8' : i < current ? '#6366f1' : '#1e293b',
                        opacity: i <= current ? 1 : 0.5,
                    }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="h-2 rounded-full"
                />
            ))}
        </div>
    );
}

// ── Live agent card preview ───────────────────────────────────────────────────

function AgentCardPreview({ name, email, phone }: { name: string; email: string; phone: string }) {
    const initials = name.trim()
        ? name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
        : '?';
    const firstLetter = name.trim()[0]?.toUpperCase() ?? '';
    const gradient = getAvatarGradient(name);

    return (
        <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 border border-white/8 overflow-hidden">
            {/* Subtle inner glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/8 to-violet-600/5 pointer-events-none rounded-2xl" />

            <div className="relative flex items-center gap-3">
                {/* Avatar — re-animates when first letter (color) changes */}
                <motion.div
                    key={firstLetter}
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 20 }}
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-lg shadow-lg shrink-0 select-none`}
                >
                    {initials}
                </motion.div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate leading-tight">
                        {name.trim() || <span className="text-slate-600 italic">Tu nombre aquí</span>}
                    </p>
                    <p className="text-slate-400 text-xs truncate mt-0.5">{email}</p>
                    {phone && <p className="text-slate-600 text-[11px] mt-0.5">{phone}</p>}
                </div>

                {/* Badge */}
                <div className="shrink-0 bg-indigo-500/15 border border-indigo-400/25 rounded-lg px-2 py-1">
                    <span className="text-indigo-300 text-[10px] font-bold uppercase tracking-wider">Agente</span>
                </div>
            </div>

            {/* Footer strip */}
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] text-slate-500 font-medium">Zinergia Energy · Agente activo</span>
            </div>
        </div>
    );
}

// ── Step 0: Welcome ───────────────────────────────────────────────────────────

function StepWelcome({ profile, onNext, onSkip }: {
    profile: AgentProfile;
    onNext: () => void;
    onSkip: () => void;
}) {
    const firstName = profile.full_name?.split(' ')[0] ?? profile.email?.split('@')[0] ?? 'agente';

    const features = [
        { icon: <FileText size={14} />, label: 'Sube factura', sub: 'OCR automático', iconCls: 'text-blue-400', bgCls: 'bg-blue-500/10 border-blue-500/20' },
        { icon: <Sparkles size={14} />, label: 'Simula ahorro', sub: 'IA en tiempo real', iconCls: 'text-violet-400', bgCls: 'bg-violet-500/10 border-violet-500/20' },
        { icon: <Send size={14} />, label: 'Envía oferta', sub: 'PDF profesional', iconCls: 'text-emerald-400', bgCls: 'bg-emerald-500/10 border-emerald-500/20' },
    ];

    return (
        <div className="text-center">
            {/* Animated Zap logo */}
            <motion.div
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.08 }}
                className="relative w-20 h-20 mx-auto mb-6"
            >
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/40">
                    <Zap size={32} className="text-white" fill="currentColor" />
                </div>
                {/* Pulse ring */}
                <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-0 rounded-3xl bg-indigo-500/30 -z-10"
                />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-2">Bienvenido a Zinergia</p>
                <h1 id="onboarding-title" className="text-3xl font-black text-white mb-3 leading-tight">
                    Hola, {firstName} 👋
                </h1>
                <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
                    En menos de 2 minutos tendrás todo listo para tu primera venta energética.
                </p>
            </motion.div>

            {/* Feature tiles */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="grid grid-cols-3 gap-2.5 mt-6"
            >
                {features.map((f, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + i * 0.08 }}
                        className={`flex flex-col items-center gap-2 p-3 rounded-2xl border ${f.bgCls}`}
                    >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 ${f.iconCls}`}>
                            {f.icon}
                        </div>
                        <div>
                            <p className="text-white text-[11px] font-bold leading-tight">{f.label}</p>
                            <p className="text-slate-500 text-[10px] mt-0.5">{f.sub}</p>
                        </div>
                    </motion.div>
                ))}
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.62 }}
                className="space-y-2 mt-7"
            >
                <button
                    type="button"
                    onClick={onNext}
                    className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:-translate-y-0.5 active:translate-y-0"
                >
                    Empezar configuración <ArrowRight size={16} />
                </button>
                <button type="button" onClick={onSkip} className="w-full text-xs text-slate-600 hover:text-slate-400 py-2 transition-colors">
                    Omitir por ahora
                </button>
            </motion.div>
        </div>
    );
}

// ── Step 1: Profile ───────────────────────────────────────────────────────────

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
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center">
                <h2 id="onboarding-title" className="text-xl font-black text-white">Tu perfil de agente</h2>
                <p className="text-sm text-slate-400 mt-1">Así te verán tus clientes y tu equipo</p>
            </div>

            {/* Live card preview */}
            <AgentCardPreview name={fullName} email={profile.email ?? ''} phone={phone} />

            {/* Fields */}
            <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">
                    Nombre completo <span className="text-rose-400">*</span>
                </label>
                <input
                    type="text"
                    value={fullName}
                    onChange={e => { setFullName(e.target.value); setError(''); }}
                    placeholder="Tu nombre y apellidos"
                    className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/60 text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm transition-all"
                    autoFocus
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">
                        Teléfono
                    </label>
                    <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="+34 600 000 000"
                        className="w-full px-3 py-3 rounded-xl border border-slate-700 bg-slate-800/60 text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm transition-all"
                    />
                </div>
                <div>
                    <label htmlFor="ob-email" className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">
                        Email
                    </label>
                    <input
                        id="ob-email"
                        type="email"
                        value={profile.email ?? ''}
                        disabled
                        placeholder="tu@email.com"
                        className="w-full px-3 py-3 rounded-xl border border-slate-700/40 text-slate-600 bg-slate-800/30 text-sm cursor-not-allowed"
                    />
                </div>
            </div>

            {error && (
                <motion.p
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-xs text-rose-400 font-semibold"
                >
                    {error}
                </motion.p>
            )}

            <div className="flex gap-2 pt-1">
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="Volver al paso anterior"
                    className="w-10 h-12 flex items-center justify-center rounded-xl border border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600 transition-all shrink-0"
                >
                    <ArrowLeft size={16} />
                </button>
                <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-indigo-600/25 hover:-translate-y-0.5 active:translate-y-0"
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

// ── Step 2: How it works ──────────────────────────────────────────────────────

function StepHowItWorks({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
    const savings = useAnimatedCounter(2340, 2000);
    const agents = useAnimatedCounter(847, 1800);

    const steps = [
        {
            num: '01',
            title: 'Añade a tu cliente',
            desc: 'Sube la factura energética. La IA extrae todos los datos en segundos.',
            icon: <Users size={15} />,
            iconCls: 'text-blue-400',
            bgCls: 'bg-blue-500/10 border-blue-500/20',
            delay: 0.3,
        },
        {
            num: '02',
            title: 'Simula el ahorro',
            desc: 'Compara la tarifa actual con las mejores ofertas del mercado en tiempo real.',
            icon: <TrendingUp size={15} />,
            iconCls: 'text-violet-400',
            bgCls: 'bg-violet-500/10 border-violet-500/20',
            delay: 0.45,
        },
        {
            num: '03',
            title: 'Cierra la venta',
            desc: 'Genera un PDF profesional o comparte por WhatsApp. El cliente firma digitalmente.',
            icon: <Send size={15} />,
            iconCls: 'text-emerald-400',
            bgCls: 'bg-emerald-500/10 border-emerald-500/20',
            delay: 0.6,
        },
    ];

    return (
        <div className="space-y-5">
            <div className="text-center">
                <h2 id="onboarding-title" className="text-xl font-black text-white">Así funciona Zinergia</h2>
                <p className="text-sm text-slate-400 mt-1">3 pasos para cerrar una venta</p>
            </div>

            {/* Animated stats banner */}
            <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 }}
                className="bg-gradient-to-r from-indigo-600/15 to-violet-600/15 border border-indigo-500/20 rounded-2xl p-4 flex items-center justify-between"
            >
                <div>
                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Ahorro medio cliente</p>
                    <p className="text-2xl font-black text-white">
                        {savings.toLocaleString('es-ES')}
                        <span className="text-indigo-400 text-lg ml-0.5">€</span>
                        <span className="text-slate-600 text-sm font-normal">/año</span>
                    </p>
                </div>
                <div className="w-px h-10 bg-white/5" />
                <div className="text-right">
                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Agentes activos</p>
                    <p className="text-2xl font-black text-indigo-400">{agents.toLocaleString('es-ES')}</p>
                </div>
            </motion.div>

            {/* Step cards */}
            <div className="space-y-2.5">
                {steps.map((s, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: s.delay }}
                        className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/50"
                    >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${s.bgCls} ${s.iconCls}`}>
                            {s.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white leading-tight">{s.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{s.desc}</p>
                        </div>
                        <div className="text-xl font-black text-slate-700 shrink-0 leading-none tabular-nums">
                            {s.num}
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="flex gap-2 pt-1">
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="Volver al paso anterior"
                    className="w-10 h-12 flex items-center justify-center rounded-xl border border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600 transition-all shrink-0"
                >
                    <ArrowLeft size={16} />
                </button>
                <button
                    type="button"
                    onClick={onNext}
                    className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 hover:-translate-y-0.5 active:translate-y-0"
                >
                    ¡Lo tengo! <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );
}

// ── Step 3: Ready ─────────────────────────────────────────────────────────────

function StepReady({ name, onDone, onNavigate }: {
    name: string;
    onDone: () => void;
    onNavigate: (href: string) => void;
}) {
    const firstName = name.split(' ')[0];

    // Confetti burst on mount
    useEffect(() => {
        const fire = async () => {
            try {
                const confetti = (await import('canvas-confetti')).default;
                confetti({
                    particleCount: 90,
                    spread: 80,
                    origin: { y: 0.62 },
                    colors: ['#6366f1', '#8b5cf6', '#a78bfa', '#22d3ee', '#34d399'],
                });
                setTimeout(() => confetti({
                    particleCount: 55,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0, y: 0.7 },
                    colors: ['#6366f1', '#8b5cf6', '#c4b5fd'],
                }), 180);
                setTimeout(() => confetti({
                    particleCount: 55,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1, y: 0.7 },
                    colors: ['#22d3ee', '#34d399', '#6366f1'],
                }), 180);
            } catch { /* canvas-confetti unavailable */ }
        };
        fire();
    }, []);

    const actions = [
        {
            label: 'Añadir mi primer cliente',
            href: '/dashboard/clients',
            icon: <Users size={15} />,
            cls: 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-600/30',
            delay: 0.5,
        },
        {
            label: 'Ir al simulador',
            href: '/dashboard/simulator',
            icon: <Sparkles size={15} />,
            cls: 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-600/25',
            delay: 0.62,
        },
        {
            label: 'Ver la Academy',
            href: '/dashboard/academy',
            icon: <GraduationCap size={15} />,
            cls: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
            delay: 0.74,
        },
    ];

    return (
        <div className="text-center">
            {/* Checkmark with expanding rings */}
            <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                {[0, 1, 2].map(i => (
                    <motion.div
                        key={i}
                        initial={{ scale: 0.5, opacity: 0.7 }}
                        animate={{ scale: 1.6 + i * 0.5, opacity: 0 }}
                        transition={{ duration: 1.2, delay: i * 0.18, ease: 'easeOut' }}
                        className="absolute inset-0 rounded-3xl border-2 border-emerald-400/50"
                    />
                ))}
                <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.05 }}
                    className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/40"
                >
                    <Check size={36} className="text-white" strokeWidth={3} />
                </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-[0.2em] mb-2">
                    Configuración completada
                </p>
                <h2 id="onboarding-title" className="text-3xl font-black text-white leading-tight">
                    ¡Ya eres agente,<br />{firstName}!
                </h2>
                <p className="text-slate-400 text-sm mt-3 max-w-xs mx-auto leading-relaxed">
                    Tu perfil está listo. ¿Por dónde quieres empezar?
                </p>
            </motion.div>

            <div className="space-y-2.5 mt-7">
                {actions.map((a, i) => (
                    <motion.button
                        key={i}
                        initial={{ opacity: 0, x: -14 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: a.delay }}
                        type="button"
                        onClick={() => onNavigate(a.href)}
                        className={`w-full py-3 font-bold rounded-xl transition-all flex items-center gap-3 px-4 text-sm hover:-translate-y-0.5 active:translate-y-0 ${a.cls}`}
                    >
                        <span className="shrink-0">{a.icon}</span>
                        <span>{a.label}</span>
                        <ChevronRight size={13} className="ml-auto shrink-0 opacity-60" />
                    </motion.button>
                ))}
            </div>

            <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.95 }}
                type="button"
                onClick={onDone}
                className="text-xs text-slate-700 hover:text-slate-400 transition-colors mt-4 py-2"
            >
                Ir al dashboard
            </motion.button>
        </div>
    );
}

// ── Slide variants ────────────────────────────────────────────────────────────

const SLIDE = {
    initial: (dir: number) => ({ x: dir * 48, opacity: 0 }),
    animate: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: -dir * 48, opacity: 0 }),
};

// ── Main wizard ───────────────────────────────────────────────────────────────

export function OnboardingWizard() {
    const router = useRouter();
    const [profile, setProfile] = useState<AgentProfile | null>(null);
    const [show, setShow] = useState(false);
    const [step, setStep] = useState(0);
    const [dir, setDir] = useState(1);
    const [currentName, setCurrentName] = useState('');

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (localStorage.getItem(STORAGE_KEY)) return;

        getAgentProfileAction().then(p => {
            if (!p) return;
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
        <>
            {/* Floating blobs behind everything */}
            <FloatingOrbs />

            <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-slate-950/88 backdrop-blur-md"
                    aria-hidden="true"
                />

                {/* Card — bottom sheet on mobile, centered modal on sm+ */}
                <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="onboarding-title"
                    initial={{ opacity: 0, y: 32, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
                    className="relative z-10 w-full sm:max-w-md bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border-t border-x sm:border border-white/8"
                >
                    {/* Gradient accent bar at top */}
                    <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

                    {/* Drag handle (mobile only) */}
                    <div className="sm:hidden flex justify-center pt-3 pb-0">
                        <div className="w-10 h-1 rounded-full bg-slate-700" />
                    </div>

                    {/* Skip button */}
                    {step < 3 && (
                        <button
                            type="button"
                            onClick={done}
                            aria-label="Cerrar asistente de bienvenida"
                            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                        >
                            <X size={15} />
                        </button>
                    )}

                    {/* Scrollable inner area (important on small phones) */}
                    <div className="px-6 pb-6 pt-5 sm:p-7 overflow-y-auto max-h-[90dvh]">
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
                                    <StepWelcome profile={profile} onNext={() => goTo(1)} onSkip={done} />
                                )}
                                {step === 1 && (
                                    <StepProfile
                                        profile={profile}
                                        onNext={({ full_name }) => { setCurrentName(full_name); goTo(2); }}
                                        onBack={() => goTo(0)}
                                    />
                                )}
                                {step === 2 && (
                                    <StepHowItWorks onNext={() => goTo(3)} onBack={() => goTo(1)} />
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
        </>
    );
}
