'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { User, Lock, CheckCircle2, AlertCircle, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { ZinergiaLogo } from '@/components/ui/ZinergiaLogo';
import { registerWithInvitationAction, validateInvitationCode } from '@/app/actions/join';

const ROLE_LABEL: Record<string, string> = {
    agent: 'Colaborador Comercial',
    franchise: 'Franquicia',
    admin: 'Administrador',
};

const ROLE_COLOR: Record<string, string> = {
    agent: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    franchise: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    admin: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function JoinNetworkPage() {
    const params = useParams();
    const router = useRouter();
    const code = params?.code as string;

    const [invitation, setInvitation] = useState<{ email: string; role: string; id: string; creator_id: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        async function validateCode() {
            try {
                const data = await validateInvitationCode(code);
                if (!data) {
                    setError('El código de invitación no es válido o ya ha sido utilizado.');
                } else {
                    setInvitation(data);
                }
            } catch (err) {
                console.error('validateInvitationCode error:', err);
                setError('Error al validar el código. Inténtalo de nuevo.');
            } finally {
                setLoading(false);
            }
        }
        if (code) validateCode();
    }, [code]);

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!invitation) return;
        setIsSubmitting(true);

        try {
            // 1. Create user + complete invitation server-side (no confirmation email)
            await registerWithInvitationAction(invitation.id, invitation.email, fullName, password);

            // 2. Sign in client-side now that the user exists and is confirmed
            const { createClient } = await import('@/lib/supabase/client');
            const supabase = createClient();
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: invitation.email,
                password,
            });
            if (signInError) throw signInError;

            router.push('/dashboard');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al registrarse. Inténtalo de nuevo.';
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Loading ──────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-400">Verificando invitación...</p>
                </div>
            </div>
        );
    }

    // ── Error ────────────────────────────────────────────────────────────────
    if (error && !invitation) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 max-w-sm w-full text-center"
                >
                    <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                        <AlertCircle size={28} className="text-red-400" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Enlace no válido</h1>
                    <p className="text-sm text-slate-500 mb-7 leading-relaxed">{error}</p>
                    <button
                        type="button"
                        onClick={() => router.push('/')}
                        className="w-full py-3 bg-slate-900 text-white rounded-2xl text-sm font-semibold hover:bg-slate-800 transition-all"
                    >
                        Volver al inicio
                    </button>
                </motion.div>
            </div>
        );
    }

    if (!invitation) return null;

    const roleLabel = ROLE_LABEL[invitation.role] ?? invitation.role;
    const roleBadge = ROLE_COLOR[invitation.role] ?? ROLE_COLOR.agent;

    // ── Form ─────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className="w-full max-w-md"
            >
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-40 mx-auto mb-5">
                        <ZinergiaLogo />
                    </div>
                    <p className="text-sm text-slate-500">Completa tu registro para acceder a la plataforma</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">

                    {/* Role badge + email */}
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl mb-7 border border-slate-100">
                        <div className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center shrink-0">
                            <Mail size={18} className="text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-400 mb-0.5">Email de acceso</p>
                            <p className="text-sm font-semibold text-slate-800 truncate">{invitation.email}</p>
                        </div>
                        <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${roleBadge}`}>
                            {roleLabel}
                        </span>
                    </div>

                    {/* Error inline */}
                    {error && (
                        <div className="flex items-start gap-3 p-3.5 bg-red-50 rounded-2xl border border-red-100 mb-5">
                            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-600 leading-snug">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSignUp} className="space-y-4">
                        {/* Full name */}
                        <div>
                            <label htmlFor="fullname" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Nombre completo
                            </label>
                            <div className="relative">
                                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                                <input
                                    id="fullname"
                                    type="text"
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                                    placeholder="Tu nombre y apellidos"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Contraseña
                            </label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                                <input
                                    id="password"
                                    type="password"
                                    required
                                    minLength={6}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                                    placeholder="Mínimo 6 caracteres"
                                />
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isSubmitting || !fullName || !password}
                            className="w-full mt-2 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Creando cuenta...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={18} />
                                    Completar Registro
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center mt-6 text-xs text-slate-400 leading-relaxed">
                    Al unirte aceptas los términos y condiciones<br />de la Red Zinergia para {roleLabel}s.
                </p>
            </motion.div>
        </div>
    );
}
