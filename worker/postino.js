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

import { prossimoAvviso, prossimaData, dataNelFuso } from '../js/ricorrenze.js';
import { bella } from '../js/date.js';

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

export function decodifica(v) {
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
