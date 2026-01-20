import React, { useState } from 'react';
import { X, Send, Mail, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SavingsResult } from '../../../types/crm';
import { emailService } from '@/services/emailService';

interface EmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    result: SavingsResult | null;
}

export const EmailModal: React.FC<EmailModalProps> = ({ isOpen, onClose, result }) => {
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');

    if (!isOpen || !result) return null;

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);

        try {
            // Construct a simple HTML template for now
            const htmlMessage = `
                <div style="font-family: sans-serif; color: #333;">
                    <h2>Propuesta Zinergia</h2>
                    <p>${message.replace(/\n/g, '<br>')}</p>
                    <hr />
                    <p style="color: #666; font-size: 12px;">Enviado desde Zinergia CRM</p>
                </div>
            `;

            await emailService.sendEmail(email, `Propuesta de Ahorro - ${result.offer.marketer_name}`, htmlMessage);
            setSent(true);
            setTimeout(() => {
                setSent(false);
                onClose();
                setEmail('');
                setMessage('');
            }, 2000);
        } catch (error) {
            console.error(error);
            alert('Error al enviar el email. Inténtalo de nuevo.');
        } finally {
            setSending(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <div onClick={e => e.stopPropagation()} className="relative w-full max-w-lg mx-auto bg-white rounded-[2rem] shadow-2xl p-6 md:p-8">
                    <button
                        onClick={onClose}
                        aria-label="Cerrar modal"
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-50 rounded-full"
                    >
                        <X size={24} />
                    </button>

                    {sent ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center animate-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-sm border border-emerald-100">
                                <Check size={32} className="stroke-[3]" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">¡Enviado Correctamente!</h3>
                            <p className="text-slate-500">La propuesta ha sido enviada a <span className="font-bold text-slate-800">{email}</span></p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                                    <Mail size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900">Enviar Propuesta</h3>
                            </div>

                            <form onSubmit={handleSend} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email del Cliente</label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full px-4 py-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400"
                                        placeholder="cliente@ejemplo.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mensaje Personalizado</label>
                                    <textarea
                                        rows={4}
                                        className="w-full px-4 py-3 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none font-medium text-slate-700 placeholder:text-slate-400"
                                        placeholder={`Hola,\n\nAdjunto encontrarás la propuesta de ahorro con ${result.offer.marketer_name} que hemos preparado para ti...\n\nSaludos.`}
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                    />
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={sending}
                                        className="w-full bg-slate-900 text-white rounded-xl py-4 font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {sending ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Enviando...
                                            </>
                                        ) : (
                                            <>
                                                <Send size={18} />
                                                Enviar Propuesta
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
