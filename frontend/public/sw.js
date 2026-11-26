self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { title: 'SchemeSetu', body: event.data?.text() || 'You have a scholarship update.' }; }
  event.waitUntil(self.registration.showNotification(payload.title || 'SchemeSetu', { body: payload.body || '', data: { url: payload.url || '/' } }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => { for (const client of windows) if (client.url === target && 'focus' in client) return client.focus(); return clients.openWindow(target); }));
});

