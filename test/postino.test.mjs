// Prova il Worker generato (worker/cloudflare-worker.js) contro un Firebase finto.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import worker from '../worker/cloudflare-worker.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = {
  API_KEY: 'chiave', ORIGINE: 'https://wolve666.github.io',
  SA_JSON: JSON.stringify({ project_id: 'prova', client_email: 'sa@prova', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) })
};
const ORIGINE = { Origin: 'https://wolve666.github.io' };

// --- Firestore finto -------------------------------------------------------
let docs, inviati, commit, eliminati;
const codifica = v => typeof v === 'string' ? { stringValue: v } : typeof v === 'number' ? { integerValue: String(v) }
  : typeof v === 'boolean' ? { booleanValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(codifica) } }
  : v && typeof v === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, codifica(x)])) } } : { nullValue: null };
const RADICE = 'projects/prova/databases/(default)/documents';
const risposta = (dati, stato = 200) => new Response(JSON.stringify(dati), { status: stato });

globalThis.fetch = async (url, opz = {}) => {
  url = String(url);
  const corpo = opz.body && typeof opz.body === 'string' && opz.body.startsWith('{') ? JSON.parse(opz.body) : null;
  if (url.includes('identitytoolkit')) return corpo.idToken === 'buono' ? risposta({ users: [{ localId: 'u1', email: 'a@x' }] }) : risposta({}, 400);
  if (url.includes('oauth2')) return risposta({ access_token: 'tok', expires_in: 3600 });
  if (url.includes('fcm.googleapis')) {
    const t = corpo.message.token;
    if (t === 'morto') return risposta({ error: { details: [{ errorCode: 'UNREGISTERED' }] } }, 404);
    inviati.push({ token: t, ...corpo.message.data }); return risposta({});
  }
  if (url.endsWith(':runQuery')) {
    const q = corpo.structuredQuery, f = q.where.fieldFilter;
    const voglio = q.from[0].collectionId;
    const out = Object.entries(docs).filter(([p, d]) => {
      const pezzi = p.split('/'); if (pezzi.at(-2) !== voglio) return false;
      if (!q.from[0].allDescendants && pezzi.length !== 2) return false;
      const v = d[f.field.fieldPath];
      if (f.op === 'ARRAY_CONTAINS') return (v || []).includes(f.value.stringValue);
      if (f.op === 'LESS_THAN_OR_EQUAL') return typeof v === 'number' && v <= +f.value.integerValue;
    }).map(([p, d]) => ({ document: { name: `${RADICE}/${p}`, fields: codifica(d).mapValue.fields } }));
    return risposta(out.length ? out : [{ readTime: 'x' }]);
  }
  if (url.endsWith(':commit')) { commit.push(corpo.writes[0]); const w = corpo.writes[0]; const p = w.update.name.replace(RADICE + '/', '');
    if ('avvisoAt' in w.update.fields) docs[p].avvisoAt = +w.update.fields.avvisoAt.integerValue; else delete docs[p].avvisoAt; return risposta({}); }
  const p = url.split('/documents/')[1];
  if (opz.method === 'DELETE') { eliminati.push(p); delete docs[p]; return risposta({}); }
  return docs[p] ? risposta({ fields: codifica(docs[p]).mapValue.fields }) : risposta({}, 404);
};

beforeEach(() => {
  inviati = []; commit = []; eliminati = [];
  docs = {
    'famiglie/F': { nome: 'Casa', membri: ['u1', 'u2', 'u3'], nomi: { u1: 'Anna', u2: 'Bruno', u3: 'Carla' } },
    'famiglie/F/voci/V': { tipo: 'impegno', testo: 'dentista', data: '2026-12-02', ora: '16:00', autoreNome: 'Anna', perChi: [] },
    'famiglie/F/voci/P': { tipo: 'todo', testo: 'latte', lista: 'spesa', autoreNome: 'Anna', perChi: ['u2'] },
    'famiglie/G/voci/X': { tipo: 'impegno', testo: 'altra famiglia', data: '2026-12-02' },
    'dispositivi/t1': { token: 't1', uid: 'u1', famiglie: ['F'] },
    'dispositivi/t2': { token: 't2', uid: 'u2', famiglie: ['F'] },
    'dispositivi/t3': { token: 't3', uid: 'u3', famiglie: ['F', 'G'] },
    'dispositivi/morto': { token: 'morto', uid: 'u3', famiglie: ['F'] },
    'dispositivi/estraneo': { token: 'estraneo', uid: 'u9', famiglie: ['G'] }
  };
});

const chiama = (corpo, intest = ORIGINE) => worker.fetch(new Request('https://w/', { method: 'POST', headers: intest, body: JSON.stringify(corpo) }), env).then(async r => ({ stato: r.status, ...(await r.json()) }));

test('nuova voce: avvisa la famiglia tranne il mio dispositivo, pulisce i token morti', async () => {
  const r = await chiama({ idToken: 'buono', famiglia: 'F', id: 'V', evento: 'nuova', mioToken: 't1' });
  assert.equal(r.ok, true);
  assert.deepEqual(inviati.map(x => x.token).sort(), ['t2', 't3']);
  assert.equal(r.inviati, 2);
  assert.match(inviati[0].titolo, /Anna: nuovo impegno/);
  assert.match(inviati[0].corpo, /dentista · mercoledì 2 dicembre alle 16:00/);
  assert.equal(inviati[0].url, './?voce=F/V');
  assert.deepEqual(eliminati, ['dispositivi/morto']);
});

test('voce "per chi": solo i dispositivi di quella persona', async () => {
  await chiama({ idToken: 'buono', famiglia: 'F', id: 'P', evento: 'nuova', mioToken: 't1' });
  assert.deepEqual(inviati.map(x => x.token), ['t2']);
  assert.match(inviati[0].titolo, /da comprare/);
});

test('rifiuta chi non è della famiglia, token falsi e origini estranee', async () => {
  assert.equal((await chiama({ idToken: 'buono', famiglia: 'G', id: 'X', evento: 'nuova' })).stato, 403);
  assert.equal((await chiama({ idToken: 'falso', famiglia: 'F', id: 'V', evento: 'nuova' })).stato, 401);
  assert.equal((await chiama({ idToken: 'buono', famiglia: 'F', id: 'V' }, { Origin: 'https://cattivo.example' })).stato, 403);
  assert.equal((await chiama({ idToken: 'buono', id: 'V', evento: 'nuova' })).stato, 400);
  assert.equal(inviati.length, 0);
});

test('cron: spedisce il promemoria e fissa il successivo di un impegno settimanale', async () => {
  const ora = Date.now();
  docs['famiglie/F/voci/V'] = { tipo: 'impegno', testo: 'piscina', data: '2026-01-05', ora: '17:00', ripeti: 'settimana', fuso: 'Europe/Rome', avvisoAt: ora - 1000 };
  docs['famiglie/F/voci/W'] = { tipo: 'impegno', testo: 'una volta', data: '2026-01-05', avvisoAt: ora - 2000 };
  docs['voci/vecchia'] = { tipo: 'impegno', testo: 'legacy', data: '2026-01-05', avvisoAt: ora - 1000 };
  const attese = [];
  await worker.scheduled({}, env, { waitUntil: p => attese.push(p) });
  await Promise.all(attese);
  const titoli = inviati.map(x => x.titolo);
  assert.equal(titoli.filter(t => t === '⏰ piscina').length, 3); // t1 t2 t3; 'morto' viene rimosso
  assert.equal(titoli.filter(t => t === '⏰ una volta').length, 3);
  assert.ok(!titoli.includes('⏰ legacy'));
  assert.ok(docs['famiglie/F/voci/V'].avvisoAt > ora, 'ricorrente: promemoria spostato avanti');
  assert.equal(new Date(docs['famiglie/F/voci/V'].avvisoAt).getUTCDay(), 1, 'sempre di lunedì');
  assert.equal(docs['famiglie/F/voci/W'].avvisoAt, undefined, 'singolo: promemoria cancellato');
});

test('chi è uscito dalla famiglia non riceve più nulla', async () => {
  docs['famiglie/F'].membri = ['u1', 'u2']; // u3 è uscito, il suo telefono ha ancora F in elenco
  await chiama({ idToken: 'buono', famiglia: 'F', id: 'V', evento: 'nuova', mioToken: 't1' });
  assert.deepEqual(inviati.map(x => x.token), ['t2']);
});
