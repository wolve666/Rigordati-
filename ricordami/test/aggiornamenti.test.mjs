import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ultimaVersione, cerca, testoRelease } from '../js/aggiornamenti.js';
import { NOVITA, ATTUALE } from '../js/novita.js';

const release = (versione, codice, extra = {}) => ({
  tag_name: `ricordami-v${versione}`, draft: false, prerelease: false, html_url: 'https://github.com/x/y/releases/' + versione, published_at: '2026-11-20T10:00:00Z',
  body: testoRelease({ versione, codice, data: '2026-11-20', cose: ['Prima novità', 'Seconda novità'] }, 'ab'.repeat(32)),
  assets: [{ name: `RicordaMi-${versione}.apk`, browser_download_url: `https://github.com/x/y/releases/download/ricordami-v${versione}/RicordaMi-${versione}.apk`, size: 5_800_000 }],
  ...extra
});

test('legge l\'ultima versione dalla release, ignorando bozze, anteprime e altre app', () => {
  const u = ultimaVersione([release('0.5.0', 6, { draft: true }), release('0.4.1', 5, { prerelease: true }), { tag_name: 'rigordati-v1', body: '', assets: [] }, release('0.4.0', 5), release('0.3.0', 4)]);
  assert.equal(u.versione, '0.4.0'); assert.equal(u.codice, 5);
  assert.deepEqual(u.cose, ['Prima novità', 'Seconda novità']);
  assert.match(u.apk, /RicordaMi-0\.4\.0\.apk$/); assert.equal(u.sha256, 'ab'.repeat(32));
});

test('propone solo versioni più nuove di quella installata', async () => {
  const finto = lista => async () => ({ ok: true, json: async () => lista });
  assert.equal((await cerca('x/y', 4, finto([release('0.4.0', 5)]))).versione, '0.4.0');
  assert.equal(await cerca('x/y', 5, finto([release('0.4.0', 5)])), null);
  assert.equal(await cerca('x/y', 4, finto([])), null);
  await assert.rejects(cerca('x/y', 4, async () => ({ ok: false, status: 403 })), /GitHub non risponde/);
});

test('versione coerente: novita.js è la sola fonte, codici in ordine', () => {
  assert.match(ATTUALE.versione, /^\d+\.\d+\.\d+$/);
  NOVITA.forEach((v, i) => i && assert.ok(v.codice < NOVITA[i - 1].codice, 'codici decrescenti'));
  const gradle = readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
  assert.match(gradle, /file\('\.\.\/\.\.\/js\/novita\.js'\)/, 'build.gradle legge la versione da novita.js');
});
