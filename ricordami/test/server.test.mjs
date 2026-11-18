// Server RicordaMi con SQLite in memoria: gli stessi controlli valgono su Cloudflare D1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creaApp } from '../server/app.js';
import { apriDb } from '../server/sqlite-node.js';

let ora = Date.parse('2026-11-18T09:00:00Z');
const app = creaApp(apriDb(), { adesso: () => ora });
const chiama = async (metodo, percorso, corpo, token) => {
  const r = await app(new Request('http://x' + percorso, { method: metodo, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined }));
  return { stato: r.status, ...(await r.json()) };
};

const anna = await chiama('POST', '/v1/utenti', { nome: 'Anna' });
const bruno = await chiama('POST', '/v1/utenti', { nome: 'Bruno' });
const zeta = await chiama('POST', '/v1/utenti', { nome: 'Zeta' });
let fam, codice;

test('account: nome obbligatorio, accesso solo con il token giusto', async () => {
  assert.equal(anna.stato, 201); assert.match(anna.token, /^[0-9a-f]{64}$/);
  assert.equal((await chiama('POST', '/v1/utenti', { nome: '  ' })).stato, 400);
  assert.equal((await chiama('GET', '/v1/io')).stato, 401);
  assert.equal((await chiama('GET', '/v1/io', null, 'falso')).stato, 401);
  assert.equal((await chiama('GET', '/v1/io', null, anna.token)).nome, 'Anna');
});

test('famiglia: crea, invita, entra con il codice', async () => {
  fam = await chiama('POST', '/v1/gruppi', { nome: 'Casa Rossi' }, anna.token);
  assert.equal(fam.stato, 201); assert.deepEqual(fam.membri.map(m => m.nome), ['Anna']);
  const inv = await chiama('POST', `/v1/gruppi/${fam.id}/inviti`, null, anna.token);
  codice = inv.codice; assert.match(codice, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.equal((await chiama('POST', `/v1/gruppi/${fam.id}/inviti`, null, zeta.token)).stato, 403, 'solo i membri invitano');
  assert.equal((await chiama('GET', `/v1/inviti/${codice}`, null, bruno.token)).gruppo.nome, 'Casa Rossi');
  const dentro = await chiama('POST', `/v1/inviti/${codice}`, null, bruno.token);
  assert.deepEqual(dentro.membri.map(m => m.nome), ['Anna', 'Bruno']);
  assert.notEqual(dentro.membri[0].colore, dentro.membri[1].colore);
  assert.equal((await chiama('POST', '/v1/inviti/ZZZZZZZZ', null, zeta.token)).stato, 404);
});

test('codice scaduto dopo 7 giorni', async () => {
  const inv = await chiama('POST', `/v1/gruppi/${fam.id}/inviti`, null, anna.token);
  ora += 8 * 864e5;
  assert.equal((await chiama('POST', `/v1/inviti/${inv.codice}`, null, zeta.token)).stato, 410);
  ora -= 8 * 864e5;
});

test('domanda per Bruno, risposta, eventi e sincronizzazione', async () => {
  const d = await chiama('PUT', '/v1/voci/d1', { gruppo: fam.id, dati: { titolo: 'Venerdì posso andare a Magic?', tipo: 'domanda', data: '2026-11-20', perChi: [bruno.utente.id] } }, anna.token);
  assert.equal(d.stato, 200);
  assert.equal((await chiama('PUT', '/v1/voci/x1', { gruppo: fam.id, dati: { titolo: 'intruso' } }, zeta.token)).stato, 403);

  const s = await chiama('GET', '/v1/sinc?dopo=0', null, bruno.token);
  assert.equal(s.voci.length, 1);
  assert.equal(s.voci[0].dati.autore.nome, 'Anna');
  const e = s.eventi.find(x => x.tipo === 'domanda');
  assert.deepEqual(e.per, [bruno.utente.id]); assert.equal(e.da, anna.utente.id);

  const r = await chiama('POST', '/v1/voci/d1/risposte', { testo: 'Sì' }, bruno.token);
  assert.deepEqual(r.dati.risposte.map(x => `${x.nome}: ${x.testo}`), ['Bruno: Sì']);
  const s2 = await chiama('GET', `/v1/sinc?dopo=${s.cursore}`, null, anna.token);
  assert.deepEqual(s2.voci.map(v => v.id), ['d1']);
  assert.deepEqual(s2.eventi.map(x => x.tipo), ['risposta']);
  assert.ok(s2.cursore > s.cursore);
  assert.equal((await chiama('GET', `/v1/sinc?dopo=${s2.cursore}`, null, anna.token)).voci.length, 0, 'niente di nuovo');
  assert.equal((await chiama('GET', '/v1/sinc?dopo=0', null, zeta.token)).voci.length, 0, 'gli estranei non vedono nulla');
});

test('una modifica non cancella le risposte arrivate nel frattempo', async () => {
  await chiama('PUT', '/v1/voci/d1', { gruppo: fam.id, dati: { titolo: 'Venerdì posso andare a Magic?', tipo: 'domanda', data: '2026-11-21', risposte: [] } }, anna.token);
  const s = await chiama('GET', '/v1/sinc?dopo=0', null, anna.token);
  assert.equal(s.voci.find(v => v.id === 'd1').dati.risposte.length, 1);
});

test('fatto: avvisa solo chi l\'aveva scritto; modifica: avvisa tutti', async () => {
  await chiama('PUT', '/v1/voci/p1', { gruppo: fam.id, dati: { titolo: 'Comprare il latte', lista: 'spesa' } }, anna.token);
  const p = { seq: (await chiama('GET', '/v1/sinc?dopo=0', null, anna.token)).cursore };
  await chiama('PUT', '/v1/voci/p1', { gruppo: fam.id, dati: { titolo: 'Comprare il latte', lista: 'spesa', fatto: true } }, bruno.token);
  await chiama('PUT', '/v1/voci/p1', { gruppo: fam.id, dati: { titolo: 'Comprare il latte e il pane', lista: 'spesa', fatto: true } }, bruno.token);
  const ev = (await chiama('GET', `/v1/sinc?dopo=${p.seq}`, null, anna.token)).eventi;
  assert.deepEqual(ev.map(e => [e.tipo, e.per]), [['fatto', [anna.utente.id]], ['modifica', []]]);
});

test('uscire dalla famiglia: niente più accesso', async () => {
  await chiama('POST', `/v1/gruppi/${fam.id}/esci`, null, bruno.token);
  assert.equal((await chiama('GET', '/v1/sinc?dopo=0', null, bruno.token)).gruppi.length, 0);
  assert.equal((await chiama('POST', '/v1/voci/d1/risposte', { testo: 'No' }, bruno.token)).stato, 403);
});
