import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occorreIl, prossimaData, dateTra, avvisiTra, prossimoAvviso, agenda, inRitardo, scadenza } from '../js/nucleo/ricorrenze.js';

const cfg = { fuso: 'Europe/Rome', oraGiornata: '09:00' };
const T = s => Date.parse(s);
const ore = l => l.map(a => new Date(a.quando).toISOString().slice(0, 16));

test('settimanale su più giorni e ogni 2 settimane', () => {
  const p = { data: '2026-11-16', ripeti: { ogni: 'settimana', giorni: [1, 4] } };
  assert.deepEqual(dateTra(p, '2026-11-16', '2026-11-29'), ['2026-11-16', '2026-11-19', '2026-11-23', '2026-11-26']);
  const q = { data: '2026-11-16', ripeti: { ogni: 'settimana', ogniN: 2 } };
  assert.deepEqual(dateTra(q, '2026-11-16', '2026-12-14'), ['2026-11-16', '2026-11-30', '2026-12-14']);
});

test('ogni 3 giorni, ogni 3 mesi, fino a', () => {
  assert.ok(occorreIl({ data: '2026-11-01', ripeti: { ogni: 'giorno', ogniN: 3 } }, '2026-11-07'));
  assert.ok(!occorreIl({ data: '2026-11-01', ripeti: { ogni: 'giorno', ogniN: 3 } }, '2026-11-08'));
  assert.equal(prossimaData({ data: '2026-01-15', ripeti: { ogni: 'mese', ogniN: 3 } }, '2026-05-01'), '2026-07-15');
  assert.equal(prossimaData({ data: '2026-11-01', ripeti: { ogni: 'giorno', fino: '2026-11-05' } }, '2026-11-06'), null);
});

test('avvisi multipli prima della scadenza', () => {
  const p = { id: 'a', data: '2026-12-01', ora: '16:00', avvisi: [1440, 60, 0] };
  const l = avvisiTra(p, T('2026-11-29T00:00Z'), T('2026-12-02T00:00Z'), cfg);
  assert.deepEqual(ore(l), ['2026-11-30T15:00', '2026-12-01T14:00', '2026-12-01T15:00']);
  assert.equal(new Set(l.map(a => a.chiave)).size, 3);
});

test('senza ora: avvisi a giorni interi all\'ora "in giornata"', () => {
  const p = { id: 'b', data: '2026-12-01', avvisi: [1440, 60, 0] };
  assert.deepEqual(ore(avvisiTra(p, T('2026-11-29T00:00Z'), T('2026-12-02T00:00Z'), cfg)), ['2026-11-30T08:00', '2026-12-01T08:00']);
});

test('insisti finché non è fatto, poi smette', () => {
  const p = { id: 'c', data: '2026-12-01', ora: '10:00', avvisi: [0], insisti: 10 };
  const l = avvisiTra(p, T('2026-12-01T08:00Z'), T('2026-12-01T12:00Z'), { ...cfg, insistiVolte: 3 });
  assert.deepEqual(ore(l), ['2026-12-01T09:00', '2026-12-01T09:10', '2026-12-01T09:20', '2026-12-01T09:30']);
  assert.deepEqual(avvisiTra({ ...p, fatto: true }, T('2026-12-01T08:00Z'), T('2026-12-01T12:00Z'), cfg), []);
});

test('rinvio: sostituisce gli avvisi di quella occorrenza', () => {
  const p = { id: 'd', data: '2026-12-01', ora: '10:00', avvisi: [0], rinvio: { occ: '2026-12-01', al: T('2026-12-01T11:00Z') } };
  assert.deepEqual(ore(avvisiTra(p, T('2026-12-01T08:00Z'), T('2026-12-01T12:00Z'), cfg)), ['2026-12-01T11:00']);
});

test('ripetuto: fatto oggi non avvisa oggi ma domani sì', () => {
  const p = { id: 'e', data: '2026-11-01', ora: '08:00', ripeti: { ogni: 'giorno' }, avvisi: [0], fatti: { '2026-11-17': true } };
  assert.deepEqual(ore(avvisiTra(p, T('2026-11-17T00:00Z'), T('2026-11-18T23:00Z'), cfg)), ['2026-11-18T07:00']);
  assert.equal(new Date(prossimoAvviso(p, T('2026-11-17T06:00Z'), cfg)).toISOString(), '2026-11-18T07:00:00.000Z');
});

test('ora legale: stessa ora "da orologio" prima e dopo il cambio', () => {
  const p = { id: 'f', data: '2026-10-20', ora: '09:00', ripeti: { ogni: 'settimana' } };
  assert.equal(new Date(scadenza(p, '2026-10-20', cfg)).toISOString(), '2026-10-20T07:00:00.000Z');
  assert.equal(new Date(scadenza(p, '2026-10-27', cfg)).toISOString(), '2026-10-27T08:00:00.000Z');
});

test('agenda e ritardi', () => {
  const l = [
    { id: 'g', data: '2026-11-10', ora: '08:00', ripeti: { ogni: 'giorno' } },
    { id: 'h', data: '2026-11-16', ora: '12:00' },
    { id: 'i', data: '2026-11-16', ora: '13:00', fatto: true },
    { id: 'j', data: '2026-11-18', ora: '09:00' }
  ];
  const adesso = T('2026-11-17T10:00Z');
  const r = inRitardo(l, adesso, cfg);
  assert.deepEqual(r.map(x => `${x.p.id}@${x.occ}`), ['h@2026-11-16', 'g@2026-11-17']); // il ripetuto conta una volta sola
  assert.deepEqual(agenda(l, '2026-11-18', '2026-11-18', cfg).map(x => x.p.id), ['g', 'j']);
});
