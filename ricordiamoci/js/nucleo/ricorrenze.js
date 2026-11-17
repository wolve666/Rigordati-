// Ripetizioni, scadenze e avvisi. Modulo puro: lo usano la pagina, il service worker e i test.
//
// Un promemoria ha:
//   data 'AAAA-MM-GG' | ''      ora 'HH:MM' | '' (senza ora = "in giornata")
//   ripeti null | { ogni: 'giorno'|'settimana'|'mese'|'anno', ogniN: 1, giorni: [0..6], fino: 'AAAA-MM-GG' }
//   avvisi [minuti prima]       insisti minuti (0 = no): ripete l'avviso dopo la scadenza finché non è fatto
//   fatto (singolo)  fatti { 'AAAA-MM-GG': true } (ripetuti)   rinvio { occ, al } (posticipato)
//   fuso 'Europe/Rome'

const dueCifre = n => String(n).padStart(2, '0');
const parti = s => s.split('-').map(Number);
const msUtc = s => { const [y, m, g] = parti(s); return Date.UTC(y, m - 1, g); };
const isoUtc = t => { const d = new Date(t); return `${d.getUTCFullYear()}-${dueCifre(d.getUTCMonth() + 1)}-${dueCifre(d.getUTCDate())}`; };

export const piuGiorni = (s, n) => isoUtc(msUtc(s) + n * 864e5);
export const giornoSettimana = s => new Date(msUtc(s)).getUTCDay();
export const giorniTra = (a, b) => Math.round((msUtc(b) - msUtc(a)) / 864e5);
const lunediDi = s => piuGiorni(s, -((giornoSettimana(s) + 6) % 7));

/** Il promemoria cade nel giorno d? */
export function occorreIl(p, d) {
  if (!p.data) return false;
  const r = p.ripeti;
  if (!r) return p.data === d;
  if (d < p.data || (r.fino && d > r.fino)) return false;
  const n = Math.max(1, r.ogniN || 1);
  const [y0, m0, g0] = parti(p.data), [y, m, g] = parti(d);
  switch (r.ogni) {
    case 'giorno': return giorniTra(p.data, d) % n === 0;
    case 'settimana': {
      const giorni = r.giorni?.length ? r.giorni : [giornoSettimana(p.data)];
      return giorni.includes(giornoSettimana(d)) && (giorniTra(lunediDi(p.data), lunediDi(d)) / 7) % n === 0;
    }
    case 'mese': return g === g0 && ((y - y0) * 12 + m - m0) % n === 0;
    case 'anno': return g === g0 && m === m0 && (y - y0) % n === 0;
    default: return false;
  }
}

/** Prima data (>= da) in cui cade il promemoria, o null. */
export function prossimaData(p, da) {
  if (!p.data) return null;
  if (!p.ripeti) return p.data >= da ? p.data : null;
  let d = da < p.data ? p.data : da;
  for (let i = 0; i < 366 * 8 + 2; i++, d = piuGiorni(d, 1)) {
    if (p.ripeti.fino && d > p.ripeti.fino) return null;
    if (occorreIl(p, d)) return d;
  }
  return null;
}

/** Tutte le date in cui cade tra da e a (compresi). */
export function dateTra(p, da, a) {
  const out = [];
  if (!p.data) return out;
  if (!p.ripeti) return p.data >= da && p.data <= a ? [p.data] : out;
  for (let d = da < p.data ? p.data : da; d <= a; d = piuGiorni(d, 1)) if (occorreIl(p, d)) out.push(d);
  return out;
}

/* ---------- fusi orari ---------- */
function scarto(t, fuso) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(t));
  const x = k => +p.find(q => q.type === k).value;
  return Date.UTC(x('year'), x('month') - 1, x('day'), x('hour'), x('minute'), x('second')) - Math.floor(t / 1000) * 1000;
}
/** Istante (ms) di un'ora "da orologio" in un fuso; gestisce l'ora legale. */
export function istante(dataIso, ora, fuso) {
  const [y, m, g] = parti(dataIso);
  const [h, mi] = (ora || '00:00').split(':').map(Number);
  const muro = Date.UTC(y, m - 1, g, h, mi);
  let t = muro;
  for (let i = 0; i < 3; i++) t = muro - scarto(t, fuso);
  return t;
}
export function dataNelFuso(t, fuso) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: fuso, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(t));
  const x = k => +p.find(q => q.type === k).value;
  return `${x('year')}-${dueCifre(x('month'))}-${dueCifre(x('day'))}`;
}

/* ---------- stato e scadenze ---------- */
export const fattoIl = (p, occ) => p.ripeti ? !!p.fatti?.[occ] : !!p.fatto;
const FUSO = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome';

/** Momento della scadenza di un'occorrenza. Senza ora: l'ora "in giornata" delle impostazioni. */
export function scadenza(p, occ, cfg = {}) {
  return istante(occ, p.ora || cfg.oraGiornata || '09:00', p.fuso || cfg.fuso || FUSO());
}

/**
 * Avvisi da mostrare nell'intervallo (da, a]. Ognuno ha una chiave unica, per non ripeterlo.
 * @returns {{quando:number, occ:string, tipo:'avviso'|'insisti'|'rinvio', minuti:number, chiave:string}[]}
 */
export function avvisiTra(p, da, a, cfg = {}) {
  const out = [];
  if (!p.data) return out;
  const fuso = p.fuso || cfg.fuso || FUSO();
  const avvisi = p.avvisi ?? cfg.avvisi ?? [0];
  const maxPrima = Math.max(0, ...avvisi);
  const insisti = p.insisti || 0, volte = cfg.insistiVolte ?? 6;
  const coda = insisti * volte;
  const d0 = dataNelFuso(da - coda * 60000 - 864e5, fuso);
  const d1 = dataNelFuso(a + maxPrima * 60000 + 864e5, fuso);
  const dentro = t => t > da && t <= a;
  for (const occ of dateTra(p, d0, d1)) {
    if (fattoIl(p, occ)) continue;
    const scad = scadenza(p, occ, cfg);
    const rinviato = p.rinvio?.occ === occ;
    if (rinviato) {
      if (dentro(p.rinvio.al)) out.push({ quando: p.rinvio.al, occ, tipo: 'rinvio', minuti: 0, chiave: `${p.id}|${occ}|r${p.rinvio.al}` });
      continue; // rinviato: valgono solo il rinvio e l'insistenza dopo di esso
    }
    const visti = new Set();
    for (const m of [...new Set(avvisi)].sort((x, y) => y - x)) {
      // Senza ora si avvisa solo a giorni interi, all'ora "in giornata".
      const t = p.ora ? scad - m * 60000 : scad - Math.floor(m / 1440) * 864e5;
      if (visti.has(t)) continue;
      visti.add(t);
      if (dentro(t)) out.push({ quando: t, occ, tipo: 'avviso', minuti: m, chiave: `${p.id}|${occ}|${m}` });
    }
    for (let k = 1; insisti && k <= volte; k++) {
      const t = scad + k * insisti * 60000;
      if (dentro(t)) out.push({ quando: t, occ, tipo: 'insisti', minuti: -k * insisti, chiave: `${p.id}|${occ}|i${k}` });
    }
  }
  return out.sort((x, y) => x.quando - y.quando);
}

/** Prossimo avviso (ms) dopo `adesso`, entro `orizzonte` giorni. */
export function prossimoAvviso(p, adesso, cfg = {}, orizzonte = 40) {
  const l = avvisiTra(p, adesso, adesso + orizzonte * 864e5, cfg);
  return l.length ? l[0].quando : null;
}

/**
 * Occorrenze tra due date, con scadenza e stato: la base di tutte le viste.
 * @returns {{p, occ, scad, fatto}[]}
 */
export function agenda(lista, da, a, cfg = {}) {
  const out = [];
  for (const p of lista) for (const occ of dateTra(p, da, a)) out.push({ p, occ, scad: p.rinvio?.occ === occ ? p.rinvio.al : scadenza(p, occ, cfg), fatto: fattoIl(p, occ) });
  return out.sort((x, y) => x.scad - y.scad);
}

/** Cose scadute e non fatte (per i ripetuti conta solo l'ultima occorrenza mancata). */
export function inRitardo(lista, adesso, cfg = {}, giorni = 30) {
  const fuso = cfg.fuso || FUSO();
  const oggi = dataNelFuso(adesso, fuso);
  const voci = agenda(lista, piuGiorni(oggi, -giorni), oggi, cfg).filter(x => !x.fatto && x.scad < adesso);
  const ultima = new Map();
  for (const x of voci) ultima.set(x.p.id, x);
  return [...ultima.values()].sort((x, y) => x.scad - y.scad);
}
