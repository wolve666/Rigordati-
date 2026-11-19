// Identità del prodotto: per cambiare nome basta cambiare qui (e in manifest.webmanifest).
import { ATTUALE } from './novita.js';

export const MARCHIO = {
  nome: 'RicordaMi',
  motto: 'Le cose importanti, al momento giusto.',
  versione: 'v' + ATTUALE.versione, // si cambia in novita.js
  repository: 'wolve666/Rigordati-', // dove escono le nuove versioni (GitHub Releases)
  // Indirizzo del servizio famiglia (es. 'https://api.ricordami.io'). Vuoto finché non c'è il server:
  // per le prove si può impostare da Impostazioni › Servizio famiglia.
  server: ''
};
