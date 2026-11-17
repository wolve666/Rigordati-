import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occorreIl, prossimaData, istante, momentoAvviso, prossimoAvviso, dataNelFuso } from '../js/ricorrenze.js';

const ROMA = 'Europe/Rome';

test('voce semplice', () => {
  const v = { data: '2026-11-20' };
  assert.ok(occorreIl(v, '2026-11-20'));
  assert.ok(!occorreIl(v, '2026-11-27'));
  assert.equal(prossimaData(v, '2026-11-21'), null);
});

test('settimanale', () => {
  const v = { data: '2026-11-20', ripeti: 'settimana' };
  assert.ok(occorreIl(v, '2026-11-27'));
  assert.ok(!occorreIl(v, '2026-11-13'), 'non prima dell\'inizio');
  assert.ok(!occorreIl(v, '2026-11-28'));
  assert.equal(prossimaData(v, '2026-11-21'), '2026-11-27');
});

test('mensile salta i mesi senza il 31', () => {
  const v = { data: '2027-01-31', ripeti: 'mese' };
  assert.equal(prossimaData(v, '2027-02-01'), '2027-03-31');
});

test('annuale 29 febbraio', () => {
  const v = { data: '2024-02-29', ripeti: 'anno' };
  assert.equal(prossimaData(v, '2024-03-01'), '2028-02-29');
});

test('istante rispetta ora legale e solare', () => {
  assert.equal(new Date(istante('2026-07-01', '10:00', ROMA)).toISOString(), '2026-07-01T08:00:00.000Z');
  assert.equal(new Date(istante('2026-12-01', '10:00', ROMA)).toISOString(), '2026-12-01T09:00:00.000Z');
  assert.equal(dataNelFuso(Date.parse('2026-11-17T23:30:00Z'), ROMA), '2026-11-18');
});

test('promemoria: un\'ora prima, alle 8 senza ora, il giorno prima', () => {
  assert.equal(new Date(momentoAvviso('2026-12-01', '16:00', 60, ROMA)).toISOString(), '2026-12-01T14:00:00.000Z');
  assert.equal(new Date(momentoAvviso('2026-12-01', '', 60, ROMA)).toISOString(), '2026-12-01T07:00:00.000Z');
  assert.equal(new Date(momentoAvviso('2026-12-01', '', 1440, ROMA)).toISOString(), '2026-11-30T07:00:00.000Z');
  assert.equal(momentoAvviso('2026-12-01', '16:00', -1, ROMA), null);
});

test('prossimo promemoria di un impegno settimanale', () => {
  const v = { tipo: 'impegno', data: '2026-11-02', ora: '17:00', ripeti: 'settimana', anticipo: 60, fuso: ROMA };
  // Lunedì 16 novembre alle 16:30 italiane: quello delle 16:00 è passato, il prossimo è il 23.
  const adesso = Date.parse('2026-11-16T15:30:00Z');
  assert.equal(new Date(prossimoAvviso(v, adesso)).toISOString(), '2026-11-23T15:00:00.000Z');
  // Attraversa il cambio d'ora: ottobre 2026, ultima domenica = 25.
  const w = { ...v, data: '2026-10-19' };
  assert.equal(new Date(prossimoAvviso(w, Date.parse('2026-10-19T16:00:00Z'))).toISOString(), '2026-10-26T15:00:00.000Z');
});

test('nessun promemoria per da fare, domande o anticipo -1', () => {
  assert.equal(prossimoAvviso({ tipo: 'todo', data: '2030-01-01' }, 0), null);
  assert.equal(prossimoAvviso({ tipo: 'impegno', data: '2030-01-01', anticipo: -1 }, 0), null);
  assert.equal(prossimoAvviso({ tipo: 'impegno', data: '2020-01-01' }, Date.now()), null);
});
