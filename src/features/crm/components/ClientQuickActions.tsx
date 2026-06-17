'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
    MoreVertical, Edit3, PhoneCall, ArrowRightLeft, Zap, Trash2,
    X, AlertTriangle, Mail, MessageCircle, Users, Check,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { Client, ClientStatus } from '@/types/crm';
import { updateClientStatus } from '@/app/actions/crm';
import { deleteClientAction, logClientContactAction, type LogContactInput } from '@/app/actions/clients';

const CreateClientModal = dynamic(() => import('./CreateClientModal'), { ssr: false, loading: () => null });

interface ClientQuickActionsProps {
    client: Client;
    onChanged: () => void;
    /** 'card' = light icon button; 'pipeline' = compact muted button. */
    variant?: 'card' | 'pipeline';
}

const STATUS_OPTIONS: { value: ClientStatus; label: string; dot: string }[] = [
    { value: 'new', label: 'Nuevo', dot: 'bg-blue-500' },
    { value: 'contacted', label: 'Contactado', dot: 'bg-amber-500' },
    { value: 'in_process', label: 'En proceso', dot: 'bg-violet-500' },
    { value: 'won', label: 'Ganado', dot: 'bg-emerald-500' },
    { value: 'lost', label: 'Perdido', dot: 'bg-red-500' },
];

const CONTACT_CHANNELS: { value: LogContactInput['channel']; label: string; icon: React.ElementType }[] = [
    { value: 'call', label: 'Llamada', icon: PhoneCall },
    { value: 'email', label: 'Email', icon: Mail },
    { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { value: 'meeting', label: 'Reunión', icon: Users },
];

type Overlay = null | 'edit' | 'contact' | 'delete';

export default function ClientQuickActions({ client, onChanged, variant = 'card' }: ClientQuickActionsProps) {
    const router = useRouter();
    const btnRef = useRef<HTMLButtonElement>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
    const [showStatus, setShowStatus] = useState(false);
    const [overlay, setOverlay] = useState<Overlay>(null);
    const [busy, setBusy] = useState(false);

    // Contact form state
    const [channel, setChannel] = useState<LogContactInput['channel']>('call');
    const [note, setNote] = useState('');

    const openMenu = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const rect = btnRef.current?.getBoundingClientRect();
        if (rect) setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
        setShowStatus(false);
        setMenuOpen(true);
    }, []);

    const closeMenu = useCallback(() => {
        setMenuOpen(false);
        setShowStatus(false);
    }, []);

    // Close on outside click / escape / scroll
    useEffect(() => {
        if (!menuOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeMenu(); };
        const onScroll = () => closeMenu();
        window.addEventListener('keydown', onKey);
        window.addEventListener('scroll', onScroll, true);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', onScroll, true);
        };
    }, [menuOpen, closeMenu]);

    const handleStatusChange = async (status: ClientStatus) => {
        if (status === client.status) { closeMenu(); return; }
        closeMenu();
        setBusy(true);
        try {
            await updateClientStatus(client.id, status);
            toast.success(`Estado: ${STATUS_OPTIONS.find(s => s.value === status)?.label}`);
            onChanged();
        } catch {
            toast.error('No se pudo cambiar el estado');
        } finally {
            setBusy(false);
        }
    };

    const handleSimulate = () => {
        closeMenu();
        sessionStorage.setItem('pendingClientPreload', JSON.stringify({
            client_id: client.id,
            client_name: client.name,
            cups: client.cups ?? '',
        }));
        router.push('/dashboard/simulator');
    };

    const handleLogContact = async () => {
        setBusy(true);
        try {
            await logClientContactAction(client.id, { channel, note: note.trim() || undefined });
            toast.success('Contacto registrado');
            setOverlay(null);
            setNote('');
            setChannel('call');
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'No se pudo registrar el contacto');
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async () => {
        setBusy(true);
        try {
            await deleteClientAction(client.id);
            toast.success('Cliente eliminado');
            setOverlay(null);
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'No se pudo eliminar');
        } finally {
            setBusy(false);
        }
    };

    const triggerClass = variant === 'pipeline'
        ? 'w-6 h-6 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
        : 'w-8 h-8 rounded-lg bg-white/80 dark:bg-slate-800/80 text-slate-500 hover:text-slate-800 dark:hover:text-white border border-slate-200/70 dark:border-slate-700 shadow-sm hover:shadow';

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onClick={openMenu}
                disabled={busy}
                aria-label="Acciones del cliente"
                title="Acciones"
                className={`flex items-center justify-center transition-all disabled:opacity-50 ${triggerClass}`}
            >
                <MoreVertical size={variant === 'pipeline' ? 14 : 16} />
            </button>

            {/* Dropdown menu (portal) */}
            {menuOpen && menuPos && createPortal(
                <>
                    <div className="fixed inset-0 z-[90]" onClick={(e) => { e.stopPropagation(); closeMenu(); }} />
                    <div
                        role="menu"
                        onClick={(e) => e.stopPropagation()}
                        style={{ top: menuPos.top, right: menuPos.right }}
                        className="fixed z-[91] w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 text-sm animate-in fade-in zoom-in-95 duration-100"
                    >
                        <MenuItem icon={Edit3} label="Editar" onClick={() => { closeMenu(); setOverlay('edit'); }} />
                        <MenuItem icon={PhoneCall} label="Registrar contacto" onClick={() => { closeMenu(); setOverlay('contact'); }} />
                        <MenuItem icon={ArrowRightLeft} label="Cambiar estado" onClick={() => setShowStatus(v => !v)} chevron={showStatus} />
                        {showStatus && (
                            <div className="px-1.5 py-1 mx-1 mb-1 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                {STATUS_OPTIONS.map(s => (
                                    <button
                                        key={s.value}
                                        type="button"
                                        onClick={() => handleStatusChange(s.value)}
                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                                        {s.label}
                                        {s.value === client.status && <Check size={12} className="ml-auto text-slate-400" />}
                                    </button>
                                ))}
                            </div>
                        )}
                        <MenuItem icon={Zap} label="Simular ahora" onClick={handleSimulate} />
                        <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                        <MenuItem icon={Trash2} label="Eliminar" danger onClick={() => { closeMenu(); setOverlay('delete'); }} />
                    </div>
                </>,
                document.body,
            )}

            {/* Edit modal (already self-contained / fixed) */}
            <CreateClientModal
                isOpen={overlay === 'edit'}
                onClose={() => setOverlay(null)}
                onSuccess={() => { setOverlay(null); onChanged(); }}
                clientToEdit={client}
            />

            {/* Register contact modal */}
            {overlay === 'contact' && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setOverlay(null)}>
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
                    <div
                        role="dialog"
                        aria-modal="true"
                        onClick={(e) => e.stopPropagation()}
                        className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 max-w-sm w-full"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">Registrar contacto</h3>
                            <button onClick={() => setOverlay(null)} aria-label="Cerrar" className="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center">
                                <X size={16} />
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mb-3 truncate">{client.name}</p>

                        <div className="grid grid-cols-4 gap-2 mb-4">
                            {CONTACT_CHANNELS.map(c => {
                                const Icon = c.icon;
                                const active = channel === c.value;
                                return (
                                    <button
                                        key={c.value}
                                        type="button"
                                        onClick={() => setChannel(c.value)}
                                        className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[10px] font-semibold transition-all ${
                                            active
                                                ? 'border-energy-500 bg-energy-50 text-energy-700 dark:bg-energy-500/10 dark:text-energy-400'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                                        }`}
                                    >
                                        <Icon size={16} />
                                        {c.label}
                                    </button>
                                );
                            })}
                        </div>

                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Nota (opcional): qué se habló, próximos pasos…"
                            rows={3}
                            maxLength={500}
                            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900 focus:border-energy-500 outline-none transition-all text-sm text-slate-800 dark:text-slate-100 resize-none"
                        />

                        <div className="flex gap-2 mt-4">
                            <button onClick={() => setOverlay(null)} className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-sm transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleLogContact} disabled={busy} className="flex-[2] py-2.5 bg-energy-600 hover:bg-energy-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                {busy ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <><PhoneCall size={14} /> Registrar</>}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}

            {/* Delete confirmation */}
            {overlay === 'delete' && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setOverlay(null)}>
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Confirmar eliminación"
                        onClick={(e) => e.stopPropagation()}
                        className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center"
                    >
                        <div className="mx-auto w-12 h-12 bg-red-50 dark:bg-red-500/10 rounded-xl flex items-center justify-center text-red-500 mb-4">
                            <AlertTriangle size={22} />
                        </div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Eliminar cliente</h3>
                        <p className="text-slate-500 text-xs mb-5">
                            <span className="font-semibold">{client.name}</span> — acción irreversible. Se eliminarán también sus facturas y propuestas.
                        </p>
                        <div className="flex gap-2">
                            <button onClick={() => setOverlay(null)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg text-sm transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleDelete} disabled={busy} className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50">
                                {busy ? 'Borrando...' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}

function MenuItem({ icon: Icon, label, onClick, danger, chevron }: {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    danger?: boolean;
    chevron?: boolean;
}) {
    return (
        <button
            type="button"
            role="menuitem"
            onClick={onClick}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2 transition-colors ${
                danger
                    ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
        >
            <Icon size={15} className="shrink-0" />
            <span className="flex-1 text-left font-medium">{label}</span>
            {chevron !== undefined && (
                <span className={`text-slate-400 text-xs transition-transform ${chevron ? 'rotate-90' : ''}`}>›</span>
            )}
        </button>
    );
}
