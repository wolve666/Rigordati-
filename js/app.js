import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut, deleteUser, reauthenticateWithPopup } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, onSnapshot, serverTimestamp, arrayUnion, arrayRemove, writeBatch, deleteField, Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getMessaging, getToken, isSupported } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js';

import { firebaseConfig, VAPID, WORKER } from './config.js';
import { capisci } from './capisci.js';
import { iso, daIso, oggi, MESI, GIORNI_BELLI, bella } from './date.js';
import { occorreIl, prossimoAvviso, ANTICIPO_PREDEFINITO } from './ricorrenze.js';

const VERSIONE = self.VERSIONE;
const FUSO = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome';
const GIORNI_INVITO = 7;

const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
const db = initializeFirestore(fb, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }), experimentalAutoDetectLongPolling: true });

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const memoria = {
  leggi: k => { try { return localStorage.getItem(k); } catch { return null; } },
  scrivi: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} }
};
const sessione = {
  leggi: k => { try { return sessionStorage.getItem(k); } catch { return null; } },
  scrivi: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch {} }
};
$('ver').textContent = VERSIONE;

/* ---------- stato ---------- */
let io = null;                  // { uid, email, nome }
let profilo = { famiglie: [] }; // utenti/{uid}
let famId = null, fam = null;   // famiglia attiva
let tutte = [];                 // voci della famiglia attiva
const nomiFamiglie = {};        // fid -> nome, per l'elenco delle famiglie
let stacca = { profilo: null, fam: null, voci: null };
let apriDopo = null;            // { fam, id } da un link o da una notifica
let benvenutoVoluto = false;    // aperto apposta per crearne/entrare in un'altra

const staccaTutto = (...chiavi) => chiavi.forEach(k => { stacca[k]?.(); stacca[k] = null; });

// Link in ingresso: ?invito=CODICE oppure ?voce=FAMIGLIA/VOCE (dalle notifiche)
(() => {
  const qs = new URLSearchParams(location.search);
  if (qs.get('invito')) sessione.scrivi('invito', qs.get('invito').trim().toUpperCase());
  if (qs.get('voce')) { const [f, v] = qs.get('voce').split('/'); if (f && v) apriDopo = { fam: f, id: v }; }
  if (qs.has('nuovo')) apriDopo = { nuovo: true };
  if ([...qs.keys()].length) history.replaceState(null, '', location.pathname);
})();

/* ---------- chi è chi ---------- */
const mia = v => v.autoreUid ? v.autoreUid === io?.uid : v.autore === io?.email;
const rispostaMia = r => r.uid ? r.uid === io?.uid : r.email === io?.email;
const perMe = v => !v.perChi?.length || v.perChi.includes(io?.uid);
const inAttesaPerMe = v => v.tipo === 'domanda' && !mia(v) && perMe(v) && !(v.risposte || []).some(rispostaMia);
const nomeDi = uid => fam?.nomi?.[uid] || '?';
const mioNome = () => fam?.nomi?.[io.uid] || profilo.nome || io.nome;

/* ---------- accesso ---------- */
const provider = new GoogleAuthProvider();
$('btnGoogle').onclick = async () => {
  $('accErr').textContent = '';
  try { await signInWithPopup(auth, provider); }
  catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') signInWithRedirect(auth, provider);
    else if (e.code !== 'auth/popup-closed-by-user') $('accErr').textContent = 'Accesso non riuscito: ' + (e.code || e.message);
  }
};
getRedirectResult(auth).catch(() => {});
const esci = () => { if (confirm('Vuoi uscire da Rigordati!!?')) { memoria.scrivi('famiglia', null); signOut(auth); } };
$('bvEsci').onclick = esci;

onAuthStateChanged(auth, u => {
  chiudiFoglio();
  staccaTutto('profilo', 'fam', 'voci');
  famId = null; fam = null; tutte = []; profilo = { famiglie: [] };
  if (!u) { io = null; $('benvenuto').classList.remove('on'); $('accesso').classList.add('on'); return; }
  io = { uid: u.uid, email: u.email, nome: (u.displayName || u.email).split(' ')[0] };
  $('accesso').classList.remove('on');
  preparaNotifiche();
  stacca.profilo = onSnapshot(doc(db, 'utenti', u.uid), { includeMetadataChanges: true }, s => {
    if (s.metadata.fromCache && !s.exists()) return; // primo avvio: aspetto il server prima di dire "nessuna famiglia"
    profilo = { famiglie: [], ...s.data() };
    scegliFamiglia();
    aggiornaTelefono();
  }, err => statoSync('err', 'Errore profilo: ' + err.code));
});

function scegliFamiglia() {
  const lista = profilo.famiglie || [];
  if (!lista.length || sessione.leggi('invito') || benvenutoVoluto) { mostraBenvenuto(); if (!lista.length) return; }
  else $('benvenuto').classList.remove('on');
  const voluta = [apriDopo?.fam, memoria.leggi('famiglia'), famId, lista[0]].find(f => f && lista.includes(f));
  if (voluta !== famId) collegaFamiglia(voluta);
}

function collegaFamiglia(fid) {
  staccaTutto('fam', 'voci');
  famId = fid; fam = null; tutte = [];
  memoria.scrivi('famiglia', fid);
  $('nomeFam').textContent = nomiFamiglie[fid] || '';
  disegna();
  stacca.fam = onSnapshot(doc(db, 'famiglie', fid), s => {
    if (!s.exists()) return;
    fam = { id: fid, ...s.data() };
    nomiFamiglie[fid] = fam.nome;
    $('nomeFam').textContent = fam.nome;
    if (foglioAperto === 'fFam') corpoFamiglia();
    disegna();
  }, err => {
    if (err.code === 'permission-denied') {
      // Non sono più nella famiglia (uscito da un altro telefono): la tolgo dal profilo.
      toast('Non fai più parte di questa famiglia');
      updateDoc(doc(db, 'utenti', io.uid), { famiglie: arrayRemove(fid) }).catch(() => {});
      memoria.scrivi('famiglia', null);
    }
  });
  stacca.voci = onSnapshot(collection(db, 'famiglie', fid, 'voci'), { includeMetadataChanges: true }, snap => {
    statoSync(snap.metadata.fromCache ? '' : 'ok', snap.metadata.fromCache ? 'Offline: uso i dati salvati sul telefono' : 'Collegato e sincronizzato');
    tutte = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    disegna();
    if (foglioAperto === 'fDett') corpoDettaglio();
    if (apriDopo?.fam === fid && tutte.some(v => v.id === apriDopo.id)) { const id = apriDopo.id; apriDopo = null; apriDettaglio(id); }
    else if (apriDopo?.nuovo && !snap.metadata.fromCache) { apriDopo = null; apriNuovo(''); } // scorciatoia "Nuova voce"
  }, err => {
    statoSync('err', 'Errore di collegamento: ' + err.code);
    if (err.code !== 'permission-denied') toast('Errore di collegamento: ' + err.code);
  });
}

/* ---------- viste ---------- */
let meseVisto = oggi(); meseVisto.setDate(1);
let giornoSel = iso(oggi());
let filtroTodo = '';

function disegna() {
  disegnaMese(); disegnaGiorno(); disegnaDomande(); disegnaTodo();
  const nd = tutte.filter(inAttesaPerMe).length;
  const nt = tutte.filter(v => v.tipo === 'todo' && !v.fatto && perMe(v)).length;
  setBadge('badgeDom', nd); setBadge('badgeTodo', nt);
  if ('setAppBadge' in navigator) { nd ? navigator.setAppBadge(nd).catch(() => {}) : navigator.clearAppBadge().catch(() => {}); }
}
function setBadge(id, n) { const b = $(id); b.textContent = n > 9 ? '9+' : n; b.classList.toggle('on', n > 0); }

function disegnaMese() {
  $('meseNome').textContent = `${MESI[meseVisto.getMonth()]} ${meseVisto.getFullYear()}`;
  const g = $('griglia'); g.innerHTML = '';
  ['L', 'M', 'M', 'G', 'V', 'S', 'D'].forEach(x => g.insertAdjacentHTML('beforeend', `<div class="gs">${x}</div>`));
  const inizio = new Date(meseVisto); inizio.setDate(1 - ((meseVisto.getDay() + 6) % 7));
  const oggiS = iso(oggi());
  for (let i = 0; i < 42; i++) {
    const d = new Date(inizio); d.setDate(inizio.getDate() + i);
    const s = iso(d);
    const tipi = [...new Set(tutte.filter(v => occorreIl(v, s) && (!v.fatto || v.ripeti)).map(v => v.tipo))];
    const b = document.createElement('button');
    b.className = 'giorno' + (d.getMonth() !== meseVisto.getMonth() ? ' fuori' : '') + (s === oggiS ? ' oggi' : '') + (s === giornoSel ? ' sel' : '');
    b.innerHTML = `${d.getDate()}<span class="pallini">${tipi.map(t => `<i class="p-${t}"></i>`).join('')}</span>`;
    b.onclick = () => { if (s === giornoSel) { apriNuovo(s); return; } giornoSel = s; if (d.getMonth() !== meseVisto.getMonth()) meseVisto = new Date(d.getFullYear(), d.getMonth(), 1); disegna(); };
    g.appendChild(b);
  }
}
$('mesePrec').onclick = () => { meseVisto.setMonth(meseVisto.getMonth() - 1); disegnaMese(); };
$('meseSucc').onclick = () => { meseVisto.setMonth(meseVisto.getMonth() + 1); disegnaMese(); };

const perOra = (a, b) => (a.ora || '99').localeCompare(b.ora || '99');
const secondi = t => t?.seconds ?? (typeof t === 'number' ? t / 1000 : 9e9);
const recenti = (a, b) => secondi(b.creato) - secondi(a.creato);

function disegnaGiorno() {
  $('giornoTitolo').textContent = giornoSel === iso(oggi()) ? 'Oggi' : bella(giornoSel);
  const l = tutte.filter(v => occorreIl(v, giornoSel)).sort(perOra);
  riempi('listaGiorno', l, 'Giornata libera', 'Tocca + per aggiungere qualcosa.', true);
}
function disegnaDomande() {
  const l = tutte.filter(v => v.tipo === 'domanda').sort((a, b) => inAttesaPerMe(b) - inAttesaPerMe(a) || recenti(a, b));
  riempi('listaDomande', l, 'Nessuna domanda', 'Scrivi qualcosa con il punto di domanda per chiedere.');
}
const nelFiltro = v => !filtroTodo || (filtroTodo === 'spesa' ? v.lista === 'spesa' : v.lista !== 'spesa');
function disegnaTodo() {
  const l = tutte.filter(v => v.tipo === 'todo' && nelFiltro(v)).sort((a, b) => (a.fatto ? 1 : 0) - (b.fatto ? 1 : 0) || recenti(a, b));
  riempi('listaTodo', l, filtroTodo === 'spesa' ? 'Non manca niente!' : 'Tutto fatto!', 'Qui finiscono le cose da prendere o da fare.');
  const fatti = l.filter(v => v.fatto).length;
  $('btnPulisci').hidden = !fatti;
  $('btnPulisci').textContent = `Togli ${fatti === 1 ? 'la cosa fatta' : `le ${fatti} cose fatte`}`;
}
document.querySelectorAll('#filtriTodo button').forEach(b => b.onclick = () => {
  filtroTodo = b.dataset.f;
  document.querySelectorAll('#filtriTodo button').forEach(x => x.classList.toggle('sel', x === b));
  disegnaTodo();
});
$('btnPulisci').onclick = async () => {
  const fatti = tutte.filter(v => v.tipo === 'todo' && v.fatto && nelFiltro(v));
  if (!fatti.length || !confirm(`Staccare dal frigo ${fatti.length === 1 ? 'la cosa fatta' : `le ${fatti.length} cose fatte`}?`)) return;
  const b = writeBatch(db);
  fatti.forEach(v => b.delete(doc(db, 'famiglie', famId, 'voci', v.id)));
  await b.commit(); toast('Frigo ripulito');
};

function riempi(id, lista, t1, t2, nelGiorno = false) {
  const el = $(id);
  if (!lista.length) { el.innerHTML = `<div class="vuoto"><b>${t1}</b>${t2}</div>`; return; }
  el.innerHTML = lista.map(v => biglietto(v, nelGiorno)).join('');
  el.querySelectorAll('.biglietto').forEach(b => b.onclick = e => {
    if (e.target.closest('.spunta')) return;
    apriDettaglio(b.dataset.id);
  });
  el.querySelectorAll('.spunta').forEach(s => s.onclick = e => spunta(s.closest('.biglietto').dataset.id, e));
}

function descriviRipeti(v) {
  const d = daIso(v.data);
  return { giorno: 'ogni giorno', settimana: `ogni ${GIORNI_BELLI[d.getDay()]}`, mese: `ogni mese il ${d.getDate()}`, anno: `ogni anno il ${d.getDate()} ${MESI[d.getMonth()]}` }[v.ripeti] || '';
}
const perChiTesto = v => v.perChi?.length ? `per ${v.perChi.map(u => u === io.uid ? 'te' : nomeDi(u)).join(', ')}` : '';

function biglietto(v, nelGiorno = false) {
  const meta = [];
  if (v.ripeti) meta.push(`<span>🔁 <b>${descriviRipeti(v)}</b></span>`);
  else if (v.data && !nelGiorno) meta.push(`<span>📅 <b>${bella(v.data)}</b></span>`);
  if (v.ora) meta.push(`<span>🕓 <b>${v.ora}</b></span>`);
  if (v.lista === 'spesa') meta.push('<span>🛒</span>');
  if (v.perChi?.length) meta.push(`<span class="per">${esc(perChiTesto(v))}</span>`);
  meta.push(`<span>da ${esc(v.autoreNome)}</span>`);
  if (v.tipo === 'domanda') {
    const r = v.risposte || [];
    if (inAttesaPerMe(v)) meta.push('<span class="attesa">Rispondi tu</span>');
    else if (!r.length) meta.push('<span>in attesa di risposta</span>');
    else meta.push(`<span class="esito">${esc(r.at(-1).nome)}: ${esc(r.at(-1).testo)}</span>`);
  }
  const spuntabile = v.tipo !== 'domanda' && !v.ripeti;
  return `<div class="biglietto b-${v.tipo} ${v.fatto && spuntabile ? 'fatto' : ''} ${spuntabile ? 'con-spunta' : ''}" data-id="${esc(v.id)}">
    ${spuntabile ? `<button class="spunta" aria-label="Fatto">${v.fatto ? '✓' : ''}</button>` : ''}
    <div class="b-testo">${esc(v.testo)}</div><div class="b-meta">${meta.join('')}</div></div>`;
}

const rifVoce = id => doc(db, 'famiglie', famId, 'voci', id);
async function spunta(id, e) {
  const v = tutte.find(x => x.id === id); if (!v) return;
  if (!v.fatto) coriandoli(e.clientX, e.clientY);
  await updateDoc(rifVoce(id), { fatto: !v.fatto });
}

/* ---------- schede in basso ---------- */
document.querySelectorAll('nav .tab').forEach(t => t.onclick = () => vaiA(t.dataset.v));
function vaiA(v, storia = true) {
  if (storia && v !== 'v-cal' && attuale() === 'v-cal') history.pushState({ vista: v }, '');
  document.querySelectorAll('.vista').forEach(s => s.classList.toggle('attiva', s.id === v));
  document.querySelectorAll('nav .tab').forEach(t => t.classList.toggle('attiva', t.dataset.v === v));
}
const attuale = () => document.querySelector('.vista.attiva').id;

/* ---------- fogli e tasto indietro ---------- */
let foglioAperto = null;
function apriFoglio(id) {
  if (foglioAperto) { $(foglioAperto).classList.remove('on'); foglioAperto = id; $(id).classList.add('on'); return; } // stesso passo di cronologia
  foglioAperto = id; $(id).classList.add('on'); $('velo').classList.add('on');
  history.pushState({ foglio: id }, '');
}
function chiudiFoglio(daIndietro = false) {
  if (!foglioAperto) return;
  $(foglioAperto).classList.remove('on'); $('velo').classList.remove('on');
  foglioAperto = null;
  if (!daIndietro) history.back();
}
$('velo').onclick = () => chiudiFoglio();
window.addEventListener('popstate', () => {
  if (foglioAperto) { chiudiFoglio(true); return; }
  if (attuale() !== 'v-cal') vaiA('v-cal', false);
});

/* ---------- nuovo e modifica ---------- */
let nTipo = 'todo', modId = null, scelto = {}, pre = { data: '', ora: '' }, nLista = '', perChiSel = new Set();
$('btnNuovo').onclick = () => apriNuovo(attuale() === 'v-cal' && giornoSel !== iso(oggi()) ? giornoSel : '');

function apriNuovo(data, voce = null) {
  if (!famId) return;
  modId = voce?.id || null;
  scelto = voce ? { tipo: true, ripeti: true, lista: true } : {};
  pre = { data: voce?.data ?? data, ora: voce?.ora ?? '' };
  $('nTitolo').textContent = voce ? 'Modifica' : 'Che c\'è da rigordare?';
  $('nSalva').textContent = voce ? 'Salva' : 'Attacca al frigo';
  $('nTesto').value = voce?.testo || '';
  $('nData').value = pre.data; $('nOra').value = pre.ora;
  $('nRipeti').value = voce?.ripeti || '';
  $('nAnticipo').value = String(voce?.anticipo ?? ANTICIPO_PREDEFINITO);
  perChiSel = new Set(voce?.perChi || []);
  impostaLista(voce ? voce.lista || '' : (attuale() === 'v-todo' && filtroTodo === 'spesa' ? 'spesa' : ''));
  aggiornaTipo(voce?.tipo || 'todo');
  disegnaPerChi();
  $('nSalva').disabled = !voce;
  $('nNota').textContent = voce ? 'Cambia quello che vuoi.' : 'Scrivi come lo diresti: giorno e ora li capisco da solo.';
  apriFoglio('fNuovo');
  if (!voce) setTimeout(() => $('nTesto').focus(), 300);
}
function aggiornaTipo(t) {
  nTipo = t; $('fNuovo').dataset.tipo = t;
  document.querySelectorAll('#nTipi button').forEach(b => b.classList.toggle('sel', b.dataset.t === t));
}
function impostaLista(l) { nLista = l; document.querySelectorAll('#nLista button').forEach(b => b.classList.toggle('sel', b.dataset.l === l)); }
document.querySelectorAll('#nLista button').forEach(b => b.onclick = () => { scelto.lista = true; impostaLista(b.dataset.l); });
function disegnaPerChi() {
  const membri = fam?.membri || [];
  $('nPerChiCampo').hidden = membri.length < 2;
  $('nPerChi').innerHTML = `<button data-u="" class="${perChiSel.size ? '' : 'sel'}">Tutti</button>` +
    membri.map(u => `<button data-u="${esc(u)}" class="${perChiSel.has(u) ? 'sel' : ''}">${esc(u === io.uid ? 'Io' : nomeDi(u))}</button>`).join('');
  $('nPerChi').querySelectorAll('button').forEach(b => b.onclick = () => {
    const u = b.dataset.u;
    if (!u) perChiSel.clear(); else perChiSel.has(u) ? perChiSel.delete(u) : perChiSel.add(u);
    if (perChiSel.size === membri.length) perChiSel.clear();
    disegnaPerChi();
  });
}
document.querySelectorAll('#nTipi button').forEach(b => b.onclick = () => {
  scelto.tipo = true; aggiornaTipo(b.dataset.t);
  // Domanda con il testo già scritto: parte subito (solo per le voci nuove)
  if (!modId && b.dataset.t === 'domanda' && $('nTesto').value.trim() && !$('nSalva').disabled) $('nSalva').click();
});
$('nData').oninput = $('nOra').oninput = () => scelto.data = true;
$('nRipeti').oninput = () => scelto.ripeti = true;
$('nTesto').oninput = () => {
  const t = $('nTesto').value; $('nSalva').disabled = !t.trim();
  const c = capisci(t);
  if (!scelto.tipo) aggiornaTipo(c.tipo);
  if (!scelto.data) { $('nData').value = c.data || pre.data; $('nOra').value = c.ora || pre.ora; }
  if (!scelto.ripeti) $('nRipeti').value = c.ripeti;
  if (!scelto.lista && c.lista) impostaLista(c.lista);
  const capito = [c.data && bella(c.data), c.ora && 'alle ' + c.ora, c.ripeti && '🔁 si ripete'].filter(Boolean).join(' ');
  $('nNota').textContent = capito ? `Ho capito: ${capito}` : 'Scrivi come lo diresti: giorno e ora li capisco da solo.';
};
$('nSalva').onclick = async () => {
  const c = capisci($('nTesto').value);
  const data = $('nData').value || '';
  const voce = {
    tipo: nTipo, testo: c.testo, data, ora: $('nOra').value || '',
    ripeti: nTipo === 'impegno' && data ? $('nRipeti').value : '',
    anticipo: nTipo === 'impegno' ? +$('nAnticipo').value : ANTICIPO_PREDEFINITO,
    lista: nTipo === 'todo' ? nLista : '',
    perChi: [...perChiSel], fuso: FUSO, famiglia: famId
  };
  if (voce.tipo === 'impegno' && !voce.data) { toast('Per un impegno serve il giorno'); return; }
  const avviso = prossimoAvviso(voce, Date.now(), FUSO);
  $('nSalva').disabled = true;
  try {
    let id = modId;
    if (modId) {
      await updateDoc(rifVoce(modId), { ...voce, avvisoAt: avviso ?? deleteField(), modificato: serverTimestamp(), modificatoDa: io.uid });
      avvisa(modId, 'modifica', true);
      toast('Modificato');
    } else {
      Object.assign(voce, { autoreUid: io.uid, autore: io.email, autoreNome: mioNome(), creato: serverTimestamp(), fatto: false, risposte: [] });
      if (avviso) voce.avvisoAt = avviso;
      id = (await addDoc(collection(db, 'famiglie', famId, 'voci'), voce)).id;
      avvisa(id, 'nuova');
      toast(voce.tipo === 'domanda' ? 'Domanda inviata' : 'Attaccato al frigo');
    }
    chiudiFoglio();
    if (voce.data) { giornoSel = voce.data; const d = daIso(voce.data); meseVisto = new Date(d.getFullYear(), d.getMonth(), 1); disegna(); }
  } catch (e) { toast('Non salvato: ' + (e.code || e.message)); $('nSalva').disabled = false; }
};

/* ---------- dettaglio ---------- */
let dId = null;
function apriDettaglio(id) { dId = id; corpoDettaglio(); apriFoglio('fDett'); }
function corpoDettaglio() {
  const v = tutte.find(x => x.id === dId); if (!v) { chiudiFoglio(); return; }
  let h = `<h3>${esc(v.testo)}</h3><div class="b-meta" style="margin-bottom:8px">`;
  if (v.data) h += `<span>📅 <b>${v.ripeti ? 'dal ' : ''}${bella(v.data)}</b></span>`;
  if (v.ora) h += `<span>🕓 <b>${v.ora}</b></span>`;
  if (v.ripeti) h += `<span>🔁 <b>${descriviRipeti(v)}</b></span>`;
  if (v.perChi?.length) h += `<span class="per">${esc(perChiTesto(v))}</span>`;
  h += `<span>scritto da ${esc(v.autoreNome)}</span></div>`;
  if (v.tipo === 'domanda') {
    const r = v.risposte || [];
    h += `<div class="risposte">${r.map(x => `<div class="fumetto ${rispostaMia(x) ? 'mio' : ''}"><small>${esc(x.nome)}</small>${esc(x.testo)}</div>`).join('') || '<div class="nota">Ancora nessuna risposta.</div>'}</div>`;
    h += `<div class="rapide"><button class="r-si" data-r="Sì">Sì</button><button class="r-no" data-r="No">No</button><button class="r-forse" data-r="Forse">Forse</button></div>
      <div class="riga"><input type="text" id="dRisp" placeholder="Oppure scrivi una risposta…" maxlength="300"></div>
      <button class="btn-grande" id="dInvia">Rispondi</button>`;
  } else if (!v.ripeti) {
    h += `<button class="btn-grande" id="dFatto">${v.fatto ? 'Rimetti da fare' : 'Fatto!'}</button>`;
  }
  h += `<button class="btn-sec" id="dModifica">✏️ Modifica</button>`;
  if (mia(v)) h += `<button class="btn-elimina" id="dElimina">Stacca dal frigo</button>`;
  $('dCorpo').innerHTML = h;

  document.querySelectorAll('#dCorpo .rapide button').forEach(b => b.onclick = () => rispondi(b.dataset.r));
  if ($('dInvia')) $('dInvia').onclick = () => { const t = $('dRisp').value.trim(); if (t) rispondi(t); };
  if ($('dFatto')) $('dFatto').onclick = e => { spunta(v.id, e); chiudiFoglio(); };
  $('dModifica').onclick = () => apriNuovo(v.data, v);
  if ($('dElimina')) $('dElimina').onclick = async () => {
    if (!confirm(v.ripeti ? 'Vuoi staccarlo dal frigo? Spariranno tutte le ripetizioni.' : 'Vuoi staccarlo dal frigo?')) return;
    await deleteDoc(rifVoce(v.id)); chiudiFoglio(); toast('Staccato');
  };
}
async function rispondi(testo) {
  await updateDoc(rifVoce(dId), { risposte: arrayUnion({ uid: io.uid, email: io.email, nome: mioNome(), testo, quando: Date.now() }) });
  avvisa(dId, 'risposta');
  toast('Risposta inviata'); chiudiFoglio();
}

/* ---------- famiglia ---------- */
$('nomeFam').onclick = () => $('btnFamiglia').click();
$('btnFamiglia').onclick = () => { if (!famId) return; corpoFamiglia(); apriFoglio('fFam'); caricaNomiFamiglie(); };
const COLORI = ['var(--impegno)', 'var(--domanda)', 'var(--todo)', '#C9DDF7', '#E4D4F7'];

function corpoFamiglia() {
  if (!fam) { $('famCorpo').innerHTML = '<p class="nota">Carico la famiglia…</p>'; return; }
  const altre = profilo.famiglie || [];
  $('famCorpo').innerHTML = `
    <h3>${esc(fam.nome)}</h3>
    <div class="sez">Chi c'è</div>
    <ul class="membri">${fam.membri.map((u, i) => `<li><span class="avatar" style="background:${COLORI[i % COLORI.length]}">${esc(nomeDi(u).charAt(0).toUpperCase())}</span>${esc(nomeDi(u))}${u === io.uid ? '<small>tu</small>' : ''}</li>`).join('')}</ul>
    <button class="btn-grande" id="fInvita">➕ Invita qualcuno</button>
    <div id="fCodice"></div>
    ${altre.length > 1 ? `<div class="sez">Le mie famiglie</div><div class="lista-fam">${altre.map(f => `<button data-f="${esc(f)}" class="${f === famId ? 'sel' : ''}">${esc(nomiFamiglie[f] || '…')}</button>`).join('')}</div>` : ''}
    <div class="sez">Impostazioni</div>
    <button class="btn-sec" id="fMioNome">Il mio nome qui: ${esc(mioNome())}</button>
    <button class="btn-sec" id="fRinomina">Rinomina la famiglia</button>
    <button class="btn-sec" id="fAltra">Crea o entra in un'altra famiglia</button>
    <button class="btn-elimina" id="fLascia">Esci da questa famiglia</button>
    <div class="piede">
      <button class="link" id="fEsci">Esci dall'account</button>
      <a class="link" href="privacy.html">Privacy</a>
      <button class="link" id="fElimina">Elimina il mio account</button>
    </div>`;
  $('fInvita').onclick = invita;
  $('famCorpo').querySelectorAll('.lista-fam button').forEach(b => b.onclick = () => { if (b.dataset.f !== famId) { collegaFamiglia(b.dataset.f); chiudiFoglio(); } });
  $('fMioNome').onclick = async () => {
    const n = prompt('Come ti chiamano in questa famiglia?', mioNome())?.trim();
    if (n) await updateDoc(doc(db, 'famiglie', famId), { [`nomi.${io.uid}`]: n.slice(0, 30) });
  };
  $('fRinomina').onclick = async () => {
    const n = prompt('Nuovo nome della famiglia', fam.nome)?.trim();
    if (n) await updateDoc(doc(db, 'famiglie', famId), { nome: n.slice(0, 60) });
  };
  $('fAltra').onclick = () => { chiudiFoglio(); benvenutoVoluto = true; mostraBenvenuto(); };
  $('fLascia').onclick = lasciaFamiglia;
  $('fEsci').onclick = esci;
  $('fElimina').onclick = eliminaAccount;
}
async function caricaNomiFamiglie() {
  const mancanti = (profilo.famiglie || []).filter(f => !nomiFamiglie[f]);
  if (!mancanti.length) return;
  await Promise.all(mancanti.map(f => getDoc(doc(db, 'famiglie', f)).then(s => { nomiFamiglie[f] = s.data()?.nome || '(non disponibile)'; }).catch(() => {})));
  if (foglioAperto === 'fFam') corpoFamiglia();
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // niente 0/O e 1/I
const nuovoCodice = () => [...crypto.getRandomValues(new Uint8Array(8))].map(x => ALFABETO[x % 32]).join('');
const linkInvito = c => `${location.origin}${location.pathname}?invito=${c}`;

async function invita() {
  const c = nuovoCodice();
  try {
    await setDoc(doc(db, 'inviti', c), {
      famiglia: famId, nomeFamiglia: fam.nome, da: io.uid, daNome: mioNome(),
      creato: serverTimestamp(), scade: Timestamp.fromMillis(Date.now() + GIORNI_INVITO * 864e5)
    });
  } catch (e) { toast('Invito non creato: ' + (e.code || e.message)); return; }
  $('fCodice').innerHTML = `<div class="codice-grande">${c}</div>
    <p class="nota" style="text-align:center">Vale ${GIORNI_INVITO} giorni. Chi lo riceve apre il link, oppure scrive il codice dopo l'accesso.</p>
    <div class="riga"><button class="btn-sec" id="fCondividi">Condividi</button><button class="btn-sec" id="fCopia">Copia link</button></div>`;
  const testo = `Entra nella famiglia "${fam.nome}" su Rigordati!! con il codice ${c}: ${linkInvito(c)}`;
  $('fCondividi').onclick = () => navigator.share ? navigator.share({ title: 'Rigordati!!', text: testo }).catch(() => {}) : copia(testo);
  $('fCopia').onclick = () => copia(linkInvito(c));
}
const copia = t => navigator.clipboard?.writeText(t).then(() => toast('Copiato'), () => toast(t)) ?? toast(t);

async function lasciaFamiglia() {
  if (!confirm(`Vuoi uscire da "${fam.nome}"? Non vedrai più le sue voci (gli altri sì).`)) return;
  const fid = famId;
  staccaTutto('fam', 'voci'); // prima di uscire, altrimenti gli ascoltatori vedono "permesso negato"
  try {
    await updateDoc(doc(db, 'famiglie', fid), { membri: arrayRemove(io.uid), [`nomi.${io.uid}`]: deleteField() });
  } catch (e) { toast('Non riuscito: ' + (e.code || e.message)); collegaFamiglia(fid); return; }
  memoria.scrivi('famiglia', null);
  chiudiFoglio();
  famId = null; fam = null; tutte = []; disegna();
  await updateDoc(doc(db, 'utenti', io.uid), { famiglie: arrayRemove(fid) }).catch(() => {});
  toast('Sei uscito dalla famiglia');
}

async function eliminaAccount() {
  if (!confirm('Eliminare il tuo account? Esci da tutte le famiglie, il telefono smette di ricevere notifiche e il profilo viene cancellato. Le voci che hai scritto restano alle famiglie.')) return;
  try { await reauthenticateWithPopup(auth.currentUser, provider); }
  catch (e) { if (e.code !== 'auth/popup-blocked') { toast('Eliminazione annullata'); return; } }
  try {
    for (const fid of profilo.famiglie || [])
      await updateDoc(doc(db, 'famiglie', fid), { membri: arrayRemove(io.uid), [`nomi.${io.uid}`]: deleteField() }).catch(() => {});
    if (mioToken) await deleteDoc(doc(db, 'dispositivi', mioToken)).catch(() => {});
    staccaTutto('profilo', 'fam', 'voci');
    await deleteDoc(doc(db, 'utenti', io.uid));
    memoria.scrivi('famiglia', null);
    await deleteUser(auth.currentUser);
    chiudiFoglio(); toast('Account eliminato');
  } catch (e) { toast('Eliminazione non completata: ' + (e.code || e.message)); }
}

/* ---------- benvenuto: crea o entra ---------- */
function mostraBenvenuto() {
  const haFamiglie = (profilo.famiglie || []).length > 0;
  const giaAperto = $('benvenuto').classList.contains('on');
  $('benvenuto').classList.add('on');
  $('bvSaluto').textContent = haFamiglie ? 'Crea un\'altra famiglia o entra in una nuova.' : `Ciao ${io.nome}! Per iniziare, entra nella tua famiglia o creane una.`;
  $('bvIndietro').hidden = !haFamiglie;
  if (giaAperto) return;
  $('bvErr').textContent = '';
  mostraInvito();
  controllaVecchioFrigo();
}
$('bvIndietro').onclick = () => { benvenutoVoluto = false; sessione.scrivi('invito', null); $('benvenuto').classList.remove('on'); };

async function mostraInvito() {
  const c = sessione.leggi('invito');
  $('bvInvito').hidden = true;
  if (!c) return;
  $('bvCodice').value = c;
  try {
    const s = await getDoc(doc(db, 'inviti', c));
    if (!s.exists()) { $('bvErr').textContent = 'Il codice d\'invito non è valido.'; sessione.scrivi('invito', null); return; }
    const inv = s.data();
    if ((profilo.famiglie || []).includes(inv.famiglia)) { sessione.scrivi('invito', null); collegaFamiglia(inv.famiglia); benvenutoVoluto = false; $('benvenuto').classList.remove('on'); return; }
    $('bvInvitoTesto').textContent = `${inv.daNome || 'Qualcuno'} ti invita nella famiglia "${inv.nomeFamiglia}".`;
    $('bvInvito').hidden = false;
  } catch (e) { $('bvErr').textContent = 'Non riesco a leggere l\'invito: ' + (e.code || e.message); }
}
$('bvAccetta').onclick = () => entraConCodice(sessione.leggi('invito'));
$('bvEntra').onclick = () => entraConCodice($('bvCodice').value);

async function entraConCodice(codice) {
  codice = (codice || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  $('bvErr').textContent = '';
  if (codice.length !== 8) { $('bvErr').textContent = 'Il codice ha 8 caratteri.'; return; }
  try {
    const s = await getDoc(doc(db, 'inviti', codice));
    if (!s.exists()) { $('bvErr').textContent = 'Codice non valido.'; return; }
    const inv = s.data();
    if (inv.scade.toMillis() < Date.now()) { $('bvErr').textContent = 'Codice scaduto: chiedine uno nuovo.'; return; }
    if (!(profilo.famiglie || []).includes(inv.famiglia))
      await updateDoc(doc(db, 'famiglie', inv.famiglia), { membri: arrayUnion(io.uid), [`nomi.${io.uid}`]: io.nome, invito: codice });
    await entraIn(inv.famiglia);
    toast(`Benvenuto in "${inv.nomeFamiglia}"!`);
  } catch (e) { $('bvErr').textContent = 'Non riesco a entrare: ' + (e.code || e.message); }
}

$('bvCrea').onclick = async () => {
  const nome = $('bvNome').value.trim();
  const migra = !$('bvMigraRiga').hidden && $('bvMigra').checked; // letto subito: la schermata può ridisegnarsi
  if (!nome) { $('bvErr').textContent = 'Dai un nome alla famiglia.'; $('bvNome').focus(); return; }
  $('bvCrea').disabled = true;
  try {
    const rif = doc(collection(db, 'famiglie'));
    await setDoc(rif, { nome: nome.slice(0, 60), membri: [io.uid], nomi: { [io.uid]: io.nome }, creata: serverTimestamp(), creatore: io.uid });
    if (migra) await portaVecchieVoci(rif.id, nome);
    await entraIn(rif.id);
    toast('Famiglia creata! Ora invita gli altri da 👪');
  } catch (e) { $('bvErr').textContent = 'Non riesco a crearla: ' + (e.code || e.message); }
  $('bvCrea').disabled = false;
};

async function entraIn(fid) {
  sessione.scrivi('invito', null); benvenutoVoluto = false;
  memoria.scrivi('famiglia', fid);
  await setDoc(doc(db, 'utenti', io.uid), { famiglie: arrayUnion(fid), email: io.email, nome: io.nome }, { merge: true });
  $('benvenuto').classList.remove('on');
  $('bvCodice').value = ''; $('bvNome').value = '';
}

/* ---------- migrazione dalla v0.2 (una sola collezione "voci" per tutti) ---------- */
async function controllaVecchioFrigo() {
  $('bvMigraRiga').hidden = true; $('bvMigrata').hidden = true;
  try {
    const st = await getDoc(doc(db, 'migrazione', 'stato'));
    if (st.exists()) {
      $('bvMigrata').textContent = `Le voci del vecchio frigo sono già nella famiglia "${st.data().nome}": chiedi il codice d'invito a chi l'ha creata.`;
      $('bvMigrata').hidden = false; return;
    }
    const s = await getDocs(collection(db, 'voci'));
    if (s.size) { $('bvMigraTesto').textContent = `Porta in questa famiglia le ${s.size} voci del vecchio frigo`; $('bvMigraRiga').hidden = false; }
  } catch { /* nessun accesso al vecchio frigo: è un utente nuovo */ }
}
async function portaVecchieVoci(fid, nomeFam) {
  const s = await getDocs(collection(db, 'voci'));
  const adesso = Date.now();
  let lotto = writeBatch(db), n = 0;
  for (const d of s.docs) {
    const v = { ripeti: '', lista: '', perChi: [], ...d.data(), famiglia: fid, fuso: FUSO, migrata: true, autoreUid: d.data().autore === io.email ? io.uid : '' };
    if (!(v.avvisoAt > adesso)) delete v.avvisoAt;
    lotto.set(doc(db, 'famiglie', fid, 'voci', d.id), v);
    if (++n % 15 === 0) { await lotto.commit(); lotto = writeBatch(db); }
  }
  lotto.set(doc(db, 'migrazione', 'stato'), { famiglia: fid, nome: nomeFam, da: io.email, voci: n, quando: serverTimestamp() });
  await lotto.commit();
}

/* ---------- notifiche ---------- */
let mioToken = null, famiglieTelefono = '';
const notificheOk = () => 'Notification' in window && Notification.permission === 'granted';
async function preparaNotifiche() {
  if (!('Notification' in window) || !(await isSupported())) return;
  $('btnCampana').hidden = notificheOk();
}
$('btnCampana').onclick = async () => {
  const p = await Notification.requestPermission();
  if (p === 'granted') { $('btnCampana').hidden = true; toast('Notifiche attive'); famiglieTelefono = ''; aggiornaTelefono(); }
  else toast('Notifiche bloccate: riattivale dalle impostazioni dell\'app');
};
// Registra il telefono con le famiglie attuali (quando cambiano, o all'avvio).
async function aggiornaTelefono() {
  if (!io || !notificheOk() || !(await isSupported().catch(() => false))) return;
  const famiglie = profilo.famiglie || [];
  if (JSON.stringify(famiglie) === famiglieTelefono && mioToken) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(fb), { vapidKey: VAPID, serviceWorkerRegistration: reg });
    if (!token) return;
    mioToken = token;
    await setDoc(doc(db, 'dispositivi', token), { token, uid: io.uid, email: io.email, nome: io.nome, famiglie, agg: serverTimestamp() });
    famiglieTelefono = JSON.stringify(famiglie);
  } catch (e) { console.warn('Notifiche non registrate', e); }
}
async function avvisa(id, evento, silenzioso = false) {
  try {
    const idToken = await auth.currentUser.getIdToken();
    const r = await fetch(WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken, famiglia: famId, id, evento, mioToken }) });
    const j = await r.json();
    if (!j.ok) toast('Postino: ' + j.errore);
    else if (silenzioso) return;
    else if (!j.inviati) toast((fam?.membri?.length || 0) < 2 ? 'Invita qualcuno da 👪 per condividere il frigo' : 'Nessun altro dispositivo ha le notifiche attive');
    else toast(`Notifica inviata a ${j.inviati} dispositiv${j.inviati > 1 ? 'i' : 'o'}`);
  } catch (e) { if (!silenzioso) toast('Postino non raggiungibile: ' + e.message); }
}
// aprendo l'app pulisco la tendina
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !navigator.serviceWorker) return;
  const reg = await navigator.serviceWorker.getRegistration();
  (await reg?.getNotifications() || []).forEach(n => n.close());
});
// tocco su una notifica con l'app già aperta: il service worker mi dice quale voce aprire
navigator.serviceWorker?.addEventListener('message', e => {
  const m = /voce=([^/&]+)\/([^&]+)/.exec(e.data?.url || '');
  if (!m) return;
  const [, f, v] = m;
  if (f === famId && tutte.some(x => x.id === v)) apriDettaglio(v);
  else if ((profilo.famiglie || []).includes(f)) { apriDopo = { fam: f, id: v }; collegaFamiglia(f); }
});

/* ---------- stato collegamento ---------- */
let syncMsg = 'In collegamento…';
function statoSync(cls, msg) { $('sync').className = 'sync ' + cls; syncMsg = msg; }
$('sync').onclick = () => toast(syncMsg);
// tocco sulla versione: notifica di prova locale
$('ver').onclick = async () => {
  if (!notificheOk()) { toast('Prima attiva le notifiche con la campanella'); return; }
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('Prova di Rigordati!!', { body: 'Se mi vedi nella tendina, Android è a posto', tag: 'prova', icon: 'icon-192.png', badge: 'badge-96.png' });
  toast('Notifica di prova creata');
};

/* ---------- trascina giù per aggiornare: la busta con i "!!" ---------- */
(() => {
  const m = document.querySelector('main'), t = $('tira'); let y0 = null, dy = 0;
  m.addEventListener('touchstart', e => { y0 = m.scrollTop <= 0 && !foglioAperto ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  m.addEventListener('touchmove', e => {
    if (y0 === null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    const k = Math.min(dy, 120);
    t.style.transform = `translateY(${k - 60}px) scale(${0.6 + k / 300})`; t.style.opacity = Math.min(1, k / 80);
  }, { passive: true });
  m.addEventListener('touchend', async () => {
    if (y0 === null) return; y0 = null;
    if (dy < 90) { t.style.transform = ''; t.style.opacity = 0; return; }
    t.classList.add('batte');
    try { const r = await navigator.serviceWorker?.getRegistration(); await r?.update(); } catch (_) {}
    setTimeout(() => location.reload(), 700);
  });
})();

/* ---------- extra ---------- */
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 2600); }
function coriandoli(x, y) {
  const col = ['#FF6B5B', '#3FAF6A', '#E9548A', '#E2B400', '#24304A'];
  for (let i = 0; i < 18; i++) {
    const c = document.createElement('i'); c.className = 'coriandolo';
    c.style.left = x + 'px'; c.style.top = y + 'px'; c.style.background = col[i % col.length];
    c.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px'); c.style.setProperty('--dy', (Math.random() * -140 - 20) + 'px');
    document.body.appendChild(c); setTimeout(() => c.remove(), 1000);
  }
}

/* ---------- installazione ---------- */
let invitoInstalla = null;
const installata = () => matchMedia('(display-mode: standalone)').matches || document.referrer.startsWith('android-app://');
if (!installata()) $('btnScarica').hidden = false;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); invitoInstalla = e; });
$('btnScarica').onclick = async () => {
  if (invitoInstalla) { invitoInstalla.prompt(); const r = await invitoInstalla.userChoice; if (r.outcome === 'accepted') $('btnScarica').hidden = true; invitoInstalla = null; }
  else toast('Apri il menu ⋮ di Chrome e scegli "Aggiungi a schermata Home"');
};
window.addEventListener('appinstalled', () => $('btnScarica').hidden = true);
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
  let ricaricato = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!ricaricato) { ricaricato = true; location.reload(); } });
}
