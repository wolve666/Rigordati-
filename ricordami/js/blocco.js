// Il foglietto della spesa: pezzi senza interfaccia, così si possono provare da soli.

// Una lista è un foglietto se l'hai scelto tu; la "Spesa" lo è da subito.
export const eBlocco = l => !!l && (l.blocco ?? l.id === 'spesa');

// Una riga del foglietto: tutto ciò che sta in un foglietto e non ha una data.
export const rigaDelBlocco = (p, liste) => !p.data && (p.tipo === 'voce' || eBlocco(liste.find(l => l.id === p.lista)));

// "latte, pane e 2 uova" → ["Latte", "Pane", "2 uova"]
export function dividi(testo) {
  return String(testo || '')
    .split(/\s*(?:,|;|\n|\s+e\s+(?=\S))\s*/i)
    .map(t => t.trim().replace(/^[-•*]\s*/, ''))
    .filter(Boolean)
    .map(t => t.charAt(0).toUpperCase() + t.slice(1))
    .slice(0, 30);
}

// Generatore pseudo-casuale con seme: lo stesso segno resta uguale a ogni ridisegno,
// ma ogni volta che depenni (seme nuovo) la penna fa un tratto diverso.
function casuale(seme) {
  let a = Math.floor((seme % 1) * 2 ** 32) >>> 0 || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const n = v => Math.round(v * 10) / 10;

// Percorso SVG di una cancellatura fatta a mano su una parola larga w e alta h.
// Quattro gesti: una riga storta, due passate, una riga con la codina, uno scarabocchio.
export function segno(seme, w, h) {
  const r = casuale(seme), tipo = Math.floor(r() * 4);
  const da = -4 - r() * 6, a = w + 3 + r() * 8;      // la penna parte e finisce un po' fuori dalla parola
  const y1 = h * (.55 + r() * .25), y2 = h * (.25 + r() * .25); // sale verso destra
  const curva = (x0, y0, x1, y1_, piega) => `M${n(x0)} ${n(y0)} Q${n((x0 + x1) / 2 + (r() - .5) * w * .2)} ${n((y0 + y1_) / 2 + piega)} ${n(x1)} ${n(y1_)}`;
  if (tipo === 0) return { tipo: 'riga', d: curva(da, y1, a, y2, (r() - .5) * h * .5) };
  if (tipo === 1) return { tipo: 'doppia', d: `${curva(da, y1, a, y2, (r() - .5) * h * .4)} ${curva(a - r() * 6, y2 + h * (.12 + r() * .12), da + r() * 8, y1 + h * (.05 + r() * .1), (r() - .5) * h * .4)}` };
  if (tipo === 2) {
    const fine = { x: a, y: y2 };
    return { tipo: 'codina', d: `${curva(da, y1, fine.x, fine.y, (r() - .5) * h * .4)} q${n(4 + r() * 4)} ${n(-2 - r() * 3)} ${n(2 + r() * 3)} ${n(5 + r() * 4)}` };
  }
  // scarabocchio: zig-zag fitto che avanza, con l'ampiezza che varia
  const passi = Math.max(5, Math.round(w / (9 + r() * 5)));
  let d = `M${n(da)} ${n(h * .55)}`;
  for (let i = 1; i <= passi; i++) {
    const x = da + (a - da) * i / passi, su = i % 2;
    d += ` L${n(x + (r() - .5) * 3)} ${n(su ? h * (.22 + r() * .12) : h * (.68 + r() * .14))}`;
  }
  return { tipo: 'scarabocchio', d };
}
