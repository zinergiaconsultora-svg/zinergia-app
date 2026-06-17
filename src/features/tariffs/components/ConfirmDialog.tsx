'use client'

import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
    open: boolean
    title: string
    message: string
    confirmLabel?: string
    busy?: boolean
    onConfirm: () => void
    onCancel: () => void
}

/** Diálogo de confirmación reutilizable para acciones destructivas. */
export function ConfirmDialog({
    open, title, message, confirmLabel = 'Eliminar', busy = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
    if (!open || typeof document === 'undefined') return null

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onCancel}>
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={e => e.stopPropagation()}
                className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center border border-slate-200"
            >
                <div className="mx-auto w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500 mb-4">
                    <AlertTriangle size={22} />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">{title}</h3>
                <p className="text-slate-500 text-xs mb-5">{message}</p>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={busy}
                        className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                        {busy ? '...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    )
}
