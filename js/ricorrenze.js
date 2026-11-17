// Ricorrenze e promemoria. Modulo puro (niente DOM, niente Firebase):
// lo usano sia l'app sia il Worker Cloudflare, e i test.
//
// Una voce ha:  data 'AAAA-MM-GG', ora 'HH:MM' o '', ripeti '' | 'giorno' | 'settimana' | 'mese' | 'anno',
//               anticipo (minuti prima dell'impegno, -1 = nessun promemoria), fuso (es. 'Europe/Rome').

export const RIPETI = ['', 'giorno', 'settimana', 'mese', 'anno'];
export const ANTICIPO_PREDEFINITO = 60;

const parti = s => s.split('-').map(Number);
const dueCifre = n => String(n).padStart(2, '0');
const isoUtc = t => { const d = new Date(t); return `${d.getUTCFullYear()}-${dueCifre(d.getUTCMonth() + 1)}-${dueCifre(d.getUTCDate())}`; };
const msUtc = s => { const [y, m, g] = parti(s); return Date.UTC(y, m - 1, g); };

export const aggiungiGiorni = (s, n) => isoUtc(msUtc(s) + n * 864e5);
export const giornoSettimana = s => new Date(msUtc(s)).getUTCDay();

/** La voce cade nel giorno `d` (AAAA-MM-GG)? */
export function occorreIl(v, d) {
  if (!v.data) return false;
  if (!v.ripeti) return v.data === d;
  if (d < v.data) return false;
  const [, m0, g0] = parti(v.data), [, m, g] = parti(d);
  switch (v.ripeti) {
    case 'giorno': return true;
    case 'settimana': return giornoSettimana(d) === giornoSettimana(v.data);
    case 'mese': return g === g0;
    case 'anno': return g === g0 && m === m0;
    default: return false;
  }
}

/** Prima data in cui cade la voce, a partire da `da` compreso. null se non ce ne sono. */
export function prossimaData(v, da) {
  if (!v.data) return null;
  if (!v.ripeti) return v.data >= da ? v.data : null;
  let d = da < v.data ? v.data : da;
  // Il caso peggiore è il 29 febbraio annuale: al massimo 8 anni.
  for (let i = 0; i < 366 * 8 + 2; i++, d = aggiungiGiorni(d, 1)) if (occorreIl(v, d)) return d;
  return null;
}

/** Differenza (ms) tra l'ora locale del fuso e UTC in un dato istante. */
function scarto(t, fuso) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric'
  }).formatToParts(new Date(t));
  const x = k => +p.find(q => q.type === k).value;
  return Date.UTC(x('year'), x('month') - 1, x('day'), x('hour'), x('minute'), x('second')) - Math.floor(t / 1000) * 1000;
}

/** Istante (ms) corrispondente a un'ora "da orologio da muro" in un fuso. Gestisce l'ora legale. */
export function istante(dataIso, ora, fuso) {
  const [y, m, g] = parti(dataIso);
  const [h, mi] = (ora || '00:00').split(':').map(Number);
  const muro = Date.UTC(y, m - 1, g, h, mi);
  let t = muro;
  for (let i = 0; i < 3; i++) t = muro - scarto(t, fuso);
  return t;
}

/** Data AAAA-MM-GG di un istante, vista nel fuso dato. */
export function dataNelFuso(t, fuso) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: fuso, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(t));
  const x = k => +p.find(q => q.type === k).value;
  return `${x('year')}-${dueCifre(x('month'))}-${dueCifre(x('day'))}`;
}

/** Momento del promemoria per un'occorrenza. Senza ora: alle 8:00 (del giorno, o del giorno prima). */
export function momentoAvviso(dataIso, ora, anticipo, fuso) {
  let a = anticipo ?? ANTICIPO_PREDEFINITO;
  if (a < 0) return null;
  if (!ora) a = a >= 1440 ? 1440 : 0;
  return istante(dataIso, ora || '08:00', fuso) - a * 60000;
}

/** Prossimo promemoria (ms) strettamente dopo `adesso`, o null. */
export function prossimoAvviso(v, adesso, fusoPredefinito = 'Europe/Rome') {
  if (v.tipo !== 'impegno' || !v.data || (v.anticipo ?? 0) < 0) return null;
  const fuso = v.fuso || fusoPredefinito;
  let d = dataNelFuso(adesso, fuso);
  for (let i = 0; i < 5; i++) {
    const occ = prossimaData(v, d);
    if (!occ) return null;
    const t = momentoAvviso(occ, v.ora, v.anticipo, fuso);
    if (t > adesso) return t;
    d = aggiungiGiorni(occ, 1);
  }
  return null;
}
