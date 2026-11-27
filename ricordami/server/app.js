// API di RicordaMi: famiglie/gruppi, promemoria condivisi, domande e risposte, eventi da notificare.
// Solo standard web (Request/Response, crypto): gira uguale su Cloudflare Workers e su Node.
// `db` è un adattatore con tre funzioni asincrone: tutti(sql, ...valori), uno(sql, ...valori), esegui(sql, ...valori).

const GIORNI_INVITO = 7;
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const COLORI = ['lilla', 'menta', 'cielo', 'sole', 'rosa', 'pesca'];
const MAX_DATI = 16000;

const casuale = n => [...crypto.getRandomValues(new Uint8Array(n))];
const nuovoId = () => casuale(12).map(x => x.toString(36).padStart(2, '0')).join('').slice(0, 20);
const nuovoCodice = () => casuale(8).map(x => ALFABETO[x % 32]).join('');
const sha256 = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(x => x.toString(16).padStart(2, '0')).join('');
const testo = (s, max) => typeof s === 'string' && s.trim() ? s.trim().slice(0, max) : null;
class Errore extends Error { constructor(stato, msg) { super(msg); this.stato = stato; } }

export function creaApp(db, { adesso = () => Date.now(), avvisa = null } = {}) {
  const prossimoSeq = async () => (await db.uno('UPDATE contatore SET n = n + 1 WHERE id = 1 RETURNING n')).n;

  async function chi(req) {
    const t = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!t) throw new Errore(401, 'accesso richiesto');
    const r = await db.uno('SELECT u.id, u.nome FROM gettoni g JOIN utenti u ON u.id = g.utente WHERE g.hash = ?', await sha256(t));
    if (!r) throw new Errore(401, 'accesso non valido');
    return r;
  }
  async function membro(gruppo, utente) {
    const m = await db.uno('SELECT * FROM membri WHERE gruppo = ? AND utente = ?', gruppo, utente);
    if (!m) throw new Errore(403, 'non fai parte di questo gruppo');
    return m;
  }
  async function gruppiDi(utente) {
    const gruppi = await db.tutti('SELECT g.id, g.nome FROM gruppi g JOIN membri m ON m.gruppo = g.id WHERE m.utente = ? ORDER BY m.entrato, m.rowid', utente);
    for (const g of gruppi) g.membri = await db.tutti('SELECT utente AS id, nome, colore FROM membri WHERE gruppo = ? ORDER BY entrato, rowid', g.id);
    return gruppi;
  }
  async function evento(gruppo, voce, tipo, da, per, titolo, testo_) {
    const seq = await prossimoSeq();
    const e = { seq, gruppo, voce, tipo, da, per: per || [], titolo: titolo || '', testo: testo_ || '', creato: adesso() };
    await db.esegui('INSERT INTO eventi (seq, gruppo, voce, tipo, da, per, titolo, testo, creato) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      seq, gruppo, voce, tipo, da, JSON.stringify(e.per), e.titolo, e.testo, e.creato);
    if (avvisa) await Promise.resolve(avvisa(e)).catch(() => {}); // notifiche push (quando ci saranno)
    return e;
  }

  const rotte = [
    ['POST', /^\/v1\/utenti$/, async (req) => {
      const { nome } = await req.json();
      const n = testo(nome, 30); if (!n) throw new Errore(400, 'serve un nome');
      const id = nuovoId(), token = casuale(32).map(x => x.toString(16).padStart(2, '0')).join('');
      await db.esegui('INSERT INTO utenti (id, nome, creato) VALUES (?, ?, ?)', id, n, adesso());
      await db.esegui('INSERT INTO gettoni (hash, utente, creato) VALUES (?, ?, ?)', await sha256(token), id, adesso());
      return [201, { utente: { id, nome: n }, token }];
    }, false],
    ['GET', /^\/v1\/io$/, async (req, io) => [200, io]],
    ['PATCH', /^\/v1\/io$/, async (req, io) => {
      const n = testo((await req.json()).nome, 30); if (!n) throw new Errore(400, 'serve un nome');
      await db.esegui('UPDATE utenti SET nome = ? WHERE id = ?', n, io.id);
      await db.esegui('UPDATE membri SET nome = ? WHERE utente = ?', n, io.id);
      return [200, { id: io.id, nome: n }];
    }],
    ['POST', /^\/v1\/gruppi$/, async (req, io) => {
      const n = testo((await req.json()).nome, 40); if (!n) throw new Errore(400, 'serve un nome per il gruppo');
      const id = nuovoId();
      await db.esegui('INSERT INTO gruppi (id, nome, creatore, creato) VALUES (?, ?, ?, ?)', id, n, io.id, adesso());
      await db.esegui('INSERT INTO membri (gruppo, utente, nome, colore, entrato) VALUES (?, ?, ?, ?, ?)', id, io.id, io.nome, COLORI[0], adesso());
      return [201, (await gruppiDi(io.id)).find(g => g.id === id)];
    }],
    ['PATCH', /^\/v1\/gruppi\/([\w-]+)$/, async (req, io, [g]) => {
      await membro(g, io.id);
      const n = testo((await req.json()).nome, 40); if (!n) throw new Errore(400, 'serve un nome');
      await db.esegui('UPDATE gruppi SET nome = ? WHERE id = ?', n, g);
      return [200, { id: g, nome: n }];
    }],
    ['POST', /^\/v1\/gruppi\/([\w-]+)\/inviti$/, async (req, io, [g]) => {
      await membro(g, io.id);
      const codice = nuovoCodice(), scade = adesso() + GIORNI_INVITO * 864e5;
      await db.esegui('INSERT INTO inviti (codice, gruppo, da, scade) VALUES (?, ?, ?, ?)', codice, g, io.id, scade);
      return [201, { codice, scade }];
    }],
    ['GET', /^\/v1\/inviti\/([A-Z0-9]{8})$/, async (req, io, [c]) => {
      const i = await db.uno('SELECT i.gruppo, i.scade, g.nome, u.nome AS da FROM inviti i JOIN gruppi g ON g.id = i.gruppo JOIN utenti u ON u.id = i.da WHERE i.codice = ?', c);
      if (!i) throw new Errore(404, 'codice non valido');
      if (i.scade < adesso()) throw new Errore(410, 'codice scaduto');
      return [200, { gruppo: { id: i.gruppo, nome: i.nome }, da: i.da }];
    }],
    ['POST', /^\/v1\/inviti\/([A-Z0-9]{8})$/, async (req, io, [c]) => {
      const i = await db.uno('SELECT * FROM inviti WHERE codice = ?', c);
      if (!i) throw new Errore(404, 'codice non valido');
      if (i.scade < adesso()) throw new Errore(410, 'codice scaduto');
      if (!await db.uno('SELECT 1 AS si FROM membri WHERE gruppo = ? AND utente = ?', i.gruppo, io.id)) {
        const n = (await db.uno('SELECT COUNT(*) AS n FROM membri WHERE gruppo = ?', i.gruppo)).n;
        await db.esegui('INSERT INTO membri (gruppo, utente, nome, colore, entrato) VALUES (?, ?, ?, ?, ?)', i.gruppo, io.id, io.nome, COLORI[n % COLORI.length], adesso());
        await evento(i.gruppo, null, 'entrato', io.id, [], io.nome, '');
      }
      return [200, (await gruppiDi(io.id)).find(g => g.id === i.gruppo)];
    }],
    ['POST', /^\/v1\/gruppi\/([\w-]+)\/esci$/, async (req, io, [g]) => {
      await membro(g, io.id);
      await db.esegui('DELETE FROM membri WHERE gruppo = ? AND utente = ?', g, io.id);
      await evento(g, null, 'uscito', io.id, [], io.nome, '');
      return [200, { ok: true }];
    }],
    ['GET', /^\/v1\/sinc$/, async (req, io) => {
      const dopo = Math.max(0, +new URL(req.url).searchParams.get('dopo') || 0);
      const gruppi = await gruppiDi(io.id);
      const ids = gruppi.map(g => g.id);
      if (!ids.length) return [200, { gruppi, voci: [], eventi: [], cursore: dopo }];
      const segnaposto = ids.map(() => '?').join(',');
      const voci = (await db.tutti(`SELECT id, gruppo, autore, dati, seq, eliminata FROM voci WHERE gruppo IN (${segnaposto}) AND seq > ? ORDER BY seq LIMIT 500`, ...ids, dopo))
        .map(v => ({ ...v, dati: JSON.parse(v.dati), eliminata: !!v.eliminata }));
      const eventi = (await db.tutti(`SELECT * FROM eventi WHERE gruppo IN (${segnaposto}) AND seq > ? ORDER BY seq LIMIT 200`, ...ids, dopo))
        .map(e => ({ ...e, per: JSON.parse(e.per) }));
      const cursore = Math.max(dopo, ...voci.map(v => v.seq), ...eventi.map(e => e.seq));
      return [200, { gruppi, voci, eventi, cursore }];
    }],
    ['PUT', /^\/v1\/voci\/([\w-]+)$/, async (req, io, [id]) => {
      const { gruppo, dati } = await req.json();
      await membro(gruppo, io.id);
      const testoDati = JSON.stringify(dati || {});
      if (testoDati.length > MAX_DATI) throw new Errore(413, 'promemoria troppo grande');
      if (!testo(dati?.titolo, 300)) throw new Errore(400, 'serve un titolo');
      const prima = await db.uno('SELECT gruppo, autore, dati, eliminata FROM voci WHERE id = ?', id);
      if (prima && prima.gruppo !== gruppo) throw new Errore(409, 'promemoria di un altro gruppo');
      const vecchi = prima ? JSON.parse(prima.dati) : null;
      // Le risposte si aggiungono solo con POST …/risposte: così due persone non si cancellano a vicenda.
      const nuovi = { ...dati, risposte: vecchi?.risposte || [], autore: vecchi?.autore || { id: io.id, nome: io.nome } };
      const seq = await prossimoSeq();
      if (prima) await db.esegui('UPDATE voci SET dati = ?, seq = ?, eliminata = 0 WHERE id = ?', JSON.stringify(nuovi), seq, id);
      else await db.esegui('INSERT INTO voci (id, gruppo, autore, dati, seq) VALUES (?, ?, ?, ?, ?)', id, gruppo, io.id, JSON.stringify(nuovi), seq);
      // Che cosa è successo, per avvisare gli altri
      const per = nuovi.perChi || [];
      // Le righe del foglietto della spesa: dico solo che sono state aggiunte, non ogni depennata.
      if (nuovi.tipo === 'voce') { if (!prima || prima.eliminata) await evento(gruppo, id, 'spesa', io.id, [], nuovi.titolo); }
      else if (!prima || prima.eliminata) await evento(gruppo, id, nuovi.tipo === 'domanda' ? 'domanda' : 'nuova', io.id, per, nuovi.titolo);
      else {
        const resto = d => JSON.stringify(Object.keys(d).sort().filter(k => !['fatto', 'fatti', 'fattoIl', 'risposte', 'aggiornato'].includes(k)).map(k => [k, d[k]]));
        const fattoOra = (!vecchi.fatto && nuovi.fatto) || Object.keys(nuovi.fatti || {}).some(k => nuovi.fatti[k] && !vecchi.fatti?.[k]);
        if (resto(vecchi) !== resto(nuovi)) await evento(gruppo, id, 'modifica', io.id, per, nuovi.titolo);
        else if (fattoOra) await evento(gruppo, id, 'fatto', io.id, [vecchi.autore?.id].filter(x => x && x !== io.id), nuovi.titolo);
      }
      return [200, { id, seq, dati: nuovi }];
    }],
    ['POST', /^\/v1\/voci\/([\w-]+)\/risposte$/, async (req, io, [id]) => {
      const v = await db.uno('SELECT gruppo, dati FROM voci WHERE id = ? AND eliminata = 0', id);
      if (!v) throw new Errore(404, 'promemoria non trovato');
      await membro(v.gruppo, io.id);
      const t = testo((await req.json()).testo, 500); if (!t) throw new Errore(400, 'risposta vuota');
      const dati = JSON.parse(v.dati);
      dati.risposte = [...(dati.risposte || []), { uid: io.id, nome: io.nome, testo: t, quando: adesso() }];
      const seq = await prossimoSeq();
      await db.esegui('UPDATE voci SET dati = ?, seq = ? WHERE id = ?', JSON.stringify(dati), seq, id);
      await evento(v.gruppo, id, 'risposta', io.id, [], dati.titolo, t);
      return [200, { id, seq, dati }];
    }],
    ['DELETE', /^\/v1\/voci\/([\w-]+)$/, async (req, io, [id]) => {
      const v = await db.uno('SELECT gruppo FROM voci WHERE id = ?', id);
      if (!v) return [200, { ok: true }];
      await membro(v.gruppo, io.id);
      await db.esegui('UPDATE voci SET eliminata = 1, seq = ? WHERE id = ?', await prossimoSeq(), id);
      return [200, { ok: true }];
    }],
    ['POST', /^\/v1\/dispositivi$/, async (req, io) => {
      const { token, piattaforma } = await req.json();
      if (!testo(token, 4096)) throw new Errore(400, 'manca il token');
      await db.esegui('INSERT INTO dispositivi (token, utente, piattaforma, agg) VALUES (?, ?, ?, ?) ON CONFLICT(token) DO UPDATE SET utente = excluded.utente, agg = excluded.agg', token, io.id, testo(piattaforma, 20) || 'android', adesso());
      return [200, { ok: true }];
    }]
  ];

  const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400' };
  const json = (stato, corpo) => new Response(JSON.stringify(corpo), { status: stato, headers: { 'Content-Type': 'application/json', ...CORS } });

  return async function gestisci(req) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const { pathname } = new URL(req.url);
    if (pathname === '/' || pathname === '/v1') return json(200, { servizio: 'RicordaMi', ok: true });
    try {
      for (const [metodo, re, fn, protetta = true] of rotte) {
        const m = re.exec(pathname);
        if (!m || metodo !== req.method) continue;
        const io = protetta ? await chi(req) : null;
        const [stato, corpo] = await fn(req, io, m.slice(1));
        return json(stato, corpo);
      }
      return json(404, { errore: 'non trovato' });
    } catch (e) {
      if (e instanceof SyntaxError) return json(400, { errore: 'richiesta non valida' });
      return json(e.stato || 500, { errore: e.stato ? e.message : 'errore interno' });
    }
  };
}
