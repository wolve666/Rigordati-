// Decide quali avvisi mostrare adesso e quando sarà il prossimo.
// Usato dalla pagina (timer) e dal service worker (sincronizzazione periodica, azioni sulle notifiche).
import { avvisiTra, prossimoAvviso, inRitardo, agenda, dataNelFuso, istante, piuGiorni } from './nucleo/ricorrenze.js';
import { durata } from './profili.js';

const RECUPERO = 6 * 3600e3; // avvisi persi da meno di 6 ore: li mostro ancora
const oraDi = t => new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

export function testoAvviso(a) {
  const p = a.p;
  const titolo = (p.priorita === 2 ? '‼️ ' : p.priorita === 1 ? '❗ ' : '') + p.titolo;
  const alle = p.ora ? ` alle ${p.ora}` : '';
  let corpo;
  if (a.tipo === 'insisti') corpo = `Non è ancora fatto! Era per${p.ora ? ' le ' + p.ora : ' oggi'}.`;
  else if (a.tipo === 'rinvio') corpo = 'Te l\'avevo rimandato: eccolo di nuovo.';
  else if (a.minuti === 0) corpo = p.ora ? `Adesso · ${p.ora}` : 'Oggi';
  else if (!p.ora) corpo = a.minuti >= 1440 ? `Tra ${durata(Math.floor(a.minuti / 1440) * 1440)}` : 'Oggi';
  else corpo = `Tra ${durata(a.minuti)}${alle}`;
  if (p.note) corpo += ` · ${p.note.slice(0, 80)}`;
  return { titolo, corpo };
}

export function riepiloghi(lista, cfg, da, adesso) {
  const out = [];
  const oggi = dataNelFuso(adesso, cfg.fuso);
  for (const [chi, quando] of [['mattina', cfg.riepilogoMattina], ['sera', cfg.riepilogoSera]]) {
    if (!quando) continue;
    const t = istante(oggi, quando, cfg.fuso);
    if (t <= da || t > adesso) continue;
    const giorno = chi === 'mattina' ? oggi : piuGiorni(oggi, 1);
    const voci = agenda(lista, giorno, giorno, cfg).filter(x => !x.fatto);
    const ritardo = chi === 'mattina' ? inRitardo(lista, adesso, cfg).length : 0;
    if (!voci.length && !ritardo) continue;
    const elenco = voci.slice(0, 4).map(x => (x.p.ora ? x.p.ora + ' ' : '') + x.p.titolo).join(' · ');
    out.push({
      chiave: `riepilogo|${chi}|${oggi}`, quando: t,
      titolo: chi === 'mattina' ? `Buongiorno! Oggi hai ${voci.length} ${voci.length === 1 ? 'cosa' : 'cose'}` : `Domani hai ${voci.length} ${voci.length === 1 ? 'cosa' : 'cose'}`,
      corpo: (ritardo ? `${ritardo} in ritardo · ` : '') + (elenco || 'Niente in programma') + (voci.length > 4 ? ' …' : '')
    });
  }
  return out;
}

/**
 * Trova gli avvisi dovuti e li passa a `mostra`. Non ripete mai lo stesso avviso.
 * @returns {Promise<{mostrati:number, prossimo:number|null, bollino:number}>}
 */
export async function controlla(archivio, mostra, adesso = Date.now(), filtro = () => true) {
  const [tutti, cfg, giaFatti] = await Promise.all([archivio.promemoria(), archivio.impostazioni(), archivio.leggiMeta('notificati')]);
  const lista = tutti.filter(filtro);
  const visti = new Set(giaFatti || []);
  const ultimo = await archivio.leggiMeta('ultimoControllo');
  // Al primo controllo in assoluto non recupero niente: l'app è appena stata installata.
  const da = ultimo ? Math.max(adesso - RECUPERO, Math.min(ultimo, adesso) - 60e3) : adesso - 60e3;

  const dovuti = lista.flatMap(p => avvisiTra(p, da, adesso, cfg).map(a => ({ ...a, p }))).filter(a => !visti.has(a.chiave));
  // Di ogni promemoria mostro solo l'avviso più recente (dopo una lunga pausa non arriva una raffica).
  const perVoce = new Map();
  for (const a of dovuti) perVoce.set(a.p.id + '|' + a.occ, a);
  for (const a of dovuti) visti.add(a.chiave);
  for (const a of perVoce.values()) await mostra({ ...testoAvviso(a), id: a.p.id, occ: a.occ, chiave: a.chiave, priorita: a.p.priorita || 0, tipo: a.tipo });

  const riep = riepiloghi(lista, cfg, da, adesso).filter(r => !visti.has(r.chiave));
  for (const r of riep) { visti.add(r.chiave); await mostra({ ...r, tipo: 'riepilogo' }); }

  await archivio.scriviMeta('notificati', [...visti].slice(-800));
  await archivio.scriviMeta('ultimoControllo', adesso);
  return { mostrati: perVoce.size + riep.length, prossimo: prossimo(lista, cfg, adesso), bollino: bollino(lista, cfg, adesso) };
}

export function prossimo(lista, cfg, adesso) {
  const tempi = lista.map(p => prossimoAvviso(p, adesso, cfg, 3)).filter(Boolean);
  const oggi = dataNelFuso(adesso, cfg.fuso);
  for (const q of [cfg.riepilogoMattina, cfg.riepilogoSera].filter(Boolean))
    for (const g of [oggi, piuGiorni(oggi, 1)]) { const t = istante(g, q, cfg.fuso); if (t > adesso) tempi.push(t); }
  return tempi.length ? Math.min(...tempi) : null;
}

/** Numero sul bollino dell'icona: cose in ritardo + cose di oggi ancora da fare. */
export function bollino(lista, cfg, adesso) {
  const oggi = dataNelFuso(adesso, cfg.fuso);
  const ritardo = inRitardo(lista, adesso, cfg);
  const chiavi = new Set(ritardo.map(x => x.p.id + x.occ));
  const restanti = agenda(lista, oggi, oggi, cfg).filter(x => !x.fatto && !chiavi.has(x.p.id + x.occ));
  return ritardo.length + restanti.length;
}

export { oraDi };
