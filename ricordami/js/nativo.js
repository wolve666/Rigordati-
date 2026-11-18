// Funzioni del telefono quando RicordaMi gira come app Android (Capacitor).
// Nel browser questo modulo non fa nulla: `nativo` è false e l'app usa le funzioni web.
import { avvisiTra, istante, dataNelFuso, piuGiorni } from './nucleo/ricorrenze.js';
import { testoAvviso, riepiloghi } from './pianificatore.js';

const C = globalThis.Capacitor;
export const nativo = !!C?.isNativePlatform?.();
const P = nativo ? C.Plugins : {};
const ORIZZONTE = 14 * 864e5; // avvisi programmati in anticipo nel sistema
const MASSIMO = 150;          // Android ne regge circa 500 per app: teniamoci larghi
const COLORE = '#F2577A';

// Id numerico stabile (int Java positivo) dalla chiave dell'avviso.
const idDi = s => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return (h & 0x7fffffff) || 1; };

export async function prepara({ suAzione, suCondiviso }) {
  if (!nativo) return;
  const LN = P.LocalNotifications;
  try {
    await LN.registerActionTypes({ types: [{ id: 'PROMEMORIA', actions: [{ id: 'fatto', title: '✓ Fatto' }, { id: 'rinvia', title: '⏰ Tra 10 min' }] }] });
    await LN.createChannel({ id: 'promemoria', name: 'Promemoria', description: 'Gli avvisi dei tuoi promemoria', importance: 5, visibility: 1, vibration: true, lights: true, lightColor: COLORE });
    await LN.createChannel({ id: 'insistenti', name: 'Promemoria che insistono', description: 'Ripetuti finché non segni fatto', importance: 5, visibility: 1, vibration: true, lights: true, lightColor: COLORE });
    await LN.createChannel({ id: 'riepiloghi', name: 'Riepiloghi', description: 'Riepilogo del mattino e della sera', importance: 3, visibility: 1 });
  } catch (e) { console.warn('Canali notifiche', e); }
  LN.addListener('localNotificationActionPerformed', e => suAzione(e.actionId, e.notification?.extra || {}));
  P.Condivisione?.addListener('condiviso', d => d?.testo && suCondiviso(d.testo));
  const { testo } = (await P.Condivisione?.leggi().catch(() => null)) || {};
  if (testo) suCondiviso(testo);
}

export async function permesso() {
  if (!nativo) return null;
  return (await P.LocalNotifications.checkPermissions()).display; // 'granted' | 'denied' | 'prompt'
}
export async function chiediPermesso() {
  return (await P.LocalNotifications.requestPermissions()).display === 'granted';
}

/** Riprogramma nel sistema tutti gli avvisi dei prossimi 14 giorni. Si chiama a ogni modifica. */
export async function programma(lista, cfg, adesso = Date.now()) {
  if (!nativo) return 0;
  const LN = P.LocalNotifications;
  const notifiche = lista
    .flatMap(p => avvisiTra(p, adesso, adesso + ORIZZONTE, cfg).map(a => ({ ...a, p })))
    .sort((a, b) => a.quando - b.quando).slice(0, MASSIMO)
    .map(a => {
      const t = testoAvviso(a);
      return {
        id: idDi(a.chiave), title: t.titolo, body: t.corpo, largeBody: t.corpo,
        schedule: { at: new Date(a.quando), allowWhileIdle: true },
        channelId: a.tipo === 'insisti' ? 'insistenti' : 'promemoria', actionTypeId: 'PROMEMORIA',
        smallIcon: 'ic_stat_ricordami', iconColor: COLORE, autoCancel: true,
        extra: { id: a.p.id, occ: a.occ }
      };
    });
  // Riepiloghi dei prossimi giorni (il testo si aggiorna a ogni riprogrammazione).
  const oggi = dataNelFuso(adesso, cfg.fuso);
  for (let g = 0; g < 3; g++) {
    const giorno = piuGiorni(oggi, g);
    for (const r of riepiloghi(lista, cfg, Math.max(adesso, istante(giorno, '00:00', cfg.fuso)), istante(giorno, '23:59', cfg.fuso)))
      notifiche.push({ id: idDi(r.chiave), title: r.titolo, body: r.corpo, largeBody: r.corpo, schedule: { at: new Date(r.quando), allowWhileIdle: true }, channelId: 'riepiloghi', smallIcon: 'ic_stat_ricordami', iconColor: COLORE, extra: {} });
  }
  const { notifications: vecchie } = await LN.getPending();
  if (vecchie.length) await LN.cancel({ notifications: vecchie.map(n => ({ id: n.id })) });
  if (notifiche.length) await LN.schedule({ notifications: notifiche });
  return notifiche.length;
}

/** Avviso di prova: arriva dal sistema dopo qualche secondo, anche ad app chiusa. */
export async function prova(secondi = 5) {
  await P.LocalNotifications.schedule({ notifications: [{
    id: 1, title: 'Ecco come ti avviso!', body: 'Se mi vedi, gli avvisi funzionano anche ad app chiusa.',
    schedule: { at: new Date(Date.now() + secondi * 1000), allowWhileIdle: true }, channelId: 'promemoria', smallIcon: 'ic_stat_ricordami', iconColor: COLORE
  }] });
}

export function bollino(n, attivo) {
  if (!nativo || !P.Badge) return;
  (attivo && n ? P.Badge.set({ count: n }) : P.Badge.clear()).catch(() => {});
}
export function vibra(tipo = 'leggero') {
  if (!nativo) return false;
  if (tipo === 'successo') P.Haptics?.notification({ type: 'SUCCESS' }).catch(() => {});
  else P.Haptics?.impact({ style: tipo === 'forte' ? 'HEAVY' : 'LIGHT' }).catch(() => {});
  return true;
}
export function barraStato(scuro, colore) {
  if (!nativo || !P.StatusBar) return;
  P.StatusBar.setStyle({ style: scuro ? 'DARK' : 'LIGHT' }).catch(() => {});
  P.StatusBar.setBackgroundColor({ color: colore }).catch(() => {});
}

/** Salva un file e apre il menu "Condividi" di Android (backup, calendario). */
export async function condividiFile(nome, testo, titolo) {
  const { uri } = await P.Filesystem.writeFile({ path: nome, data: testo, directory: 'CACHE', encoding: 'utf8' });
  await P.Share.share({ title: titolo, files: [uri], dialogTitle: titolo });
}
