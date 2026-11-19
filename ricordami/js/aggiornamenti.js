// Nuove versioni dell'app Android, pubblicate come "release" su GitHub dal workflow apk-ricordami.
// Nel testo di ogni release c'è una riga nascosta con i dati per l'app:
//   <!-- ricordami {"versione":"0.3.0","codice":4,"sha256":"…"} -->
const PREFISSO = 'ricordami-v';
const DATI_RE = /<!--\s*ricordami\s+(\{.*?\})\s*-->/s;

/** Legge l'elenco delle release e restituisce l'ultima versione di RicordaMi, o null. */
export function ultimaVersione(releases) {
  for (const r of releases || []) {
    if (r.draft || r.prerelease || !r.tag_name?.startsWith(PREFISSO)) continue;
    const m = DATI_RE.exec(r.body || '');
    const apk = (r.assets || []).find(a => a.name.endsWith('.apk'));
    if (!m || !apk) continue;
    let dati; try { dati = JSON.parse(m[1]); } catch { continue; }
    const cose = (r.body || '').split('\n').filter(l => /^\s*[-*]\s+/.test(l)).map(l => l.replace(/^\s*[-*]\s+/, '').trim()).slice(0, 8);
    return { versione: dati.versione, codice: +dati.codice, sha256: dati.sha256 || '', apk: apk.browser_download_url, dimensione: apk.size || 0, cose, pagina: r.html_url, data: (r.published_at || '').slice(0, 10) };
  }
  return null;
}

/** Chiede a GitHub l'ultima versione. `codiceAttuale` = versionCode dell'app installata. */
export async function cerca(repository, codiceAttuale, recupera = fetch) {
  const r = await recupera(`https://api.github.com/repos/${repository}/releases?per_page=20`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!r.ok) throw new Error('GitHub non risponde (' + r.status + ')');
  const u = ultimaVersione(await r.json());
  return u && u.codice > codiceAttuale ? u : null;
}

/** Testo della release (lo usa il workflow): elenco delle novità + riga nascosta per l'app. */
export function testoRelease(voce, sha256) {
  return [`**RicordaMi ${voce.versione}** · ${voce.data}`, '', ...voce.cose.map(c => `- ${c}`), '',
    'Si installa sopra la versione precedente senza perdere i dati.', '',
    `<!-- ricordami ${JSON.stringify({ versione: voce.versione, codice: voce.codice, sha256 })} -->`].join('\n');
}
