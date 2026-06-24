/* Service worker for AMFX Trading — Web Push notifications. */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'AMFX', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'AMFX Trading';
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.data && payload.data.symbol ? `alert-${payload.data.symbol}` : undefined,
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const params = new URLSearchParams();
  if (data.broker) params.set('broker', data.broker);
  if (data.symbol) params.set('symbol', data.symbol);
  const url = `/chart${params.toString() ? `?${params.toString()}` : ''}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
