// Prova dell'app vera nel browser (Chromium di Playwright). Con FOTO=cartella salva le anteprime.
//   node test/e2e/prova.mjs
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const RADICE = resolve(new URL('../..', import.meta.url).pathname);
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const FOTO = process.env.FOTO && resolve(process.env.FOTO);

const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const f = join(RADICE, p.endsWith('/') ? p + 'index.html' : p);
    if (!f.startsWith(RADICE)) throw 0;
    res.writeHead(200, { 'Content-Type': TIPI[extname(f)] || 'application/octet-stream' }).end(await readFile(f));
  } catch { res.writeHead(404).end(); }
}).listen(0);
const BASE = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch({ args: ['--lang=it-IT'], ...(process.env.CANALE ? { channel: process.env.CANALE } : {}) });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: FOTO ? 2 : 1, locale: 'it-IT', timezoneId: 'Europe/Rome', serviceWorkers: 'block', colorScheme: 'light' });
if (!FOTO) await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
const page = await ctx.newPage();
// Ora fissa per anteprime ripetibili: mercoledì 18 novembre 2026, 10:30.
if (FOTO) await page.clock.setFixedTime(new Date('2026-11-18T10:30:00+01:00'));
const errori = [];
page.on('pageerror', e => errori.push(e.message));
page.on('console', m => m.type() === 'error' && !/fonts\.g/.test(m.text()) && errori.push(m.text()));
page.on('dialog', d => d.accept());
const passo = m => console.log('✓', m);
const vedi = (sel, timeout = 5000) => page.locator(sel).first().waitFor({ state: 'visible', timeout });
const testo = sel => page.locator(sel).first().innerText();
const foto = async (nome, opz = {}) => {
  if (!FOTO) return;
  await mkdir(FOTO, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.getElementById('toast').classList.remove('on'));
  await page.waitForTimeout(450); // fine delle animazioni
  await page.screenshot({ path: join(FOTO, nome + '.png'), ...opz });
};
const tema = async (t, modo) => {
  await page.evaluate(async ([t, modo]) => {
    const { archivio } = await import('./js/archivio.js');
    await archivio.salvaImpostazioni({ tema: t, modo });
  }, [t, modo]);
  await page.reload();
  await vedi('#v-oggi .riassunto');
};

/* ---------- primo avvio ---------- */
await page.goto(BASE);
await vedi('#benvenuto .passo.on .logo-grande');
assert.equal(await testo('#benvenuto .passo.on h1'), 'Ricordiamoci');
await foto('01-benvenuto');
await page.click('#benvenuto .passo.on [data-avanti]');
await page.click('.profilo[data-p="scordarello"]');
await foto('02-profilo');
await page.click('#bProfiloAvanti');
await vedi('#bTemi .tema-carta');
await foto('03-stile');
await page.click('#benvenuto .passo.on [data-avanti]');
await page.click('#bDopo');
await page.waitForFunction(() => document.getElementById('benvenuto').hidden);
passo('primo avvio: profilo Scordarello, tema, esempi');

/* ---------- vista Oggi ---------- */
await vedi('#v-oggi .gruppo.ritardo');
assert.match(await testo('#g-ritardo'), /Restituire il libro a Giulia/);
assert.match(await testo('#v-oggi'), /Latte, pane, uova/);
assert.match(await testo('#v-oggi .prossimo'), /Prossimo/i);
const ritardi = +(await testo('.stat.ritardo b'));
assert.equal(ritardi, 1);
assert.ok(+(await page.textContent('#bollinoOggi')) >= 2, 'bollino sulla scheda Oggi');
await foto('10-elegante-oggi');
passo('Oggi: ritardi, prossimo, gruppi, bollino');

/* ---------- scrivere come si parla ---------- */
await page.click('#btnNuovo');
await vedi('#fScheda.on');
await page.fill('#sTesto', 'ogni lunedì e giovedì inglese alle 19 #lavoro !');
await page.waitForTimeout(100);
const capito = await testo('#sCapito');
assert.match(capito, /19:00/); assert.match(capito, /lun, gio/); assert.match(capito, /Importante/); assert.match(capito, /Lavoro/);
await page.click('#sDettagliTog');
await foto('11-elegante-nuovo');
await page.click('#sSalva');
await page.waitForFunction(() => !document.getElementById('fScheda').classList.contains('on'));
assert.match(await testo('#toast'), /Ti avviso|agenda/);
passo('frase "ogni lunedì e giovedì inglese alle 19 #lavoro !" capita e salvata');

await page.click('#btnNuovo');
await page.fill('#sTesto', 'tra 2 ore chiamare il commercialista urgente');
await page.keyboard.press('Enter');
await page.waitForFunction(() => document.querySelector('#v-oggi').innerText.includes('Chiamare il commercialista'));
assert.match(await testo('#v-oggi .prossimo, #g-oggi'), /commercialista|Tocca il cerchio/);
passo('ultimo minuto: "tra 2 ore … urgente" con invio');

/* ---------- spunta e annulla ---------- */
const riga = page.locator('#g-oggi .riga-guscio', { hasText: 'Tocca il cerchio' });
await riga.locator('.spunta').click();
await page.waitForFunction(() => document.getElementById('toastTesto').textContent.startsWith('Fatto'));
await page.waitForTimeout(900);
assert.ok(await page.locator('#g-oggi .riga.fatto', { hasText: 'Tocca il cerchio' }).count() === 1, 'resta in Oggi, barrata');
passo('spunta: fatto con animazione e "Annulla"');

/* ---------- scorri a sinistra per rimandare ---------- */
const libro = page.locator('#g-ritardo .riga', { hasText: 'Restituire il libro' });
const box = await libro.boundingBox();
await page.mouse.move(box.x + box.width - 30, box.y + box.height / 2);
await page.mouse.down();
for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width - 30 - i * 20, box.y + box.height / 2);
await page.mouse.up();
await vedi('#fRinvia.on');
await foto('12-elegante-rimanda');
await page.click('#rScelte button:has-text("Domani mattina")');
await page.waitForFunction(() => !document.querySelector('#g-ritardo')?.innerText.includes('Restituire'));
assert.match(await testo('#g-domani'), /Restituire il libro/);
passo('scorrimento a sinistra → Rimanda → domani mattina');

/* ---------- avviso dentro l'app ---------- */
await page.evaluate(async () => {
  const { archivio } = await import('./js/archivio.js');
  const d = new Date(), p2 = n => String(n).padStart(2, '0');
  await archivio.salva({ titolo: 'Togliere la torta dal forno', data: `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`, ora: `${p2(d.getHours())}:${p2(d.getMinutes())}`, avvisi: [0], insisti: 5, priorita: 2, lista: 'casa', fuso: 'Europe/Rome' });
  document.dispatchEvent(new Event('visibilitychange'));
});
await vedi('#banner.on', 8000);
assert.match(await testo('#bnTitolo'), /‼️ Togliere la torta/);
await foto('13-elegante-avviso');
await page.click('#bnFatto');
passo('avviso in-app con Fatto / Rimanda');

/* ---------- calendario, liste, impostazioni ---------- */
await page.click('.tab[data-v="v-cal"]');
await vedi('#v-cal .griglia');
const pallini = await page.locator('#v-cal .giorno .pallini i').count();
assert.ok(pallini > 5, 'pallini nel calendario: ' + pallini);
await foto('14-elegante-calendario');
await page.click('.tab[data-v="v-liste"]');
await vedi('.carta-lista');
await page.click('.carta-lista:has-text("Scadenze")');
assert.match(await testo('#v-liste'), /Pagare la bolletta/);
await page.goBack();
await vedi('.carta-lista.nuova');
await foto('15-elegante-liste');
await page.click('.tab[data-v="v-imp"]');
await vedi('#iAvvisi');
await foto('16-elegante-impostazioni');
passo('calendario con pallini, liste, impostazioni');

/* ---------- ricerca ---------- */
await page.click('#btnCerca');
await page.fill('#cercaInput', 'bolletta');
assert.match(await testo('#v-cerca'), /Pagare la bolletta/);
await page.click('#btnCerca');
passo('ricerca');

/* ---------- export .ics ---------- */
const [scaricato] = await Promise.all([page.waitForEvent('download'), page.click('.tab[data-v="v-imp"]').then(() => page.click('#iIcs'))]);
const ics = await (await import('node:fs/promises')).readFile(await scaricato.path(), 'utf8');
assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=MO,TH/); assert.match(ics, /BEGIN:VALARM/);
passo('esportazione calendario .ics con ripetizioni e avvisi');

/* ---------- temi ---------- */
await tema('elegante', 'scuro');
await foto('20-elegante-scuro-oggi');
await tema('allegro', 'chiaro');
await foto('30-allegro-oggi');
await page.click('#btnNuovo'); await page.fill('#sTesto', 'domani sera cena da Marta #personale'); await page.click('#sDettagliTog');
await foto('31-allegro-nuovo');
await page.click('#velo', { position: { x: 20, y: 20 } });
await page.click('.tab[data-v="v-liste"]'); await vedi('.carta-lista');
await foto('32-allegro-liste');
await page.click('.tab[data-v="v-cal"]'); await vedi('#v-cal .griglia');
await foto('33-allegro-calendario');
await tema('allegro', 'scuro');
await foto('40-allegro-scuro-oggi');
passo('temi Elegante e Allegro, chiaro e scuro');

/* ---------- schermo grande ---------- */
await tema('elegante', 'chiaro');
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(200);
await foto('50-computer');
await page.setViewportSize({ width: 390, height: 844 });
passo('impaginazione per computer');

/* ---------- link da altre app (condividi / pacchetto) ---------- */
await page.goto(BASE + '?text=' + encodeURIComponent('Ricordati di portare i documenti venerdì alle 10'));
await vedi('#fScheda.on');
assert.match(await page.inputValue('#sTesto'), /portare i documenti/);
assert.match(await testo('#sCapito'), /10:00/);
passo('condivisione da un\'altra app apre il promemoria già capito');

assert.deepEqual(errori, [], 'errori nella pagina');
passo('nessun errore JavaScript');
await browser.close(); server.close();
