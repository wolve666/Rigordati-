# RicordaMi

**Le cose importanti, al momento giusto.**
Promemoria che capiscono come parli, avvisano quando serve e insistono finché non hai fatto. Nato dal nucleo di [Rigordati!!](../README.md), pensato per essere venduto. Gira come **app Android** (APK) e come app web.

Versione **v0.1.0** · Documento di prodotto: [docs/PRODOTTO.md](docs/PRODOTTO.md) · Anteprime: [docs/anteprime/](docs/anteprime/)

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

## App Android

| Cosa | Dove |
|---|---|
| Progetto Android (Capacitor) | `android/`, `capacitor.config.json` |
| Ponte verso le funzioni del telefono | `js/nativo.js` (avvisi esatti nel sistema, azioni, bollino, vibrazione, condivisione) |
| "Condividi con RicordaMi" | `android/app/src/main/java/app/ricordami/CondivisionePlugin.java` |
| Chiave di firma **solo per le prove** | `android/sviluppo.keystore` (non è quella del Play Store) |

**Scaricare l'APK**: GitHub → Actions → "APK RicordaMi" → ultima esecuzione → Artifacts. Sul telefono: aprire il file e consentire "installa app sconosciute" per il browser o il gestore file. Gli aggiornamenti si installano sopra senza perdere i dati.

**Costruirlo a mano** (serve Android SDK 36 e Java 21): `npm install && npm run apk` → `android/app/build/outputs/apk/debug/app-debug.apk`.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm test` | 44 test: frasi, ripetizioni, avvisi, pianificatore |
| `npm run test:app` | L'app vera nel browser: primo avvio, frasi, gesti, avvisi, temi, condivisione |
| `npm run anteprime` | Come sopra, salvando le schermate in `docs/anteprime/` |
| `npm run test:nativo` | Lo strato Android con un Capacitor finto: avvisi programmati, azioni, condivisione |
| `npm run apk` | Costruisce l'APK di prova |

Per provarla: `python3 -m http.server` in questa cartella e aprire `http://localhost:8000`.

## Collegamento dalle altre app del pacchetto

```
https://…/ricordami/?aggiungi={"titolo":"Bolletta luce","data":"2026-12-05","ora":"","lista":"scadenze","origine":"conti"}
web+ricordami:Pagare la bolletta venerdì
```

Si apre il promemoria già compilato; l'utente conferma con un tocco.
