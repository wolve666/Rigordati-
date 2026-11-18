import { test } from 'node:test';
import assert from 'node:assert/strict';
import { controlla, testoAvviso, bollino } from '../js/pianificatore.js';

const cfg = { fuso: 'Europe/Rome', oraGiornata: '09:00', riepilogoMattina: '08:00', riepilogoSera: '', insistiVolte: 6 };
const finto = (lista, extra = {}) => {
  const meta = {};
  return { promemoria: async () => lista, impostazioni: async () => ({ ...cfg, ...extra }), leggiMeta: async k => meta[k], scriviMeta: async (k, v) => { meta[k] = v; } };
};
const T = s => Date.parse(s);

test('mostra l\'avviso una volta sola e calcola il prossimo', async () => {
  const a = finto([{ id: 'x', titolo: 'Dentista', data: '2026-12-01', ora: '16:00', avvisi: [60, 0] }]);
  const visti = [];
  const r1 = await controlla(a, n => visti.push(n), T('2026-12-01T14:00:30Z'));
  assert.equal(visti.length, 1);
  assert.equal(visti[0].titolo, 'Dentista');
  assert.equal(visti[0].corpo, 'Tra un\'ora alle 16:00');
  assert.equal(new Date(r1.prossimo).toISOString(), '2026-12-01T15:00:00.000Z');
  await controlla(a, n => visti.push(n), T('2026-12-01T14:01:00Z'));
  assert.equal(visti.length, 1, 'niente doppioni');
});

test('dopo una pausa lunga: un solo avviso per promemoria', async () => {
  const a = finto([{ id: 'y', titolo: 'Pastiglia', data: '2026-12-01', ora: '10:00', avvisi: [30, 10, 0], insisti: 10 }]);
  const visti = [];
  await a.scriviMeta('ultimoControllo', T('2026-12-01T08:00:00Z'));
  await controlla(a, n => visti.push(n), T('2026-12-01T09:35:00Z'));
  assert.equal(visti.length, 1);
  assert.match(visti[0].corpo, /Non è ancora fatto/);
});

test('riepilogo del mattino con le cose di oggi', async () => {
  const a = finto([
    { id: 'a', titolo: 'Palestra', data: '2026-12-01', ora: '18:00', avvisi: [] },
    { id: 'b', titolo: 'Bolletta', data: '2026-12-01', avvisi: [] }
  ]);
  const visti = [];
  await a.scriviMeta('ultimoControllo', T('2026-12-01T06:50:00Z'));
  await controlla(a, n => visti.push(n), T('2026-12-01T07:00:30Z'));
  assert.equal(visti.length, 1);
  assert.equal(visti[0].titolo, 'Buongiorno! Oggi hai 2 cose');
  assert.match(visti[0].corpo, /Bolletta · 18:00 Palestra/);
});

test('testi degli avvisi', () => {
  const p = { titolo: 'Consegna', ora: '', priorita: 2 };
  assert.deepEqual(testoAvviso({ p, tipo: 'avviso', minuti: 2880 }), { titolo: '‼️ Consegna', corpo: 'Tra 2 giorni' });
});

test('bollino: ritardi + cose di oggi', () => {
  const l = [
    { id: '1', data: '2026-11-30', ora: '10:00' },
    { id: '2', data: '2026-12-01', ora: '20:00' },
    { id: '3', data: '2026-12-01', ora: '07:00', fatto: true },
    { id: '4', data: '2026-12-02', ora: '10:00' }
  ];
  assert.equal(bollino(l, cfg, T('2026-12-01T12:00Z')), 2);
});

test('primo controllo in assoluto: non recupera riepiloghi e avvisi vecchi', async () => {
  const a = finto([{ id: 'v', titolo: 'Vecchio', data: '2026-12-01', ora: '06:00', avvisi: [0] }]);
  const visti = [];
  await controlla(a, n => visti.push(n), T('2026-12-01T09:30:00Z'));
  assert.equal(visti.length, 0);
});
