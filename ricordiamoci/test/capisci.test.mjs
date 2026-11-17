import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capisci } from '../js/nucleo/capisci.js';

// Martedì 17 novembre 2026, ore 10:30
const ADESSO = new Date(2026, 10, 17, 10, 30);
const caso = (frase, atteso) => test(frase, () => {
  const r = capisci(frase, ADESSO);
  for (const [k, v] of Object.entries(atteso)) assert.deepEqual(r[k], v, `${k} di "${frase}"`);
});

caso('domani dentista alle 16', { titolo: 'Dentista', data: '2026-11-18', ora: '16:00', ripeti: null });
caso('mercoledì 16:30 riunione', { data: '2026-11-18', ora: '16:30', titolo: 'Riunione' });
caso('mercoledì 6 colloquio', { data: '2027-01-06' });
caso('venerdì prossimo cena', { data: '2026-11-20' });
caso('cena da nonna il 6 dicembre', { titolo: 'Cena da nonna', data: '2026-12-06' });

// ultimo minuto
caso('tra 2 ore chiamare il commercialista', { data: '2026-11-17', ora: '12:30', titolo: 'Chiamare il commercialista' });
caso("fra mezz'ora uscire", { ora: '11:00' });
caso('tra 20 minuti forno', { ora: '10:50' });
caso('consegnare relazione entro venerdì', { data: '2026-11-20', titolo: 'Consegnare relazione' });
caso('pagare bollo urgente', { priorita: 2, titolo: 'Pagare bollo' });
caso('rinnovare passaporto!!', { priorita: 2, titolo: 'Rinnovare passaporto' });
caso('rispondere a Luca!', { priorita: 1 });
caso('alle 9 telefonare', { data: '2026-11-18', ora: '09:00' }); // le 9 sono passate: domani
caso('alle 18 telefonare', { data: '2026-11-17', ora: '18:00' });

// fasce del giorno
caso('domani mattina analisi', { data: '2026-11-18', ora: '09:00', titolo: 'Analisi' });
caso('stasera film', { data: '2026-11-17', ora: '20:00', titolo: 'Film' });
caso('giovedì pomeriggio parrucchiere', { data: '2026-11-19', ora: '15:00', titolo: 'Parrucchiere' });

// ricorrenze
caso('ogni lunedì e giovedì palestra alle 18', { ripeti: { ogni: 'settimana', ogniN: 1, giorni: [1, 4] }, data: '2026-11-19', ora: '18:00', titolo: 'Palestra' });
caso('pastiglia ogni mattina', { ripeti: { ogni: 'giorno', ogniN: 1 }, data: '2026-11-17', ora: '09:00', titolo: 'Pastiglia' });
caso('nei giorni feriali timbrare alle 8:30', { ripeti: { ogni: 'settimana', ogniN: 1, giorni: [1, 2, 3, 4, 5] }, data: '2026-11-17', ora: '08:30' });
caso('nel weekend annaffiare', { ripeti: { ogni: 'settimana', ogniN: 1, giorni: [0, 6] }, data: '2026-11-21' });
caso('ogni 2 settimane pulizie', { ripeti: { ogni: 'settimana', ogniN: 2 }, titolo: 'Pulizie' });
caso('ogni 3 mesi cambio filtro', { ripeti: { ogni: 'mese', ogniN: 3 } });
caso('il 27 ogni mese affitto', { ripeti: { ogni: 'mese', ogniN: 1 }, data: '2026-11-27', titolo: 'Affitto' });
caso('3 marzo compleanno di Luca', { ripeti: { ogni: 'anno', ogniN: 1 }, data: '2027-03-03', titolo: 'Compleanno di Luca' });

// liste
caso('latte #spesa', { lista: 'spesa', titolo: 'Latte', data: '' });
caso('#lavoro preparare slide domani', { lista: 'lavoro', data: '2026-11-18', titolo: 'Preparare slide' });
caso('comprare il pane', { data: '', ora: '', ripeti: null, titolo: 'Comprare il pane' });
caso('la settimana prossima tagliando', { data: '2026-11-23' });
