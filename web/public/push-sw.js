// Notificaciones de Mis Gastos (lo importa el service worker que genera vite-plugin-pwa).
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.title || 'Mis Gastos', {
    body: d.body || '',
    icon: 'pwa-192.png',
    badge: 'pwa-192.png',
    tag: d.tag,
    data: { url: d.url || './' },
  }));
});

// Al tocarla: abre la app en ese gasto (#gasto=<id>) para clasificarlo.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const abierta = ventanas.find((w) => w.url.startsWith(self.registration.scope));
    if (abierta) {
      abierta.postMessage({ tipo: 'abrir', url });
      return abierta.focus();
    }
    return self.clients.openWindow(url);
  })());
});
