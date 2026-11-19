# RicordaMi

**Le cose importanti, al momento giusto.**
Promemoria che capiscono come parli, avvisano quando serve e insistono finché non hai fatto. Nato dal nucleo di [Rigordati!!](../README.md), pensato per essere venduto. Gira come **app Android** (APK) e come app web.

Versione **v0.3.0** (si cambia in `js/novita.js`) · Documento di prodotto: [docs/PRODOTTO.md](docs/PRODOTTO.md) · Anteprime: [docs/anteprime/](docs/anteprime/)

## Com'è fatta

Nessuna libreria, nessuna compilazione: moduli JavaScript nativi, si pubblica copiando la cartella.

| File | Ruolo |
|---|---|
| `index.html`, `css/app.css` | Schermate e i due temi (Elegante, Allegro) × chiaro/scuro |
| `js/marchio.js` | Nome, motto, versione: **cambiare qui il nome dell'app** |
| `js/app.js` | Interfaccia |
| `js/nucleo/capisci.js` | Capisce la frase ("tra 2 ore…", "ogni lunedì e giovedì…", "#lista", "!!") |
| `js/nucleo/ricorrenze.js` | Ripetizioni, scadenze, avvisi multipli, insistenza, rinvii, ora legale |
| `js/pianificatore.js` | Quali avvisi mostrare adesso, riepiloghi, bollino |
| `js/archivio.js` | Dati sul dispositivo (IndexedDB), avvisa le altre schede e il service worker |
| `js/profili.js` | Profili Organizzato / Scordarello / Ultimo minuto e impostazioni predefinite |
| `js/ics.js` | Esportazione verso i calendari |
| `sw.js` | Offline, avvisi in sottofondo, azioni "Fatto" e "Tra 10 min" sulle notifiche |
| `manifest.webmanifest` | Installazione, scorciatoie, condivisione da altre app, link `web+ricordami:` |
| `icone/` | Icona "!!" (SVG sorgente + PNG), bollino monocromatico per la barra di stato |

## Famiglia (messaggistica come in Rigordati)

Promemoria condivisi, **domande** con risposta Sì / No / Forse o scritta, "**per chi**", "**Rispondi tu**", avvisi agli altri ("💬 Anna ti chiede", "💬 Bruno ha risposto", "✅ Bruno ha fatto"), codice d'invito di 8 caratteri valido 7 giorni, più famiglie o gruppi.

| Parte | Dove |
|---|---|
| Server (lo stesso codice per Cloudflare e per un server tuo) | `server/app.js`, `server/schema.sql` |
| Avvio su Node con SQLite | `npm run server` → `http://localhost:8787` (file `ricordami.db`) |
| Avvio su Cloudflare (D1) | `server/worker.js`, `server/wrangler.toml` |
| Motore nell'app: coda offline, sincronizzazione ogni 15 s, avvisi | `js/famiglia.js` |

**Provarla con due telefoni oggi, senza server online**: sul computer, nella cartella `ricordami`, `npm run server` (serve Node 22.13 o più recente). Sui telefoni, nella stessa rete Wi-Fi: Famiglia › indirizzo `http://IP-DEL-COMPUTER:8787` › il tuo nome › uno crea la famiglia, l'altro entra con il codice. Le notifiche arrivano mentre l'app è aperta o appena la si riapre; con l'app chiusa arriveranno con le notifiche push (Firebase), da aggiungere con il server online.

> Le versioni di prova dell'APK accettano server senza HTTPS sulla rete di casa (`android/app/src/debug/`, `allowMixedContent` in `capacitor.config.json`). Prima del Play Store: solo HTTPS.

## App Android

| Cosa | Dove |
|---|---|
| Progetto Android (Capacitor) | `android/`, `capacitor.config.json` |
| Ponte verso le funzioni del telefono | `js/nativo.js` (avvisi esatti nel sistema, azioni, bollino, vibrazione, condivisione) |
| "Condividi con RicordaMi" | `android/app/src/main/java/app/ricordami/CondivisionePlugin.java` |
| Chiave di firma **solo per le prove** | `android/sviluppo.keystore` (non è quella del Play Store) |

**Scaricare l'APK**: GitHub → Actions → "APK RicordaMi" → ultima esecuzione → Artifacts. Sul telefono: aprire il file e consentire "installa app sconosciute" per il browser o il gestore file. Gli aggiornamenti si installano sopra senza perdere i dati.

**Costruirlo a mano** (serve Android SDK 36 e Java 21): `npm install && npm run apk` → `android/app/build/outputs/apk/debug/app-debug.apk`.

## Aggiornamenti

1. Aggiungi la nuova versione **in cima** a `js/novita.js` (numero, `codice` +1, data, novità). È l'unico posto: app, APK e GitHub la leggono da lì.
2. Fai push. GitHub Actions costruisce l'APK e, se la versione è nuova, pubblica la release `ricordami-vX.Y.Z` con l'APK e le novità.
3. Le app installate controllano ogni 6 ore (e alla riapertura): compare "È pronta la versione X" con le novità, **Aggiorna ora** scarica l'APK con la barra di avanzamento, ne verifica l'impronta SHA-256 e apre l'installazione di Android. Dopo l'aggiornamento l'app mostra una volta "Cosa c'è di nuovo".

La prima volta Android chiede di consentire a RicordaMi di installare app: è normale per le app fuori dal Play Store. Android accetta l'aggiornamento solo se è firmato con la stessa chiave dell'app installata. Nella versione per il Play Store questo meccanismo va tolto (permesso `REQUEST_INSTALL_PACKAGES`): lì aggiorna lo store.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm test` | 51 test: frasi, ripetizioni, avvisi, pianificatore, server |
| `npm run test:app` | L'app vera nel browser: primo avvio, frasi, gesti, avvisi, temi, condivisione |
| `npm run anteprime` | Come sopra, salvando le schermate in `docs/anteprime/` |
| `npm run test:nativo` | Lo strato Android con un Capacitor finto: avvisi programmati, azioni, condivisione |
| `npm run test:famiglia` | Due persone e un server: domande, risposte, cose da fare insieme, coda senza rete |
| `npm run server` | Avvia il servizio famiglia sul computer |
| `npm run apk` | Costruisce l'APK di prova |

Per provarla: `python3 -m http.server` in questa cartella e aprire `http://localhost:8000`.

## Collegamento dalle altre app del pacchetto

```
https://…/ricordami/?aggiungi={"titolo":"Bolletta luce","data":"2026-12-05","ora":"","lista":"scadenze","origine":"conti"}
web+ricordami:Pagare la bolletta venerdì
```

Si apre il promemoria già compilato; l'utente conferma con un tocco.
