// "Capisco la frase": da "ogni lunedì e giovedì palestra alle 18 #salute !" a un promemoria.
// Modulo puro, testato in test/capisci.test.mjs.
import { pad, iso, MESI, GIORNI } from './date.js';

const NUMERI = { un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, dieci: 10, quindici: 15, venti: 20, trenta: 30 };
const num = s => NUMERI[s] ?? +s;
const GIORNO = '(domenica|lunedi|martedi|mercoledi|giovedi|venerdi|sabato)';
const PLURALE = { domeniche: 'domenica', sabati: 'sabato' };
const FASCE = { mattina: '09:00', stamattina: '09:00', stamani: '09:00', pomeriggio: '15:00', sera: '20:00', stasera: '20:00', notte: '22:00', stanotte: '22:00' };

const normalizza = t => t.toLowerCase()
  .replace(/[àá]/g, 'a').replace(/[èé]/g, 'e').replace(/[ìí]/g, 'i').replace(/[òó]/g, 'o').replace(/[ùú]/g, 'u').replace(/’/g, "'");
const piu = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const verso = (base, nome, saltaOggi) => {
  let diff = (GIORNI.indexOf(nome) - base.getDay() + 7) % 7;
  if (diff === 0 && saltaOggi) diff = 7;
  return piu(base, diff);
};

/**
 * @param {string} testo
 * @param {Date} adesso  istante attuale (iniettabile per i test)
 * @returns {{titolo:string, data:string, ora:string, ripeti:object|null, priorita:0|1|2, lista:string}}
 */
export function capisci(testo, adesso = new Date()) {
  const base = new Date(adesso); base.setHours(0, 0, 0, 0);
  let n = normalizza(testo);
  let data = null, ora = '', ripeti = null, priorita = 0, lista = '', fascia = '';
  const tagli = [];
  const prendi = (re, fn) => {
    const m = re.exec(n);
    if (!m || fn(m) === false) return false;
    tagli.push([m.index, m.index + m[0].length]);
    n = n.slice(0, m.index) + ' '.repeat(m[0].length) + n.slice(m.index + m[0].length);
    return true;
  };
  const orario = (h, m) => (+h > 23 || +m > 59) ? false : (ora = `${pad(+h)}:${pad(+m)}`, true);

  /* lista e priorità */
  prendi(/(?:^|\s)#([\p{L}\d_-]+)/u, m => { lista = m[1]; });
  prendi(/\s*!{1,3}\s*$/, m => { priorita = m[0].trim().length >= 2 ? 2 : 1; });
  prendi(/\b(urgente|urgentissimo|importante)\b/, m => { priorita = Math.max(priorita, m[1] === 'importante' ? 1 : 2); });

  /* tra N minuti / ore: data e ora insieme */
  if (prendi(/\b(?:tra|fra)\s+(mezz'ora|mezzora|un'ora|(\d+|un|una|due|tre|quattro|cinque|dieci|quindici|venti|trenta)\s+(minuti|minuto|ore|ora))\b/, m => {
    const minuti = /mezz/.test(m[1]) ? 30 : /un'ora/.test(m[1]) ? 60 : num(m[2]) * (m[3].startsWith('or') ? 60 : 1);
    const t = new Date(adesso.getTime() + minuti * 60000);
    data = new Date(t); data.setHours(0, 0, 0, 0);
    ora = `${pad(t.getHours())}:${pad(t.getMinutes())}`;
  })) {}

  /* ora */
  if (!ora) {
    prendi(/\b(?:alle|ore|h|verso le)\s*(\d{1,2})(?:[:.](\d{2}))?\b/, m => orario(m[1], m[2] || 0))
      || prendi(/\b(\d{1,2})[:.](\d{2})\b/, m => orario(m[1], m[2]))
      || prendi(/\b(?:a\s+)?mezzogiorno\b/, () => orario(12, 0))
      || prendi(/\b(?:a\s+)?mezzanotte\b/, () => orario(23, 59));
  }

  /* ripetizione */
  const giornoDi = s => PLURALE[s] || s;
  if (prendi(new RegExp(`\\b(?:ogni|tutti i|tutte le|il|la)\\s+(${'domenic(?:a|he)|lunedi|martedi|mercoledi|giovedi|venerdi|sabat[oi]'})((?:\\s*(?:,|e)\\s*(?:il\\s+|la\\s+)?(?:domenic(?:a|he)|lunedi|martedi|mercoledi|giovedi|venerdi|sabat[oi]))*)(?=\\s|$)`), m => {
    if (!/^(ogni|tutti|tutte)/.test(m[0]) && !m[2]) return false; // "il lunedì" da solo non è una ripetizione
    const nomi = [m[1], ...(m[2].match(/domenic(?:a|he)|lunedi|martedi|mercoledi|giovedi|venerdi|sabat[oi]/g) || [])].map(giornoDi);
    ripeti = { ogni: 'settimana', ogniN: 1, giorni: [...new Set(nomi.map(x => GIORNI.indexOf(x)))].sort() };
    data = nomi.map(x => verso(base, x, false)).sort((a, b) => a - b)[0];
  })) {}
  else if (prendi(/\b(?:nei giorni feriali|dal lunedi al venerdi|ogni giorno feriale|tutti i giorni feriali)\b/, () => {
    ripeti = { ogni: 'settimana', ogniN: 1, giorni: [1, 2, 3, 4, 5] };
  })) {}
  else if (prendi(/\b(?:nel|ogni|tutti i)\s+(?:fine settimana|weekend|week-end)\b/, () => {
    ripeti = { ogni: 'settimana', ogniN: 1, giorni: [0, 6] };
  })) {}
  else if (prendi(/\bogni\s+(\d+|due|tre|quattro|cinque|sei|sette|otto|dieci|quindici)\s+(giorni|settimane|mesi|anni)\b/, m => {
    ripeti = { ogni: { giorni: 'giorno', settimane: 'settimana', mesi: 'mese', anni: 'anno' }[m[2]], ogniN: num(m[1]) };
  })) {}
  else if (prendi(/\b(?:ogni giorno|tutti i giorni|quotidiano|ogni mattina|ogni sera)\b/, m => {
    ripeti = { ogni: 'giorno', ogniN: 1 };
    if (m[0].endsWith('mattina')) fascia = '09:00'; else if (m[0].endsWith('sera')) fascia = '20:00';
  })) {}
  else if (prendi(/\b(?:ogni settimana|settimanale)\b/, () => { ripeti = { ogni: 'settimana', ogniN: 1 }; })) {}
  else if (prendi(/\b(?:ogni mese|mensile|tutti i mesi)\b/, () => { ripeti = { ogni: 'mese', ogniN: 1 }; })) {}
  else if (prendi(/\b(?:ogni anno|annuale|tutti gli anni)\b/, () => { ripeti = { ogni: 'anno', ogniN: 1 }; })) {}
  else if (/\b(?:compleanno|anniversario|onomastico)\b/.test(n)) ripeti = { ogni: 'anno', ogniN: 1 };

  /* giorno */
  prendi(/\bentro\b/, () => {}); // "entro venerdì" = venerdì
  if (data) {}
  else if (prendi(/\bdopodomani\b/, () => { data = piu(base, 2); })) {}
  else if (prendi(/\bdomani(?:\s+(mattina|pomeriggio|sera))?\b/, m => { data = piu(base, 1); if (m[1]) fascia = FASCE[m[1]]; })) {}
  else if (prendi(/\b(oggi|stasera|stamattina|stanotte|stamani|oggi pomeriggio)\b/, m => { data = new Date(base); fascia = FASCE[m[1].replace('oggi ', '')] || ''; })) {}
  else if (prendi(/\b(?:fra|tra)\s+(\d{1,2}|un|una|due|tre|quattro|cinque)\s+(giorni|giorno|settimane|settimana|mesi|mese)\b/, m => {
    const k = num(m[1]);
    if (m[2].startsWith('mes')) { data = new Date(base); data.setMonth(data.getMonth() + k); }
    else data = piu(base, m[2].startsWith('settiman') ? k * 7 : k);
  })) {}
  else if (prendi(/\b(?:la\s+)?settimana prossima\b/, () => { data = verso(base, 'lunedi', true); })) {}
  else if (prendi(/\b(?:il\s+)?(?:prossimo\s+)?(?:fine settimana|weekend)\b/, () => { data = verso(base, 'sabato', false); })) {}
  else if (prendi(new RegExp(`\\b(\\d{1,2})\\s+(${MESI.join('|')})(?:\\s+(\\d{4}))?\\b`), m => {
    const y = m[3] ? +m[3] : base.getFullYear();
    data = new Date(y, MESI.indexOf(m[2]), +m[1]);
    if (data.getMonth() !== MESI.indexOf(m[2])) return (data = null, false);
    if (!m[3] && data < base && !ripeti) data.setFullYear(y + 1);
    if (!m[3] && data < base && ripeti) data.setFullYear(y + 1);
  })) {}
  else if (prendi(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, m => {
    let y = m[3] ? +m[3] : base.getFullYear(); if (y < 100) y += 2000;
    if (+m[2] < 1 || +m[2] > 12) return false;
    data = new Date(y, +m[2] - 1, +m[1]);
    if (!m[3] && data < base) data.setFullYear(y + 1);
  })) {}
  else if (prendi(new RegExp(`\\b(?:(?:il|la)\\s+)?(prossim[oa]\\s+)?${GIORNO}(\\s+prossim[oa])?(?:\\s+(\\d{1,2})\\b(?![:.]\\d))?(?:\\s+(mattina|pomeriggio|sera))?`), m => {
    const nome = m[2], numero = m[4] ? +m[4] : null;
    if (m[5]) fascia = FASCE[m[5]];
    if (numero) {
      for (let i = 0; i < 24 && !data; i++) {
        const d = new Date(base.getFullYear(), base.getMonth() + i, numero);
        if (d.getDate() === numero && d >= base && d.getDay() === GIORNI.indexOf(nome)) data = d;
      }
      if (!data) { data = new Date(base.getFullYear(), base.getMonth(), numero); if (data < base) data.setMonth(data.getMonth() + 1); }
    } else data = verso(base, nome, !!(m[1] || m[3]));
  })) {}
  else prendi(/\b(?:il|per il)\s+(\d{1,2})\b(?![:./]\d)/, m => {
    const g = +m[1]; if (g < 1 || g > 31) return false;
    for (let i = 0; i < 3 && !data; i++) { const d = new Date(base.getFullYear(), base.getMonth() + i, g); if (d.getDate() === g && d >= base) data = d; }
    if (!data) return false;
  });

  if (!ora && fascia) ora = fascia;
  if (!ora) prendi(/\b(?:di |la |in )?(mattina|pomeriggio|sera)\b/, m => { if (data || ripeti) ora = FASCE[m[1]]; else return false; });
  if (ripeti && !data) {
    data = new Date(base);
    if (ripeti.giorni?.length) { while (!ripeti.giorni.includes(data.getDay())) data = piu(data, 1); }
  }
  if (ora && !data) {
    // Solo l'ora: oggi, oppure domani se è già passata.
    data = new Date(base);
    const [h, mi] = ora.split(':').map(Number);
    if (h * 60 + mi <= adesso.getHours() * 60 + adesso.getMinutes()) data = piu(base, 1);
  }

  let titolo = testo;
  tagli.sort((a, b) => b[0] - a[0]).forEach(([a, b]) => titolo = titolo.slice(0, a) + ' ' + titolo.slice(b));
  titolo = titolo.replace(/\s+/g, ' ').replace(/\s+([?!.,;:])/g, '$1').trim();
  for (let prima; prima !== titolo;) {
    prima = titolo;
    titolo = titolo.replace(/^(il|lo|la|di|a|per|alle|ore|del|dal|e|che)\s+/i, '').replace(/[\s,]+(il|di|a|per|alle|ore|del|dal|la|e|entro)$/i, '').trim();
  }
  if (!titolo) titolo = testo.trim();
  titolo = titolo.charAt(0).toUpperCase() + titolo.slice(1);

  return { titolo, data: data ? iso(data) : '', ora, ripeti, priorita, lista };
}
