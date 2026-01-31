'use client';

import { useEffect, useState } from 'react';

export function useFocusTrap(enabled: boolean) {
    useEffect(() => {
        if (!enabled) return;

        const handleTab = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            const focusableElements = document.querySelectorAll(
                'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );

            const firstElement = focusableElements[0] as HTMLElement;
            const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    lastElement?.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastElement) {
                    firstElement?.focus();
                    e.preventDefault();
                }
            }
        };

        document.addEventListener('keydown', handleTab);
        return () => document.removeEventListener('keydown', handleTab);
    }, [enabled]);
}

export function useReducedMotion() {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        }
        return false;
    });

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

        const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    return prefersReducedMotion;
}

export function announceToScreenReader(message: string) {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
}

export function getAriaLabel_fromChildren(children: React.ReactNode): string {
    if (typeof children === 'string') {
        return children;
    }
    return '';
}

export const visuallyHidden = {
    position: 'absolute' as const,
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap' as const,
    borderWidth: 0,
};
