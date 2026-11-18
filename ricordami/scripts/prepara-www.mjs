// Copia la web app in www/, la cartella che Capacitor impacchetta nell'APK.
// Il service worker non serve nell'app Android: lì gli avvisi li gestisce il sistema.
import { rmSync, mkdirSync, cpSync } from 'node:fs';
rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const f of ['index.html', 'manifest.webmanifest', 'css', 'js', 'icone']) cpSync(f, `www/${f}`, { recursive: true });
console.log('www/ pronta');
