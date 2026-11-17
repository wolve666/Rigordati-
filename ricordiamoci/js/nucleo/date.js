// Date "di calendario" come stringhe AAAA-MM-GG, sempre nell'ora locale del telefono.
export const pad = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const daIso = s => { const [y, m, g] = s.split('-').map(Number); return new Date(y, m - 1, g); };
export const oggi = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export const MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
export const GIORNI = ['domenica','lunedi','martedi','mercoledi','giovedi','venerdi','sabato'];
export const GIORNI_BELLI = ['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
export const bella = s => { const d = daIso(s); return `${GIORNI_BELLI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`; };
