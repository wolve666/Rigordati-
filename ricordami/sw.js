// Service worker di RicordaMi (modulo): app offline, avvisi in background, azioni sulle notifiche.
import { MARCHIO } from './js/marchio.js';
import { archivio } from './js/archivio.js';
import { controlla, bollino } from './js/pianificatore.js';

const CACHE = 'ricordami-' + MARCHIO.versione;
const GUSCIO = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/novita.js', './js/aggiornamenti.js', './js/famiglia.js', './js/archivio.js', './js/pianificatore.js', './js/profili.js', './js/marchio.js', './js/ics.js', './js/nativo.js',
  './js/nucleo/capisci.js', './js/nucleo/date.js', './js/nucleo/ricorrenze.js',
  './icone/icona-64.png', './icone/icona-192.png', './icone/icona-512.png', './icone/bollino-96.png'
];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(GUSCIO))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n.startsWith('ricordami-') && n !== CACHE).map(n => caches.delete(n)))));
  self.clients.claim();
});
// Prima la cache (apertura istantanea), poi aggiorno in sottofondo.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const inCache = await c.match(e.request, { ignoreSearch: url.pathname.endsWith('/') || url.pathname.endsWith('index.html') });
    const rete = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => inCache);
    return inCache || rete;
  }));
});

async function notifica(n) {
  const cfg = await archivio.impostazioni();
  await self.registration.showNotification(n.titolo, {
    body: n.corpo, tag: n.id ? 'p-' + n.id : n.chiave, renotify: true, icon: 'icone/icona-192.png', badge: 'icone/bollino-96.png',
    data: { id: n.id, occ: n.occ }, requireInteraction: n.priorita === 2 || n.tipo === 'insisti',
    vibrate: cfg.vibrazione ? [120, 60, 120] : undefined,
    actions: n.id ? [{ action: 'fatto', title: '✓ Fatto' }, { action: 'rinvia', title: '⏰ Tra 10 min' }] : []
  });
}
async function giro() {
  const finestre = await clients.matchAll({ type: 'window' });
  if (finestre.some(c => c.visibilityState === 'visible')) return; // ci pensa la pagina
  const r = await controlla(archivio, notifica);
  await aggiornaBollino(r.bollino);
}
async function aggiornaBollino(n) {
  if (!self.navigator.setAppBadge) return;
  const cfg = await archivio.impostazioni();
  if (n === undefined) n = bollino(await archivio.promemoria(), cfg, Date.now());
  (cfg.bollino && n ? self.navigator.setAppBadge(n) : self.navigator.clearAppBadge()).catch(() => {});
}

// Sincronizzazione periodica (app installata, Chrome): controllo gli avvisi anche ad app chiusa.
self.addEventListener('periodicsync', e => { if (e.tag === 'controlla') e.waitUntil(giro()); });
// Notifiche dal server (versione con account): il server manda solo "svegliati", i dati restano qui.
self.addEventListener('push', e => e.waitUntil(giro()));

self.addEventListener('notificationclick', e => {
  const { id, occ } = e.notification.data || {};
  e.notification.close();
  e.waitUntil((async () => {
    if (e.action === 'fatto' && id) { await archivio.segnaFatto(id, occ); return aggiornaBollino(); }
    if (e.action === 'rinvia' && id) { await archivio.rinvia(id, occ, Date.now() + 10 * 60e3); return; }
    const url = new URL(id ? `./?apri=${encodeURIComponent(id)}&occ=${occ || ''}` : './', self.registration.scope).href;
    const l = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of l) if ('focus' in c) { await c.focus(); return c.navigate(url); }
    return clients.openWindow(url);
  })());
});
