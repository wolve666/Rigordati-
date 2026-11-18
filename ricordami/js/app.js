// RicordaMi — interfaccia. Nessuna dipendenza: moduli nativi del browser.
import { MARCHIO } from './marchio.js';
import { archivio } from './archivio.js';
import { PROFILI, COLORI, SCELTE_AVVISI, durata } from './profili.js';
import { capisci } from './nucleo/capisci.js';
import { MESI, GIORNI_BELLI, pad } from './nucleo/date.js';
import { agenda, inRitardo, dataNelFuso, piuGiorni, giornoSettimana, istante, fattoIl, prossimaData, scadenza, prossimoAvviso } from './nucleo/ricorrenze.js';
import { controlla, bollino, prossimo } from './pianificatore.js';
import { esportaIcs } from './ics.js';
import * as N from './nativo.js';

/* ---------- utilità ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icona = (n, cls = 'i') => `<svg class="${cls}"><use href="#i-${n}"/></svg>`;
const SEGNI = (dim = 84) => `<svg class="segni" width="${dim}" height="${dim}" fill="currentColor" stroke="currentColor" style="color:var(--accento)"><use href="#segni"/></svg>`;
const animazioni = () => document.documentElement.dataset.animazioni !== 'ridotte' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
const GSETT = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];

let lista = [], liste = [], cfg = {}, vista = 'v-oggi', listaAperta = null, ricerca = '';
let calMese = null, calGiorno = null;
const adesso = () => Date.now();
const oggiIso = () => dataNelFuso(adesso(), cfg.fuso);
const listaDi = id => liste.find(l => l.id === id);
const colore = id => `var(--c-${listaDi(id)?.colore || 'lilla'})`;

document.title = MARCHIO.nome;
document.querySelectorAll('.nome-app').forEach(e => e.textContent = MARCHIO.nome);
document.querySelectorAll('.motto').forEach(e => e.textContent = MARCHIO.motto);

/* ---------- date leggibili ---------- */
function giornoBreve(iso) {
  const o = oggiIso();
  if (iso === o) return 'Oggi';
  if (iso === piuGiorni(o, 1)) return 'Domani';
  if (iso === piuGiorni(o, -1)) return 'Ieri';
  const [y, m, g] = iso.split('-').map(Number);
  const d = new Date(y, m - 1, g);
  const diff = Math.round((d - new Date(o)) / 864e5);
  if (diff > 1 && diff < 7) return GIORNI_BELLI[d.getDay()].replace(/^./, c => c.toUpperCase());
  return `${GIORNI_BELLI[d.getDay()].slice(0, 3)} ${g} ${MESI[m - 1].slice(0, 3)}${y !== new Date().getFullYear() ? ' ' + y : ''}`;
}
function conto(scad) {
  const m = Math.round((scad - adesso()) / 60000);
  if (m < 0) { const a = -m; return a < 60 ? `${a} min fa` : a < 1440 ? `${Math.round(a / 60)} h fa` : `${Math.round(a / 1440)} g fa`; }
  if (m < 1) return 'adesso';
  if (m < 60) return `tra ${m} min`;
  if (m < 300) return `tra ${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}`;
  if (m < 1440) return `tra ${Math.round(m / 60)} h`;
  const g = Math.round(m / 1440);
  return g === 1 ? 'domani' : `tra ${g} giorni`;
}
function descriviRipeti(r, data) {
  if (!r) return '';
  const n = r.ogniN > 1 ? r.ogniN : 0;
  if (r.ogni === 'giorno') return n ? `ogni ${n} giorni` : 'ogni giorno';
  if (r.ogni === 'settimana') {
    const g = r.giorni?.length ? r.giorni : [giornoSettimana(data)];
    const nomi = g.length === 5 && !g.includes(0) && !g.includes(6) ? 'feriali' : g.length === 2 && g.includes(0) && g.includes(6) ? 'weekend' : g.map(x => GIORNI_BELLI[x].slice(0, 3)).join(', ');
    return (n ? `ogni ${n} settimane, ` : 'ogni ') + nomi;
  }
  if (r.ogni === 'mese') return n ? `ogni ${n} mesi` : 'ogni mese';
  if (r.ogni === 'anno') return 'ogni anno';
  return '';
}

/* ---------- caricamento ---------- */
async function ricarica() {
  [lista, liste, cfg] = await Promise.all([archivio.promemoria(), archivio.liste(), archivio.impostazioni()]);
  disegna();
}
archivio.ascolta(() => ricarica().then(riprogramma));
// App Android: a ogni modifica riprogrammo gli avvisi nel sistema (aspetto un attimo per raggrupparle).
let timerProgramma = null;
function riprogramma() {
  if (!N.nativo || !cfg.profilo) return;
  clearTimeout(timerProgramma);
  timerProgramma = setTimeout(() => N.programma(lista, cfg).catch(e => console.warn('Avvisi non programmati', e)), 300);
}
let permessoNativo = null;

/* ---------- viste ---------- */
function vaiA(v, storia = true) {
  if (v === vista && !listaAperta) return;
  const cambia = () => {
    vista = v; listaAperta = v === 'v-liste' ? listaAperta : null;
    document.querySelectorAll('.vista').forEach(s => s.classList.toggle('attiva', s.id === v));
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('attiva', t.dataset.v === v));
    disegna();
    $('contenuto').scrollTop = 0;
  };
  if (storia && v !== 'v-oggi') history.pushState({ v }, '');
  cambia();
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => { listaAperta = null; vaiA(t.dataset.v); });

function disegna() {
  if (!cfg.fuso) return;
  const v = $(vista);
  $('titolo').textContent = listaAperta ? `${listaDi(listaAperta)?.emoji || ''} ${listaDi(listaAperta)?.nome || ''}` : v.dataset.titolo;
  const o = new Date();
  $('sopratitolo').textContent = `${GIORNI_BELLI[o.getDay()]} ${o.getDate()} ${MESI[o.getMonth()]}`;
  ({ 'v-oggi': vistaOggi, 'v-cal': vistaCalendario, 'v-liste': vistaListe, 'v-imp': vistaImpostazioni, 'v-cerca': vistaCerca })[vista]();
  aggiornaBollino();
}

/* ---------- righe ---------- */
function riga(x, { mostraGiorno = false } = {}) {
  const p = x.p, occ = x.occ || '';
  const tardi = !x.fatto && x.scad && x.scad < adesso();
  const meta = [];
  if (occ) {
    const quando = (mostraGiorno || tardi ? giornoBreve(occ) + (p.ora ? ' · ' : '') : '') + (p.ora || (mostraGiorno || tardi ? '' : 'in giornata'));
    meta.push(`<span class="${tardi ? 'tardi' : ''}">${icona('ora')}${esc(quando)}</span>`);
  }
  if (p.ripeti) meta.push(`<span>${icona('ripeti')}${esc(descriviRipeti(p.ripeti, p.data))}</span>`);
  if (p.insisti) meta.push(`<span title="Insiste finché non è fatto">${icona('insisti')}</span>`);
  if (p.lista && listaDi(p.lista) && listaAperta !== p.lista) meta.push(`<span>${listaDi(p.lista).emoji} ${esc(listaDi(p.lista).nome)}</span>`);
  if (p.note) meta.push(`<span>${icona('nota')}</span>`);
  const flag = p.priorita ? `<span class="bandiera p${p.priorita}">${p.priorita === 2 ? '!!' : '!'}</span> ` : '';
  let coda = '';
  if (x.scad && !x.fatto) {
    const m = (x.scad - adesso()) / 60000;
    coda = `<span class="conto ${tardi ? 'tardi' : m < 120 ? 'vicino' : ''}">${conto(x.scad)}</span>`;
  }
  return `<div class="riga-guscio" data-id="${esc(p.id)}" data-occ="${esc(occ)}">
    <div class="riga-sotto"><span>${icona('ok')} Fatto</span><span>Rimanda ${icona('ora')}</span></div>
    <div class="riga ${x.fatto ? 'fatto' : ''} ${p.priorita === 2 ? 'p2' : ''}" style="--colore-lista:${p.lista ? colore(p.lista) : 'transparent'}">
      <button class="spunta" aria-label="${x.fatto ? 'Da fare' : 'Fatto'}">${icona('ok')}</button>
      <div class="riga-corpo"><div class="riga-titolo">${flag}${esc(p.titolo)}</div>${meta.length ? `<div class="riga-meta">${meta.join('')}</div>` : ''}</div>
      ${coda}
    </div></div>`;
}
const gruppo = (titolo, righe, cls = '', extra = '') => righe.length ? `<div class="gruppo ${cls}"><div class="gruppo-titolo">${titolo}<span class="num">${righe.length}</span></div><div class="lista-righe">${righe.join('')}</div>${extra}</div>` : '';
const senzaData = p => ({ p, occ: '', scad: null, fatto: !!p.fatto });
// Dei ripetuti mostro solo la prima occorrenza (un "ogni giorno" non deve riempire la settimana).
const primaPerVoce = arr => { const visti = new Set(); return arr.filter(x => !x.p.ripeti || (!visti.has(x.p.id) && visti.add(x.p.id))); };

function vuoto(titolo, testo) {
  return `<div class="vuoto">${SEGNI()}<h3>${titolo}</h3><p>${testo}</p></div>`;
}

function vistaOggi() {
  const ora = adesso(), o = oggiIso(), dom = piuGiorni(o, 1);
  const ritardo = inRitardo(lista, ora, cfg);
  const inR = new Set(ritardo.map(x => x.p.id + x.occ));
  const ag = agenda(lista, o, piuGiorni(o, 60), cfg).filter(x => !inR.has(x.p.id + x.occ));
  const dOggi = ag.filter(x => x.occ === o);
  const dDomani = ag.filter(x => x.occ === dom && !x.fatto);
  const settimana = primaPerVoce(ag.filter(x => x.occ > dom && x.occ <= piuGiorni(o, 7) && !x.fatto));
  const avanti = primaPerVoce(ag.filter(x => x.occ > piuGiorni(o, 7) && !x.fatto));
  const libere = lista.filter(p => !p.data && !p.fatto).sort((a, b) => (b.priorita || 0) - (a.priorita || 0) || b.creato - a.creato).map(senzaData);
  const restaOggi = dOggi.filter(x => !x.fatto);
  const prox = ag.find(x => !x.fatto && x.scad > ora && x.scad - ora < 7 * 864e5);

  let h = `<div class="riassunto">
    <button class="stat ${ritardo.length ? 'ritardo' : 'zero'}" data-salta="g-ritardo"><b>${ritardo.length}</b><span>in ritardo</span></button>
    <button class="stat ${restaOggi.length ? '' : 'zero'}" data-salta="g-oggi"><b>${restaOggi.length}</b><span>oggi</span></button>
    <button class="stat ${dDomani.length ? '' : 'zero'}" data-salta="g-domani"><b>${dDomani.length}</b><span>domani</span></button></div>`;
  if (prox) h += `<button class="prossimo" data-id="${esc(prox.p.id)}" data-occ="${prox.occ}"><div><small>Prossimo</small><strong>${esc(prox.p.titolo)}</strong></div><span class="conto-grande">${conto(prox.scad).replace('tra ', '')}</span></button>`;
  const tutto = ritardo.length + dOggi.length + dDomani.length + settimana.length + avanti.length + libere.length;
  if (!tutto) h += vuoto('Niente da ricordare', 'Tocca + e scrivi come parli: "domani alle 9 chiamare Marco".');
  h += `<div id="g-ritardo">${gruppo('In ritardo', ritardo.map(x => riga(x)), 'ritardo')}</div>`;
  h += `<div id="g-oggi">${gruppo('Oggi', [...dOggi.filter(x => !x.fatto), ...dOggi.filter(x => x.fatto)].map(x => riga(x)))}</div>`; // le fatte in fondo
  h += `<div id="g-domani">${gruppo('Domani', dDomani.map(x => riga(x)))}</div>`;
  h += gruppo('Questa settimana', settimana.map(x => riga(x, { mostraGiorno: true })));
  h += gruppo('Più avanti', avanti.slice(0, 8).map(x => riga(x, { mostraGiorno: true })), '', avanti.length > 8 ? `<button class="altro-btn" data-vai="v-cal">Vedi tutto nel calendario</button>` : '');
  h += gruppo('Quando capita', libere.map(x => riga(x)));
  $('v-oggi').innerHTML = h;
  $('v-oggi').querySelectorAll('[data-salta]').forEach(b => b.onclick = () => $(b.dataset.salta)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  $('v-oggi').querySelectorAll('[data-vai]').forEach(b => b.onclick = () => vaiA(b.dataset.vai));
  const pb = $('v-oggi').querySelector('.prossimo');
  if (pb) pb.onclick = () => apriScheda(lista.find(p => p.id === pb.dataset.id));
}

function vistaCalendario() {
  const o = oggiIso();
  calGiorno ||= o;
  if (!calMese) { const [y, m] = o.split('-').map(Number); calMese = { y, m }; }
  const { y, m } = calMese;
  const primo = `${y}-${pad(m)}-01`;
  const inizio = piuGiorni(primo, -((giornoSettimana(primo) + 6) % 7));
  const fine = piuGiorni(inizio, 41);
  const ag = agenda(lista, inizio, fine, cfg);
  const perGiorno = {};
  for (const x of ag) (perGiorno[x.occ] ||= []).push(x);
  let g = ['L', 'M', 'M', 'G', 'V', 'S', 'D'].map(x => `<div class="gs">${x}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = piuGiorni(inizio, i);
    const voci = (perGiorno[d] || []).filter(x => !x.fatto);
    const colori = [...new Set(voci.map(x => x.p.lista ? colore(x.p.lista) : 'var(--tenue)'))].slice(0, 3);
    g += `<button class="giorno ${+d.slice(5, 7) !== m ? 'fuori' : ''} ${d === o ? 'oggi' : ''} ${d === calGiorno ? 'sel' : ''}" data-d="${d}">${+d.slice(8)}<span class="pallini">${colori.map(c => `<i style="--colore:${c}"></i>`).join('')}</span></button>`;
  }
  const delGiorno = agenda(lista, calGiorno, calGiorno, cfg);
  $('v-cal').innerHTML = `<div class="cal"><div class="cal-testa">
      <h2>${MESI[m - 1]} ${y}</h2>
      ${calGiorno !== o || primo.slice(0, 7) !== o.slice(0, 7) ? '<button class="btn-oggi" id="calOggi">Oggi</button>' : ''}
      <button id="calPrec" aria-label="Mese precedente">${icona('sx')}</button><button id="calSucc" aria-label="Mese successivo">${icona('dx')}</button>
    </div><div class="griglia">${g}</div></div>
    ${delGiorno.length ? gruppo(giornoBreve(calGiorno), delGiorno.map(x => riga(x))) : `<div class="vuoto" style="padding-top:12px"><h3>${giornoBreve(calGiorno)}</h3><p>Giornata libera. Tocca di nuovo il giorno per aggiungere qualcosa.</p></div>`}`;
  const sposta = k => { let mm = m + k, yy = y; if (mm < 1) { mm = 12; yy--; } if (mm > 12) { mm = 1; yy++; } calMese = { y: yy, m: mm }; vistaCalendario(); };
  $('calPrec').onclick = () => sposta(-1);
  $('calSucc').onclick = () => sposta(1);
  if ($('calOggi')) $('calOggi').onclick = () => { calGiorno = o; calMese = null; vistaCalendario(); };
  $('v-cal').querySelectorAll('.giorno').forEach(b => b.onclick = () => {
    if (b.dataset.d === calGiorno) return apriScheda(null, { data: b.dataset.d });
    calGiorno = b.dataset.d;
    const [yy, mm] = calGiorno.split('-').map(Number);
    if (mm !== m) calMese = { y: yy, m: mm };
    vistaCalendario();
  });
}

function attiviDiLista(id) {
  const ora = adesso(), o = oggiIso();
  const rit = inRitardo(lista, ora, cfg).filter(x => x.p.lista === id);
  const inR = new Set(rit.map(x => x.p.id + x.occ));
  const fut = primaPerVoce(agenda(lista.filter(p => p.lista === id), o, piuGiorni(o, 366), cfg).filter(x => !x.fatto && !inR.has(x.p.id + x.occ)));
  const lib = lista.filter(p => p.lista === id && !p.data && !p.fatto).map(senzaData);
  return { rit, fut, lib, n: rit.length + fut.length + lib.length };
}

function vistaListe() {
  if (listaAperta) {
    const { rit, fut, lib, n } = attiviDiLista(listaAperta);
    $('v-liste').innerHTML = `<button class="indietro" id="lIndietro">${icona('sx')} Tutte le liste</button>
      ${n ? '' : vuoto('Lista vuota', 'Aggiungi qualcosa con +: finirà in questa lista.')}
      ${gruppo('In ritardo', rit.map(x => riga(x, { mostraGiorno: true })), 'ritardo')}
      ${gruppo('In programma', fut.map(x => riga(x, { mostraGiorno: true })))}
      ${gruppo('Quando capita', lib.map(x => riga(x)))}
      <button class="btn largo" id="lModifica" style="margin-top:8px">Modifica lista</button>`;
    $('lIndietro').onclick = () => history.back();
    $('lModifica').onclick = () => apriFoglioLista(listaDi(listaAperta));
    return;
  }
  $('v-liste').innerHTML = `<div class="griglia-liste">${liste.map(l => {
    const n = attiviDiLista(l.id).n;
    return `<button class="carta-lista" data-l="${esc(l.id)}" style="--colore-lista:var(--c-${l.colore})"><span class="emoji">${esc(l.emoji)}</span><div><b>${esc(l.nome)}</b><br><small>${n ? `${n} da ricordare` : 'Niente in sospeso'}</small></div></button>`;
  }).join('')}<button class="carta-lista nuova" id="lNuova">${icona('piu')}<small>Nuova lista</small></button></div>`;
  $('v-liste').querySelectorAll('[data-l]').forEach(b => b.onclick = () => { listaAperta = b.dataset.l; history.pushState({ v: 'v-liste', l: listaAperta }, ''); disegna(); $('contenuto').scrollTop = 0; });
  $('lNuova').onclick = () => apriFoglioLista(null);
}

function vistaCerca() {
  const q = ricerca.trim().toLowerCase();
  const trovati = q ? lista.filter(p => (p.titolo + ' ' + (p.note || '')).toLowerCase().includes(q)) : [];
  const o = oggiIso();
  const righe = trovati.map(p => {
    const occ = p.data ? prossimaData(p, o) || p.data : '';
    return riga(occ ? { p, occ, scad: scadenza(p, occ, cfg), fatto: fattoIl(p, occ) } : senzaData(p), { mostraGiorno: true });
  });
  $('v-cerca').innerHTML = q ? (righe.length ? gruppo('Risultati', righe) : vuoto('Nessun risultato', `Niente che contenga "${esc(ricerca)}".`)) : '';
}

/* ---------- impostazioni ---------- */
const interruttore = (id, on) => `<span class="interruttore"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span></span></span>`;
function vistaImpostazioni() {
  const perm = N.nativo ? ({ granted: 'granted', denied: 'denied' }[permessoNativo] || 'default') : 'Notification' in window ? Notification.permission : 'non disponibili';
  const permTesto = { granted: N.nativo ? 'Attive: arrivano all\'ora esatta anche ad app chiusa' : 'Attive', denied: N.nativo ? 'Bloccate: riattivale da Impostazioni › App › RicordaMi › Notifiche' : 'Bloccate: riattivale dalle impostazioni del browser', default: 'Non ancora attivate' }[perm] || 'Non disponibili su questo browser';
  $('v-imp').innerHTML = `
    <div class="sez">Aspetto</div>
    <div class="pannello">
      <div class="temi">${['elegante', 'allegro'].map(t => `<button class="tema-carta ${cfg.tema === t ? 'sel' : ''}" data-tema="${t}"><div class="mini mini-${t}"><i></i><i></i><i></i></div><b>${t === 'elegante' ? 'Elegante' : 'Allegro'}</b></button>`).join('')}</div>
      <div class="voce"><div>Modalità</div><div class="segmenti" id="iModo" style="flex:0 0 auto">${[['auto', 'Auto'], ['chiaro', 'Chiaro'], ['scuro', 'Scuro']].map(([k, n]) => `<button data-m="${k}" class="${cfg.modo === k ? 'sel' : ''}">${n}</button>`).join('')}</div></div>
      <label class="voce"><div>Animazioni<small>Spegnile per un'app ancora più rapida e sobria</small></div>${interruttore('iAnim', cfg.animazioni !== 'ridotte')}</label>
    </div>

    <div class="sez">Il mio stile</div>
    <div class="pannello">${Object.entries(PROFILI).map(([k, p]) => `<div class="voce cliccabile" data-profilo="${k}"><div>${p.emoji} ${p.nome}<small>${p.frase}</small></div>${cfg.profilo === k ? `<span style="color:var(--accento)">${icona('ok')}</span>` : ''}</div>`).join('')}</div>

    <div class="sez">Promemoria</div>
    <div class="pannello">
      <div class="voce" style="display:block"><div style="margin-bottom:8px">Avvisi predefiniti<small>Per i nuovi promemoria; si cambiano anche uno per uno</small></div><div class="chips" id="iAvvisi">${SCELTE_AVVISI.map(([m, n]) => `<button class="chip ${cfg.avvisi.includes(m) ? 'sel' : ''}" data-m="${m}">${n}</button>`).join('')}</div></div>
      <div class="voce"><div>Insisti finché non è fatto<small>Ripete l'avviso dopo la scadenza</small></div><select class="inserto" id="iInsisti" style="width:auto">${[[0, 'No'], [5, 'Ogni 5 min'], [10, 'Ogni 10 min'], [15, 'Ogni 15 min'], [30, 'Ogni 30 min']].map(([m, n]) => `<option value="${m}" ${cfg.insisti === m ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="voce"><div>Ora per le cose "in giornata"<small>Quando avvisarti se non c'è un orario</small></div><input type="time" id="iOraGiornata" value="${cfg.oraGiornata}"></div>
      <div class="voce"><div>Riepilogo del mattino<small>Cosa ti aspetta oggi</small></div><input type="time" id="iMattina" value="${cfg.riepilogoMattina}">${interruttore('iMattinaOn', !!cfg.riepilogoMattina)}</div>
      <div class="voce"><div>Riepilogo della sera<small>Cosa ti aspetta domani</small></div><input type="time" id="iSera" value="${cfg.riepilogoSera || '21:00'}">${interruttore('iSeraOn', !!cfg.riepilogoSera)}</div>
    </div>

    <div class="sez">Notifiche</div>
    <div class="pannello">
      <div class="voce"><div>Notifiche sul telefono<small>${permTesto}</small></div>${perm === 'default' ? '<button class="btn primario" id="iPermesso" style="flex:none;padding:9px 14px">Attiva</button>' : ''}</div>
      <label class="voce"><div>Bollino sull'icona<small>Quante cose hai in ritardo o da fare oggi</small></div>${interruttore('iBollino', cfg.bollino)}</label>
      <label class="voce"><div>Vibrazione</div>${interruttore('iVibra', cfg.vibrazione)}</label>
      <div class="voce"><div>Prova un avviso<small>Per controllare che arrivino davvero</small></div><button class="btn" id="iProva" style="flex:none;padding:9px 14px">Prova</button></div>
      <div class="voce"><div>Avvisi anche per email<small>Con un account: per le cose che non puoi proprio scordare</small></div><span class="prossimamente">Plus · presto</span></div>
    </div>

    <div class="sez">Telefono e computer</div>
    <div class="pannello">
      ${N.nativo
        ? `<div class="voce"><div>💻 ${MARCHIO.nome} sul computer<small>Stessi promemoria sullo schermo grande, sincronizzati con il telefono</small></div><span class="prossimamente">Presto</span></div>`
        : `<div class="voce"><div>📱 ${MARCHIO.nome} sul telefono<small>Con l'app Android gli avvisi arrivano all'ora esatta anche ad app chiusa</small></div><span class="prossimamente">Presto</span></div>
           <div class="voce"><div>🔄 Sincronizzazione<small>Scrivi sul computer, ti avvisa il telefono</small></div><span class="prossimamente">Presto</span></div>`}
    </div>

    <div class="sez">App collegate</div>
    <div class="pannello">
      <div class="voce"><div>💶 Conti<small>Bollette e abbonamenti diventano promemoria da soli</small></div><span class="prossimamente">Presto</span></div>
      <div class="voce"><div>📅 Esporta nel calendario<small>File .ics per Google Calendar, Outlook, Apple</small></div><button class="btn" id="iIcs" style="flex:none;padding:9px 14px">Esporta</button></div>
      <div class="voce"><div>📲 Da altre app<small>Condividi un messaggio o una mail con ${MARCHIO.nome} e diventa un promemoria</small></div></div>
    </div>

    <div class="sez">I tuoi dati</div>
    <div class="pannello">
      <div class="voce"><div>Restano su questo dispositivo<small>Nessun account, nessun server. Fai un backup ogni tanto.</small></div></div>
      <div class="voce"><div>Backup</div><button class="btn" id="iEsporta" style="flex:none;padding:9px 14px">Salva</button><button class="btn" id="iImporta" style="flex:none;padding:9px 14px">Ripristina</button></div>
      <div class="voce cliccabile" id="iSvuota"><div style="color:var(--ritardo)">Cancella tutto</div></div>
    </div>
    <p style="text-align:center;color:var(--tenue);font-size:.8rem;margin:22px 0 0">${MARCHIO.nome} ${MARCHIO.versione}</p>`;

  const salva = async (patch, ev) => { cfg = await archivio.salvaImpostazioni(patch); applicaAspetto(ev); vistaImpostazioni(); };
  $('v-imp').querySelectorAll('[data-tema]').forEach(b => b.onclick = e => salva({ tema: b.dataset.tema }, e));
  $('iModo').querySelectorAll('button').forEach(b => b.onclick = e => salva({ modo: b.dataset.m }, e));
  $('iAnim').onchange = e => salva({ animazioni: e.target.checked ? 'piene' : 'ridotte' });
  $('v-imp').querySelectorAll('[data-profilo]').forEach(b => b.onclick = () => {
    const p = PROFILI[b.dataset.profilo];
    salva({ profilo: b.dataset.profilo, avvisi: p.avvisi, insisti: p.insisti, riepilogoMattina: p.riepilogoMattina, riepilogoSera: p.riepilogoSera });
    toast(`Stile "${p.nome}": avvisi aggiornati`);
  });
  $('iAvvisi').querySelectorAll('.chip').forEach(b => b.onclick = () => {
    const m = +b.dataset.m, s = new Set(cfg.avvisi);
    s.has(m) ? s.delete(m) : s.add(m);
    salva({ avvisi: [...s].sort((a, b) => b - a) });
  });
  $('iInsisti').onchange = e => salva({ insisti: +e.target.value });
  $('iOraGiornata').onchange = e => e.target.value && salva({ oraGiornata: e.target.value });
  $('iMattinaOn').onchange = e => salva({ riepilogoMattina: e.target.checked ? $('iMattina').value || '08:00' : '' });
  $('iMattina').onchange = e => cfg.riepilogoMattina && salva({ riepilogoMattina: e.target.value });
  $('iSeraOn').onchange = e => salva({ riepilogoSera: e.target.checked ? $('iSera').value || '21:00' : '' });
  $('iSera').onchange = e => cfg.riepilogoSera && salva({ riepilogoSera: e.target.value });
  $('iBollino').onchange = e => salva({ bollino: e.target.checked });
  $('iVibra').onchange = e => salva({ vibrazione: e.target.checked });
  if ($('iPermesso')) $('iPermesso').onclick = async () => { await chiediNotifiche(); vistaImpostazioni(); };
  $('iProva').onclick = async () => {
    if (N.nativo) {
      if (permessoNativo !== 'granted' && !(await chiediNotifiche())) return;
      await N.prova(5); return toast('Ti arriva tra 5 secondi: prova pure a chiudere l\'app');
    }
    await mostraAvviso({ titolo: 'Ecco come ti avviso!', corpo: 'Se mi vedi, gli avvisi funzionano.', chiave: 'prova', priorita: 0 }, true);
  };
  $('iIcs').onclick = () => scarica(`${MARCHIO.nome.toLowerCase()}.ics`, esportaIcs(lista, cfg, MARCHIO.nome), 'text/calendar', 'Aggiungi al calendario');
  $('iEsporta').onclick = async () => scarica(`${MARCHIO.nome.toLowerCase()}-backup-${oggiIso()}.json`, JSON.stringify(await archivio.esporta(), null, 1), 'application/json', 'Salva il backup');
  $('iImporta').onclick = () => {
    const f = Object.assign(document.createElement('input'), { type: 'file', accept: 'application/json,.json' });
    f.onchange = async () => { try { await archivio.importa(JSON.parse(await f.files[0].text())); toast('Backup ripristinato'); } catch (e) { toast('Non riesco a leggerlo: ' + e.message); } };
    f.click();
  };
  $('iSvuota').onclick = async () => { if (confirm('Cancellare tutti i promemoria e le impostazioni? Non si può annullare.')) { await archivio.svuota(); location.reload(); } };
}
function scarica(nome, testo, tipo, titolo) {
  if (N.nativo) return N.condividiFile(nome, testo, titolo).catch(e => toast('Non riuscito: ' + e.message));
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([testo], { type: tipo })), download: nome });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- aspetto ---------- */
function applicaAspetto(ev) {
  const r = document.documentElement;
  const scuro = cfg.modo === 'scuro' || (cfg.modo !== 'chiaro' && matchMedia('(prefers-color-scheme: dark)').matches);
  const cambia = () => {
    r.dataset.tema = cfg.tema;
    if (scuro) r.dataset.scuro = ''; else delete r.dataset.scuro;
    r.dataset.animazioni = cfg.animazioni;
    const sfondo = getComputedStyle(r).getPropertyValue('--sfondo').trim();
    document.querySelector('meta[name=theme-color]').content = sfondo;
    N.barraStato(scuro, sfondo);
  };
  if (cfg.tema === 'allegro' && !document.getElementById('fontAllegro'))
    document.head.append(Object.assign(document.createElement('link'), { id: 'fontAllegro', rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Fredoka:wght@400;500;600;700&display=swap' }));
  try { localStorage.setItem('ricordami-aspetto', JSON.stringify({ tema: cfg.tema, modo: cfg.modo, animazioni: cfg.animazioni })); } catch {}
  const diverso = r.dataset.tema !== cfg.tema || ('scuro' in r.dataset) !== scuro;
  if (ev && diverso && document.startViewTransition && animazioni()) {
    r.style.setProperty('--vt-x', ev.clientX + 'px'); r.style.setProperty('--vt-y', ev.clientY + 'px');
    document.startViewTransition(cambia);
  } else cambia();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applicaAspetto());

/* ---------- gesti sulle righe: tocco, spunta, scorrimento ---------- */
const contenuto = $('contenuto');
contenuto.addEventListener('click', e => {
  const g = e.target.closest('.riga-guscio'); if (!g || g.dataset.trascinato) return;
  const p = lista.find(x => x.id === g.dataset.id); if (!p) return;
  if (e.target.closest('.spunta')) return segna(p, g.dataset.occ, g, e);
  apriScheda(p, { occ: g.dataset.occ });
});
let trascina = null;
contenuto.addEventListener('pointerdown', e => {
  const r = e.target.closest('.riga'); if (!r || e.target.closest('.spunta') || e.button) return;
  trascina = { r, g: r.parentElement, x0: e.clientX, y0: e.clientY, dx: 0, attivo: false };
});
contenuto.addEventListener('pointermove', e => {
  if (!trascina) return;
  const dx = e.clientX - trascina.x0, dy = e.clientY - trascina.y0;
  if (!trascina.attivo) {
    if (Math.abs(dy) > 10) { trascina = null; return; }
    if (Math.abs(dx) < 12) return;
    trascina.attivo = true; trascina.r.classList.add('trascina');
    trascina.r.setPointerCapture?.(e.pointerId);
  }
  trascina.dx = dx;
  trascina.r.style.transform = `translateX(${dx}px)`;
  const sotto = trascina.g.querySelector('.riga-sotto');
  sotto.style.background = dx > 0 ? 'var(--ok)' : 'var(--accento)';
  sotto.style.justifyContent = dx > 0 ? 'flex-start' : 'flex-end';
  sotto.children[0].style.display = dx > 0 ? '' : 'none'; sotto.children[1].style.display = dx > 0 ? 'none' : '';
});
const fineTrascina = () => {
  if (!trascina) return;
  const { r, g, dx, attivo } = trascina; trascina = null;
  if (!attivo) return;
  g.dataset.trascinato = '1'; setTimeout(() => delete g.dataset.trascinato, 50);
  r.classList.remove('trascina'); r.style.transition = 'transform .3s var(--molla)'; r.style.transform = '';
  setTimeout(() => r.style.transition = '', 320);
  const p = lista.find(x => x.id === g.dataset.id); if (!p) return;
  if (dx > 90) segna(p, g.dataset.occ, g);
  else if (dx < -90) apriRinvia(p, g.dataset.occ);
};
contenuto.addEventListener('pointerup', fineTrascina);
contenuto.addEventListener('pointercancel', fineTrascina);

async function segna(p, occ, guscio, ev) {
  const ora = fattoIl(p, occ);
  if (!ora) {
    guscio?.querySelector('.riga')?.classList.add('fatto');
    if (cfg.vibrazione && !N.vibra('successo')) navigator.vibrate?.(18);
    if (ev && cfg.tema === 'allegro' && animazioni()) festa(ev.clientX, ev.clientY);
    if (animazioni() && vista === 'v-oggi') { guscio?.classList.add('esce'); await new Promise(r => setTimeout(r, 750)); }
  }
  await archivio.segnaFatto(p.id, occ, !ora);
  if (!ora) toast(p.ripeti ? 'Fatto! Ci rivediamo alla prossima' : 'Fatto!', 'Annulla', () => archivio.segnaFatto(p.id, occ, false));
}
function festa(x, y) {
  const colori = ['var(--c-rosa)', 'var(--c-sole)', 'var(--c-menta)', 'var(--c-cielo)', 'var(--accento)'];
  for (let i = 0; i < 14; i++) {
    const s = Object.assign(document.createElement('span'), { className: 'festa', textContent: i % 3 ? '!' : '!!' });
    const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 70;
    Object.assign(s.style, { left: x + 'px', top: y + 'px', color: colori[i % colori.length], fontSize: 14 + Math.random() * 12 + 'px' });
    s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d - 30 + 'px'); s.style.setProperty('--r', (Math.random() * 360 - 180) + 'deg');
    document.body.append(s); setTimeout(() => s.remove(), 950);
  }
}

/* ---------- fogli ---------- */
let foglio = null;
function apriFoglio(id) {
  if (foglio && foglio !== id) $(foglio).classList.remove('on');
  else if (!foglio) history.pushState({ foglio: id }, '');
  foglio = id; $(id).classList.add('on'); $('velo').classList.add('on');
}
function chiudiFoglio(daIndietro = false) {
  if (!foglio) return;
  $(foglio).classList.remove('on'); $('velo').classList.remove('on');
  foglio = null;
  if (!daIndietro) history.back();
}
$('velo').onclick = () => chiudiFoglio();
window.addEventListener('popstate', e => {
  if (foglio) return chiudiFoglio(true);
  if (listaAperta && !(e.state?.l)) { listaAperta = null; return disegna(); }
  if (e.state?.v) { listaAperta = e.state.l || null; vaiA(e.state.v, false); return; }
  if (vista !== 'v-oggi') vaiA('v-oggi', false);
});

/* ---------- nuovo / modifica ---------- */
let s = null; // stato della scheda aperta
function apriScheda(p = null, pre = {}) {
  s = {
    id: p?.id || null, occ: pre.occ || '', originale: p, scelto: p ? { data: 1, ora: 1, ripeti: 1, priorita: 1, lista: 1 } : {},
    v: {
      titolo: p?.titolo || '', data: p?.data ?? pre.data ?? '', ora: p?.ora ?? pre.ora ?? '', ripeti: p?.ripeti ? { ...p.ripeti } : null,
      avvisi: [...(p?.avvisi ?? cfg.avvisi)], insisti: p?.insisti ?? cfg.insisti, priorita: p?.priorita || 0,
      lista: p?.lista ?? pre.lista ?? (listaAperta || ''), note: p?.note || '', listaNuova: ''
    }
  };
  if (pre.data || pre.ora) Object.assign(s.scelto, { data: 1, ora: 1 });
  $('sIntestazione').textContent = p ? 'Modifica' : 'Nuovo promemoria';
  $('sTesto').value = p ? p.titolo : pre.testo || '';
  $('sNote').value = s.v.note;
  $('sElimina').hidden = !p;
  $('sSalva').textContent = p ? 'Salva' : 'Ricordamelo';
  $('sDettagli').hidden = !p; $('sDettagliTog').classList.toggle('aperto', !!p);
  if (pre.testo && !p) leggiTesto(); else aggiornaScheda();
  apriFoglio('fScheda');
  autoAltezza();
  if (!p) setTimeout(() => $('sTesto').focus(), 320);
}
$('btnNuovo').onclick = () => apriScheda(null, vista === 'v-cal' && calGiorno !== oggiIso() ? { data: calGiorno } : {});
function autoAltezza() { const t = $('sTesto'); t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }

function leggiTesto() {
  const c = capisci($('sTesto').value);
  s.v.titolo = c.titolo;
  if (!s.scelto.data) { s.v.data = c.data; }
  if (!s.scelto.ora) { s.v.ora = c.ora; }
  if (!s.scelto.ripeti) s.v.ripeti = c.ripeti;
  if (!s.scelto.priorita) s.v.priorita = c.priorita;
  if (!s.scelto.lista && c.lista) {
    const l = liste.find(x => x.id === c.lista || x.nome.toLowerCase() === c.lista.toLowerCase());
    s.v.lista = l ? l.id : ''; s.v.listaNuova = l ? '' : c.lista;
  } else if (!s.scelto.lista && !c.lista) s.v.listaNuova = '';
  aggiornaScheda();
}
$('sTesto').oninput = () => { autoAltezza(); leggiTesto(); };
$('sTesto').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('sSalva').click(); } };

function aggiornaScheda() {
  const v = s.v;
  $('sSalva').disabled = !$('sTesto').value.trim();
  // cosa ho capito
  const c = [];
  if (v.data) c.push(`<span>📅 ${giornoBreve(v.data)}</span>`);
  if (v.ora) c.push(`<span>🕘 ${v.ora}</span>`);
  if (v.ripeti) c.push(`<span>🔁 ${descriviRipeti(v.ripeti, v.data || oggiIso())}</span>`);
  if (v.priorita) c.push(`<span class="urg">${v.priorita === 2 ? '‼️ Urgente' : '❗ Importante'}</span>`);
  if (v.lista && listaDi(v.lista)) c.push(`<span>${listaDi(v.lista).emoji} ${esc(listaDi(v.lista).nome)}</span>`);
  if (v.listaNuova) c.push(`<span>✨ nuova lista "${esc(v.listaNuova)}"</span>`);
  if (v.data && v.avvisi.length) c.push(`<span>🔔 ${v.avvisi.length === 1 ? (v.avvisi[0] ? durata(v.avvisi[0]) + ' prima' : 'al momento') : v.avvisi.length + ' avvisi'}</span>`);
  if (v.data && v.insisti) c.push(`<span>📣 insiste</span>`);
  $('sCapito').innerHTML = c.join('') || `<span class="vuoto-capito">${$('sTesto').value ? 'Senza data: lo trovi in "Quando capita"' : 'Scrivi come parli: "domani alle 9 chiamare Marco"'}</span>`;
  // scorciatoie
  const o = oggiIso(), h = new Date().getHours();
  const sab = piuGiorni(o, (6 - giornoSettimana(o) + 7) % 7 || 7);
  const rapidi = [
    ['Oggi', o, ''], h < 19 ? ['Stasera', o, '20:00'] : null, ['Domani', piuGiorni(o, 1), cfg.oraGiornata],
    ['Weekend', sab, '10:00'], ['Tra una settimana', piuGiorni(o, 7), ''], ['Senza data', '', '']
  ].filter(Boolean);
  $('sRapidi').innerHTML = rapidi.map(([n, d, t]) => `<button class="chip ${v.data === d && (v.ora === t || !t) && (d || !v.data) ? 'sel' : ''}" data-d="${d}" data-t="${t}">${n}</button>`).join('');
  $('sRapidi').querySelectorAll('button').forEach(b => b.onclick = () => { s.scelto.data = s.scelto.ora = 1; v.data = b.dataset.d; v.ora = b.dataset.t; aggiornaScheda(); });
  // dettagli
  $('sData').value = v.data; $('sOra').value = v.ora;
  const r = v.ripeti;
  $('sRipeti').querySelectorAll('button').forEach(b => b.classList.toggle('sel', (r?.ogni || '') === b.dataset.r));
  $('sRipetiAltro').hidden = !r;
  if (r) {
    $('sOgniN').value = r.ogniN || 1; $('sFino').value = r.fino || '';
    $('sGiorniCampo').hidden = r.ogni !== 'settimana';
    const sel = r.giorni?.length ? r.giorni : [giornoSettimana(v.data || o)];
    $('sGiorni').innerHTML = [1, 2, 3, 4, 5, 6, 0].map(g => `<button data-g="${g}" class="${sel.includes(g) ? 'sel' : ''}" aria-label="${GIORNI_BELLI[g]}">${GSETT[g]}</button>`).join('');
    $('sGiorni').querySelectorAll('button').forEach(b => b.onclick = () => {
      const g = +b.dataset.g, set = new Set(sel);
      set.has(g) ? set.size > 1 && set.delete(g) : set.add(g);
      r.giorni = [...set].sort(); s.scelto.ripeti = 1; aggiornaScheda();
    });
  }
  $('sAvvisi').innerHTML = SCELTE_AVVISI.map(([m, n]) => `<button class="chip ${v.avvisi.includes(m) ? 'sel' : ''}" data-m="${m}">${n}</button>`).join('');
  $('sAvvisi').querySelectorAll('button').forEach(b => b.onclick = () => {
    const m = +b.dataset.m, set = new Set(v.avvisi); set.has(m) ? set.delete(m) : set.add(m);
    v.avvisi = [...set].sort((a, b) => b - a); aggiornaScheda();
  });
  $('sInsisti').querySelectorAll('button').forEach(b => { b.classList.toggle('sel', +b.dataset.m === v.insisti); b.onclick = () => { v.insisti = +b.dataset.m; aggiornaScheda(); }; });
  $('sPriorita').querySelectorAll('button').forEach(b => { b.classList.toggle('sel', +b.dataset.p === v.priorita); b.onclick = () => { s.scelto.priorita = 1; v.priorita = +b.dataset.p; aggiornaScheda(); }; });
  $('sListe').innerHTML = `<button class="chip ${!v.lista ? 'sel' : ''}" data-l="">Nessuna</button>` + liste.map(l => `<button class="chip lista ${v.lista === l.id ? 'sel' : ''}" data-l="${esc(l.id)}" style="--colore-lista:var(--c-${l.colore})">${l.emoji} ${esc(l.nome)}</button>`).join('');
  $('sListe').querySelectorAll('button').forEach(b => b.onclick = () => { s.scelto.lista = 1; v.lista = b.dataset.l; v.listaNuova = ''; aggiornaScheda(); });
}
$('sDettagliTog').onclick = () => { const h = !$('sDettagli').hidden; $('sDettagli').hidden = h; $('sDettagliTog').classList.toggle('aperto', !h); };
$('sData').oninput = () => { s.scelto.data = 1; s.v.data = $('sData').value; aggiornaScheda(); };
$('sOra').oninput = () => { s.scelto.ora = 1; s.v.ora = $('sOra').value; if (s.v.ora && !s.v.data) s.v.data = oggiIso(); aggiornaScheda(); };
$('sRipeti').querySelectorAll('button').forEach(b => b.onclick = () => {
  s.scelto.ripeti = 1;
  s.v.ripeti = b.dataset.r ? { ogni: b.dataset.r, ogniN: s.v.ripeti?.ogniN || 1, ...(s.v.ripeti?.ogni === b.dataset.r ? s.v.ripeti : {}) } : null;
  if (s.v.ripeti && !s.v.data) s.v.data = oggiIso();
  aggiornaScheda();
});
$('sOgniN').oninput = () => { if (s.v.ripeti) { s.v.ripeti.ogniN = Math.max(1, +$('sOgniN').value || 1); s.scelto.ripeti = 1; aggiornaScheda(); } };
$('sFino').oninput = () => { if (s.v.ripeti) { s.v.ripeti.fino = $('sFino').value || undefined; s.scelto.ripeti = 1; } };
$('sNote').oninput = () => { s.v.note = $('sNote').value; };

$('sSalva').onclick = async () => {
  const v = s.v;
  if (!$('sTesto').value.trim()) return;
  if (s.id && $('sTesto').value === s.originale.titolo) v.titolo = s.originale.titolo; // testo non toccato: niente da reinterpretare
  let lista_ = v.lista;
  if (v.listaNuova) {
    const nuova = await archivio.salvaLista({ nome: v.listaNuova.replace(/^./, c => c.toUpperCase()), emoji: '📌', colore: COLORI[liste.length % COLORI.length], ordine: liste.length });
    lista_ = nuova.id;
  }
  const p = {
    ...(s.originale || {}), titolo: v.titolo, data: v.data, ora: v.data ? v.ora : '', ripeti: v.data ? v.ripeti : null,
    avvisi: v.avvisi, insisti: v.insisti, priorita: v.priorita, lista: lista_, note: v.note.trim(),
    fuso: cfg.fuso
  };
  if (s.originale && (s.originale.data !== p.data || s.originale.ora !== p.ora)) delete p.rinvio;
  const salvato = await archivio.salva(p);
  chiudiFoglio();
  const primo = prossimoAvviso(salvato, adesso(), cfg);
  toast(s.id ? 'Modificato' : primo ? `Ok! Ti avviso ${quandoLeggibile(primo)}` : salvato.data ? 'Fatto, è in agenda' : 'Ok, lo trovi in "Quando capita"');
  if (!s.id && 'Notification' in window && Notification.permission === 'default' && primo) setTimeout(() => toast('Attiva le notifiche per ricevere gli avvisi', 'Attiva', chiediNotifiche), 2600);
  pianifica();
};
$('sElimina').onclick = async () => {
  const p = s.originale; chiudiFoglio();
  await archivio.elimina(p.id);
  toast('Eliminato', 'Annulla', () => archivio.salva(p));
};
function quandoLeggibile(t) {
  const d = dataNelFuso(t, cfg.fuso), ora = new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const m = Math.round((t - adesso()) / 60000);
  if (m < 60) return `tra ${m} minut${m === 1 ? 'o' : 'i'}`;
  return `${giornoBreve(d).toLowerCase()} alle ${ora}`;
}

/* ---------- rinvia ---------- */
let rv = null;
function apriRinvia(p, occ) {
  rv = { p, occ };
  const ora = adesso(), o = oggiIso(), h = new Date().getHours();
  const t = (d, hh) => istante(d, hh, cfg.fuso);
  const lun = piuGiorni(o, (8 - giornoSettimana(o)) % 7 || 7), sab = piuGiorni(o, (6 - giornoSettimana(o) + 7) % 7 || 7);
  const scelte = [
    ['Tra 10 minuti', ora + 10 * 60e3], ['Tra un\'ora', ora + 60 * 60e3],
    h < 19 ? ['Stasera', t(o, '20:00')] : ['Tra 3 ore', ora + 3 * 3600e3],
    ['Domani mattina', t(piuGiorni(o, 1), cfg.oraGiornata)], ['Nel weekend', t(sab, '10:00')], ['Settimana prossima', t(lun, cfg.oraGiornata)]
  ];
  $('rScelte').innerHTML = scelte.map(([n, ms]) => `<button data-ms="${ms}">${n}<small>${quandoLeggibile(ms)}</small></button>`).join('');
  $('rScelte').querySelectorAll('button').forEach(b => b.onclick = () => rinvia(+b.dataset.ms));
  const dom = new Date(ora + 864e5); dom.setMinutes(0);
  $('rQuando').value = `${dataNelFuso(+dom, cfg.fuso)}T${pad(dom.getHours())}:00`;
  apriFoglio('fRinvia');
}
$('rConferma').onclick = () => { const [d, t] = $('rQuando').value.split('T'); if (d && t) rinvia(istante(d, t, cfg.fuso)); };
async function rinvia(ms) {
  const { p, occ } = rv; chiudiFoglio();
  const prima = structuredClone(p);
  if (!p.ripeti) {
    // Per le cose singole spostare = cambiare giorno e ora.
    const d = dataNelFuso(ms, cfg.fuso), h = new Date(ms);
    await archivio.salva({ ...p, data: d, ora: `${pad(h.getHours())}:${pad(h.getMinutes())}`, rinvio: undefined });
  } else await archivio.rinvia(p.id, occ, ms);
  toast(`Rimandato a ${quandoLeggibile(ms)}`, 'Annulla', () => archivio.salva(prima));
  pianifica();
}

/* ---------- liste: nuova / modifica ---------- */
let lv = null;
function apriFoglioLista(l) {
  lv = l ? { ...l } : { nome: '', emoji: '📌', colore: COLORI[liste.length % COLORI.length] };
  $('lIntestazione').textContent = l ? 'Modifica lista' : 'Nuova lista';
  $('lNome').value = lv.nome; $('lEmoji').value = lv.emoji; $('lElimina').hidden = !l;
  const colori = () => {
    $('lColori').innerHTML = COLORI.map(c => `<button class="chip lista ${lv.colore === c ? 'sel' : ''}" data-c="${c}" style="--colore-lista:var(--c-${c})"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--c-${c})"></span></button>`).join('');
    $('lColori').querySelectorAll('button').forEach(b => b.onclick = () => { lv.colore = b.dataset.c; colori(); });
  };
  colori();
  apriFoglio('fLista');
  if (!l) setTimeout(() => $('lNome').focus(), 320);
}
$('lSalva').onclick = async () => {
  if (!$('lNome').value.trim()) return $('lNome').focus();
  await archivio.salvaLista({ ...lv, nome: $('lNome').value.trim(), emoji: $('lEmoji').value.trim() || '📌', ordine: lv.ordine ?? liste.length });
  chiudiFoglio();
};
$('lElimina').onclick = async () => {
  const n = lista.filter(p => p.lista === lv.id).length;
  if (!confirm(n ? `Eliminare la lista? I suoi ${n} promemoria restano, senza lista.` : 'Eliminare la lista?')) return;
  for (const p of lista.filter(p => p.lista === lv.id)) await archivio.salva({ ...p, lista: '' });
  await archivio.eliminaLista(lv.id);
  chiudiFoglio(); listaAperta = null; history.back();
};

/* ---------- ricerca ---------- */
let vistaPrimaDiCercare = 'v-oggi';
$('btnCerca').onclick = () => {
  const aperta = !$('cercaBox').hidden;
  $('cercaBox').hidden = aperta;
  if (aperta) { ricerca = ''; $('cercaInput').value = ''; vaiA(vistaPrimaDiCercare, false); }
  else { vistaPrimaDiCercare = vista; vaiA('v-cerca', false); $('cercaInput').focus(); }
};
$('cercaInput').oninput = () => { ricerca = $('cercaInput').value; vistaCerca(); };

/* ---------- avvisi ---------- */
let bannerDi = null;
async function mostraAvviso(n, forzaSistema = false) {
  const visibile = document.visibilityState === 'visible';
  if (visibile && !forzaSistema) {
    bannerDi = n;
    $('bnTitolo').textContent = n.titolo; $('bnCorpo').textContent = n.corpo;
    $('bnFatto').hidden = $('bnRinvia').hidden = !n.id;
    const b = $('banner'); b.classList.add('on');
    if (n.tipo === 'insisti') { b.classList.remove('scuoti'); void b.offsetWidth; b.classList.add('scuoti'); }
    if (cfg.vibrazione) navigator.vibrate?.(n.priorita === 2 ? [200, 80, 200, 80, 200] : [120, 60, 120]);
    clearTimeout(b._t); if (n.priorita < 2 && n.tipo !== 'insisti') b._t = setTimeout(() => b.classList.remove('on'), 9000);
    return;
  }
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg && 'Notification' in window && Notification.permission === 'granted') {
    await reg.showNotification(n.titolo, {
      body: n.corpo, tag: n.id ? 'p-' + n.id : n.chiave, renotify: true, icon: 'icone/icona-192.png', badge: 'icone/bollino-96.png',
      data: { id: n.id, occ: n.occ }, requireInteraction: n.priorita === 2 || n.tipo === 'insisti', vibrate: cfg.vibrazione ? [120, 60, 120] : undefined,
      actions: n.id ? [{ action: 'fatto', title: '✓ Fatto' }, { action: 'rinvia', title: '⏰ Tra 10 min' }] : []
    });
  } else if (forzaSistema) { mostraAvviso(n); toast('Le notifiche non sono attive: te l\'ho mostrato qui'); }
}
$('bnChiudi').onclick = () => $('banner').classList.remove('on');
$('bnFatto').onclick = () => { $('banner').classList.remove('on'); archivio.segnaFatto(bannerDi.id, bannerDi.occ); toast('Fatto!'); };
$('bnRinvia').onclick = () => { $('banner').classList.remove('on'); const p = lista.find(x => x.id === bannerDi.id); if (p) apriRinvia(p, bannerDi.occ); };

async function chiediNotifiche() {
  if (N.nativo) {
    const ok = await N.chiediPermesso();
    permessoNativo = await N.permesso();
    toast(ok ? 'Notifiche attive: ti avviso anche ad app chiusa' : 'Senza notifiche non posso avvisarti');
    if (ok) riprogramma();
    return ok;
  }
  if (!('Notification' in window)) { toast('Questo browser non supporta le notifiche'); return false; }
  const r = await Notification.requestPermission();
  if (r === 'granted') {
    toast('Notifiche attive');
    try { const reg = await navigator.serviceWorker?.ready; await reg?.periodicSync?.register('controlla', { minInterval: 15 * 60e3 }); } catch {}
  } else toast('Senza notifiche ti avviso solo ad app aperta');
  return r === 'granted';
}

let timer = null;
async function pianifica() {
  clearTimeout(timer);
  if (!cfg.fuso) return;
  if (N.nativo) {
    // Nell'app Android gli avvisi li mostra il sistema: qui aggiorno solo bollino e "tra X min".
    aggiornaBollino();
    timer = setTimeout(pianifica, 60e3);
    if (vista === 'v-oggi' && !foglio && !trascina) vistaOggi();
    return;
  }
  const r = await controlla(archivio, mostraAvviso);
  aggiornaBollino(r.bollino);
  const attesa = r.prossimo ? Math.min(Math.max(r.prossimo - adesso() + 500, 1000), 60e3) : 60e3;
  timer = setTimeout(pianifica, attesa);
  if (vista === 'v-oggi' && !foglio && !trascina) vistaOggi(); // aggiorna i "tra X min"
}
function aggiornaBollino(n = bollino(lista, cfg, adesso())) {
  const b = $('bollinoOggi'); b.hidden = !n; b.textContent = n > 99 ? '99+' : n;
  if (N.nativo) return N.bollino(n, cfg.bollino);
  if (!('setAppBadge' in navigator)) return;
  if (cfg.bollino && n) navigator.setAppBadge(n).catch(() => {}); else navigator.clearAppBadge().catch(() => {});
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { pianifica(); navigator.serviceWorker?.getRegistration().then(r => r?.getNotifications()).then(l => l?.forEach(n => n.close())).catch(() => {}); } });

/* ---------- toast ---------- */
function toast(testo, azione, fn) {
  const t = $('toast');
  $('toastTesto').textContent = testo;
  $('toastAzione').hidden = !azione;
  if (azione) { $('toastAzione').textContent = azione; $('toastAzione').onclick = () => { t.classList.remove('on'); fn(); }; }
  t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), azione ? 5000 : 2600);
}

/* ---------- tastiera (computer) ---------- */
document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select')) { if (e.key === 'Escape') e.target.blur(), chiudiFoglio(); return; }
  if (e.key === 'n' || e.key === '+') { e.preventDefault(); $('btnNuovo').click(); }
  else if (e.key === '/') { e.preventDefault(); if ($('cercaBox').hidden) $('btnCerca').click(); else $('cercaInput').focus(); }
  else if (e.key === 'Escape') chiudiFoglio();
});

/* ---------- primo avvio ---------- */
function benvenuto() {
  const b = $('benvenuto'); b.hidden = false;
  let passo = 0;
  const vai = n => {
    passo = n;
    b.querySelectorAll('.passo').forEach(p => p.classList.toggle('on', +p.dataset.passo === n));
    $('bPuntini').querySelectorAll('i').forEach((i, k) => i.classList.toggle('on', k === n));
  };
  b.querySelectorAll('[data-avanti]').forEach(x => x.onclick = () => vai(passo + 1));
  $('bProfili').innerHTML = Object.entries(PROFILI).map(([k, p]) => `<button class="profilo" data-p="${k}"><span class="emoji">${p.emoji}</span><div><b>${p.nome}</b><small>${p.frase}</small></div></button>`).join('');
  $('bProfili').querySelectorAll('.profilo').forEach(x => x.onclick = async () => {
    $('bProfili').querySelectorAll('.profilo').forEach(y => y.classList.toggle('sel', y === x));
    const p = PROFILI[x.dataset.p];
    cfg = await archivio.salvaImpostazioni({ avvisi: p.avvisi, insisti: p.insisti, riepilogoMattina: p.riepilogoMattina, riepilogoSera: p.riepilogoSera, sceltaProfilo: x.dataset.p });
    $('bProfiloAvanti').disabled = false;
  });
  const temi = () => {
    $('bTemi').innerHTML = ['elegante', 'allegro'].map(t => `<button class="tema-carta ${cfg.tema === t ? 'sel' : ''}" data-tema="${t}"><div class="mini mini-${t}"><i></i><i></i><i></i></div><b>${t === 'elegante' ? 'Elegante e funzionale' : 'Allegro e simpatico'}</b></button>`).join('');
    $('bTemi').querySelectorAll('[data-tema]').forEach(x => x.onclick = async e => { cfg = await archivio.salvaImpostazioni({ tema: x.dataset.tema }); applicaAspetto(e); temi(); });
    $('bModo').querySelectorAll('button').forEach(x => { x.classList.toggle('sel', x.dataset.m === cfg.modo); x.onclick = async e => { cfg = await archivio.salvaImpostazioni({ modo: x.dataset.m }); applicaAspetto(e); temi(); }; });
  };
  temi();
  const fine = async () => {
    cfg = await archivio.salvaImpostazioni({ profilo: cfg.sceltaProfilo || 'scordarello' });
    if ($('bEsempi').checked) for (const p of esempi()) await archivio.salva(p);
    b.hidden = true;
    await ricarica(); pianifica(); riprogramma();
  };
  $('bNotifiche').onclick = async () => { await chiediNotifiche(); fine(); };
  $('bDopo').onclick = fine;
}
function esempi() {
  const o = oggiIso(), f = cfg.fuso, ora = new Date();
  const traUnOra = new Date(+ora + 65 * 60e3);
  const base = { fuso: f, avvisi: cfg.avvisi, insisti: 0, priorita: 0, note: '' };
  return [
    { ...base, titolo: 'Tocca il cerchio quando hai fatto', data: o, ora: `${pad(traUnOra.getHours())}:${pad(traUnOra.getMinutes())}`, lista: 'personale', note: 'Scorri la riga verso destra per segnarla fatta, verso sinistra per rimandarla.' },
    { ...base, titolo: 'Restituire il libro a Giulia', data: piuGiorni(o, -1), ora: '18:00', lista: 'personale' },
    { ...base, titolo: 'Pagare la bolletta della luce', data: piuGiorni(o, 3), ora: '', lista: 'scadenze', priorita: 1, avvisi: [1440, 0] },
    { ...base, titolo: 'Palestra', data: o, ora: '18:30', lista: 'salute', ripeti: { ogni: 'settimana', ogniN: 1, giorni: [1, 4] } },
    { ...base, titolo: 'Chiamare la mamma', data: piuGiorni(o, (7 - giornoSettimana(o)) % 7), ora: '11:00', lista: 'personale', ripeti: { ogni: 'settimana', ogniN: 1 } },
    { ...base, titolo: 'Latte, pane, uova', data: '', ora: '', lista: 'spesa' },
    { ...base, titolo: 'Rinnovare la carta d\'identità', data: piuGiorni(o, 20), ora: '', lista: 'scadenze', avvisi: [10080, 1440] }
  ].map((p, i) => ({ ...p, creato: Date.now() - i, ripeti: p.ripeti || null }));
}

/* ---------- link in ingresso: condividi, scorciatoie, altre app della suite ---------- */
function leggiIngresso() {
  const q = new URLSearchParams(location.search);
  if (![...q.keys()].length) return;
  history.replaceState(null, '', location.pathname);
  if (q.has('apri')) { const p = lista.find(x => x.id === q.get('apri')); if (p) return apriScheda(p, { occ: q.get('occ') || '' }); }
  if (q.has('vista')) return vaiA(q.get('vista'));
  if (q.has('aggiungi')) {
    // Da un'altra app del pacchetto: testo libero oppure JSON { titolo, data, ora, ripeti, lista, note, origine }.
    const a = q.get('aggiungi').replace(/^web\+ricordami:/, '');
    try {
      const j = JSON.parse(a);
      return apriScheda(null, { testo: j.titolo, data: j.data, ora: j.ora, lista: j.lista });
    } catch { return apriScheda(null, { testo: a }); }
  }
  const condiviso = [q.get('title'), q.get('text'), q.get('url')].filter(Boolean).join(' ').trim();
  if (condiviso || q.has('nuovo')) apriScheda(null, { testo: condiviso.slice(0, 300) });
}

/* ---------- avvio ---------- */
(async () => {
  cfg = await archivio.impostazioni();
  applicaAspetto();
  await ricarica();
  if (N.nativo) {
    permessoNativo = await N.permesso();
    await N.prepara({
      suAzione: async (azione, { id, occ }) => {
        if (azione === 'fatto' && id) { await archivio.segnaFatto(id, occ); toast('Fatto!'); }
        else if (azione === 'rinvia' && id) { await archivio.rinvia(id, occ, adesso() + 10 * 60e3); toast('Te lo ricordo tra 10 minuti'); }
        else if (id) { const p = lista.find(x => x.id === id); if (p) apriScheda(p, { occ }); }
      },
      suCondiviso: testo => cfg.profilo && apriScheda(null, { testo })
    });
  }
  if (!cfg.profilo) benvenuto();
  else { leggiIngresso(); pianifica(); riprogramma(); }
  if (!N.nativo && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js', { type: 'module', updateViaCache: 'none' }).catch(() => {});
  }
})();
