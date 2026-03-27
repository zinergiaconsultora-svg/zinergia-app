self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
    // Interceptador pasivo mínimo necesario por Chrome/Safari para requerimiento de A2HS.
});
