import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Shield, Check, Copy, UserPlus, Target } from 'lucide-react';
import { crmService } from '@/services/crmService';

interface InviteModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose }) => {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'agent' | 'franchise'>('agent');
    const [isGenerating, setIsGenerating] = useState(false);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsGenerating(true);
        try {
            const invitation = await crmService.createInvitation(email, role);
            const link = `${window.location.origin}/join/${invitation.code}`;
            setInviteLink(link);
        } catch (err) {
            console.error(err);
            alert('Error al generar la invitación');
        } finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = () => {
        if (inviteLink) {
            navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
                    >
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900 text-center">Invitar a la Red &quot;Nexus&quot;</h2>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors" title="Cerrar">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8">
                            {!inviteLink ? (
                                <form onSubmit={handleInvite} className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Email del invitado</label>
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                            <input
                                                type="email"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                                                placeholder="ejemplo@correo.com"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Rol en la jerarquía</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setRole('agent')}
                                                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${role === 'agent' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-slate-100 hover:border-slate-200 text-slate-500'}`}
                                            >
                                                <Target size={24} />
                                                <span className="font-bold text-sm">Colaborador</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRole('franchise')}
                                                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${role === 'franchise' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-slate-100 hover:border-slate-200 text-slate-500'}`}
                                            >
                                                <Shield size={24} />
                                                <span className="font-bold text-sm">Franquicia</span>
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        disabled={isGenerating}
                                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                    >
                                        {isGenerating ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <UserPlus size={20} />
                                                Generar Enlace Mágico
                                            </>
                                        )}
                                    </button>
                                </form>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="text-center"
                                >
                                    <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-emerald-100">
                                        <Check size={40} className="stroke-[3]" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-900 mb-2">¡Enlace Mágico Listo!</h3>
                                    <p className="text-slate-500 mb-8 font-medium">Envía este enlace a <span className="text-slate-900 font-bold">{email}</span></p>

                                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200 mb-8 shadow-inner">
                                        <div className="flex-1 truncate pl-3 text-sm text-slate-600 font-medium font-mono">
                                            {inviteLink}
                                        </div>
                                        <button
                                            onClick={copyToClipboard}
                                            className={`p-3 rounded-xl shadow-lg transition-all flex items-center gap-2 font-bold text-xs ${copied ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700'}`}
                                        >
                                            {copied ? <Check size={18} /> : <Copy size={18} />}
                                            {copied ? '¡Copiado!' : 'Copiar'}
                                        </button>
                                    </div>

                                    <button
                                        onClick={onClose}
                                        className="w-full py-4 font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest text-xs"
                                    >
                                        Cerrar panel
                                    </button>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
