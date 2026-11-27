// Due persone, un server: domande, risposte, cose da fare insieme, avvisi, coda senza rete.
//   node test/e2e/famiglia.mjs            (FOTO=cartella per salvare le schermate)
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { creaApp } from '../../server/app.js';
import { apriDb } from '../../server/sqlite-node.js';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || 'playwright');
const RADICE = resolve(new URL('../..', import.meta.url).pathname);
const FOTO = process.env.FOTO && resolve(process.env.FOTO);
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/json' };

// Sito dell'app
const sito = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try { const f = join(RADICE, p.endsWith('/') ? p + 'index.html' : p); if (!f.startsWith(RADICE)) throw 0; res.writeHead(200, { 'Content-Type': TIPI[extname(f)] || 'application/octet-stream' }).end(await readFile(f)); }
  catch { res.writeHead(404).end(); }
}).listen(0);
// Servizio famiglia (lo stesso codice che andrà su Cloudflare)
const api = creaApp(apriDb());
const servizio = createServer(async (req, res) => {
  const corpo = ['GET', 'OPTIONS'].includes(req.method) ? undefined : await new Promise(ok => { const p = []; req.on('data', c => p.push(c)); req.on('end', () => ok(Buffer.concat(p))); });
  const r = await api(new Request('http://x' + req.url, { method: req.method, headers: req.headers, body: corpo }));
  res.writeHead(r.status, Object.fromEntries(r.headers)).end(Buffer.from(await r.arrayBuffer()));
}).listen(0);
const BASE = `http://localhost:${sito.address().port}/`, SERVIZIO = `http://localhost:${servizio.address().port}`;

const browser = await chromium.launch(process.env.CANALE ? { channel: process.env.CANALE } : {});
const errori = [];
async function persona(nome) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: FOTO ? 2 : 1, locale: 'it-IT', timezoneId: 'Europe/Rome', serviceWorkers: 'block' });
  if (!FOTO) await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  const page = await ctx.newPage();
  page.on('pageerror', e => errori.push(`${nome}: ${e.message}`));
  page.on('dialog', d => d.accept());
  await page.goto(BASE);
  await page.click('#benvenuto .passo.on [data-avanti]');
  await page.click('.profilo[data-p="organizzato"]'); await page.click('#bProfiloAvanti');
  await page.click('#benvenuto .passo.on [data-avanti]');
  await page.uncheck('#bEsempi'); await page.click('#bDopo');
  await page.waitForFunction(() => document.getElementById('benvenuto').hidden);
  await page.click('.tab[data-v="v-fam"]');
  await page.fill('#fServer', SERVIZIO); await page.click('#fServerOk');
  await page.fill('#fNome', nome); await page.click('#fNomeOk');
  return { ctx, page };
}
const passo = m => console.log('✓', m);
const sinc = page => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
const aspetta = async (page, fn, arg) => { for (let i = 0; i < 40; i++) { await sinc(page); try { await page.waitForFunction(fn, arg, { timeout: 500 }); return; } catch {} } throw new Error('tempo scaduto: ' + fn); };
const foto = async (page, nome) => { if (!FOTO) return; await mkdir(FOTO, { recursive: true }); await page.evaluate(() => document.getElementById('toast').classList.remove('on')); await page.waitForTimeout(500); await page.screenshot({ path: join(FOTO, nome + '.png') }); };

/* ---------- Anna crea la famiglia e invita ---------- */
const A = await persona('Anna');
await A.page.locator('#fCrea').waitFor();
await A.page.fill('#fNuovo', 'Casa Rossi'); await A.page.click('#fCrea');
await A.page.locator('#fInvita').waitFor();
await A.page.click('#fInvita');
const codice = (await A.page.locator('.codice-grande').innerText()).trim();
assert.match(codice, /^[A-Z0-9]{8}$/);
await A.page.click('#fCondividiInvito');
await A.page.waitForFunction(() => !document.querySelector('.codice-grande'));
assert.match(await A.page.locator('.fam-nome').innerText(), /Casa Rossi/);
assert.equal(await A.page.locator('.tab[data-v="v-fam"]').innerText(), 'Famiglia', 'la scheda non cambia nome');
passo(`Anna crea "Casa Rossi", condivide il codice ${codice} e il riquadro si chiude`);

/* ---------- Bruno entra con il codice ---------- */
const B = await persona('Bruno');
await B.page.fill('#fCodice', codice); await B.page.click('#fEntra');
await B.page.locator('.membri-riga .membro').nth(1).waitFor();
assert.deepEqual(await B.page.locator('.membri-riga .membro:not(.invita) span:last-child').allInnerTexts(), ['Anna', 'Tu']);
await aspetta(A.page, () => document.querySelector('#v-fam').innerText.includes('Bruno'));
passo('Bruno entra; Anna lo vede nella famiglia ("👋 Bruno è nel gruppo")');

/* ---------- Anna fa una domanda a Bruno ---------- */
await A.page.click('#btnNuovo');
await A.page.fill('#sTesto', 'Venerdì posso andare a Magic?');
assert.equal(await A.page.locator('#sGruppo .chip.sel').innerText(), '👪 Casa Rossi', 'dalla scheda Famiglia si condivide già con la famiglia');
await A.page.click('#sGruppo .chip.persona:has-text("Bruno")');
assert.equal(await A.page.locator('#sGruppo .chip.sel').innerText(), 'Bruno', 'una riga sola: scegliere Bruno vuol dire "per Bruno"');
assert.equal(await A.page.locator('#sTipo .sel').innerText(), '💬 Domanda');
await foto(A.page, '60-famiglia-nuova-domanda');
await A.page.click('#sSalva');
await A.page.waitForFunction(() => /Domanda inviata a "Casa Rossi"/.test(document.getElementById('toastTesto').textContent), null, { timeout: 5000 });
passo('Anna: "Venerdì posso andare a Magic?" per Bruno → diventa una domanda');

await aspetta(B.page, () => document.getElementById('banner').classList.contains('on'));
assert.equal(await B.page.locator('#bnTitolo').innerText(), '💬 Anna ti chiede');
assert.match(await B.page.locator('#bnCorpo').innerText(), /Magic/);
await B.page.click('#bnChiudi');
assert.equal(await B.page.locator('#bollinoFam').innerText(), '1');
assert.match(await B.page.locator('#v-fam').innerText(), /RISPONDI TU|Rispondi tu/);
await foto(B.page, '61-famiglia-rispondi-tu');
passo('Bruno riceve "💬 Anna ti chiede", bollino 1 sulla scheda Famiglia, "Rispondi tu"');

/* ---------- Bruno risponde Sì ---------- */
await B.page.click('#v-fam .riga-guscio:has-text("Magic")');
await B.page.locator('#fDomanda.on').waitFor();
await B.page.click('#dRapide .r-si');
await B.page.locator('.bolla.mia').waitFor();
await foto(B.page, '62-famiglia-risposta');
await B.page.click('#velo', { position: { x: 20, y: 20 } });
await aspetta(A.page, () => document.getElementById('bnTitolo').textContent === '💬 Bruno ha risposto');
assert.match(await A.page.locator('#bnCorpo').innerText(), /Magic\? → Sì/);
await A.page.click('#bnChiudi');
assert.match(await A.page.locator('#v-fam').innerText(), /Bruno: Sì/);
assert.equal(await B.page.locator('#bollinoFam').isHidden(), true);
passo('Bruno risponde "Sì"; Anna riceve "💬 Bruno ha risposto" e vede "Bruno: Sì"');

/* ---------- cosa da fare insieme, spuntata dall'altro ---------- */
await A.page.click('#btnNuovo');
await A.page.fill('#sTesto', 'Comprare il latte');
await A.page.click('#sSalva');
await aspetta(B.page, () => document.querySelector('#v-fam').innerText.includes('Comprare il latte'));
await B.page.click('#v-fam .riga-guscio:has-text("Comprare il latte") .spunta');
await aspetta(A.page, () => document.getElementById('bnTitolo').textContent === '✅ Bruno ha fatto');
await A.page.click('#bnChiudi');
passo('"Comprare il latte" condiviso; Bruno lo spunta e Anna riceve "✅ Bruno ha fatto"');

/* ---------- senza rete: la risposta parte quando torna ---------- */
await A.page.click('#btnNuovo');
await A.page.fill('#sTesto', 'Stasera pizza?');
await A.page.click('#sSalva');
await aspetta(B.page, () => document.querySelector('#v-fam').innerText.includes('Pizza?')); // "stasera" diventa data e ora
await B.ctx.setOffline(true);
await B.page.click('#v-fam .riga-guscio:has-text("Pizza?")');
await B.page.fill('#dTesto', 'Volentieri!'); await B.page.click('#dInvia');
assert.match(await B.page.locator('.bolla.mia').innerText(), /invio…/);
await B.page.waitForTimeout(800);
await B.ctx.setOffline(false);
await aspetta(A.page, () => document.getElementById('bnCorpo').textContent.includes('Volentieri!'));
passo('senza rete la risposta resta in coda ("invio…") e parte appena torna la connessione');
await A.page.click('#bnChiudi');
await A.page.click('.tab[data-v="v-fam"]');
await foto(A.page, '63-famiglia-anna');

/* ---------- Bruno esce dal gruppo ---------- */
await B.page.click('#velo', { position: { x: 20, y: 20 } }).catch(() => {});
await B.page.click('#fEsci');
await B.page.locator('#fCrea').waitFor();
assert.equal(await B.page.evaluate(async () => (await (await import('./js/archivio.js')).archivio.promemoria()).filter(p => p.gruppo).length), 0);
passo('Bruno esce dalla famiglia: le voci condivise spariscono dal suo telefono');

assert.deepEqual(errori, []);
passo('nessun errore JavaScript');
await browser.close(); sito.close(); servizio.close();
