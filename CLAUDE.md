# CLAUDE.md — Rigordati!!

Istruzioni per Claude Code su questo progetto. Rispondi sempre in **italiano**.

## Il progetto
Calendario condiviso in tempo reale per coppie e famiglie: impegni, domande con risposta e cose da fare, con notifiche push e promemoria.
- Nome attuale: **Rigordati!!** (per la versione pubblica diventerà **Ricordati**).
- Repository: `wolve666/Rigordati-` (con il trattino), pubblicato su GitHub Pages: https://wolve666.github.io/Rigordati-/
- Obiettivo: passare da PWA ad **APK Android** compilato su GitHub (come Magic Play&Print), poi pubblicazione su **Google Play** e vendita.
- Utenti finali poco esperti: il minor numero possibile di passaggi.

## Stack
- **Frontend**: un solo `index.html` (HTML + CSS + JS modulo, niente build), `sw.js`, `manifest.json`.
- **APK**: Capacitor 6, pacchetto `it.educk.rigordati` (versione privata; quella pubblica sarà un pacchetto separato). Compilato da `.github/workflows/build-apk.yml` a ogni push su `main`; release `vX.Y.Z` con l'APK. Versione in `package.json` (allineata a `VERSIONE`). `NATIVO` in `index.html` distingue APK e web. Plugin: App (tasto indietro: listener `backButton`), FirebaseAuthentication, FirebaseMessaging, LocalNotifications (accessibili da `window.Capacitor.Plugins`). Promemoria impegni programmati localmente sull'APK; il Worker li invia solo ai dispositivi web.
- Segreti GitHub: `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`. `google-services.json` nella radice.
- **Firebase** (piano gratuito Spark, progetto `rigordati`): Firestore, Authentication con Google, Cloud Messaging (FCM). SDK web 10.12.2 da `gstatic.com`.
- **Cloudflare Worker** `rigordati.wolve666.workers.dev` (file `cloudflare-worker.js`: NON va su GitHub Pages, si incolla nell'editor Cloudflare):
  - `POST /` con `{ idToken, id, evento, mioToken }`: verifica l'utente (Identity Toolkit + `API_KEY`), controlla `AMMESSI`, invia FCM a tutti i dispositivi tranne `mioToken`.
  - Cron ogni minuto: invia i promemoria con `avvisoAt <= now`, poi cancella `avvisoAt`.
  - Segreti: `SA_JSON`, `API_KEY`, `AMMESSI`.
- Direzione architetturale decisa: **ibrido**. Firebase per login e notifiche; accesso ai dati concentrato in **un unico modulo**, così da poter migrare i dati su Cloudflare in futuro. Preferire una struttura ordinata e scalabile anche se più lenta da scrivere.

## Temi
- `data-tema` su `<html>` (assente = "frigo", `inchiostro` = Inchiostro quieto); salvato in `localStorage` `rigordati-tema`, applicato da uno script in `<head>`. Ogni tema ridefinisce le variabili CSS e gli stili con il selettore `[data-tema="..."]`. Nuovi temi: aggiungere blocco CSS + voce in `#fTemi` + colore in `COLORE_TEMA`. Temi di festa: `festa-scura`, `festa-chiara` (selettore comune `[data-tema^="festa"]`); decorazioni come immagini SVG in data URI dentro il CSS, generate da script Python (fiori, papel picado, calaveras); elementi `.deco-top`, `.deco-bottom`, `.petali`, `.eroe`. Icone della barra: `nav .tab[data-v=...] .ic` con immagine per tema. Iconcine dei biglietti: `iconaVoce()` con lista `ICONE` di parole chiave.

## Dati Firestore
- `voci/{id}`: `tipo` (`impegno` | `domanda` | `todo`), `testo`, `data` (`AAAA-MM-GG`), `ora` (`HH:MM`), `autore`, `autoreNome`, `creato`, `fatto`, `risposte[]` (`email, nome, testo, quando`), `avvisoAt` (ms, solo impegni futuri).
- `dispositivi/{token}`: `token`, `email`, `nome`, `agg`.
- Regole: lettura e scrittura solo per le email ammesse.
- `famiglia/{id}` (condivisa, stesse regole di `voci`): `tipo: 'bimbo'` (`nome`, `sesso` m|f, `colore`, `creato`) oppure `tipo: 'evento'` (`cat`: cacca | malattia | medicina | visita | sport | impegno | altezza, `bimbo`, `data`, `fine` solo malattia, `ora`, `testo`, `umore` buona|media|brutta, `cm`).
- `ciclo/{uid}` (PRIVATO: regola `request.auth.uid == uid`): `imp` (`durata`, `flusso`, `promemoria`), `giorni` { 'AAAA-MM-GG': { flusso, dolore[], umore[], energia, sonno, pelle[], voglie[], pillola } }, `importato`. Si scrive tutto il documento con `setDoc`.

## Famiglia e Ciclo (v0.6.0)
- Barra: Calendario, Domande, Da fare, **+**, Famiglia. Il + nella scheda Famiglia apre `fEvento`.
- Fogli `fBimbo`, `fEvento`, `fFiglio`; `passaA(id)` cambia foglio senza aggiungere passi alla cronologia; i tasti `[data-indietro]` fanno `history.back()`.
- Disegni: `avatar(b)` (ragazzo/ragazza) e `cacca(umore)` in SVG. Icone calendario da `CAT`, giorni di malattia con classe `.malato`.
- Ciclo: overlay `#ciclo` con stile notturno fisso (non segue i temi), aperto da `apriCiclo()` dopo `sblocca()` (plugin `@capgo/capacitor-native-biometric`, permesso `USE_BIOMETRIC` in `patch-android.py`). Pannelli interni `apriPanel`/`chiudiPanel`. Calcoli in `cicloCalc()` e `faseDi()`; importazione Clue tollerante in `leggiClue()` (JSON/.cluedata o CSV). Si richiude dopo 3 minuti in sottofondo.
- Promemoria APK aggiuntivi da `extraPromemoria()` (famiglia con ora, ciclo il giorno prima alle 9 con testo discreto).

## Regole fisse dell'utente (rispettale sempre)
- **Versione visibile** accanto al nome dell'app; toccandola: verifica aggiornamenti (oggi genera anche la notifica di prova).
- **Tasto indietro** Android gestito (chiude i fogli, torna al calendario).
- **Tasto per scaricare/installare** l'app.
- **Trascina giù per aggiornare**.
- A ogni aggiornamento incrementa insieme `VERSIONE` in `index.html` e `CACHE` in `sw.js`, e aggiorna lo storico in `README.md`.
- **Modifica i file esistenti**, non ricrearli da zero. Leggi e cambia solo le parti coinvolte.
- Consegna/elenca **solo i file modificati**.
- Riepiloghi brevi dopo ogni modifica, niente passaggi superflui: l'utente vuole risparmiare utilizzo.
- Test nel browser e screenshot solo per modifiche complesse o se richiesti.
- Se chiede un parere su una nuova aggiunta: prima un'**anteprima** da discutere, nessuna modifica al codice finché non dà il via.
- Toni diretti, niente emoticon nelle risposte, errori trattati senza scuse eccessive.

## Insidie già incontrate
- I file vanno nella **radice** del repository, mai in una sottocartella.
- Mai leggere e riscrivere lo stesso file nella stessa istruzione shell: ha già svuotato `sw.js` una volta. Dopo ogni modifica verifica che `sw.js` e `index.html` non siano vuoti (`node --check`).
- L'icona della barra notifiche (`badge-96.png`) deve essere monocromatica su fondo trasparente.
- Icone: `icon-*.png` (angoli arrotondati) con `purpose: any`; `icon-maskable-*.png` (margine 20%) con `purpose: maskable`.
- Non suggerire di cancellare i dati del sito `wolve666.github.io`: ospita anche altre app dell'utente.
- `firebaseConfig` e chiave VAPID sono pubbliche; il JSON dell'account di servizio è segreto e sta solo su Cloudflare.

## Idee e lavori aperti
- Animazione di aggiornamento: **busta con "!!"** al centro dello schermo con effetto battito (zoom avanti/indietro) al posto della papera che gira.
- Aggiornamenti APK dentro l'app (`aggiornaInApp`): Filesystem.downloadFile in CACHE, FileOpener apre l'installatore; il file si cancella all'avvio successivo. Non tornare al download via browser.
- Risposta Sì/No/Forse direttamente dalla notifica (serve codice nativo).
- Accoppiamento pubblico: **invito via email** dalle impostazioni (si inserisce la mail dell'altro, che accede con Google e accetta con un tocco), al posto della lista `AMMESSI` fissa.
- Notifiche e messaggistica devono essere impeccabili.
- In futuro: pacchetto a pagamento con l'app dei conti di casa integrata nel calendario.
