// Rigordati!! postino v0.3.0 — FILE GENERATO da scripts/costruisci-worker.mjs, non modificarlo a mano.

// ===== js/date.js =====
// Date "di calendario" come stringhe AAAA-MM-GG, sempre nell'ora locale del telefono.
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daIso = s => { const [y, m, g] = s.split('-').map(Number); return new Date(y, m - 1, g); };
const oggi = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const GIORNI = ['domenica','lunedi','martedi','mercoledi','giovedi','venerdi','sabato'];
const GIORNI_BELLI = ['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
const bella = s => { const d = daIso(s); return `${GIORNI_BELLI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`; };

// ===== js/ricorrenze.js =====
// Ricorrenze e promemoria. Modulo puro (niente DOM, niente Firebase):
// lo usano sia l'app sia il Worker Cloudflare, e i test.
//
// Una voce ha:  data 'AAAA-MM-GG', ora 'HH:MM' o '', ripeti '' | 'giorno' | 'settimana' | 'mese' | 'anno',
//               anticipo (minuti prima dell'impegno, -1 = nessun promemoria), fuso (es. 'Europe/Rome').

const RIPETI = ['', 'giorno', 'settimana', 'mese', 'anno'];
const ANTICIPO_PREDEFINITO = 60;

const parti = s => s.split('-').map(Number);
const dueCifre = n => String(n).padStart(2, '0');
const isoUtc = t => { const d = new Date(t); return `${d.getUTCFullYear()}-${dueCifre(d.getUTCMonth() + 1)}-${dueCifre(d.getUTCDate())}`; };
const msUtc = s => { const [y, m, g] = parti(s); return Date.UTC(y, m - 1, g); };

const aggiungiGiorni = (s, n) => isoUtc(msUtc(s) + n * 864e5);
const giornoSettimana = s => new Date(msUtc(s)).getUTCDay();

/** La voce cade nel giorno `d` (AAAA-MM-GG)? */
function occorreIl(v, d) {
  if (!v.data) return false;
  if (!v.ripeti) return v.data === d;
  if (d < v.data) return false;
  const [, m0, g0] = parti(v.data), [, m, g] = parti(d);
  switch (v.ripeti) {
    case 'giorno': return true;
    case 'settimana': return giornoSettimana(d) === giornoSettimana(v.data);
    case 'mese': return g === g0;
    case 'anno': return g === g0 && m === m0;
    default: return false;
  }
}

/** Prima data in cui cade la voce, a partire da `da` compreso. null se non ce ne sono. */
function prossimaData(v, da) {
  if (!v.data) return null;
  if (!v.ripeti) return v.data >= da ? v.data : null;
  let d = da < v.data ? v.data : da;
  // Il caso peggiore è il 29 febbraio annuale: al massimo 8 anni.
  for (let i = 0; i < 366 * 8 + 2; i++, d = aggiungiGiorni(d, 1)) if (occorreIl(v, d)) return d;
  return null;
}

/** Differenza (ms) tra l'ora locale del fuso e UTC in un dato istante. */
function scarto(t, fuso) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric'
  }).formatToParts(new Date(t));
  const x = k => +p.find(q => q.type === k).value;
  return Date.UTC(x('year'), x('month') - 1, x('day'), x('hour'), x('minute'), x('second')) - Math.floor(t / 1000) * 1000;
}

/** Istante (ms) corrispondente a un'ora "da orologio da muro" in un fuso. Gestisce l'ora legale. */
function istante(dataIso, ora, fuso) {
  const [y, m, g] = parti(dataIso);
  const [h, mi] = (ora || '00:00').split(':').map(Number);
  const muro = Date.UTC(y, m - 1, g, h, mi);
  let t = muro;
  for (let i = 0; i < 3; i++) t = muro - scarto(t, fuso);
  return t;
}

/** Data AAAA-MM-GG di un istante, vista nel fuso dato. */
function dataNelFuso(t, fuso) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: fuso, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(t));
  const x = k => +p.find(q => q.type === k).value;
  return `${x('year')}-${dueCifre(x('month'))}-${dueCifre(x('day'))}`;
}

/** Momento del promemoria per un'occorrenza. Senza ora: alle 8:00 (del giorno, o del giorno prima). */
function momentoAvviso(dataIso, ora, anticipo, fuso) {
  let a = anticipo ?? ANTICIPO_PREDEFINITO;
  if (a < 0) return null;
  if (!ora) a = a >= 1440 ? 1440 : 0;
  return istante(dataIso, ora || '08:00', fuso) - a * 60000;
}

/** Prossimo promemoria (ms) strettamente dopo `adesso`, o null. */
function prossimoAvviso(v, adesso, fusoPredefinito = 'Europe/Rome') {
  if (v.tipo !== 'impegno' || !v.data || (v.anticipo ?? 0) < 0) return null;
  const fuso = v.fuso || fusoPredefinito;
  let d = dataNelFuso(adesso, fuso);
  for (let i = 0; i < 5; i++) {
    const occ = prossimaData(v, d);
    if (!occ) return null;
    const t = momentoAvviso(occ, v.ora, v.anticipo, fuso);
    if (t > adesso) return t;
    d = aggiungiGiorni(occ, 1);
  }
  return null;
}

// ===== worker/postino.js =====
// Il "postino" di Rigordati!!: Cloudflare Worker che spedisce le notifiche push.
//  - POST  dall'app: "ho scritto/risposto/modificato la voce X della famiglia F, avvisa gli altri"
//  - cron  ogni minuto: promemoria degli impegni in scadenza (anche ricorrenti)
//
// Sorgente. Il file da incollare su Cloudflare è cloudflare-worker.js, generato con `npm run worker`.
//
// Segreti richiesti su Cloudflare (tipo Secret):
//   SA_JSON   contenuto del file JSON dell'account di servizio Firebase
//   API_KEY   apiKey di firebaseConfig (serve a verificare chi scrive)
// Variabile facoltativa:
//   ORIGINE   indirizzi da cui accettare richieste, separati da virgola (predefinito https://wolve666.github.io)


const STANTIO = 6 * 3600e3; // promemoria più vecchi di così (Worker fermo) non vengono più spediti

export default {
  async fetch(req, env) {
    const cors = intestazioniCors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: cors ? 204 : 403, headers: cors || {} });
    if (req.method === 'GET') return json({ ok: true, servizio: 'postino di Rigordati!!' }, 200, cors);
    if (!cors) return json({ ok: false, errore: 'origine non ammessa' }, 403);
    try {
      return json(await consegna(await req.json(), env), 200, cors);
    } catch (e) {
      return json({ ok: false, errore: e.message || String(e) }, e.stato || 500, cors);
    }
  },
  async scheduled(_evento, env, ctx) {
    ctx.waitUntil(sveglia(env));
  }
};

/* ---------- POST dall'app ---------- */

async function consegna({ idToken, famiglia, id, evento, mioToken }, env) {
  if (!famiglia) throw errore(400, 'app da aggiornare (manca la famiglia)');
  if (!idToken || !id) throw errore(400, 'richiesta incompleta');
  const utente = await verificaUtente(idToken, env);
  const g = await google(env);

  const fam = await g.leggi(`famiglie/${famiglia}`);
  if (!fam || !(fam.membri || []).includes(utente.uid)) throw errore(403, 'non fai parte di questa famiglia');
  const voce = await g.leggi(`famiglie/${famiglia}/voci/${id}`);
  if (!voce) throw errore(404, 'voce non trovata');

  const nome = fam.nomi?.[utente.uid] || voce.autoreNome || 'Qualcuno';
  const quando = descriviQuando(voce, voce.data);
  let titolo, corpo = voce.testo + (quando ? ` · ${quando}` : '');
  if (evento === 'risposta') {
    const r = (voce.risposte || []).at(-1);
    titolo = `💬 ${r?.nome || nome} ha risposto`;
    corpo = `${voce.testo} → ${r?.testo ?? ''}`;
  } else if (evento === 'modifica') {
    titolo = `✏️ ${nome} ha modificato`;
  } else {
    titolo = { impegno: `📅 ${nome}: nuovo impegno`, domanda: `💬 ${nome} chiede`, todo: voce.lista === 'spesa' ? `🛒 ${nome}: da comprare` : `✅ ${nome}: da fare` }[voce.tipo] || `📌 ${nome}`;
  }
  const soloPer = evento === 'risposta' ? null : voce.perChi;
  const inviati = await spedisciAllaFamiglia(g, famiglia, fam.membri, { titolo, corpo, tag: `voce-${id}`, url: `./?voce=${famiglia}/${id}` }, { escludi: mioToken, soloPer });
  return { ok: true, inviati };
}

/* ---------- cron: promemoria ---------- */

async function sveglia(env) {
  const g = await google(env);
  const adesso = Date.now();
  const scadute = await g.cerca(null, {
    from: [{ collectionId: 'voci', allDescendants: true }],
    where: { fieldFilter: { field: { fieldPath: 'avvisoAt' }, op: 'LESS_THAN_OR_EQUAL', value: { integerValue: String(adesso) } } },
    limit: 100
  });
  const famiglie = {}; // famiglia -> membri, letta una volta per giro
  for (const { percorso, dati: v } of scadute) {
    const pezzi = percorso.split('/');            // famiglie/{fid}/voci/{id}
    if (pezzi[0] !== 'famiglie') continue;      // vecchia collezione: ignorata
    const famiglia = pezzi[1], id = pezzi[3];
    famiglie[famiglia] ??= (await g.leggi(`famiglie/${famiglia}`))?.membri || [];
    if (adesso - v.avvisoAt < STANTIO) {
      const fuso = v.fuso || 'Europe/Rome';
      const occ = prossimaData(v, dataNelFuso(v.avvisoAt, fuso)) || v.data;
      await spedisciAllaFamiglia(g, famiglia, famiglie[famiglia],
        { titolo: `⏰ ${v.testo}`, corpo: descriviQuando(v, occ), tag: `avviso-${id}`, url: `./?voce=${famiglia}/${id}` },
        { soloPer: v.perChi });
    }
    const prossimo = prossimoAvviso(v, adesso);
    await g.aggiorna(percorso, prossimo ? { avvisoAt: { integerValue: String(prossimo) } } : {}, ['avvisoAt']);
  }
}

/* ---------- spedizione ---------- */

// Solo i telefoni di chi è ancora membro: chi esce dalla famiglia smette subito di ricevere.
async function spedisciAllaFamiglia(g, famiglia, membri, messaggio, { escludi, soloPer } = {}) {
  const dispositivi = await g.cerca(null, {
    from: [{ collectionId: 'dispositivi' }],
    where: { fieldFilter: { field: { fieldPath: 'famiglie' }, op: 'ARRAY_CONTAINS', value: { stringValue: famiglia } } }
  });
  let inviati = 0;
  for (const { percorso, dati: d } of dispositivi) {
    if (!d.token || d.token === escludi || !membri.includes(d.uid)) continue;
    if (soloPer?.length && !soloPer.includes(d.uid)) continue;
    const esito = await g.push(d.token, messaggio);
    if (esito === 'ok') inviati++;
    else if (esito === 'sparito') await g.elimina(percorso); // app disinstallata o notifiche revocate
  }
  return inviati;
}

function descriviQuando(v, data) {
  if (!data) return v.ora ? `alle ${v.ora}` : '';
  return bella(data) + (v.ora ? ` alle ${v.ora}` : '');
}

/* ---------- accesso a Google ---------- */

async function verificaUtente(idToken, env) {
  if (!env.API_KEY) throw errore(500, 'accesso non verificato (manca API_KEY)');
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken })
  });
  const u = (await r.json()).users?.[0];
  if (!r.ok || !u) throw errore(401, 'accesso non verificato');
  return { uid: u.localId, email: u.email };
}

let gettone = null; // { valore, scade }

async function google(env) {
  const sa = JSON.parse(env.SA_JSON || 'null');
  if (!sa) throw errore(500, 'manca il segreto SA_JSON');
  if (!gettone || gettone.scade < Date.now() + 60e3) gettone = await chiediGettone(sa);
  const auth = { Authorization: `Bearer ${gettone.valore}`, 'Content-Type': 'application/json' };
  const radice = `projects/${sa.project_id}/databases/(default)/documents`;
  const api = `https://firestore.googleapis.com/v1/${radice}`;
  const relativo = nome => nome.slice(nome.indexOf('/documents/') + 11);

  return {
    async leggi(percorso) {
      const r = await fetch(`${api}/${percorso}`, { headers: auth });
      if (r.status === 404) return null;
      if (!r.ok) throw errore(502, `Firestore ${r.status}`);
      return decodifica({ mapValue: { fields: (await r.json()).fields || {} } });
    },
    async cerca(genitore, structuredQuery) {
      const r = await fetch(`${api}${genitore ? '/' + genitore : ''}:runQuery`, { method: 'POST', headers: auth, body: JSON.stringify({ structuredQuery }) });
      if (!r.ok) throw errore(502, `Firestore query ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return (await r.json()).filter(x => x.document).map(x => ({
        percorso: relativo(x.document.name), dati: decodifica({ mapValue: { fields: x.document.fields || {} } })
      }));
    },
    async aggiorna(percorso, campi, maschera) {
      const r = await fetch(`https://firestore.googleapis.com/v1/${radice}:commit`, {
        method: 'POST', headers: auth,
        body: JSON.stringify({ writes: [{ update: { name: `${radice}/${percorso}`, fields: campi }, updateMask: { fieldPaths: maschera }, currentDocument: { exists: true } }] })
      });
      if (!r.ok && r.status !== 404) throw errore(502, `Firestore commit ${r.status}`);
    },
    async elimina(percorso) {
      await fetch(`${api}/${percorso}`, { method: 'DELETE', headers: auth });
    },
    async push(token, { titolo, corpo, tag, url }) {
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: 'POST', headers: auth,
        body: JSON.stringify({ message: { token, data: { titolo, corpo, tag, url: url || './' }, webpush: { headers: { Urgency: 'high', TTL: '86400' } } } })
      });
      if (r.ok) return 'ok';
      const testo = await r.text();
      return r.status === 404 || /UNREGISTERED|registration-token-not-registered/.test(testo) ? 'sparito' : 'errore';
    }
  };
}

async function chiediGettone(sa) {
  const ora = Math.floor(Date.now() / 1000);
  const b64 = x => btoa(typeof x === 'string' ? x : String.fromCharCode(...new Uint8Array(x))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const testa = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corpo = b64(JSON.stringify({
    iss: sa.client_email, aud: 'https://oauth2.googleapis.com/token', iat: ora, exp: ora + 3600,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging'
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const chiave = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const firma = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chiave, new TextEncoder().encode(`${testa}.${corpo}`));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${testa}.${corpo}.${b64(firma)}`
  });
  const j = await r.json();
  if (!j.access_token) throw errore(500, 'account di servizio non valido');
  return { valore: j.access_token, scade: Date.now() + (j.expires_in || 3600) * 1000 };
}

/* ---------- utilità ---------- */

function decodifica(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodifica);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, decodifica(x)]));
  return null;
}

function intestazioniCors(req, env) {
  const origine = req.headers.get('Origin') || '';
  const ammesse = (env.ORIGINE || 'https://wolve666.github.io').split(',').map(s => s.trim());
  if (!ammesse.includes(origine)) return null;
  return { 'Access-Control-Allow-Origin': origine, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' };
}
const json = (dati, stato = 200, extra = {}) => new Response(JSON.stringify(dati), { status: stato, headers: { 'Content-Type': 'application/json', ...extra } });
const errore = (stato, messaggio) => Object.assign(new Error(messaggio), { stato });
