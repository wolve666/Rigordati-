// "Capisco la frase": estrae giorno, ora, ricorrenza e tipo da un testo scritto come lo si direbbe.
// Modulo puro, testato in test/capisci.test.mjs.
import { pad, iso, MESI, GIORNI } from './date.js';

const GIORNO_RE = '(domenica|lunedi|martedi|mercoledi|giovedi|venerdi|sabato)';
const PLURALI = { domeniche: 'domenica', sabati: 'sabato' };
const SPESA_RE = /\b(comprare|compra|comprate|spesa|manca|mancano|finit[oaie])\b/;

const normalizza = t => t.toLowerCase()
  .replace(/[àá]/g, 'a').replace(/[èé]/g, 'e').replace(/[ìí]/g, 'i').replace(/[òó]/g, 'o').replace(/[ùú]/g, 'u');

const piuGiorni = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const versoGiorno = (base, nome, saltaOggi) => {
  let diff = (GIORNI.indexOf(nome) - base.getDay() + 7) % 7;
  if (diff === 0 && saltaOggi) diff = 7;
  return piuGiorni(base, diff);
};

/**
 * @param {string} testo  la frase scritta
 * @param {Date} base     "oggi" a mezzanotte (iniettabile per i test)
 * @returns {{data:string, ora:string, testo:string, tipo:string, ripeti:string, lista:string}}
 */
export function capisci(testo, base = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })()) {
  // La normalizzazione sostituisce carattere per carattere: gli indici restano allineati al testo originale.
  let n = normalizza(testo);
  let data = null, ora = '', ripeti = '';
  const tagli = [];
  const prendi = (re, fn) => {
    const m = re.exec(n);
    if (!m) return false;
    if (fn(m) === false) return false;
    tagli.push([m.index, m.index + m[0].length]);
    // Cancello il pezzo già capito, così le regole successive non lo rileggono.
    n = n.slice(0, m.index) + ' '.repeat(m[0].length) + n.slice(m.index + m[0].length);
    return true;
  };
  const orario = (h, m) => (+h > 23 || +m > 59) ? false : (ora = `${pad(+h)}:${pad(+m)}`, true);

  /* ora */
  prendi(/\b(?:alle|ore|h)\s*(\d{1,2})(?:[:.](\d{2}))?\b/, m => orario(m[1], m[2] || 0))
    || prendi(/\b(\d{1,2})[:.](\d{2})\b/, m => orario(m[1], m[2]))
    || prendi(/\ba\s+mezzogiorno\b|\bmezzogiorno\b/, () => orario(12, 0));

  /* ricorrenza */
  if (prendi(new RegExp(`\\b(?:ogni|tutti i|tutte le)\\s+(domenic(?:a|he)|lunedi|martedi|mercoledi|giovedi|venerdi|sabat[oi])\\b`), m => {
    const nome = PLURALI[m[1]] || m[1];
    ripeti = 'settimana'; data = versoGiorno(base, nome, false);
  })) {}
  else if (prendi(/\b(?:ogni giorno|tutti i giorni)\b/, () => { ripeti = 'giorno'; })) {}
  else if (prendi(/\b(?:ogni settimana|settimanale)\b/, () => { ripeti = 'settimana'; })) {}
  else if (prendi(/\b(?:ogni mese|mensile)\b/, () => { ripeti = 'mese'; })) {}
  else if (prendi(/\b(?:ogni anno|annuale)\b/, () => { ripeti = 'anno'; })) {}
  else if (/\b(?:compleanno|anniversario)\b/.test(n)) ripeti = 'anno'; // la parola resta nel testo

  /* giorno */
  if (data) {}
  else if (prendi(/\bdopodomani\b/, () => { data = piuGiorni(base, 2); })) {}
  else if (prendi(/\bdomani\b/, () => { data = piuGiorni(base, 1); })) {}
  else if (prendi(/\b(?:oggi|stasera|stamattina|stanotte|stamani)\b/, () => { data = new Date(base); })) {}
  else if (prendi(/\b(?:fra|tra)\s+(\d{1,2}|un|una|due|tre)\s+(giorni|giorno|settimane|settimana)\b/, m => {
    const k = { un: 1, una: 1, due: 2, tre: 3 }[m[1]] ?? +m[1];
    data = piuGiorni(base, m[2].startsWith('settiman') ? k * 7 : k);
  })) {}
  else if (prendi(new RegExp(`\\b(\\d{1,2})\\s+(${MESI.join('|')})(?:\\s+(\\d{4}))?\\b`), m => {
    const y = m[3] ? +m[3] : base.getFullYear();
    data = new Date(y, MESI.indexOf(m[2]), +m[1]);
    if (data.getMonth() !== MESI.indexOf(m[2])) return (data = null, false); // es. 31 aprile
    if (!m[3] && data < base) data.setFullYear(y + 1);
  })) {}
  else if (prendi(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, m => {
    let y = m[3] ? +m[3] : base.getFullYear(); if (y < 100) y += 2000;
    if (+m[2] < 1 || +m[2] > 12) return false;
    data = new Date(y, +m[2] - 1, +m[1]);
    if (!m[3] && data < base) data.setFullYear(y + 1);
  })) {}
  else if (prendi(new RegExp(`\\b(?:(?:il|la)\\s+)?(prossim[oa]\\s+)?${GIORNO_RE}(\\s+prossim[oa])?(?:\\s+(\\d{1,2})\\b(?![:.]\\d))?`), m => {
    const nome = m[2], numero = m[4] ? +m[4] : null;
    if (numero) {
      // "mercoledì 6": il primo 6 del mese che cade davvero di mercoledì.
      for (let i = 0; i < 24 && !data; i++) {
        const d = new Date(base.getFullYear(), base.getMonth() + i, numero);
        if (d.getDate() === numero && d >= base && d.getDay() === GIORNI.indexOf(nome)) data = d;
      }
      if (!data) { data = new Date(base.getFullYear(), base.getMonth(), numero); if (data < base) data.setMonth(data.getMonth() + 1); }
    } else data = versoGiorno(base, nome, !!(m[1] || m[3]));
  })) {}
  else prendi(/\b(?:il|per il)\s+(\d{1,2})\b(?![:./]\d)/, m => {
    const g = +m[1]; if (g < 1 || g > 31) return false;
    for (let i = 0; i < 3 && !data; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() + i, g);
      if (d.getDate() === g && d >= base) data = d;
    }
    if (!data) return false;
  });

  if (ripeti && !data) data = new Date(base);

  let pulito = testo;
  tagli.sort((a, b) => b[0] - a[0]).forEach(([a, b]) => pulito = pulito.slice(0, a) + ' ' + pulito.slice(b));
  pulito = pulito.replace(/\s+/g, ' ').replace(/\s+([?!.,;:])/g, '$1').trim();
  for (let prima; prima !== pulito;) {
    prima = pulito;
    pulito = pulito.replace(/^(il|lo|la|di|a|per|alle|ore|del|dal)\s+/i, '').replace(/\s+(il|di|a|per|alle|ore|del|dal|la|e)$/i, '').trim();
  }
  if (!pulito) pulito = testo.trim();

  const tipo = testo.includes('?') ? 'domanda' : (data || ora) ? 'impegno' : 'todo';
  const lista = tipo === 'todo' && SPESA_RE.test(normalizza(testo)) ? 'spesa' : '';
  return { data: data ? iso(data) : '', ora, testo: pulito, tipo, ripeti: tipo === 'impegno' ? ripeti : '', lista };
}
