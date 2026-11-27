// Famiglia e gruppi: promemoria condivisi, domande e risposte, avvisi agli altri (il cuore di Rigordati).
// Local-first: tutto si scrive subito sul telefono; una coda manda le modifiche al server quando c'è rete,
// e la sincronizzazione porta qui quelle degli altri.
import { archivio } from './archivio.js';
import { MARCHIO } from './marchio.js';

const OGNI = 15e3;                 // sincronizzazione ad app aperta
const SOLO_LOCALI = ['id', 'gruppo', 'rinvio', 'seqServer', 'aggiornato', 'risposte', 'autore'];
let s = { account: null, gruppi: [], eventi: [], cursore: 0, server: '', coda: [] };
let timer = null, invio = null, inCorso = null, suNovita = () => {};

const salvaMeta = (k, v) => archivio.scriviMeta('fam-' + k, v);
const indirizzo = () => (s.server || MARCHIO.server || '').replace(/\/+$/, '');

async function api(metodo, percorso, corpo) {
  if (!indirizzo()) throw Object.assign(new Error('Servizio famiglia non configurato'), { stato: 0 });
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 12e3);
  try {
    const r = await fetch(indirizzo() + percorso, {
      method: metodo, signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(s.account ? { Authorization: 'Bearer ' + s.account.token } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.errore || 'Errore ' + r.status), { stato: r.status });
    return j;
  } catch (e) {
    if (e.stato === undefined) e.stato = 0; // niente rete
    if (e.name === 'AbortError') e.message = 'Il servizio non risponde';
    else if (!e.stato) e.message = e.message === 'Failed to fetch' ? 'Nessuna connessione con il servizio' : e.message;
    throw e;
  } finally { clearTimeout(t); }
}

export const famiglia = {
  async carica() {
    const [account, gruppi, eventi, cursore, server, coda] = await Promise.all(['account', 'gruppi', 'eventi', 'cursore', 'server', 'coda'].map(k => archivio.leggiMeta('fam-' + k)));
    s = { account: account || null, gruppi: gruppi || [], eventi: eventi || [], cursore: cursore || 0, server: server || '', coda: coda || [] };
  },
  get io() { return s.account?.utente || null; },
  get gruppi() { return s.gruppi; },
  get eventi() { return s.eventi; },
  get server() { return indirizzo(); },
  get configurato() { return !!indirizzo(); },
  get attivo() { return !!(indirizzo() && s.account); },
  gruppo: id => s.gruppi.find(g => g.id === id),
  membro(gruppo, uid) { return this.gruppo(gruppo)?.membri.find(m => m.id === uid); },

  async impostaServer(url) { s.server = url.trim(); await salvaMeta('server', s.server); },

  async registra(nome) {
    const r = await api('POST', '/v1/utenti', { nome });
    s.account = { utente: r.utente, token: r.token };
    await salvaMeta('account', s.account);
    return r.utente;
  },
  async rinominami(nome) { s.account.utente = await api('PATCH', '/v1/io', { nome }); await salvaMeta('account', s.account); await this.sinc(); },
  async creaGruppo(nome) { const g = await api('POST', '/v1/gruppi', { nome }); await this.sinc(); return g; },
  async rinominaGruppo(id, nome) { await api('PATCH', `/v1/gruppi/${id}`, { nome }); await this.sinc(); },
  invita: id => api('POST', `/v1/gruppi/${id}/inviti`),
  leggiInvito: codice => api('GET', `/v1/inviti/${codice}`),
  async entra(codice) { const g = await api('POST', `/v1/inviti/${codice}`); await this.sinc(); return g; },
  async esci(id) {
    await api('POST', `/v1/gruppi/${id}/esci`);
    for (const p of (await archivio.promemoria()).filter(p => p.gruppo === id)) await archivio.elimina(p.id, { daServer: true });
    await this.sinc();
  },

  /** Risposta a una domanda: subito sul telefono, poi al server (che le aggiunge senza sovrascrivere). */
  async rispondi(id, testo) {
    const p = await archivio.uno(id); if (!p) return;
    p.risposte = [...(p.risposte || []), { uid: this.io.id, nome: this.io.nome, testo, quando: Date.now(), inAttesa: true }];
    await archivio.salva(p, { daServer: true });
    await this.accoda({ op: 'risposta', id, testo });
  },

  async accoda(o) {
    if (o.op === 'salva') s.coda = s.coda.filter(x => !(x.op === 'salva' && x.id === o.id));
    s.coda.push(o);
    await salvaMeta('coda', s.coda);
    clearTimeout(invio); invio = setTimeout(() => this.invia().catch(() => {}), 300);
  },

  /** Manda la coda al server, in ordine. Se manca la rete si ferma e riprova al prossimo giro. */
  async invia() {
    if (!this.attivo) return;
    while (s.coda.length) {
      const o = s.coda[0];
      try {
        if (o.op === 'salva') {
          const p = await archivio.uno(o.id);
          if (p?.gruppo) {
            const dati = Object.fromEntries(Object.entries(p).filter(([k]) => !SOLO_LOCALI.includes(k)));
            const r = await api('PUT', `/v1/voci/${o.id}`, { gruppo: p.gruppo, dati });
            await unisci({ id: o.id, gruppo: p.gruppo, dati: r.dati, seq: r.seq }, true);
          }
        } else if (o.op === 'elimina') await api('DELETE', `/v1/voci/${o.id}`);
        else if (o.op === 'risposta') {
          const p = await archivio.uno(o.id);
          const r = await api('POST', `/v1/voci/${o.id}/risposte`, { testo: o.testo });
          if (p) await unisci({ id: o.id, gruppo: p.gruppo, dati: r.dati, seq: r.seq }, true);
        }
      } catch (e) {
        if (!e.stato || e.stato >= 500) return; // rete o server: riprovo dopo
        console.warn('Modifica scartata dal servizio:', e.message);
      }
      s.coda.shift();
      await salvaMeta('coda', s.coda);
    }
  },

  /** Scarica le novità. Restituisce gli eventi nuovi che riguardano me (per gli avvisi). */
  async sinc() {
    if (!this.attivo) return [];
    if (inCorso) return inCorso;
    inCorso = (async () => {
      await this.invia();
      const primaVolta = !s.cursore;
      const r = await api('GET', `/v1/sinc?dopo=${s.cursore}`);
      s.gruppi = r.gruppi;
      const mieiGruppi = new Set(r.gruppi.map(g => g.id));
      for (const v of r.voci) await unisci(v);
      // Gruppi lasciati: tolgo dal telefono le loro voci
      for (const p of (await archivio.promemoria()).filter(p => p.gruppo && !mieiGruppi.has(p.gruppo))) await archivio.elimina(p.id, { daServer: true });
      const nuovi = r.eventi.filter(e => !s.eventi.some(x => x.seq === e.seq));
      s.eventi = [...s.eventi, ...nuovi].slice(-150);
      s.cursore = r.cursore;
      await Promise.all([salvaMeta('gruppi', s.gruppi), salvaMeta('eventi', s.eventi), salvaMeta('cursore', s.cursore)]);
      const miei = primaVolta ? [] : nuovi.filter(e => rilevante(e, this.io.id));
      if (r.voci.length || nuovi.length) suNovita(miei);
      return miei;
    })().finally(() => { inCorso = null; });
    return inCorso;
  },

  avvia(fn) {
    suNovita = fn;
    archivio.ascolta(ev => {
      if (ev.daServer || !ev.gruppo || !this.attivo) return;
      this.accoda({ op: ev.tipo === 'eliminato' ? 'elimina' : 'salva', id: ev.id });
    });
    const giro = () => { clearTimeout(timer); if (document.visibilityState === 'visible') this.sinc().catch(() => {}); timer = setTimeout(giro, OGNI); };
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && giro());
    giro();
  },

  async esciDaTutto() {
    s = { account: null, gruppi: [], eventi: [], cursore: 0, server: s.server, coda: [] };
    await Promise.all(['account', 'gruppi', 'eventi', 'cursore', 'coda'].map(k => salvaMeta(k, null)));
  }
};

async function unisci(v, mio = false) {
  const locale = await archivio.uno(v.id);
  if (!mio && s.coda.some(o => o.id === v.id)) return; // ho modifiche in viaggio: vince la mia
  if (v.eliminata) { if (locale) await archivio.elimina(v.id, { daServer: true }); return; }
  if (locale?.seqServer && locale.seqServer >= v.seq) return;
  await archivio.salva({ ...v.dati, id: v.id, gruppo: v.gruppo, seqServer: v.seq, rinvio: locale?.rinvio, creato: locale?.creato ?? v.dati.creato }, { daServer: true });
}

export const rilevante = (e, io) => e.da !== io && (!e.per?.length || e.per.includes(io));

/** Frase dell'avviso, come in Rigordati: "💬 Anna ti chiede", "✅ Bruno ha fatto". */
export function fraseEvento(e, io) {
  const chi = famiglia.membro(e.gruppo, e.da)?.nome || e.titolo || 'Qualcuno';
  const perMe = e.per?.length === 1 && e.per[0] === io;
  return ({
    domanda: { titolo: `💬 ${chi} ${perMe ? 'ti chiede' : 'chiede'}`, corpo: e.titolo },
    nuova: { titolo: `📌 ${chi} ha aggiunto${perMe ? ' per te' : ''}`, corpo: e.titolo },
    spesa: { titolo: `🛒 ${chi} ha aggiunto alla lista`, corpo: e.titolo },
    modifica: { titolo: `✏️ ${chi} ha modificato`, corpo: e.titolo },
    risposta: { titolo: `💬 ${chi} ha risposto`, corpo: `${e.titolo} → ${e.testo}` },
    fatto: { titolo: `✅ ${chi} ha fatto`, corpo: e.titolo },
    entrato: { titolo: `👋 ${e.titolo} è nel gruppo`, corpo: famiglia.gruppo(e.gruppo)?.nome || '' },
    uscito: { titolo: `${e.titolo} ha lasciato il gruppo`, corpo: famiglia.gruppo(e.gruppo)?.nome || '' }
  })[e.tipo] || { titolo: chi, corpo: e.titolo };
}
