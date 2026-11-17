# Rigordati!! sul Google Play Store

Rigordati!! è già una PWA completa: per il Play Store si "impacchetta" come **Trusted Web Activity (TWA)**, cioè un'app Android leggera che apre il sito a schermo intero dentro Chrome. Niente codice da riscrivere: quando aggiorni il sito, si aggiorna anche l'app dello store.

Cosa è già pronto in questo repository:

| Cosa | Dove |
|---|---|
| Manifest completo (id, descrizione, lingua, categorie, scorciatoia) | `manifest.json` |
| Icone normali e *maskable* 512 px | `icon-*.png` |
| Informativa privacy | `privacy.html` → `https://wolve666.github.io/Rigordati/privacy.html` |
| Eliminazione account dentro l'app (obbligatoria) | 👪 → Elimina il mio account |
| Pagina web per l'eliminazione (obbligatoria) | `privacy.html#eliminazione` |
| 5 screenshot 1080×2160 | `docs/play-store/1-…5-*.png` |
| Grafica in evidenza 1024×500 | `docs/play-store/grafica-in-evidenza.png` |
| Testi della scheda | qui sotto |

Cosa serve da parte tua: un account sviluppatore Google Play (25 $ una tantum), un'email di contatto pubblica, e un'ora di lavoro.

---

## 0. Prima di iniziare

1. **Email di contatto**: in `privacy.html` sostituisci `[EMAIL DI CONTATTO]` con un indirizzo che sei disposto a rendere pubblico (Google lo mostra nella scheda). Va bene un indirizzo creato apposta.
2. La v0.3 deve essere già pubblicata (vedi [PUBBLICARE.md](PUBBLICARE.md)).

## 1. Account sviluppatore

[play.google.com/console](https://play.google.com/console) → crea un account **personale**. Serve un documento d'identità e la verifica di un telefono Android.

> **Attenzione**: per gli account personali nuovi Google richiede un **test chiuso con almeno 12 persone per 14 giorni consecutivi** prima di poter pubblicare in produzione. Conviene iniziare subito a raccogliere i tester (amici, parenti: basta un account Google e che installino l'app dal link di test).

## 2. Generare l'app Android con Bubblewrap

Su un computer con Node.js:

```bash
npx @bubblewrap/cli init --manifest https://wolve666.github.io/Rigordati/manifest.json
```

Risposte consigliate:

| Domanda | Risposta |
|---|---|
| Domain | `wolve666.github.io` |
| URL path | `/Rigordati/` |
| Application name / Short name | `Rigordati!!` |
| Application ID (package) | `io.github.wolve666.rigordati` (non si potrà più cambiare) |
| Display mode | `standalone` |
| Status bar color / Splash | `#DDEFF3` |
| Icon / Maskable icon | proposte dal manifest (512 px) |
| Include support for Play Billing | No |
| Request geolocation permission | No |
| Notifications (notification delegation) | **Sì** (servono per le notifiche push) |
| Signing key | lascia creare una chiave nuova e **conservala con la password in un posto sicuro** |

Poi:

```bash
npx @bubblewrap/cli build
```

Produce `app-release-bundle.aab` (da caricare sullo store) e `app-release-signed.apk` (da provare sul telefono).

Bubblewrap installa da solo JDK e Android SDK la prima volta.

## 3. Digital Asset Links (il punto delicato)

Perché l'app si apra a schermo intero **senza la barra degli indirizzi**, il sito deve dichiarare che l'app è sua. Il file va pubblicato **alla radice del dominio**:

```
https://wolve666.github.io/.well-known/assetlinks.json
```

Su GitHub Pages la radice di `wolve666.github.io` è il repository **`wolve666/wolve666.github.io`** (non questo). Quindi:

1. Se non esiste, crea il repository pubblico `wolve666.github.io` e attiva Pages sul ramo `main`.
2. Aggiungi il file vuoto `.nojekyll` alla radice (altrimenti GitHub ignora le cartelle che iniziano con il punto).
3. Aggiungi `.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "io.github.wolve666.rigordati",
    "sha256_cert_fingerprints": [
      "IMPRONTA_CHIAVE_DI_CARICAMENTO",
      "IMPRONTA_CHIAVE_PLAY_APP_SIGNING"
    ]
  }
}]
```

- La prima impronta la stampa `npx @bubblewrap/cli fingerprint list` (o `keytool -list -v -keystore android.keystore`).
- La seconda la trovi dopo il primo caricamento: Play Console → la tua app → **Test e rilascio → Integrità dell'app → Firma dell'app** → "Certificato della chiave di firma dell'app", SHA-256.

Verifica: installa l'APK, apri l'app; se vedi la barra degli indirizzi in alto, l'impronta o il percorso del file non sono giusti.

## 4. Accesso con Google dentro l'app

L'app usa l'accesso Google di Firebase con popup, che funziona dentro la TWA perché è Chrome. Non serve configurare nulla in più, ma prova l'accesso sull'APK prima di caricarlo.

## 5. Scheda dello store

**Nome**: Rigordati!! – calendario di famiglia

**Descrizione breve** (max 80):
> Il frigo di casa nel telefono: impegni, domande e spesa condivisi in famiglia.

**Descrizione completa**:
> Rigordati!! è il frigo di casa, ma nel telefono. Un calendario condiviso per tutta la famiglia, semplice come attaccare un bigliettino.
>
> ✏️ SCRIVI COME PARLI
> "mercoledì dentista ore 16", "ogni lunedì piscina alle 17", "comprare latte": giorno, ora e ripetizione li capisce da solo.
>
> 📅 IMPEGNI — appuntamenti con promemoria, anche ricorrenti (compleanni compresi).
> 💬 DOMANDE — "venerdì posso andare al cinema?" e gli altri rispondono Sì, No o Forse.
> 🛒 DA FARE E SPESA — la lista condivisa: chi passa dal supermercato sa cosa manca.
>
> 👪 FAMIGLIE
> Crei la tua famiglia e inviti gli altri con un codice. Ogni famiglia vede solo le sue cose. Puoi far parte di più famiglie (casa, nonni…).
>
> 🔔 NOTIFICHE
> Quando qualcuno aggiunge qualcosa, risponde o si avvicina un impegno. Una voce può essere "per tutti" o solo per qualcuno.
>
> Funziona anche offline. Niente pubblicità, niente profilazione.

**Categoria**: Produttività (o Stile di vita) · **Tag**: calendario, famiglia, lista della spesa

**Grafica**: icona 512×512 = `icon-512.png`; grafica in evidenza = `docs/play-store/grafica-in-evidenza.png`; screenshot telefono = `docs/play-store/1-…5-*.png`.

## 6. Moduli obbligatori della Play Console

**Norme sui contenuti dell'app**:

| Voce | Risposta |
|---|---|
| Norme sulla privacy | `https://wolve666.github.io/Rigordati/privacy.html` |
| Accesso all'app | "Tutte le funzionalità richiedono l'accesso": fornisci un account Google di prova con una famiglia già creata |
| Annunci | Nessun annuncio |
| Classificazione dei contenuti | Questionario: utilità/produttività, nessun contenuto sensibile. L'app permette comunicazione tra utenti **solo all'interno della famiglia su invito** |
| Pubblico di destinazione | 18+ (oppure 13+). Scegliere fasce sotto i 13 anni fa scattare il programma "Famiglie" con requisiti molto più stretti |
| App di notizie / governativa / finanziaria / sanitaria | No |
| Eliminazione dell'account | URL: `https://wolve666.github.io/Rigordati/privacy.html#eliminazione` |

**Sicurezza dei dati** (Data safety):

| Domanda | Risposta |
|---|---|
| Raccoglie o condivide dati? | Sì, raccoglie; **non** condivide con terze parti (Firebase e Cloudflare sono fornitori di servizi, non "condivisione") |
| Dati cifrati in transito? | Sì |
| L'utente può chiedere l'eliminazione? | Sì (nell'app e via web) |
| Informazioni personali → Nome, Indirizzo email, ID utente | Raccolti · Funzionalità dell'app, Gestione dell'account · Obbligatori |
| Messaggi → Altri messaggi in-app (voci e risposte) | Raccolti · Funzionalità dell'app · Obbligatori |
| Identificatori dispositivo o altri ID (token notifiche) | Raccolti · Funzionalità dell'app · Facoltativi |
| Posizione, contatti, foto, dati finanziari, salute, cronologia web, attività | No |

## 7. Rilascio

1. Play Console → crea app → carica `app-release-bundle.aab` in **Test chiuso**.
2. Aggiungi l'impronta Play App Signing ad `assetlinks.json` (punto 3).
3. Invita i 12 tester, aspetta i 14 giorni.
4. Chiedi l'accesso alla produzione e promuovi la versione.

Per aggiornare il contenuto dell'app **non serve** ricaricare nulla sullo store: basta pubblicare il sito. Serve un nuovo `.aab` (con `versionCode` aumentato in `twa-manifest.json`, poi `bubblewrap update && bubblewrap build`) solo se cambiano nome, icone, colori o colore della barra.
