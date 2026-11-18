// Profili d'uso e impostazioni predefinite.
export const PROFILI = {
  organizzato: {
    nome: 'Organizzato', emoji: '🗂️', frase: 'Pianifico tutto e voglio la settimana in ordine.',
    avvisi: [1440, 30], insisti: 0, riepilogoMattina: '', riepilogoSera: '21:00'
  },
  scordarello: {
    nome: 'Scordarello', emoji: '🫣', frase: 'Se non me lo ricordi tu, me lo scordo.',
    avvisi: [60, 10, 0], insisti: 10, riepilogoMattina: '08:00', riepilogoSera: ''
  },
  ultimoMinuto: {
    nome: 'Ultimo minuto', emoji: '⏱️', frase: 'Faccio tutto all\'ultimo… ma lo faccio.',
    avvisi: [2880, 1440, 120, 30], insisti: 15, riepilogoMattina: '08:30', riepilogoSera: ''
  }
};

export const PREDEFINITE = {
  profilo: '', tema: 'elegante', modo: 'auto', animazioni: 'piene',
  avvisi: [60, 10, 0], insisti: 0, insistiVolte: 6, oraGiornata: '09:00',
  riepilogoMattina: '08:00', riepilogoSera: '', bollino: true, vibrazione: true
};

export const COLORI = ['lilla', 'menta', 'cielo', 'sole', 'rosa', 'pesca'];
export const LISTE_INIZIALI = [
  { id: 'personale', nome: 'Personale', emoji: '🙂', colore: 'lilla' },
  { id: 'casa', nome: 'Casa', emoji: '🏠', colore: 'menta' },
  { id: 'lavoro', nome: 'Lavoro', emoji: '💼', colore: 'cielo' },
  { id: 'spesa', nome: 'Spesa', emoji: '🛒', colore: 'sole' },
  { id: 'salute', nome: 'Salute', emoji: '💊', colore: 'rosa' },
  { id: 'scadenze', nome: 'Scadenze', emoji: '📄', colore: 'pesca' }
];

export const SCELTE_AVVISI = [
  [0, 'Al momento'], [5, '5 min'], [10, '10 min'], [15, '15 min'], [30, '30 min'], [60, '1 ora'],
  [120, '2 ore'], [1440, '1 giorno'], [2880, '2 giorni'], [10080, '1 settimana']
];

export function durata(min) {
  if (min >= 10080 && min % 10080 === 0) return min === 10080 ? 'una settimana' : `${min / 10080} settimane`;
  if (min >= 1440 && min % 1440 === 0) return min === 1440 ? 'un giorno' : `${min / 1440} giorni`;
  if (min >= 60 && min % 60 === 0) return min === 60 ? 'un\'ora' : `${min / 60} ore`;
  if (min >= 60) return `${Math.floor(min / 60)} h ${min % 60} min`;
  return `${min} minut${min === 1 ? 'o' : 'i'}`;
}
