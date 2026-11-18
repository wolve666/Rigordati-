// Prova dello strato Android (js/nativo.js) con un Capacitor finto: cosa l'app chiede al sistema.
// L'APK vero va provato su un telefono; qui si verifica che le chiamate ai plugin siano giuste.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || 'playwright');
const RADICE = resolve(new URL('../..', import.meta.url).pathname);
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/json' };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try { const f = join(RADICE, p.endsWith('/') ? p + 'index.html' : p); if (!f.startsWith(RADICE)) throw 0; res.writeHead(200, { 'Content-Type': TIPI[extname(f)] || 'application/octet-stream' }).end(await readFile(f)); }
  catch { res.writeHead(404).end(); }
}).listen(0);
const BASE = `http://localhost:${server.address().port}/`;

// Capacitor finto: registra ogni chiamata in window.__chiamate.
const FINTO = () => {
  const chiamate = window.__chiamate = [];
  const ascolti = window.__ascolti = {};
  const condiviso = sessionStorage.getItem('__condiviso');
  sessionStorage.removeItem('__condiviso');
  const plugin = nome => new Proxy({}, { get: (t, metodo) => metodo in t ? t[metodo] : async arg => {
    chiamate.push({ plugin: nome, metodo, arg: JSON.parse(JSON.stringify(arg ?? null)) });
    if (metodo === 'addListener') { (ascolti[`${nome}.${arg}`] ||= []); return { remove() {} }; }
    if (metodo === 'checkPermissions' || metodo === 'requestPermissions') return { display: 'granted' };
    if (metodo === 'getPending') return { notifications: (window.__programmate || []).map(n => ({ id: n.id })) };
    if (metodo === 'schedule') { window.__programmate = arg.notifications; return {}; }
    if (metodo === 'leggi') return { testo: condiviso };
    if (metodo === 'writeFile') return { uri: 'file:///cache/' + arg.path };
    return {};
  } });
  const nomi = ['LocalNotifications', 'Condivisione', 'Badge', 'Haptics', 'StatusBar', 'Filesystem', 'Share'];
  const Plugins = Object.fromEntries(nomi.map(n => [n, plugin(n)]));
  // addListener vero: conservo la funzione per poter simulare gli eventi
  for (const n of nomi) Plugins[n].addListener = async (evento, fn) => { (ascolti[`${n}.${evento}`] ||= []).push(fn); return { remove() {} }; };
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins };
};

const browser = await chromium.launch(process.env.CANALE ? { channel: process.env.CANALE } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'it-IT', timezoneId: 'Europe/Rome' });
await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
await ctx.addInitScript(FINTO);
const page = await ctx.newPage();
const errori = [];
page.on('pageerror', e => errori.push(e.message));
page.on('dialog', d => d.accept());
const passo = m => console.log('✓', m);
const chiamate = (plugin, metodo) => page.evaluate(([p, m]) => window.__chiamate.filter(c => c.plugin === p && (!m || c.metodo === m)), [plugin, metodo]);

await page.goto(BASE);
await page.click('#benvenuto .passo.on [data-avanti]');
await page.click('.profilo[data-p="scordarello"]');
await page.click('#bProfiloAvanti');
await page.click('#benvenuto .passo.on [data-avanti]');
await page.click('#bNotifiche');
await page.waitForFunction(() => document.getElementById('benvenuto').hidden);
await page.waitForFunction(() => (window.__programmate || []).length > 0, null, { timeout: 5000 });

assert.equal((await chiamate('LocalNotifications', 'requestPermissions')).length, 1, 'chiede il permesso');
const canali = (await chiamate('LocalNotifications', 'createChannel')).map(c => c.arg.id);
assert.deepEqual(canali, ['promemoria', 'insistenti', 'riepiloghi']);
const azioni = (await chiamate('LocalNotifications', 'registerActionTypes'))[0].arg.types[0].actions.map(a => a.id);
assert.deepEqual(azioni, ['fatto', 'rinvia']);
passo('primo avvio: permesso, canali di notifica, azioni Fatto / Tra 10 min');

const prog = await page.evaluate(() => window.__programmate);
const ora = Date.now();
assert.ok(prog.length >= 5, 'avvisi programmati: ' + prog.length);
assert.ok(prog.every(n => Number.isInteger(n.id) && n.id > 0 && n.id < 2 ** 31), 'id interi positivi');
assert.equal(new Set(prog.map(n => n.id)).size, prog.length, 'id unici');
assert.ok(prog.every(n => new Date(n.schedule.at) > ora - 1000 && new Date(n.schedule.at) < ora + 15 * 864e5), 'entro 14 giorni');
assert.ok(prog.every(n => n.schedule.allowWhileIdle && n.smallIcon === 'ic_stat_ricordami'), 'anche a telefono in riposo, con icona "!!"');
assert.ok(prog.some(n => n.title === 'Palestra' && n.actionTypeId === 'PROMEMORIA' && n.extra.id), 'promemoria ripetuto con azioni');
assert.ok(prog.some(n => n.channelId === 'riepiloghi'), 'riepilogo del mattino');
passo(`${prog.length} avvisi programmati nel sistema per i prossimi 14 giorni (ora esatta, anche a riposo)`);

const bol = await chiamate('Badge', 'set');
assert.ok(bol.length && bol.at(-1).arg.count >= 1, 'bollino sull\'icona');
assert.ok((await chiamate('StatusBar', 'setStyle')).length, 'barra di stato del colore del tema');
passo(`bollino sull'icona: ${bol.at(-1).arg.count}; barra di stato intonata al tema`);

// Tocco "Fatto" sulla notifica della palestra
const palestra = prog.find(n => n.title === 'Palestra');
await page.evaluate(n => window.__ascolti['LocalNotifications.localNotificationActionPerformed'][0]({ actionId: 'fatto', notification: n }), palestra);
await page.waitForFunction(id => !(window.__programmate || []).some(n => n.id === id), palestra.id, { timeout: 5000 });
passo('"✓ Fatto" dalla notifica: segnato e avviso tolto dal sistema');

// Tocco "Tra 10 min"
const altra = (await page.evaluate(() => window.__programmate)).find(n => n.extra?.id && n.channelId !== 'riepiloghi');
await page.evaluate(n => window.__ascolti['LocalNotifications.localNotificationActionPerformed'][0]({ actionId: 'rinvia', notification: n }), altra);
await page.waitForFunction(() => (window.__programmate || []).some(n => Math.abs(new Date(n.schedule.at) - Date.now() - 600e3) < 5000), null, { timeout: 5000 });
passo('"⏰ Tra 10 min" dalla notifica: riprogrammato fra 10 minuti');

// Avviso di prova dalle impostazioni
await page.click('.tab[data-v="v-imp"]');
assert.match(await page.locator('#v-imp').innerText(), /ora esatta anche ad app chiusa/);
await page.click('#iProva');
assert.ok((await chiamate('LocalNotifications', 'schedule')).some(c => c.arg.notifications[0].id === 1), 'avviso di prova');
passo('impostazioni: notifiche attive, avviso di prova del sistema');

// Backup: file + menu Condividi di Android
await page.click('#iEsporta');
await page.waitForFunction(() => window.__chiamate.some(c => c.plugin === 'Share'));
assert.match((await chiamate('Filesystem', 'writeFile'))[0].arg.path, /backup.*\.json$/);
passo('backup: file salvato e menu "Condividi" di Android');

// Testo condiviso da WhatsApp all'avvio
await page.evaluate(() => sessionStorage.setItem('__condiviso', 'Ricordati di pagare il bollo venerdì alle 10'));
await page.reload();
await page.locator('#fScheda.on').waitFor({ timeout: 5000 });
assert.match(await page.inputValue('#sTesto'), /pagare il bollo/);
assert.match(await page.locator('#sCapito').innerText(), /10:00/);
passo('"Condividi → Ricordamelo" da un\'altra app apre il promemoria già capito');

assert.deepEqual(errori, []);
passo('nessun errore JavaScript');
await browser.close(); server.close();
