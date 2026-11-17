import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capisci } from '../js/capisci.js';

// Martedì 17 novembre 2026
const BASE = new Date(2026, 10, 17);
const c = t => capisci(t, BASE);
const caso = (frase, atteso) => test(frase, () => {
  const r = c(frase);
  for (const [k, v] of Object.entries(atteso)) assert.equal(r[k], v, `${k} di "${frase}"`);
});

// giorni relativi
caso('domani pane', { data: '2026-11-18', tipo: 'impegno', testo: 'pane' });
caso('dopodomani cena da nonna', { data: '2026-11-19', testo: 'cena da nonna' });
caso('stasera pizza alle 20', { data: '2026-11-17', ora: '20:00', testo: 'pizza' });
caso('tra 3 giorni dentista', { data: '2026-11-20', testo: 'dentista' });
caso('fra una settimana colloquio', { data: '2026-11-24' });

// giorni della settimana
caso('venerdì calcetto', { data: '2026-11-20', testo: 'calcetto' });
caso('martedì riunione', { data: '2026-11-17' });
caso('martedì prossimo riunione', { data: '2026-11-24', testo: 'riunione' });
caso('il prossimo martedì riunione', { data: '2026-11-24' });
caso('mercoledì 6 dentista ore 16', { data: '2027-01-06', ora: '16:00', testo: 'dentista' }); // primo mercoledì 6
caso('mercoledì 16:30 dentista', { data: '2026-11-18', ora: '16:30', testo: 'dentista' });
caso('giovedì 19 palestra', { data: '2026-11-19', testo: 'palestra' });

// date esplicite
caso('6 dicembre recita', { data: '2026-12-06', testo: 'recita' });
caso('cena da nonna il 6 dicembre', { data: '2026-12-06', testo: 'cena da nonna' });
caso('3 marzo visita', { data: '2027-03-03' });
caso('25 dicembre 2027 natale', { data: '2027-12-25', testo: 'natale' });
caso('31 aprile boh', { data: '' });
caso('6/11 bollo auto', { data: '2027-11-06' });
caso('20/11 bollo auto', { data: '2026-11-20' });
caso('1/2/27 tagliando', { data: '2027-02-01' });
caso('il 25 pagare affitto', { data: '2026-11-25', testo: 'pagare affitto' });
caso('il 5 pagare affitto', { data: '2026-12-05' });

// orari
caso('ore 9 parrucchiere', { ora: '09:00', data: '', tipo: 'impegno' });
caso('alle 16.30 riunione', { ora: '16:30' });
caso('h8 treno', { ora: '08:00' });
caso('domani a mezzogiorno pranzo', { ora: '12:00', data: '2026-11-18', testo: 'pranzo' });
caso('ore 27 boh', { ora: '' });
caso('domani 18:75', { ora: '' });

// tipi
caso('venerdì posso andare a Magic?', { tipo: 'domanda', data: '2026-11-20', testo: 'posso andare a Magic?' });
caso('prendere pane per la cena', { tipo: 'todo', data: '', ora: '', testo: 'prendere pane per la cena' });
caso('comprare latte', { tipo: 'todo', lista: 'spesa' });
caso('manca il caffè', { lista: 'spesa' });
caso('portare fuori il cane', { lista: '' });

// ricorrenze
caso('ogni lunedì piscina alle 17', { ripeti: 'settimana', data: '2026-11-23', ora: '17:00', testo: 'piscina' });
caso('tutti i martedì inglese', { ripeti: 'settimana', data: '2026-11-17' });
caso('tutte le domeniche messa', { ripeti: 'settimana', data: '2026-11-22', testo: 'messa' });
caso('il 27 ogni mese bolletta', { ripeti: 'mese', data: '2026-11-27', testo: 'bolletta' });
caso('3 marzo compleanno di Luca', { ripeti: 'anno', data: '2027-03-03', testo: 'compleanno di Luca' });
caso('ogni giorno pastiglia ore 8', { ripeti: 'giorno', data: '2026-11-17', ora: '08:00' });
caso('posso uscire stasera?', { tipo: 'domanda', data: '2026-11-17', testo: 'posso uscire?' });
caso('ogni mese?', { tipo: 'domanda', ripeti: '' });

test('senza nulla da capire il testo resta intero', () => {
  assert.equal(c('domani').testo, 'domani');
});
