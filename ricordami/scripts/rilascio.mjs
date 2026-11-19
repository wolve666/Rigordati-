// Usato da GitHub Actions: stampa tag, nome e testo della release per la versione in cima a js/novita.js.
//   node scripts/rilascio.mjs tag            → ricordami-v0.3.0
//   node scripts/rilascio.mjs testo FILE.apk → note della release con l'impronta SHA-256 dell'APK
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ATTUALE } from '../js/novita.js';
import { testoRelease } from '../js/aggiornamenti.js';

const [cosa, apk] = process.argv.slice(2);
if (cosa === 'tag') console.log(`ricordami-v${ATTUALE.versione}`);
else if (cosa === 'versione') console.log(ATTUALE.versione);
else if (cosa === 'testo') console.log(testoRelease(ATTUALE, createHash('sha256').update(readFileSync(apk)).digest('hex')));
else { console.error('uso: rilascio.mjs tag|versione|testo FILE.apk'); process.exit(1); }
