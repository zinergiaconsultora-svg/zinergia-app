'use client';

import { useEffect } from 'react';

async function subscribeToPush(registration: ServiceWorkerRegistration) {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) return;

    try {
        // Comprobar si ya hay una suscripción activa
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
            // Registrar la suscripción existente en el servidor por si acaso
            await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(existing),
            });
            return;
        }

        // Solicitar permiso de notificaciones
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // Convertir la clave pública VAPID a Uint8Array
        const keyBytes = Uint8Array.from(atob(vapidPublicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: keyBytes,
        });

        // Guardar suscripción en el servidor
        await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription),
        });
    } catch (err) {
        // Push no soportado o bloqueado — no es crítico
        console.warn('[Push] Subscription failed (non-blocking):', err);
    }
}

export function PwaRegister() {
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!('serviceWorker' in navigator)) return;
        if (!window.isSecureContext) return;

        let refreshing = false;
        const handleControllerChange = () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        };

        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        const handleLoad = () => {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    registration.update().catch(() => {});
                    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
                    registration.addEventListener('updatefound', () => {
                        const worker = registration.installing;
                        if (!worker) return;
                        worker.addEventListener('statechange', () => {
                            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                                worker.postMessage({ type: 'SKIP_WAITING' });
                            }
                        });
                    });
                    // Intentar suscribir a push después de registrar el SW
                    subscribeToPush(registration);
                })
                .catch((err) => {
                    console.error('Service Worker registration failed:', err);
                });
        };

        window.addEventListener('load', handleLoad);

        return () => {
            window.removeEventListener('load', handleLoad);
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        };
    }, []);

    return null;
}
