// Archivio locale: IndexedDB (con ripiego in memoria + localStorage dove IndexedDB non c'è).
// Funziona sia nella pagina sia nel service worker; avvisa le altre schede con un BroadcastChannel.
import { PREDEFINITE, LISTE_INIZIALI } from './profili.js';

const NOME_DB = 'ricordiamoci', VERSIONE_DB = 1;
const canale = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ricordiamoci') : null;
const ascoltatori = new Set();
const avvisa = cosa => { ascoltatori.forEach(f => f(cosa)); canale?.postMessage(cosa); };
canale && (canale.onmessage = e => ascoltatori.forEach(f => f(e.data)));

let dbp = null;
function apri() {
  if (dbp) return dbp;
  dbp = new Promise((ok, ko) => {
    if (typeof indexedDB === 'undefined') return ko(new Error('niente IndexedDB'));
    const r = indexedDB.open(NOME_DB, VERSIONE_DB);
    r.onupgradeneeded = () => {
      const db = r.result;
      db.createObjectStore('promemoria', { keyPath: 'id' });
      db.createObjectStore('liste', { keyPath: 'id' });
      db.createObjectStore('meta');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  }).catch(() => null); // null = uso il ripiego
  return dbp;
}

// Ripiego: tutto in un oggetto, salvato in localStorage se disponibile.
const ripiego = (() => {
  let s = { promemoria: {}, liste: {}, meta: {} };
  try { s = JSON.parse(localStorage.getItem('ricordiamoci') || 'null') || s; } catch {}
  const salva = () => { try { localStorage.setItem('ricordiamoci', JSON.stringify(s)); } catch {} };
  return {
    tutti: st => Object.values(s[st]),
    leggi: (st, k) => s[st][k],
    scrivi: (st, v, k) => { s[st][k ?? v.id] = v; salva(); },
    togli: (st, k) => { delete s[st][k]; salva(); },
    svuota: () => { s = { promemoria: {}, liste: {}, meta: {} }; salva(); }
  };
})();

async function op(st, modo, fn) {
  const db = await apri();
  if (!db) return fn(null);
  return new Promise((ok, ko) => {
    const tx = db.transaction(st, modo);
    const r = fn(tx.objectStore(st));
    tx.oncomplete = () => ok(r?.result);
    tx.onerror = () => ko(tx.error);
  });
}
const tutti = st => op(st, 'readonly', o => o ? o.getAll() : { result: ripiego.tutti(st) });
const leggi = (st, k) => op(st, 'readonly', o => o ? o.get(k) : { result: ripiego.leggi(st, k) });
const scrivi = (st, v, k) => op(st, 'readwrite', o => o ? o.put(v, k) : ripiego.scrivi(st, v, k));
const togli = (st, k) => op(st, 'readwrite', o => o ? o.delete(k) : ripiego.togli(st, k));

export const nuovoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const archivio = {
  ascolta(f) { ascoltatori.add(f); return () => ascoltatori.delete(f); },

  promemoria: () => tutti('promemoria'),
  uno: id => leggi('promemoria', id),
  async salva(p) {
    const ora = Date.now();
    const v = { creato: ora, ...p, id: p.id || nuovoId(), aggiornato: ora };
    await scrivi('promemoria', v);
    avvisa({ tipo: 'promemoria', id: v.id });
    return v;
  },
  async elimina(id) { await togli('promemoria', id); avvisa({ tipo: 'promemoria', id }); },
  async segnaFatto(id, occ, valore = true) {
    const p = await this.uno(id); if (!p) return null;
    if (p.ripeti) p.fatti = { ...(p.fatti || {}), [occ]: valore || undefined };
    else { p.fatto = valore; p.fattoIl = valore ? Date.now() : null; }
    if (p.rinvio?.occ === occ) delete p.rinvio;
    return this.salva(p);
  },
  async rinvia(id, occ, al) {
    const p = await this.uno(id); if (!p) return null;
    p.rinvio = { occ, al };
    return this.salva(p);
  },

  async liste() {
    const l = await tutti('liste');
    if (l.length || await leggi('meta', 'listeCreate')) return l.sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0));
    for (const [i, x] of LISTE_INIZIALI.entries()) await scrivi('liste', { ...x, ordine: i });
    await scrivi('meta', true, 'listeCreate');
    return this.liste();
  },
  async salvaLista(l) { const v = { ...l, id: l.id || nuovoId() }; await scrivi('liste', v); avvisa({ tipo: 'liste' }); return v; },
  async eliminaLista(id) { await togli('liste', id); avvisa({ tipo: 'liste' }); },

  leggiMeta: k => leggi('meta', k),
  scriviMeta: (k, v) => scrivi('meta', v, k),

  async impostazioni() { return { ...PREDEFINITE, fuso: Intl.DateTimeFormat().resolvedOptions().timeZone, ...(await leggi('meta', 'impostazioni')) }; },
  async salvaImpostazioni(patch) {
    const v = { ...(await leggi('meta', 'impostazioni')), ...patch };
    await scrivi('meta', v, 'impostazioni');
    avvisa({ tipo: 'impostazioni' });
    return this.impostazioni();
  },

  async esporta() {
    return { formato: 'ricordiamoci', versione: 1, esportato: new Date().toISOString(), promemoria: await this.promemoria(), liste: await this.liste(), impostazioni: await leggi('meta', 'impostazioni') };
  },
  async importa(dati) {
    if (dati?.formato !== 'ricordiamoci') throw new Error('File non riconosciuto');
    for (const l of dati.liste || []) await scrivi('liste', l);
    for (const p of dati.promemoria || []) await scrivi('promemoria', p);
    if (dati.impostazioni) await scrivi('meta', dati.impostazioni, 'impostazioni');
    avvisa({ tipo: 'tutto' });
  },
  async svuota() {
    const db = await apri();
    if (db) for (const st of ['promemoria', 'liste', 'meta']) await op(st, 'readwrite', o => o.clear());
    else ripiego.svuota();
    avvisa({ tipo: 'tutto' });
  }
};
