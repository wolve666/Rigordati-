// Esportazione in formato iCalendar (.ics): Google Calendar, Outlook, Apple Calendario.
import { piuGiorni } from './nucleo/ricorrenze.js';

const GG = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const testo = s => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
const compatta = s => s.replace(/-/g, '');
const piega = riga => { const out = []; for (let i = 0; i < riga.length; i += 73) out.push((i ? ' ' : '') + riga.slice(i, i + 73)); return out.join('\r\n'); };

export function esportaIcs(promemoria, cfg = {}, nome = 'RicordaMi') {
  const fuso = cfg.fuso || 'Europe/Rome';
  const timbro = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const righe = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${nome}//IT`, 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${nome}`];
  for (const p of promemoria.filter(p => p.data && !(p.fatto && !p.ripeti))) {
    righe.push('BEGIN:VEVENT', `UID:${p.id}@${nome.toLowerCase()}`, `DTSTAMP:${timbro}`, `SUMMARY:${testo(p.titolo)}`);
    if (p.ora) {
      const [h, m] = p.ora.split(':').map(Number), fine = h * 60 + m + 30;
      const dataFine = fine >= 1440 ? piuGiorni(p.data, 1) : p.data;
      righe.push(`DTSTART;TZID=${fuso}:${compatta(p.data)}T${p.ora.replace(':', '')}00`,
        `DTEND;TZID=${fuso}:${compatta(dataFine)}T${String(Math.floor(fine % 1440 / 60)).padStart(2, '0')}${String(fine % 60).padStart(2, '0')}00`);
    } else righe.push(`DTSTART;VALUE=DATE:${compatta(p.data)}`, `DTEND;VALUE=DATE:${compatta(piuGiorni(p.data, 1))}`);
    if (p.ripeti) {
      const r = p.ripeti;
      let rr = `RRULE:FREQ=${{ giorno: 'DAILY', settimana: 'WEEKLY', mese: 'MONTHLY', anno: 'YEARLY' }[r.ogni]}`;
      if (r.ogniN > 1) rr += `;INTERVAL=${r.ogniN}`;
      if (r.ogni === 'settimana' && r.giorni?.length) rr += `;BYDAY=${r.giorni.map(g => GG[g]).join(',')}`;
      if (r.fino) rr += `;UNTIL=${compatta(r.fino)}T235959Z`;
      righe.push(rr);
    }
    if (p.note) righe.push(`DESCRIPTION:${testo(p.note)}`);
    if (p.priorita) righe.push(`PRIORITY:${p.priorita === 2 ? 1 : 5}`);
    for (const m of p.avvisi || []) righe.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${testo(p.titolo)}`, `TRIGGER:${m ? `-PT${m}M` : 'PT0M'}`, 'END:VALARM');
    righe.push('END:VEVENT');
  }
  righe.push('END:VCALENDAR');
  return righe.map(piega).join('\r\n') + '\r\n';
}
