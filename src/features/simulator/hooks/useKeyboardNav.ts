'use client';

import { useEffect, useState, useCallback } from 'react';

interface KeyboardNavOptions {
    onConfirm: () => void;
    onCompare: () => void;
    onTogglePdf: () => void;
    canConfirm: boolean;
    canCompare: boolean;
}

export function useKeyboardNav({
    onConfirm, onCompare, onTogglePdf, canConfirm, canCompare,
}: KeyboardNavOptions) {
    const [showHelp, setShowHelp] = useState(false);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

        if (e.key === '?' && !isInput) {
            e.preventDefault();
            setShowHelp(v => !v);
            return;
        }

        if (e.key === 'Escape') {
            setShowHelp(false);
            return;
        }

        if (isInput) return;

        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            if (canConfirm) onConfirm();
            return;
        }

        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Enter') {
            e.preventDefault();
            if (canCompare) onCompare();
            return;
        }

        if (e.key === 'j' || e.key === 'k') {
            e.preventDefault();
            const warnings = document.querySelectorAll('[data-field-status="warning"], [data-field-status="error"]');
            if (warnings.length === 0) return;
            const current = document.activeElement;
            const arr = Array.from(warnings);
            let idx = arr.indexOf(current as Element);
            if (e.key === 'j') idx = (idx + 1) % arr.length;
            else idx = idx <= 0 ? arr.length - 1 : idx - 1;
            (arr[idx] as HTMLElement).focus();
            arr[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        if (e.key === 'p') {
            e.preventDefault();
            onTogglePdf();
            return;
        }
    }, [onConfirm, onCompare, onTogglePdf, canConfirm, canCompare]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return { showHelp, setShowHelp };
}

export const SHORTCUTS = [
    { keys: ['Ctrl', 'Enter'], desc: 'Confirmar datos' },
    { keys: ['Ctrl', 'Shift', 'Enter'], desc: 'Ejecutar comparativa' },
    { keys: ['J'], desc: 'Siguiente campo con aviso' },
    { keys: ['K'], desc: 'Anterior campo con aviso' },
    { keys: ['P'], desc: 'Mostrar/ocultar PDF' },
    { keys: ['?'], desc: 'Mostrar/ocultar atajos' },
    { keys: ['Esc'], desc: 'Cerrar ayuda' },
];
