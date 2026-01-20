'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';
import { User, Mail, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { ZinergiaLogo } from '@/components/ui/ZinergiaLogo';

export default function JoinNetworkPage() {
    const params = useParams();
    const router = useRouter();
    const code = params?.code as string;
    const [invitation, setInvitation] = useState<{ email: string, role: string, id: string, creator_id: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        async function validateCode() {
            const supabase = createClient();
            const { data, error } = await supabase
                .from('network_invitations')
                .select('*')
                .eq('code', code)
                .eq('used', false)
                .single();

            if (error || !data) {
                setError('El código de invitación no es válido o ya ha sido utilizado.');
            } else {
                setInvitation(data);
            }
            setLoading(false);
        }
        if (code) validateCode();
    }, [code]);

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!invitation) return;
        setIsSubmitting(true);
        const supabase = createClient();

        try {
            // 1. Auth Sign Up
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: invitation.email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                    }
                }
            });

            if (authError) throw authError;

            // 2. Mark invitation as used
            await supabase
                .from('network_invitations')
                .update({ used: true })
                .eq('id', invitation.id);

            // 3. Update Profile (Role & Parent)
            // Note: In a real app, this should be handled by a Trigger or a secure RPC
            // because the user might not have permissions to edit their own role yet.
            // For this MVP, we assume profiles are created via trigger and we update it.
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    role: invitation.role,
                    parent_id: invitation.creator_id,
                    full_name: fullName
                })
                .eq('id', authData.user?.id);

            if (profileError) console.error('Error updating profile:', profileError);

            router.push('/dashboard');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al registrarse';
            alert(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-red-100">
                    <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Enlace no válido</h1>
                    <p className="text-slate-500 mb-6">{error}</p>
                    <button
                        onClick={() => router.push('/')}
                        className="w-full py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
                    >
                        Volver al inicio
                    </button>
                </div>
            </div>
        );
    }
    if (!invitation) return null;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-lg"
            >
                <div className="text-center mb-8">
                    <ZinergiaLogo className="h-10 mx-auto mb-6" />
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Bienvenido a la Red</h1>
                    <p className="text-slate-500">
                        Has sido invitado como <span className="text-indigo-600 font-bold uppercase">{invitation.role}</span>
                    </p>
                </div>

                <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-100 border border-indigo-50/50">
                    <form onSubmit={handleSignUp} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Tu Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                                <input
                                    type="email"
                                    disabled
                                    value={invitation.email}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-slate-400 font-medium"
                                    title="Email del invitado"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Nombre Completo</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type="text"
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                                    placeholder="Tu nombre y apellidos"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Crea tu Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                                    placeholder="Mínimo 6 caracteres"
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                disabled={isSubmitting}
                                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                            >
                                {isSubmitting ? (
                                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span>Completar Registro</span>
                                        <CheckCircle2 size={24} />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                <p className="text-center mt-8 text-xs text-slate-400 max-w-xs mx-auto">
                    Al unirte, aceptas los términos y condiciones de la Red Zinergia para {invitation.role}s.
                </p>
            </motion.div>
        </div>
    );
}
