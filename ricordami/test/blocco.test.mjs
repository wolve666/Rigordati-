import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dividi, segno, eBlocco, rigaDelBlocco } from '../js/blocco.js';

test('dividi: virgole, "e", a capo, trattini', () => {
  assert.deepEqual(dividi('latte, pane e 2 uova'), ['Latte', 'Pane', '2 uova']);
  assert.deepEqual(dividi('- mele\n- pere; banane'), ['Mele', 'Pere', 'Banane']);
  assert.deepEqual(dividi('  '), []);
  assert.deepEqual(dividi('caffè'), ['Caffè']);
});

test('segno: stesso seme, stesso tratto; semi diversi, tratti diversi', () => {
  assert.equal(segno(.42, 100, 30).d, segno(.42, 100, 30).d);
  const tipi = new Set(), tratti = new Set();
  for (let i = 0; i < 60; i++) { const s = segno(Math.random(), 120, 32); tipi.add(s.tipo); tratti.add(s.d); assert.match(s.d, /^M-?\d/); }
  assert.equal(tipi.size, 4, 'riga, doppia, codina e scarabocchio');
  assert.equal(tratti.size, 60, 'mai due segni uguali');
});

test('il foglietto: la Spesa lo è da subito, le altre liste se scelto', () => {
  const liste = [{ id: 'spesa' }, { id: 'casa' }, { id: 'vacanza', blocco: true }, { id: 'spesa2', blocco: false }];
  assert.deepEqual(liste.map(eBlocco), [true, false, true, false]);
  assert.equal(rigaDelBlocco({ lista: 'spesa', data: '' }, liste), true);
  assert.equal(rigaDelBlocco({ lista: 'spesa', data: '2026-12-01' }, liste), false, 'con una data resta un promemoria');
  assert.equal(rigaDelBlocco({ lista: 'casa', data: '' }, liste), false);
  assert.equal(rigaDelBlocco({ tipo: 'voce', lista: 'arrivata', data: '' }, liste), true);
});
