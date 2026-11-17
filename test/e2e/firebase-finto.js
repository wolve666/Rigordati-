// Firebase finto per le prove nel browser: stessa interfaccia usata da js/app.js, dati in memoria.
// Lo serve test/e2e/prova-app.mjs al posto dei moduli di gstatic.com. Le regole di sicurezza qui NON valgono.
const F = (globalThis.__finto ??= (() => {
  // Sopravvive ai ricaricamenti della pagina, come farebbe il server.
  let s = {}; try { s = JSON.parse(localStorage.getItem('__finto') || '{}'); } catch {}
  return { dati: new Map(s.dati || []), utente: s.utente || null, prossimo: s.prossimo, id: s.id || 0, ascolti: new Set(), authCb: new Set() };
})());
F.salva = () => { try { localStorage.setItem('__finto', JSON.stringify({ dati: [...F.dati], utente: F.utente, prossimo: F.prossimo, id: F.id })); } catch {} };

/* ---------- app ---------- */
export const initializeApp = cfg => ({ cfg });

/* ---------- auth ---------- */
export const getAuth = () => ({ get currentUser() { return F.utente && { ...F.utente, getIdToken: async () => 'token-' + F.utente.uid }; } });
export class GoogleAuthProvider {}
export const signInWithPopup = async () => { F.login(F.prossimo || { uid: 'anna', email: 'anna@prova.it', displayName: 'Anna Rossi' }); };
export const signInWithRedirect = signInWithPopup;
export const getRedirectResult = async () => null;
export const reauthenticateWithPopup = async () => {};
export const signOut = async () => F.login(null);
export const deleteUser = async () => F.login(null);
export const onAuthStateChanged = (_a, cb) => { F.authCb.add(cb); setTimeout(() => cb(F.utente)); return () => F.authCb.delete(cb); };
F.login = u => { F.utente = u; F.salva(); F.authCb.forEach(cb => cb(u)); };

/* ---------- firestore ---------- */
const OP = Symbol('op');
export const initializeFirestore = () => ({});
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});
export const serverTimestamp = () => ({ [OP]: 'ora' });
export const deleteField = () => ({ [OP]: 'via' });
export const arrayUnion = (...x) => ({ [OP]: 'unisci', x });
export const arrayRemove = (...x) => ({ [OP]: 'togli', x });
export const Timestamp = { fromMillis: ms => ({ seconds: Math.floor(ms / 1000), toMillis: () => ms }) };

const unisci = (...p) => p.flatMap(x => typeof x === 'string' ? x.split('/') : x.path.split('/')).filter(Boolean).join('/');
export const collection = (_db, ...p) => ({ tipo: 'col', path: unisci(...p) });
export const doc = (a, ...p) => {
  if (a?.tipo === 'col' && !p.length) return { tipo: 'doc', path: `${a.path}/auto${++F.id}`, get id() { return this.path.split('/').at(-1); } };
  const path = unisci(...(a?.tipo ? [a] : []), ...p);
  return { tipo: 'doc', path, id: path.split('/').at(-1) };
};

// Come Firestore: i Timestamp letti hanno toMillis() (anche dopo il passaggio da JSON).
const ravviva = x => { if (x && typeof x === 'object') { if ('seconds' in x && !Array.isArray(x)) x.toMillis = () => x.seconds * 1000; Object.values(x).forEach(ravviva); } return x; };
const copia = x => ravviva(JSON.parse(JSON.stringify(x ?? null)));
function valore(v, vecchio) {
  if (v && typeof v === 'object' && OP in v) {
    if (v[OP] === 'ora') return { seconds: Math.floor(Date.now() / 1000) };
    if (v[OP] === 'unisci') return [...(vecchio || []), ...v.x.filter(y => !(vecchio || []).some(z => JSON.stringify(z) === JSON.stringify(y)))];
    if (v[OP] === 'togli') return (vecchio || []).filter(z => !v.x.some(y => JSON.stringify(z) === JSON.stringify(y)));
  }
  return v;
}
function applica(base, campi) {
  const d = copia(base || {});
  for (const [k, v] of Object.entries(campi)) {
    const pezzi = k.split('.'); let o = d;
    pezzi.slice(0, -1).forEach(p => o = (o[p] ??= {}));
    const ultimo = pezzi.at(-1);
    if (v && typeof v === 'object' && v[OP] === 'via') delete o[ultimo];
    else o[ultimo] = valore(v, o[ultimo]);
  }
  return d;
}
const toccato = () => { F.salva(); queueMicrotask(() => F.ascolti.forEach(a => a())); };
const scrivi = (path, d) => { if (d === null) F.dati.delete(path); else F.dati.set(path, d); toccato(); };

export const setDoc = async (r, d, o) => scrivi(r.path, applica(o?.merge ? F.dati.get(r.path) : {}, d));
export const updateDoc = async (r, d) => { if (!F.dati.has(r.path)) throw Object.assign(new Error('not-found'), { code: 'not-found' }); scrivi(r.path, applica(F.dati.get(r.path), d)); };
export const addDoc = async (c, d) => { const r = doc(c); await setDoc(r, d); return r; };
export const deleteDoc = async r => scrivi(r.path, null);
export const writeBatch = () => { const op = []; return {
  set: (r, d) => op.push(() => setDoc(r, d)), update: (r, d) => op.push(() => updateDoc(r, d)), delete: r => op.push(() => deleteDoc(r)),
  commit: async () => { for (const f of op) await f(); }
}; };

const istantanea = r => ({ id: r.path.split('/').at(-1), exists: () => F.dati.has(r.path), data: () => copia(F.dati.get(r.path)), metadata: { fromCache: false } });
const figli = c => [...F.dati.keys()].filter(k => k.startsWith(c.path + '/') && k.split('/').length === c.path.split('/').length + 1);
const elenco = c => { const docs = figli(c).map(k => istantanea({ path: k })); return { docs, size: docs.length, metadata: { fromCache: false } }; };
export const getDoc = async r => istantanea(r);
export const getDocs = async c => {
  if (c.path === 'voci' && F.vecchiaNegata) throw Object.assign(new Error('permission-denied'), { code: 'permission-denied' });
  return elenco(c);
};
export const onSnapshot = (r, ...a) => {
  const [cb, err] = a.filter(x => typeof x === 'function');
  const chiama = () => { try { cb(r.tipo === 'doc' ? istantanea(r) : elenco(r)); } catch (e) { (err || console.error)(e); } };
  F.ascolti.add(chiama); setTimeout(chiama);
  return () => F.ascolti.delete(chiama);
};
F.salva();

/* ---------- messaging ---------- */
export const isSupported = async () => false;
export const getMessaging = () => ({});
export const getToken = async () => null;
