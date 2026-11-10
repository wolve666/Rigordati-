const CACHE = 'rigordati-v0.2.2';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-192.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Rete prima, cache se offline. Solo file della nostra app.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-store' }).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

// Notifiche in arrivo dal postino
self.addEventListener('push', e => {
  let d = {};
  try { const j = e.data.json(); d = j.data || j; } catch (_) {}
  e.waitUntil((async () => {
    await self.registration.showNotification(d.titolo || 'Rigordati!!', {
      body: d.corpo || '', tag: d.tag, icon: 'icon-192.png', badge: 'icon-192.png', vibrate: [80, 40, 80], renotify: true
    });
    const tutte = await self.registration.getNotifications();
    if (self.navigator.setAppBadge) self.navigator.setAppBadge(tutte.length).catch(() => {});
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
    for (const c of l) if ('focus' in c) return c.focus();
    return clients.openWindow('./');
  }));
});
