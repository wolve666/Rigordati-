// Versioni di RicordaMi e cosa c'è di nuovo: UNICA fonte per il numero di versione.
// La leggono l'app (marchio.js), l'APK (android/app/build.gradle) e GitHub (note della release).
// Per una nuova versione: aggiungi una voce IN CIMA con codice +1.
export const NOVITA = [
  {
    versione: '0.3.1', codice: 5, data: '2026-11-19',
    cose: [
      'Prima versione arrivata con l\'aggiornamento dall\'app',
      'In Impostazioni › Aggiornamenti vedi quando ho controllato l\'ultima volta'
    ]
  },
  {
    versione: '0.3.0', codice: 4, data: '2026-11-19',
    cose: [
      'Avvisi di aggiornamento: quando esce una nuova versione te lo dico io, con le novità',
      'Aggiorna con un tocco: scarico e installo la nuova versione, controllando che sia integra',
      'Dopo ogni aggiornamento ti mostro cosa è cambiato'
    ]
  },
  {
    versione: '0.2.1', codice: 3, data: '2026-11-19',
    cose: ['La finestra del + si apre fluida e veloce', 'La tastiera compare a finestra già aperta']
  },
  {
    versione: '0.2.0', codice: 2, data: '2026-11-18',
    cose: [
      'Famiglia: promemoria condivisi, domande con risposta Sì / No / Forse, "Rispondi tu"',
      'Il calendario è la prima pagina',
      'Il tasto indietro torna al calendario e poi esce dall\'app',
      'Barra in basso separata da quella di Android',
      'Il + si apre come una finestra che nasce dal pulsante'
    ]
  },
  {
    versione: '0.1.0', codice: 1, data: '2026-11-18',
    cose: ['Prima versione Android: avvisi all\'ora esatta anche ad app chiusa', '"Fatto" e "Tra 10 min" dalla notifica', 'Condividi da altre app → Ricordamelo']
  }
];
export const ATTUALE = NOVITA[0];
