// Genera worker/cloudflare-worker.js: un unico file da incollare nell'editor di Cloudflare.
// Mette in fila i moduli di cui ha bisogno il postino, togliendo import/export.
//   node scripts/costruisci-worker.mjs           scrive il file
//   node scripts/costruisci-worker.mjs --verifica  esce con errore se il file non è aggiornato
import { readFileSync, writeFileSync } from 'node:fs';

const MODULI = ['js/date.js', 'js/ricorrenze.js', 'worker/postino.js'];
const USCITA = 'worker/cloudflare-worker.js';

export function costruisci() {
  const versione = /VERSIONE\s*=\s*'([^']+)'/.exec(readFileSync('js/versione.js', 'utf8'))[1];
  const pezzi = MODULI.map(f => {
    const src = readFileSync(f, 'utf8')
      .replace(/^import[^;]+;\n/gm, '')
      .replace(/^export (?!default)/gm, '');
    return `// ===== ${f} =====\n${src.trim()}\n`;
  });
  return `// Rigordati!! postino ${versione} — FILE GENERATO da scripts/costruisci-worker.mjs, non modificarlo a mano.\n\n${pezzi.join('\n')}`;
}

const testo = costruisci();
if (process.argv.includes('--verifica')) {
  let attuale = '';
  try { attuale = readFileSync(USCITA, 'utf8'); } catch {}
  if (attuale !== testo) { console.error(`${USCITA} non è aggiornato: esegui "npm run worker".`); process.exit(1); }
  console.log(`${USCITA} è aggiornato.`);
} else {
  writeFileSync(USCITA, testo);
  console.log(`Scritto ${USCITA}`);
}
