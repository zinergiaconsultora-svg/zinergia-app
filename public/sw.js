self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
    // Interceptador pasivo mínimo necesario por Chrome/Safari para requerimiento de A2HS.
});

// Web Push: mostrar notificación cuando llega un push del servidor
self.addEventListener('push', (event) => {
    if (!event.data) return;

    let payload;
    try {
        payload = event.data.json();
    } catch {
        payload = { title: 'Zinergia', body: event.data.text() };
    }

    const { title = 'Zinergia', body = '', icon = '/icon-192.png', data = {} } = payload;

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon,
            badge: '/icon-192.png',
            vibrate: [200, 100, 200],
            data,
            actions: data.url ? [{ action: 'open', title: 'Ver resultado' }] : [],
        })
    );
});

// Al hacer clic en la notificación, abrir/enfocar la app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = event.notification.data?.url || '/dashboard';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            // Si ya hay una ventana abierta, enfocarla y navegar
            for (const client of clients) {
                if ('focus' in client) {
                    client.focus();
                    if ('navigate' in client) client.navigate(url);
                    return;
                }
            }
            // Si no hay ventana, abrir una nueva
            if (self.clients.openWindow) {
                return self.clients.openWindow(url);
            }
        })
    );
});
