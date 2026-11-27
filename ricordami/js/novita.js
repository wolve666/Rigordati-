// Versioni di RicordaMi e cosa c'è di nuovo: UNICA fonte per il numero di versione.
// La leggono l'app (marchio.js), l'APK (android/app/build.gradle) e GitHub (note della release).
// Per una nuova versione: aggiungi una voce IN CIMA con codice +1.
export const NOVITA = [
  { versione: '0.6.0', codice: 9, data: '2026-11-27', cose: ['Nuovo tema Rame, abbinato all\'icona: grafite e rame, con il giorno di oggi cerchiato come sull\'icona', 'Il + e i tasti principali in rame spazzolato', 'Anche il foglietto della spesa si veste di rame', 'Lo scegli in Impostazioni › Aspetto, chiaro o scuro'] },
  { versione: '0.5.0', codice: 8, data: '2026-11-27', cose: ['Il foglietto della spesa: in Liste tocca la Spesa e si apre un blocchetto a righe', 'Scrivi al volo, anche tante cose insieme con le virgole: "latte, pane e uova"', 'Tocca due volte per depennare: la penna fa ogni volta un segno diverso', 'Condividi il foglietto con la famiglia: chi scrive avvisa gli altri con un messaggio solo', 'Qualsiasi lista può diventare un foglietto, da Modifica lista'] },
  { versione: '0.4.1', codice: 7, data: '2026-11-27', cose: ['Nuova icona: il calendario scuro con l\'angolo di rame'] },
  { versione: '0.4.0', codice: 6, data: '2026-11-27', cose: ['Oggi è più pulito: solo la lista, senza contatori e riquadri doppi', 'Nuovo promemoria più semplice: quello che ho capito in una frase, i campi in ordine, il tasto sempre in fondo', '"Con chi" in una riga sola: tocca una persona e il promemoria (o la domanda) è per lei', 'Famiglia più ordinata: il codice d\'invito si chiude dopo averlo condiviso, l\'attività è più corta', 'Impostazioni con l\'icona dell\'ingranaggio'] },
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
