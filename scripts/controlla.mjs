// Controlli veloci prima di pubblicare (li esegue anche GitHub Actions):
// sintassi dei file, file della cache del service worker, Worker generato aggiornato, versione coerente.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

let errori = 0;
const male = m => { console.error('✗ ' + m); errori++; };
const bene = m => console.log('✓ ' + m);
const avviso = m => console.log('! ' + m);

// 1. sintassi
const js = ['sw.js', 'ricordiamoci/sw.js', ...['js', 'worker', 'scripts', 'test', 'test/e2e', 'test/regole', 'ricordiamoci/js', 'ricordiamoci/js/nucleo', 'ricordiamoci/test', 'ricordiamoci/test/e2e'].flatMap(d =>
  existsSync(d) ? readdirSync(d).filter(f => /\.(m?js)$/.test(f)).map(f => `${d}/${f}`) : [])];
for (const f of js) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { male(`${f}: ${e.stderr.toString().split('\n').slice(0, 4).join(' ')}`); }
}
bene(`sintassi di ${js.length} file`);

// 2. versione
const versione = /VERSIONE\s*=\s*'(v\d+\.\d+\.\d+)'/.exec(readFileSync('js/versione.js', 'utf8'))?.[1];
if (!versione) male('js/versione.js: VERSIONE mancante o non nel formato vX.Y.Z');
else if (!readFileSync('README.md', 'utf8').includes(`**${versione}**`)) male(`README.md non riporta la versione attuale ${versione}`);
else bene(`versione ${versione}`);

// 3. file messi in cache dal service worker e collegati da index.html
const shell = [...readFileSync('sw.js', 'utf8').matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean);
const html = [...readFileSync('index.html', 'utf8').matchAll(/(?:src|href)="(?!https?:|#)([^"?]+)"/g)].map(m => m[1]);
for (const f of new Set([...shell, ...html])) if (!existsSync(f)) male(`file mancante: ${f}`);
const moduli = readdirSync('js').filter(f => f.endsWith('.js')).map(f => `js/${f}`);
for (const f of moduli) if (!shell.includes(f)) male(`${f} non è nella cache di sw.js (l'app non partirebbe offline)`);
bene(`${shell.length} file nella cache del service worker`);

// 4. Worker generato
try { execFileSync(process.execPath, ['scripts/costruisci-worker.mjs', '--verifica'], { stdio: 'pipe' }); bene('worker/cloudflare-worker.js aggiornato'); }
catch { male('worker/cloudflare-worker.js non è aggiornato: esegui "npm run worker"'); }

// 5. cose da completare a mano (solo avvisi)
if (readFileSync('privacy.html', 'utf8').includes('[EMAIL DI CONTATTO]')) avviso('privacy.html: manca l\'email di contatto (obbligatoria per il Play Store)');
if (readFileSync('firestore.rules', 'utf8').includes("'EMAIL_1'")) avviso('firestore.rules: sostituire EMAIL_1/EMAIL_2 prima di pubblicare le regole');

if (errori) { console.error(`\n${errori} problemi.`); process.exit(1); }
console.log('\nTutto a posto.');
