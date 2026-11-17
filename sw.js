// Service worker di Rigordati!!: cache offline, notifiche push, clic sulle notifiche.
importScripts('js/versione.js'); // definisce self.VERSIONE: cambiando versione cambia la cache
const CACHE = 'rigordati-' + self.VERSIONE;
const SHELL = [
  './', './index.html', './manifest.json', './privacy.html', './css/app.css',
  './js/versione.js', './js/config.js', './js/app.js', './js/capisci.js', './js/date.js', './js/ricorrenze.js',
  './icon-192.png', './icon-512.png', './icon-maskable-192.png', './icon-maskable-512.png', './badge-96.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k.startsWith('rigordati-') && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Rete prima (sempre fresca), cache se offline. Solo file della nostra app.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-store' }).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});

// Notifiche in arrivo dal postino
self.addEventListener('push', e => {
  let d = {};
  try { const j = e.data.json(); d = j.data || j.notification || j; } catch (_) {}
  if (!d.tag) d.tag = 'rigordati-' + Date.now();
  e.waitUntil((async () => {
    await self.registration.showNotification(d.titolo || 'Rigordati!!', {
      body: d.corpo || '', tag: d.tag, icon: 'icon-192.png', badge: 'badge-96.png', renotify: true,
      data: { url: d.url || './' }
    });
    const tutte = await self.registration.getNotifications();
    if (self.navigator.setAppBadge) self.navigator.setAppBadge(tutte.length).catch(() => {});
  })());
});

// Tocco sulla notifica: apre l'app sulla voce giusta.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
    for (const c of l) if ('focus' in c) { c.postMessage({ url }); return c.focus(); }
    return clients.openWindow(url);
  }));
});
