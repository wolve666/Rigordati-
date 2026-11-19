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
import { famiglia, fraseEvento } from './famiglia.js';
import { NOVITA, ATTUALE } from './novita.js';
import { cerca as cercaAggiornamento } from './aggiornamenti.js';

/* ---------- chi è chi (famiglia) ---------- */
const ioId = () => famiglia.io?.id;
const perMe = p => !p.gruppo || !p.perChi?.length || p.perChi.includes(ioId());
const mio = p => !p.gruppo || !p.autore || p.autore.id === ioId();
const haRisposto = p => (p.risposte || []).some(r => r.uid === ioId());
const inAttesa = p => p.tipo === 'domanda' && !!p.gruppo && !mio(p) && perMe(p) && !haRisposto(p);
const perAvvisi = p => perMe(p) && p.tipo !== 'domanda';
const nomeMembro = (g, uid) => uid === ioId() ? 'te' : famiglia.membro(g, uid)?.nome || '?';
const iniziale = n => (n || '?').trim().charAt(0).toUpperCase();
const avatar = (g, uid, cls = '') => { const m = famiglia.membro(g, uid); return `<span class="avatar ${cls}" style="background:var(--c-${m?.colore || 'lilla'})">${esc(iniziale(m?.nome))}</span>`; };
let gruppoAperto = null; // gruppo mostrato nella scheda Famiglia
let invitoMostrato = null; // { g, codice } ultimo codice creato

/* ---------- utilità ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icona = (n, cls = 'i') => `<svg class="${cls}"><use href="#i-${n}"/></svg>`;
const SEGNI = (dim = 84) => `<svg class="segni" width="${dim}" height="${dim}" fill="currentColor" stroke="currentColor" style="color:var(--accento)"><use href="#segni"/></svg>`;
const animazioni = () => document.documentElement.dataset.animazioni !== 'ridotte' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
const GSETT = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];

const CASA = 'v-cal'; // la prima pagina
let lista = [], liste = [], cfg = {}, vista = CASA, listaAperta = null, ricerca = '';
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
  timerProgramma = setTimeout(() => N.programma(lista.filter(perAvvisi), cfg).catch(e => console.warn('Avvisi non programmati', e)), 300);
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
  cambia();
  aggiornaStoria();
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => { listaAperta = null; chiudiRicerca(); vaiA(t.dataset.v); });
$('btnImp').onclick = () => { listaAperta = null; chiudiRicerca(); vaiA('v-imp'); };

/* ---------- tasto indietro ----------
   Una sola regola per Android e per il browser: chiude il foglio aperto, poi la ricerca,
   poi la lista aperta, poi torna al calendario. Dal calendario: si esce dall'app. */
function indietro() {
  if (foglio) { chiudiFoglio(); return true; }
  if ($('banner').classList.contains('on')) { $('banner').classList.remove('on'); return true; }
  if (!$('cercaBox').hidden) { chiudiRicerca(); vaiA(vistaPrimaDiCercare === 'v-cerca' ? CASA : vistaPrimaDiCercare); return true; }
  if (listaAperta) { listaAperta = null; disegna(); aggiornaStoria(); return true; }
  if (vista !== CASA) { vaiA(CASA); return true; }
  return false;
}
const allaRadice = () => !foglio && $('cercaBox').hidden && !listaAperta && vista === CASA;
// Nel browser tengo al massimo UN passo di cronologia "di guardia", così Indietro non si perde mai.
let ignoraPop = false;
function aggiornaStoria() {
  if (N.nativo) return;
  const guardia = history.state?.guardia;
  if (!allaRadice() && !guardia) history.pushState({ guardia: 1 }, '');
  else if (allaRadice() && guardia) { ignoraPop = true; history.back(); }
}
window.addEventListener('popstate', () => {
  if (ignoraPop) { ignoraPop = false; return; }
  indietro();
  aggiornaStoria();
});

function disegna() {
  if (!cfg.fuso) return;
  const v = $(vista);
  $('titolo').textContent = listaAperta ? `${listaDi(listaAperta)?.emoji || ''} ${listaDi(listaAperta)?.nome || ''}` : v.dataset.titolo;
  const o = new Date();
  $('sopratitolo').textContent = `${GIORNI_BELLI[o.getDay()]} ${o.getDate()} ${MESI[o.getMonth()]}`;
  $('btnImp').classList.toggle('nuovo', !!aggiornamento);
  const nAttesa = lista.filter(inAttesa).length;
  $('bollinoFam').hidden = !nAttesa; $('bollinoFam').textContent = nAttesa;
  $('tabFamNome').textContent = famiglia.gruppi.length === 1 ? famiglia.gruppi[0].nome.slice(0, 12) : 'Famiglia';
  ({ 'v-oggi': vistaOggi, 'v-cal': vistaCalendario, 'v-fam': vistaFamiglia, 'v-liste': vistaListe, 'v-imp': vistaImpostazioni, 'v-cerca': vistaCerca })[vista]();
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
  if (p.gruppo) {
    if (p.perChi?.length) meta.push(`<span class="pill per">per ${esc(p.perChi.map(u => nomeMembro(p.gruppo, u)).join(', '))}</span>`);
    if (!mio(p)) meta.push(`<span>da ${esc(p.autore?.nome || '?')}</span>`);
    else if (!p.perChi?.length) meta.push(`<span>👪 ${esc(famiglia.gruppo(p.gruppo)?.nome || '')}</span>`);
    if (p.tipo === 'domanda') {
      const r = p.risposte || [];
      if (inAttesa(p)) meta.push('<span class="pill attesa">Rispondi tu</span>');
      else if (!r.length) meta.push('<span>in attesa di risposta</span>');
      else meta.push(`<span class="pill esito">${esc(r.at(-1).nome)}: ${esc(r.at(-1).testo)}</span>`);
    }
  }
  const flag = p.priorita ? `<span class="bandiera p${p.priorita}">${p.priorita === 2 ? '!!' : '!'}</span> ` : '';
  let coda = '';
  if (x.scad && !x.fatto && p.tipo !== 'domanda') {
    const m = (x.scad - adesso()) / 60000;
    coda = `<span class="conto ${tardi ? 'tardi' : m < 120 ? 'vicino' : ''}">${conto(x.scad)}</span>`;
  }
  return `<div class="riga-guscio" data-id="${esc(p.id)}" data-occ="${esc(occ)}">
    <div class="riga-sotto"><span>${icona('ok')} Fatto</span><span>Rimanda ${icona('ora')}</span></div>
    <div class="riga ${x.fatto ? 'fatto' : ''} ${p.priorita === 2 ? 'p2' : ''}" style="--colore-lista:${p.lista ? colore(p.lista) : 'transparent'}">
      ${p.tipo === 'domanda' ? '<span class="spunta domanda" aria-hidden="true">💬</span>' : `<button class="spunta" aria-label="${x.fatto ? 'Da fare' : 'Fatto'}">${icona('ok')}</button>`}
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
  const libere = lista.filter(p => !p.data && !p.fatto && p.tipo !== 'domanda').sort((a, b) => (b.priorita || 0) - (a.priorita || 0) || b.creato - a.creato).map(senzaData);
  const restaOggi = dOggi.filter(x => !x.fatto);
  const prox = ag.find(x => !x.fatto && x.scad > ora && x.scad - ora < 7 * 864e5);

  let h = `${cartaAggiornamento()}<div class="riassunto">
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
  collegaCartaAggiornamento();
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
  $('v-cal').innerHTML = `${cartaAggiornamento()}<div class="cal"><div class="cal-testa">
      <h2>${MESI[m - 1]} ${y}</h2>
      ${calGiorno !== o || primo.slice(0, 7) !== o.slice(0, 7) ? '<button class="btn-oggi" id="calOggi">Oggi</button>' : ''}
      <button id="calPrec" aria-label="Mese precedente">${icona('sx')}</button><button id="calSucc" aria-label="Mese successivo">${icona('dx')}</button>
    </div><div class="griglia">${g}</div></div>
    ${delGiorno.length ? gruppo(giornoBreve(calGiorno), delGiorno.map(x => riga(x))) : `<div class="vuoto" style="padding-top:12px"><h3>${giornoBreve(calGiorno)}</h3><p>Giornata libera. Tocca di nuovo il giorno per aggiungere qualcosa.</p></div>`}`;
  const sposta = k => { let mm = m + k, yy = y; if (mm < 1) { mm = 12; yy--; } if (mm > 12) { mm = 1; yy++; } calMese = { y: yy, m: mm }; vistaCalendario(); };
  collegaCartaAggiornamento();
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
    $('lIndietro').onclick = () => indietro();
    $('lModifica').onclick = () => apriFoglioLista(listaDi(listaAperta));
    return;
  }
  $('v-liste').innerHTML = `<div class="griglia-liste">${liste.map(l => {
    const n = attiviDiLista(l.id).n;
    return `<button class="carta-lista" data-l="${esc(l.id)}" style="--colore-lista:var(--c-${l.colore})"><span class="emoji">${esc(l.emoji)}</span><div><b>${esc(l.nome)}</b><br><small>${n ? `${n} da ricordare` : 'Niente in sospeso'}</small></div></button>`;
  }).join('')}<button class="carta-lista nuova" id="lNuova">${icona('piu')}<small>Nuova lista</small></button></div>`;
  $('v-liste').querySelectorAll('[data-l]').forEach(b => b.onclick = () => { listaAperta = b.dataset.l; disegna(); aggiornaStoria(); $('contenuto').scrollTop = 0; });
  $('lNuova').onclick = () => apriFoglioLista(null);
}

/* ---------- aggiornamenti dell'app ---------- */
let aggiornamento = null, scaricando = null, codiceInstallato = ATTUALE.codice, ultimoControllo = 0;
const OGNI_CONTROLLO = 6 * 3600e3;
const rimandatoOra = async u => { const r = await archivio.leggiMeta('aggRimandato'); return r?.versione === u.versione && r.fino > adesso(); };
async function controllaAggiornamenti(manuale = false) {
  if (!N.nativo) return null;
  codiceInstallato = (await N.infoApp().catch(() => null))?.codice || ATTUALE.codice;
  ultimoControllo ||= (await archivio.leggiMeta('aggControllo')) || 0;
  // Un aggiornamento già trovato resta segnalato anche riaprendo l'app (senza chiedere di nuovo a GitHub).
  const trovato = await archivio.leggiMeta('aggTrovato');
  if (!aggiornamento && trovato?.codice > codiceInstallato && !(await rimandatoOra(trovato))) { aggiornamento = trovato; disegna(); }
  if (!manuale && adesso() - ((await archivio.leggiMeta('aggControllo')) || 0) < OGNI_CONTROLLO) return aggiornamento;
  try {
    const u = await cercaAggiornamento(MARCHIO.repository, codiceInstallato);
    await archivio.scriviMeta('aggControllo', ultimoControllo = adesso());
    aggiornamento = u && (manuale || !(await rimandatoOra(u))) ? u : null;
    if (u) await archivio.scriviMeta('aggTrovato', u);
    disegna();
    if (manuale && !u) toast(`Hai già l'ultima versione (${ATTUALE.versione})`);
    return u;
  } catch (e) {
    if (manuale) toast('Non riesco a controllare: ' + e.message);
    return null;
  }
}
function cartaAggiornamento() {
  const u = aggiornamento; if (!u) return '';
  const mb = u.dimensione ? ` · ${(u.dimensione / 1048576).toFixed(1).replace('.', ',')} MB` : '';
  return `<div class="carta-agg" id="cartaAgg">
    <div class="agg-testa"><span class="segni-mini"><svg width="28" height="28" fill="#fff" stroke="#fff"><use href="#segni"/></svg></span>
      <div><b>È pronta la versione ${esc(u.versione)}</b><small>Ora hai la ${esc(ATTUALE.versione)}${mb}</small></div></div>
    ${u.cose.length ? `<ul>${u.cose.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
    ${scaricando === null
      ? `<div class="azioni"><button class="btn primario" id="aggOra">Aggiorna ora</button><button class="btn" id="aggDopo">Più tardi</button></div>`
      : `<div class="avanzamento"><i style="width:${Math.max(scaricando, 3)}%"></i></div><small style="color:var(--tenue)">${scaricando >= 100 ? 'Conferma l\'installazione nella finestra di Android' : `Scarico… ${scaricando >= 0 ? scaricando + '%' : ''}`}</small>`}
  </div>`;
}
function collegaCartaAggiornamento() {
  if ($('aggOra')) $('aggOra').onclick = aggiornaOra;
  if ($('aggDopo')) $('aggDopo').onclick = async () => {
    await archivio.scriviMeta('aggRimandato', { versione: aggiornamento.versione, fino: adesso() + 864e5 });
    aggiornamento = null; disegna(); toast('Te lo ricordo domani. Lo trovi anche in Impostazioni');
  };
}
async function aggiornaOra() {
  const u = aggiornamento || await archivio.leggiMeta('aggTrovato'); if (!u) return;
  aggiornamento = u; scaricando = 0; disegna();
  try {
    await N.scaricaAggiornamento(u.apk, u.sha256, p => {
      scaricando = p;
      const barra = document.querySelector('#cartaAgg .avanzamento i'); // aggiorno solo la barra, senza ridisegnare
      if (barra) { barra.style.width = Math.max(p, 3) + '%'; barra.parentElement.nextElementSibling.textContent = `Scarico… ${p >= 0 ? p + '%' : ''}`; }
    });
    scaricando = 100; disegna();
  } catch (e) {
    scaricando = null; disegna(); toast('Aggiornamento non riuscito: ' + e.message);
  }
}
// Dopo un aggiornamento: "Cosa c'è di nuovo", una volta sola.
async function mostraNovitaSeAggiornata() {
  // Chi usava già l'app prima di questa funzione non ha "versioneVista": arriva dalla versione precedente.
  const vista = (await archivio.leggiMeta('versioneVista')) ?? ATTUALE.codice - 1;
  await archivio.scriviMeta('versioneVista', ATTUALE.codice);
  if (vista >= ATTUALE.codice) return;
  apriNovita(NOVITA.filter(v => v.codice > vista), `Benvenuta la ${ATTUALE.versione}!`);
}
function apriNovita(voci = NOVITA.slice(0, 3), titolo = 'Cosa c\'è di nuovo') {
  $('nTitolo').textContent = titolo;
  $('nCorpo').innerHTML = voci.map(v => `<h3>Versione ${esc(v.versione)} · ${esc(v.data)}</h3><ul>${v.cose.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`).join('');
  apriFoglio('fNovita');
}
$('nOk').onclick = () => chiudiFoglio();

function vistaFamiglia() {
  const el = $('v-fam');
  if (!famiglia.configurato) {
    el.innerHTML = `<div class="scheda-fam"><h3>Condividi con la famiglia</h3>
      <p>Promemoria in comune, domande con risposta Sì / No / Forse, avvisi a chi riguarda: funziona con il servizio online di ${MARCHIO.nome}, in arrivo.</p>
      <p>Per le prove: indirizzo del servizio (es. <b>http://192.168.1.20:8787</b>).</p>
      <input class="inserto campo-server" id="fServer" placeholder="https://…" autocomplete="off" autocapitalize="off">
      <button class="btn primario largo" id="fServerOk">Collega</button></div>`;
    $('fServerOk').onclick = async () => { const u = $('fServer').value.trim(); if (!/^https?:\/\//.test(u)) return toast('Scrivi un indirizzo che inizia con http'); await famiglia.impostaServer(u); vistaFamiglia(); };
    return;
  }
  if (!famiglia.attivo) {
    el.innerHTML = `<div class="scheda-fam"><h3>Come ti chiamano?</h3><p>Il nome con cui gli altri ti vedranno nei promemoria e nelle risposte.</p>
      <input class="inserto" id="fNome" maxlength="30" placeholder="es. Anna" autocomplete="given-name"><button class="btn primario largo" id="fNomeOk">Continua</button></div>`;
    $('fNomeOk').onclick = () => azioneFam(async () => { const n = $('fNome').value.trim(); if (!n) throw new Error('Scrivi il tuo nome'); await famiglia.registra(n); vistaFamiglia(); });
    return;
  }
  const gruppi = famiglia.gruppi;
  if (!gruppi.length || gruppoAperto === 'nuovo') {
    el.innerHTML = `${gruppi.length ? `<button class="indietro" id="fIndietro">${icona('sx')} ${esc(famiglia.gruppo(gruppi[0].id).nome)}</button>` : ''}
      <div class="scheda-fam"><h3>Entra con un codice</h3><p>Chi ha già creato la famiglia lo trova in Famiglia › Invita.</p>
        <input class="inserto codice" id="fCodice" maxlength="8" placeholder="ABCD2345" autocomplete="off" autocapitalize="characters" value="${esc(sessionStorage.getItem('invito') || '')}"><button class="btn primario largo" id="fEntra">Entra</button></div>
      <div class="scheda-fam"><h3>Crea una famiglia</h3><p>Poi inviti gli altri con un codice. Va bene anche per coppia, amici, colleghi.</p>
        <input class="inserto" id="fNuovo" maxlength="40" value="Famiglia"><button class="btn primario largo" id="fCrea">Crea</button></div>`;
    if ($('fIndietro')) $('fIndietro').onclick = () => { gruppoAperto = null; vistaFamiglia(); };
    $('fEntra').onclick = () => azioneFam(async () => {
      const c = $('fCodice').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (c.length !== 8) throw new Error('Il codice ha 8 caratteri');
      const g = await famiglia.entra(c); sessionStorage.removeItem('invito'); gruppoAperto = g.id; toast(`Benvenuto in "${g.nome}"!`);
    });
    $('fCrea').onclick = () => azioneFam(async () => { const g = await famiglia.creaGruppo($('fNuovo').value.trim() || 'Famiglia'); gruppoAperto = g.id; toast('Fatto! Ora invita gli altri'); });
    return;
  }
  const g = famiglia.gruppo(gruppoAperto) || gruppi[0];
  gruppoAperto = g.id;
  const delGruppo = lista.filter(p => p.gruppo === g.id);
  const domande = delGruppo.filter(p => p.tipo === 'domanda' && !p.fatto).sort((a, b) => b.creato - a.creato);
  const attesa = domande.filter(inAttesa), altre = domande.filter(p => !inAttesa(p));
  const o = oggiIso();
  const prossimi = primaPerVoce(agenda(delGruppo.filter(p => p.tipo !== 'domanda'), o, piuGiorni(o, 30), cfg).filter(x => !x.fatto)).slice(0, 8);
  const daFare = delGruppo.filter(p => !p.data && !p.fatto && p.tipo !== 'domanda').map(senzaData);
  const fa = t => { const m = Math.round((adesso() - t) / 60000); return m < 1 ? 'adesso' : m < 60 ? `${m} min fa` : m < 1440 ? `${Math.round(m / 60)} h fa` : giornoBreve(dataNelFuso(t, cfg.fuso)); };
  const eventi = famiglia.eventi.filter(e => e.gruppo === g.id).slice(-15).reverse();
  el.innerHTML = `
    ${gruppi.length > 1 ? `<div class="chips" style="margin-bottom:12px">${gruppi.map(x => `<button class="chip ${x.id === g.id ? 'sel' : ''}" data-g="${esc(x.id)}">${esc(x.nome)}</button>`).join('')}</div>` : ''}
    <div class="membri-riga">${g.membri.map(m => `<div class="membro">${avatar(g.id, m.id)}<span>${esc(m.id === ioId() ? 'Tu' : m.nome)}</span></div>`).join('')}
      <button class="membro invita" id="fInvita"><span class="avatar">+</span><span>Invita</span></button></div>
    <div id="fInvito">${invitoMostrato?.g === g.id ? `<div class="scheda-fam"><h3>Codice d'invito</h3><div class="codice-grande">${invitoMostrato.codice}</div><p style="text-align:center;margin:0">Vale 7 giorni. Chi lo riceve apre ${MARCHIO.nome} › Famiglia › Entra con un codice.</p><button class="btn primario largo" id="fCondividiInvito">Condividi</button></div>` : ''}</div>
    ${gruppo('Rispondi tu', attesa.map(p => riga(senzaData(p))), 'ritardo')}
    ${gruppo('Domande', altre.map(p => riga(senzaData(p))))}
    ${gruppo('In programma insieme', prossimi.map(x => riga(x, { mostraGiorno: true })))}
    ${gruppo('Da fare insieme', daFare.map(x => riga(x)))}
    ${!domande.length && !prossimi.length && !daFare.length ? vuoto('Ancora niente in comune', 'Tocca + e scegli "Con chi": ' + esc(g.nome) + '. Con un punto di domanda diventa una domanda.') : ''}
    ${eventi.length ? `<div class="gruppo"><div class="gruppo-titolo">Attività</div><div class="lista-righe feed">${eventi.map(e => { const f = fraseEvento(e, ioId()); return `<div class="ev">${avatar(g.id, e.da, 'piccolo')}<div><b>${esc(f.titolo)}</b> ${esc(f.corpo)}<small>${fa(e.creato)}</small></div></div>`; }).join('')}</div></div>` : ''}
    <div class="chips" style="justify-content:center;margin-top:8px"><button class="chip" id="fAltro">+ Altra famiglia o gruppo</button><button class="chip" id="fRinomina">Rinomina</button><button class="chip" id="fEsci">Esci dal gruppo</button></div>`;
  el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { gruppoAperto = b.dataset.g; vistaFamiglia(); });
  $('fInvita').onclick = () => azioneFam(async () => {
    const { codice } = await famiglia.invita(g.id);
    invitoMostrato = { g: g.id, codice };
  });
  if ($('fCondividiInvito')) $('fCondividiInvito').onclick = () => condividiTesto(`Entra nella famiglia "${g.nome}" su ${MARCHIO.nome} con il codice ${invitoMostrato.codice}`);
  $('fAltro').onclick = () => { gruppoAperto = 'nuovo'; vistaFamiglia(); };
  $('fRinomina').onclick = () => azioneFam(async () => { const n = prompt('Nuovo nome del gruppo', g.nome)?.trim(); if (n) await famiglia.rinominaGruppo(g.id, n); });
  $('fEsci').onclick = () => azioneFam(async () => { if (!confirm(`Uscire da "${g.nome}"? Non vedrai più le sue voci.`)) return; await famiglia.esci(g.id); gruppoAperto = null; toast('Sei uscito dal gruppo'); });
}
async function azioneFam(fn) {
  try { await fn(); await ricarica(); }
  catch (e) { toast(e.message || 'Non riuscito'); }
}
function condividiTesto(t) {
  if (N.nativo) return N.condividiTesto(t);
  if (navigator.share) return navigator.share({ text: t }).catch(() => {});
  navigator.clipboard?.writeText(t).then(() => toast('Copiato: incollalo dove vuoi'), () => toast(t));
}

/* ---------- domanda: risposte come in Rigordati ---------- */
let dv = null;
function apriDomanda(p, origine) {
  dv = p.id;
  corpoDomanda();
  apriFoglio('fDomanda', origine);
}
function corpoDomanda() {
  const p = lista.find(x => x.id === dv); if (!p) return chiudiFoglio();
  $('dTitolo').textContent = p.titolo;
  const meta = [];
  if (p.data) meta.push(`<span>📅 ${giornoBreve(p.data)}${p.ora ? ' · ' + p.ora : ''}</span>`);
  if (p.perChi?.length) meta.push(`<span class="pill per">per ${esc(p.perChi.map(u => nomeMembro(p.gruppo, u)).join(', '))}</span>`);
  meta.push(`<span>chiede ${esc(mio(p) ? 'tu' : p.autore?.nome || '?')}</span>`);
  $('dMeta').innerHTML = meta.join('');
  const r = p.risposte || [];
  $('dRisposte').innerHTML = r.length ? r.map(x => `<div class="bolla ${x.uid === ioId() ? 'mia' : ''}"><small>${esc(x.uid === ioId() ? 'Tu' : x.nome)}${x.inAttesa ? ' · invio…' : ''}</small>${esc(x.testo)}</div>`).join('') : '<p class="nota" style="color:var(--tenue)">Ancora nessuna risposta.</p>';
  $('dRisposte').scrollTop = 1e6;
  $('dModifica').hidden = !mio(p);
}
async function invia(testo) {
  testo = testo.trim(); if (!testo) return;
  await famiglia.rispondi(dv, testo);
  $('dTesto').value = '';
  N.vibra('leggero');
  await ricarica(); corpoDomanda();
}
$('dRapide').querySelectorAll('button').forEach(b => b.onclick = () => invia(b.dataset.r));
$('dInvia').onclick = () => invia($('dTesto').value);
$('dTesto').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); invia($('dTesto').value); } };
$('dModifica').onclick = () => { const p = lista.find(x => x.id === dv); chiudiFoglio().then(() => apriScheda(p)); };

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

    <div class="sez">Famiglia</div>
    <div class="pannello">
      ${famiglia.attivo ? `<div class="voce cliccabile" id="iMioNome"><div>Il mio nome<small>Come ti vedono gli altri</small></div><b>${esc(famiglia.io.nome)}</b></div>` : ''}
      <div class="voce"><div>Servizio famiglia<small>${famiglia.configurato ? esc(famiglia.server) : 'Non collegato'}</small></div><button class="btn" id="iServer" style="flex:none;padding:9px 14px">${famiglia.configurato ? 'Cambia' : 'Collega'}</button></div>
    </div>

    <div class="sez">App collegate</div>
    <div class="pannello">
      <div class="voce"><div>💶 Conti<small>Bollette e abbonamenti diventano promemoria da soli</small></div><span class="prossimamente">Presto</span></div>
      <div class="voce"><div>📅 Esporta nel calendario<small>File .ics per Google Calendar, Outlook, Apple</small></div><button class="btn" id="iIcs" style="flex:none;padding:9px 14px">Esporta</button></div>
      <div class="voce"><div>📲 Da altre app<small>Condividi un messaggio o una mail con ${MARCHIO.nome} e diventa un promemoria</small></div></div>
    </div>

    <div class="sez">Aggiornamenti</div>
    <div class="pannello">
      <div class="voce"><div>${MARCHIO.nome} ${ATTUALE.versione}<small>${aggiornamento ? `È pronta la ${esc(aggiornamento.versione)}` : N.nativo ? (ultimoControllo ? `Ultimo controllo: ${giornoBreve(dataNelFuso(ultimoControllo, cfg.fuso)).toLowerCase()} alle ${new Date(ultimoControllo).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : 'Controllo da solo ogni 6 ore') : 'La versione web si aggiorna da sola'}</small></div>
        ${N.nativo ? `<button class="btn ${aggiornamento ? 'primario' : ''}" id="iAggiorna" style="flex:none;padding:9px 14px">${aggiornamento ? 'Aggiorna' : 'Controlla'}</button>` : ''}</div>
      <div class="voce cliccabile" id="iNovita"><div>Cosa c'è di nuovo<small>Le novità delle ultime versioni</small></div>${icona('dx')}</div>
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
  if ($('iMioNome')) $('iMioNome').onclick = () => azioneFam(async () => { const n = prompt('Il tuo nome', famiglia.io.nome)?.trim(); if (n) { await famiglia.rinominami(n); vistaImpostazioni(); } });
  $('iServer').onclick = () => azioneFam(async () => {
    const u = prompt('Indirizzo del servizio famiglia', famiglia.server || 'https://')?.trim();
    if (u === undefined || u === null) return;
    if (u && !/^https?:\/\//.test(u)) throw new Error('L\'indirizzo deve iniziare con http');
    if (famiglia.attivo && u !== famiglia.server) await famiglia.esciDaTutto();
    await famiglia.impostaServer(u); vistaImpostazioni();
  });
  if ($('iAggiorna')) $('iAggiorna').onclick = () => aggiornamento ? (vaiA(CASA), aggiornaOra()) : controllaAggiornamenti(true);
  $('iNovita').onclick = () => apriNovita();
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
  if (p.tipo === 'domanda') return apriDomanda(p, g);
  if (e.target.closest('.spunta')) return segna(p, g.dataset.occ, g, e);
  apriScheda(p, { occ: g.dataset.occ }, g);
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
let foglio = null, origineFoglio = null;
// Con un'origine (il +, una riga) il foglio diventa una finestra che si allarga da lì.
function apriFoglio(id, origine = null) {
  if (foglio && foglio !== id) $(foglio).classList.remove('on', 'finestra');
  const f = $(id);
  foglio = id; origineFoglio = origine;
  f.classList.toggle('finestra', !!origine);
  f.classList.add('on'); $('velo').classList.add('on');
  $('btnNuovo').classList.toggle('aperto', id === 'fScheda');
  document.querySelector('.barra').classList.toggle('sopra', id === 'fScheda');
  aggiornaStoria();
  return origine && animazioni() ? cresci(f, origine) : Promise.resolve();
}
// Solo transform e opacity: così l'animazione la fa la scheda grafica, senza ricalcoli a ogni fotogramma.
function cresci(f, origine, chiudi = false) {
  const o = origine.getBoundingClientRect(), r = f.getBoundingClientRect();
  if (!o.width) return Promise.resolve();
  f.style.transformOrigin = `${o.left + o.width / 2 - r.left}px ${o.top + o.height / 2 - r.top}px`;
  const fotogrammi = [{ transform: 'scale(.08)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }];
  return f.animate(chiudi ? fotogrammi.reverse() : fotogrammi, chiudi
    ? { duration: 170, easing: 'cubic-bezier(.4,0,1,1)' }
    : { duration: 260, easing: 'cubic-bezier(.16,1,.3,1)' }).finished.catch(() => {});
}
async function chiudiFoglio() {
  if (!foglio) return;
  const f = $(foglio), origine = origineFoglio;
  foglio = null; origineFoglio = null;
  $('velo').classList.remove('on'); $('btnNuovo').classList.remove('aperto');
  document.querySelector('.barra').classList.remove('sopra');
  aggiornaStoria();
  const eraFinestra = f.classList.contains('finestra');
  if (origine && eraFinestra && animazioni() && origine.isConnected) await cresci(f, origine, true).catch(() => {});
  if (foglio === f.id) return; // riaperto nel frattempo
  if (eraFinestra) {
    // Spengo la transizione "dal basso" dei fogli, altrimenti un fantasma della finestra scivolerebbe giù.
    f.style.transition = 'none'; f.classList.remove('on', 'finestra'); void f.offsetWidth; f.style.transition = '';
  } else f.classList.remove('on');
}
$('velo').onclick = () => chiudiFoglio();

/* ---------- nuovo / modifica ---------- */
let s = null; // stato della scheda aperta
function apriScheda(p = null, pre = {}, origine = null) {
  s = {
    id: p?.id || null, occ: pre.occ || '', originale: p, scelto: p ? { data: 1, ora: 1, ripeti: 1, priorita: 1, lista: 1 } : {},
    v: {
      titolo: p?.titolo || '', data: p?.data ?? pre.data ?? '', ora: p?.ora ?? pre.ora ?? '', ripeti: p?.ripeti ? { ...p.ripeti } : null,
      avvisi: [...(p?.avvisi ?? cfg.avvisi)], insisti: p?.insisti ?? cfg.insisti, priorita: p?.priorita || 0,
      lista: p?.lista ?? pre.lista ?? (listaAperta || ''), note: p?.note || '', listaNuova: '',
      gruppo: p?.gruppo ?? pre.gruppo ?? (vista === 'v-fam' && famiglia.gruppo(gruppoAperto) ? gruppoAperto : ''),
      perChi: [...(p?.perChi || [])], tipo: p?.tipo || 'promemoria'
    }
  };
  if (p) s.scelto.tipo = 1;
  if (pre.data || pre.ora) Object.assign(s.scelto, { data: 1, ora: 1 });
  $('sIntestazione').textContent = p ? 'Modifica' : 'Nuovo promemoria';
  $('sTesto').value = p ? p.titolo : pre.testo || '';
  $('sNote').value = s.v.note;
  $('sElimina').hidden = !p;
  $('sSalva').textContent = p ? 'Salva' : 'Ricordamelo';
  $('sDettagli').hidden = !p; $('sDettagliTog').classList.toggle('aperto', !!p);
  if (pre.testo && !p) leggiTesto(); else aggiornaScheda();
  autoAltezza(); // misure prima dell'animazione, non durante
  const aperta = apriFoglio('fScheda', origine || $('btnNuovo'));
  // La tastiera ridimensiona lo schermo: la apro solo a finestra già aperta, così l'animazione non scatta.
  if (!p) aperta.then(() => foglio === 'fScheda' && $('sTesto').focus({ preventScroll: true }));
}
$('btnNuovo').onclick = () => foglio === 'fScheda' ? chiudiFoglio() : apriScheda(null, vista === 'v-cal' && calGiorno && calGiorno !== oggiIso() ? { data: calGiorno } : {}, $('btnNuovo'));
function autoAltezza() { const t = $('sTesto'); t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }

function leggiTesto() {
  const c = capisci($('sTesto').value);
  s.v.titolo = c.titolo;
  if (!s.scelto.data) { s.v.data = c.data; }
  if (!s.scelto.ora) { s.v.ora = c.ora; }
  if (!s.scelto.ripeti) s.v.ripeti = c.ripeti;
  if (!s.scelto.priorita) s.v.priorita = c.priorita;
  if (!s.scelto.tipo) s.v.tipo = s.v.gruppo && $('sTesto').value.includes('?') ? 'domanda' : 'promemoria';
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
  if (v.data && v.avvisi.length && v.tipo !== 'domanda') c.push(`<span>🔔 ${v.avvisi.length === 1 ? (v.avvisi[0] ? durata(v.avvisi[0]) + ' prima' : 'al momento') : v.avvisi.length + ' avvisi'}</span>`);
  if (v.data && v.insisti && v.tipo !== 'domanda') c.push(`<span>📣 insiste</span>`);
  if (v.gruppo) c.push(`<span>👪 ${esc(famiglia.gruppo(v.gruppo)?.nome || '')}${v.perChi.length ? ' · per ' + esc(v.perChi.map(u => nomeMembro(v.gruppo, u)).join(', ')) : ''}</span>`);
  if (v.tipo === 'domanda') c.push('<span>💬 Domanda</span>');
  if (!s.id) $('sSalva').textContent = v.tipo === 'domanda' && v.gruppo ? 'Chiedi' : v.gruppo ? 'Condividi' : 'Ricordamelo';
  // condivisione
  const gruppi = famiglia.attivo ? famiglia.gruppi : [];
  $('sCondividi').hidden = !gruppi.length;
  if (gruppi.length) {
    $('sGruppo').innerHTML = `<button class="chip ${!v.gruppo ? 'sel' : ''}" data-g="">Solo io</button>` + gruppi.map(g => `<button class="chip ${v.gruppo === g.id ? 'sel' : ''}" data-g="${esc(g.id)}">👪 ${esc(g.nome)}</button>`).join('');
    $('sGruppo').querySelectorAll('button').forEach(b => b.onclick = () => { v.gruppo = b.dataset.g; v.perChi = []; if (!s.scelto.tipo) v.tipo = v.gruppo && $('sTesto').value.includes('?') ? 'domanda' : 'promemoria'; aggiornaScheda(); });
    $('sCondivisoCampi').hidden = !v.gruppo;
    const g = famiglia.gruppo(v.gruppo);
    if (g) {
      $('sPerChi').innerHTML = `<button class="chip ${!v.perChi.length ? 'sel' : ''}" data-u="">Tutti</button>` + g.membri.map(m => `<button class="chip ${v.perChi.includes(m.id) ? 'sel' : ''}" data-u="${esc(m.id)}">${esc(m.id === ioId() ? 'Io' : m.nome)}</button>`).join('');
      $('sPerChi').querySelectorAll('button').forEach(b => b.onclick = () => {
        const u = b.dataset.u, set = new Set(v.perChi);
        if (!u) set.clear(); else set.has(u) ? set.delete(u) : set.add(u);
        v.perChi = set.size === g.membri.length ? [] : [...set]; aggiornaScheda();
      });
      $('sTipo').querySelectorAll('button').forEach(b => { b.classList.toggle('sel', b.dataset.t === v.tipo); b.onclick = () => { s.scelto.tipo = 1; v.tipo = b.dataset.t; aggiornaScheda(); }; });
    }
  }
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
  // dettagli: li costruisco solo se sono aperti (la finestra nuova si apre più in fretta)
  if ($('sDettagli').hidden) return;
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
$('sDettagliTog').onclick = () => { const h = !$('sDettagli').hidden; $('sDettagli').hidden = h; $('sDettagliTog').classList.toggle('aperto', !h); if (!h) aggiornaScheda(); };
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
  const domanda = v.gruppo && v.tipo === 'domanda';
  const p = {
    ...(s.originale || {}), titolo: v.titolo, data: v.data, ora: v.data ? v.ora : '', ripeti: v.data && !domanda ? v.ripeti : null,
    avvisi: domanda ? [] : v.avvisi, insisti: domanda ? 0 : v.insisti, priorita: v.priorita, lista: lista_, note: v.note.trim(),
    fuso: cfg.fuso, gruppo: v.gruppo || '', perChi: v.gruppo ? v.perChi : [], tipo: domanda ? 'domanda' : 'promemoria'
  };
  if (p.gruppo && !s.originale?.gruppo) Object.assign(p, { autore: { id: ioId(), nome: famiglia.io.nome }, risposte: [] });
  if (s.originale && (s.originale.gruppo || '') !== p.gruppo) {
    // Cambia "con chi": nasce una voce nuova e la vecchia sparisce (anche per gli altri).
    await archivio.elimina(s.originale.id);
    for (const k of ['id', 'seqServer', 'risposte', 'autore']) delete p[k];
    if (p.gruppo) Object.assign(p, { autore: { id: ioId(), nome: famiglia.io.nome }, risposte: [] });
  }
  if (s.originale && (s.originale.data !== p.data || s.originale.ora !== p.ora)) delete p.rinvio;
  const salvato = await archivio.salva(p);
  chiudiFoglio();
  const primo = prossimoAvviso(salvato, adesso(), cfg);
  const gNome = famiglia.gruppo(salvato.gruppo)?.nome;
  toast(salvato.tipo === 'domanda' ? `Domanda inviata a "${gNome}"` : s.id ? 'Modificato' : gNome && !perAvvisi(salvato) ? `Condiviso con "${gNome}"` : primo ? `Ok! Ti avviso ${quandoLeggibile(primo)}` : salvato.data ? 'Fatto, è in agenda' : 'Ok, lo trovi in "Quando capita"');
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
  chiudiFoglio(); listaAperta = null; disegna(); aggiornaStoria();
};

/* ---------- ricerca ---------- */
let vistaPrimaDiCercare = CASA;
function chiudiRicerca() { if ($('cercaBox').hidden) return; $('cercaBox').hidden = true; ricerca = ''; $('cercaInput').value = ''; }
$('btnCerca').onclick = () => {
  if (!$('cercaBox').hidden) { chiudiRicerca(); return vaiA(vistaPrimaDiCercare); }
  vistaPrimaDiCercare = vista; $('cercaBox').hidden = false; vaiA('v-cerca'); $('cercaInput').focus();
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
    if (!foglio && !trascina && (vista === 'v-oggi' || vista === 'v-cal')) disegna();
    return;
  }
  const r = await controlla(archivio, mostraAvviso, adesso(), perAvvisi);
  aggiornaBollino();
  const attesa = r.prossimo ? Math.min(Math.max(r.prossimo - adesso() + 500, 1000), 60e3) : 60e3;
  timer = setTimeout(pianifica, attesa);
  if (!foglio && !trascina && (vista === 'v-oggi' || vista === 'v-cal')) disegna(); // aggiorna i "tra X min"
}
function aggiornaBollino(n = bollino(lista.filter(perAvvisi), cfg, adesso()) + lista.filter(inAttesa).length) {
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
    await archivio.scriviMeta('versioneVista', ATTUALE.codice); // installazione nuova: niente novità da mostrare
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
  if (q.has('invito')) { sessionStorage.setItem('invito', q.get('invito').toUpperCase()); gruppoAperto = 'nuovo'; return vaiA('v-fam'); }
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
// Avvisi delle novità della famiglia: "💬 Anna ti chiede", "✅ Bruno ha fatto"…
function avvisaNovita(eventi) {
  ricarica();
  for (const e of eventi) {
    const f = fraseEvento(e, ioId());
    if (N.nativo) N.notificaSubito(f.titolo, f.corpo, { id: e.voce || '' });
    else mostraAvviso({ titolo: f.titolo, corpo: f.corpo, chiave: 'ev' + e.seq, priorita: 0, tipo: 'evento' });
  }
}

(async () => {
  await famiglia.carica();
  cfg = await archivio.impostazioni();
  applicaAspetto();
  await ricarica();
  if (N.nativo) {
    document.documentElement.dataset.nativo = '';
    N.suIndietro(() => indietro());
    permessoNativo = await N.permesso();
    await N.prepara({
      suAzione: async (azione, { id, occ }) => {
        if (azione === 'fatto' && id) { await archivio.segnaFatto(id, occ); toast('Fatto!'); }
        else if (azione === 'rinvia' && id) { await archivio.rinvia(id, occ, adesso() + 10 * 60e3); toast('Te lo ricordo tra 10 minuti'); }
        else if (id) { const p = lista.find(x => x.id === id); if (p) p.tipo === 'domanda' ? apriDomanda(p) : apriScheda(p, { occ }); }
      },
      suCondiviso: testo => cfg.profilo && apriScheda(null, { testo })
    });
  }
  if (!cfg.profilo) benvenuto();
  else { leggiIngresso(); pianifica(); riprogramma(); }
  famiglia.avvia(avvisaNovita);
  if (cfg.profilo) mostraNovitaSeAggiornata();
  controllaAggiornamenti();
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && controllaAggiornamenti());
  if (!N.nativo && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    const avevaController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js', { type: 'module', updateViaCache: 'none' }).catch(() => {});
    // Versione web: quando arriva una versione nuova lo dico, e ricarico solo se lo vuoi tu.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (avevaController) toast('È pronta una nuova versione', 'Ricarica', () => location.reload());
    });
  }
})();
