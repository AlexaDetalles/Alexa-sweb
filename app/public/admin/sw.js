// Service worker mínimo: hace que el panel se pueda instalar como app. No guarda nada en caché
// (el panel muestra datos privados y siempre debe pedirlos frescos a la red).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
