// Prova dell'app nel browser con Firebase finto: due persone, una famiglia, le funzioni principali.
//   node test/e2e/prova-app.mjs            (usa il Chromium di Playwright)
//   CHROME=/percorso/chrome node test/e2e/prova-app.mjs
//   FOTO=cartella node ...                 salva anche le schermate
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const RADICE = resolve(new URL('../..', import.meta.url).pathname);
const FINTO = await readFile(new URL('./firebase-finto.js', import.meta.url), 'utf8');
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const FOTO = process.env.FOTO;

const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const f = join(RADICE, p.endsWith('/') ? p + 'index.html' : p);
    if (!f.startsWith(RADICE)) throw 0;
    res.writeHead(200, { 'Content-Type': TIPI[extname(f)] || 'application/octet-stream' }).end(await readFile(f));
  } catch { res.writeHead(404).end(); }
}).listen(0);
const BASE = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch({ args: ['--lang=it-IT'], ...(process.env.CHROME ? { executablePath: process.env.CHROME } : process.env.CANALE ? { channel: process.env.CANALE } : {}) });
// Service worker bloccato nel percorso principale (al primo avvio ricarica la pagina); lo provo a parte alla fine.
const [LARGO, ALTO] = (process.env.SCHERMO || '390x844').split('x').map(Number);
const ctx = await browser.newContext({ viewport: { width: LARGO, height: ALTO }, deviceScaleFactor: FOTO ? 3 : 1, locale: 'it-IT', timezoneId: 'Europe/Rome', serviceWorkers: 'block' });
let notificheWorker = [];
await ctx.route('https://www.gstatic.com/firebasejs/**', r => r.fulfill({ contentType: 'text/javascript', body: FINTO }));
if (!FOTO) await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
await ctx.route('https://rigordati.wolve666.workers.dev/**', async r => { notificheWorker.push(JSON.parse(r.request().postData())); await r.fulfill({ contentType: 'application/json', body: '{"ok":true,"inviati":1}' }); });
await ctx.route('https://rigordati.wolve666.workers.dev', async r => { notificheWorker.push(JSON.parse(r.request().postData())); await r.fulfill({ contentType: 'application/json', body: '{"ok":true,"inviati":1}' }); });

const page = await ctx.newPage();
const errori = [];
page.on('pageerror', e => errori.push(e.message));
page.on('console', m => m.type() === 'error' && errori.push(m.text()));
page.on('dialog', d => d.type() === 'prompt' ? d.accept('Annina') : d.accept());
const foto = async nome => {
  if (!FOTO) return;
  await mkdir(FOTO, { recursive: true });
  await page.addStyleTag({ content: '.toast{display:none!important}' }); // niente messaggi temporanei nelle foto
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(FOTO, nome + '.png') });
};
const passo = m => console.log('✓', m);
const attendi = async (fn, arg) => {
  try { await page.waitForFunction(fn, arg, { timeout: 5000 }); }
  catch (e) { console.error('Stato:', errori, await page.evaluate(() => [document.querySelector('#nomeFam').textContent, document.querySelector('#benvenuto').className, document.querySelector('#bvErr').textContent])); throw e; }
};
const visibile = async sel => {
  try { await page.locator(sel).first().waitFor({ state: 'visible', timeout: 5000 }); }
  catch (e) { console.error('Stato:', errori, await page.evaluate(() => document.body.innerText.slice(0, 600))); throw e; }
};

await page.goto(BASE);
await visibile('#accesso.on');
await foto('0-accesso');
passo('schermata di accesso');

// Il vecchio frigo (v0.2) ha due voci: Anna le porta nella nuova famiglia.
await page.evaluate(() => {
  const F = globalThis.__finto;
  F.dati.set('voci/v1', { tipo: 'todo', testo: 'pane', autore: 'anna@prova.it', autoreNome: 'Anna', fatto: false, risposte: [] });
  F.dati.set('voci/v2', { tipo: 'domanda', testo: 'cinema sabato?', autore: 'bruno@prova.it', autoreNome: 'Bruno', fatto: false, risposte: [], data: '2026-11-21' });
  F.salva();
});
await page.click('#btnGoogle');
await visibile('#benvenuto.on');
await visibile('#bvMigraRiga:not([hidden])');
assert.match(await page.textContent('#bvMigraTesto'), /2 voci del vecchio frigo/);
await foto('1-benvenuto');
passo('benvenuto con proposta di migrazione');

await page.fill('#bvNome', 'Casa Rossi');
await page.click('#bvCrea');
await attendi(() => !document.querySelector('#benvenuto').classList.contains('on'));
assert.equal(await page.textContent('#nomeFam'), 'Casa Rossi');
passo('famiglia creata');

// Le voci migrate ci sono, con l'autore giusto
await page.click('nav .tab[data-v="v-dom"]');
await visibile('#listaDomande .biglietto');
assert.match(await page.textContent('#listaDomande'), /cinema sabato\?.*Rispondi tu/s);
passo('voci migrate: la domanda di Bruno aspetta la risposta di Anna');

// Impegno ricorrente scritto a frase
await page.click('nav .tab[data-v="v-cal"]');
await page.click('#btnNuovo');
await page.fill('#nTesto', 'ogni lunedì piscina alle 17');
assert.match(await page.textContent('#nNota'), /si ripete/);
assert.equal(await page.inputValue('#nRipeti'), 'settimana');
assert.equal(await page.getAttribute('#fNuovo', 'data-tipo'), 'impegno');
await foto('2-nuovo');
await page.click('#nSalva');
await attendi(() => !document.querySelector('#fNuovo').classList.contains('on'));
assert.match(await page.textContent('#listaGiorno'), /piscina.*ogni lunedì.*17:00/s);
await page.click('#meseSucc');
const conPallino = await page.$$eval('#griglia .giorno:not(.fuori)', bs => bs.filter(b => b.querySelector('.p-impegno')).map(b => parseInt(b.textContent)));
const lunedi = await page.evaluate(() => { const m = new Date(); m.setDate(1); m.setMonth(m.getMonth() + 1); const out = []; for (let d = new Date(m); d.getMonth() === m.getMonth(); d.setDate(d.getDate() + 1)) if (d.getDay() === 1 && d >= new Date()) out.push(d.getDate()); return out; });
assert.deepEqual(conPallino, lunedi, 'nel mese dopo hanno il pallino esattamente i lunedì');
const lunediConPallino = conPallino.length;
await page.click('#mesePrec');
assert.equal(notificheWorker.at(-1).evento, 'nuova');
assert.ok(notificheWorker.at(-1).famiglia, 'il postino riceve la famiglia');
await foto('3-calendario');
passo(`impegno settimanale: ${lunediConPallino} lunedì segnati nel mese`);

// Modifica
await page.click('#listaGiorno .biglietto');
await visibile('#fDett.on');
await page.click('#dModifica');
await visibile('#fNuovo.on');
assert.equal(await page.inputValue('#nRipeti'), 'settimana');
await page.fill('#nTesto', 'piscina con Luca');
await page.selectOption('#nAnticipo', '15');
await page.click('#nSalva');
await attendi(() => !document.querySelector('#fNuovo').classList.contains('on'));
assert.match(await page.textContent('#listaGiorno'), /piscina con Luca.*ogni lunedì/s);
const salvata = await page.evaluate(() => [...globalThis.__finto.dati.entries()].find(([k, v]) => v.testo === 'piscina con Luca')[1]);
assert.equal(salvata.anticipo, 15); assert.ok(salvata.avvisoAt > Date.now()); assert.equal(salvata.fuso, 'Europe/Rome');
passo('modifica: testo e promemoria aggiornati, prossimo avviso calcolato');

// Lista della spesa
await page.click('#btnNuovo');
await page.fill('#nTesto', 'comprare latte');
assert.ok(await page.$eval('#nLista button[data-l="spesa"]', b => b.classList.contains('sel')));
await page.click('#nSalva');
await page.click('nav .tab[data-v="v-todo"]');
await page.click('#filtriTodo button[data-f="spesa"]');
assert.match(await page.textContent('#listaTodo'), /comprare latte/);
assert.doesNotMatch(await page.textContent('#listaTodo'), /pane/);
await page.click('#listaTodo .biglietto .spunta');
await visibile('#btnPulisci:not([hidden])');
await foto('4-spesa');
await page.click('#btnPulisci');
await attendi(() => !document.querySelector('#listaTodo').textContent.includes('latte'));
passo('spesa: filtro, spunta e pulizia delle cose fatte');

// Invito
await page.click('#btnFamiglia');
await visibile('#fFam.on');
await page.click('#fInvita');
await visibile('.codice-grande');
const codice = (await page.textContent('.codice-grande')).trim();
assert.match(codice, /^[A-HJ-NP-Z2-9]{8}$/);
await foto('5-famiglia');
await page.click('#velo', { position: { x: 20, y: 20 } });
passo('codice d\'invito ' + codice);

// Arriva Bruno, dal link d'invito
await page.evaluate(() => { globalThis.__finto.prossimo = { uid: 'bruno', email: 'bruno@prova.it', displayName: 'Bruno Rossi' }; });
await page.click('#btnFamiglia'); await page.click('#fEsci');
await visibile('#accesso.on');
await page.goto(BASE + '?invito=' + codice);
await visibile('#accesso.on');
await page.click('#btnGoogle');
await visibile('#bvInvito:not([hidden])');
assert.match(await page.textContent('#bvInvitoTesto'), /Anna ti invita nella famiglia "Casa Rossi"/);
await foto('6-invito');
await page.click('#bvAccetta');
await attendi(() => document.querySelector('#nomeFam').textContent === 'Casa Rossi' && !document.querySelector('#benvenuto').classList.contains('on'));
passo('Bruno entra in famiglia con il link d\'invito');

// Bruno fa una domanda solo ad Anna
await page.click('#btnNuovo');
await page.fill('#nTesto', 'posso uscire stasera?');
await visibile('#nPerChiCampo:not([hidden])');
await page.click('#nPerChi button:has-text("Anna")');
await page.click('#nSalva');
await page.click('nav .tab[data-v="v-dom"]');
assert.match(await page.textContent('#listaDomande'), /posso uscire\?.*per Anna/s);
assert.doesNotMatch(await page.textContent('#listaDomande'), /Rispondi tu/, 'Bruno non deve rispondere alle sue domande');
assert.equal(await page.textContent('#badgeDom'), '0');
passo('domanda "per Anna"; per Bruno nessuna attesa (anche sulla sua domanda migrata)');

// Torna Anna: due domande da rispondere
await page.evaluate(() => { globalThis.__finto.prossimo = { uid: 'anna', email: 'anna@prova.it', displayName: 'Anna Rossi' }; });
await page.click('#btnFamiglia'); await page.click('#fEsci');
await page.click('#btnGoogle');
await attendi(() => document.querySelector('#badgeDom').textContent === '2');
await page.click('nav .tab[data-v="v-dom"]');
await page.click('#listaDomande .biglietto:has-text("posso uscire")');
await visibile('#fDett.on');
await foto('7-domanda');
await page.click('#dCorpo .r-si');
await attendi(() => document.querySelector('#badgeDom').textContent === '1');
assert.equal(notificheWorker.at(-1).evento, 'risposta');
passo('Anna risponde Sì: il contatore scende a 1');

// Link da una notifica: apre direttamente la voce
const [chiave] = await page.evaluate(() => [...globalThis.__finto.dati.keys()].filter(k => k.includes('/voci/') && globalThis.__finto.dati.get(k).testo === 'piscina con Luca'));
const [, fid, , vid] = chiave.split('/');
await page.goto(BASE + `?voce=${fid}/${vid}`);
await visibile('#fDett.on');
assert.match(await page.textContent('#dCorpo'), /piscina con Luca/);
assert.equal(new URL(page.url()).search, '', 'il link viene ripulito');
passo('link da notifica apre la voce giusta');

// Seconda famiglia e scambio
await page.click('#velo', { position: { x: 20, y: 20 } });
await page.click('#btnFamiglia'); await page.click('#fAltra');
await visibile('#bvIndietro:not([hidden])');
await page.fill('#bvNome', 'Nonni');
await page.click('#bvCrea');
await attendi(() => document.querySelector('#nomeFam').textContent === 'Nonni');
assert.doesNotMatch(await page.textContent('#app'), /piscina/);
await page.click('#btnFamiglia');
await page.click('.lista-fam button:has-text("Casa Rossi")');
await attendi(() => document.querySelector('#nomeFam').textContent === 'Casa Rossi');
passo('seconda famiglia separata, scambio dal foglio famiglia');

// Uscire dalla famiglia
await page.click('#btnFamiglia'); await page.click('#fLascia');
await attendi(() => document.querySelector('#nomeFam').textContent === 'Nonni');
const membri = await page.evaluate(f => globalThis.__finto.dati.get('famiglie/' + f).membri, fid);
assert.deepEqual(membri, ['bruno']);
passo('Anna esce da "Casa Rossi": resta solo Bruno');

assert.deepEqual(errori, [], 'errori nella pagina');
passo('nessun errore JavaScript');

// Service worker: si installa (tutti i file della cache esistono) e l'app riparte offline
const ctxSw = await browser.newContext({ locale: 'it-IT' });
await ctxSw.route('https://www.gstatic.com/firebasejs/**', r => r.fulfill({ contentType: 'text/javascript', body: FINTO }));
await ctxSw.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
const p2 = await ctxSw.newPage();
await p2.goto(BASE);
let cache;
for (let i = 0; i < 20 && !cache; i++) {
  // Al primo avvio il service worker prende il controllo e la pagina si ricarica da sola.
  try {
    cache = await p2.evaluate(async () => {
      if (!navigator.serviceWorker.controller) return null;
      const nomi = await caches.keys();
      return nomi.length ? { nomi, file: (await (await caches.open(nomi[0])).keys()).length } : null;
    });
  } catch {}
  if (!cache) await p2.waitForTimeout(250);
}
assert.ok(cache, 'il service worker non ha preso il controllo');
assert.deepEqual(cache.nomi, [`rigordati-${await p2.evaluate(() => self.VERSIONE)}`]);
assert.ok(cache.file >= 15, 'file in cache: ' + cache.file);
await ctxSw.setOffline(true);
await p2.reload();
await p2.locator('#accesso.on').waitFor({ timeout: 5000 });
passo(`service worker: cache "${cache.nomi[0]}" con ${cache.file} file, l'app si apre offline`);

await browser.close(); server.close();
