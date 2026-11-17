# Rigordati!!

**Il frigo di casa, ma nel telefono.**
Calendario condiviso in tempo reale per la famiglia: impegni, domande, cose da fare e lista della spesa, con notifiche push e promemoria automatici. Ogni famiglia ha il suo frigo: si crea in un attimo e si invitano gli altri con un codice.

Versione attuale: **v0.3.0**
App: https://wolve666.github.io/Rigordati/

> Passando dalla v0.2 alla v0.3 i dati cambiano struttura (arrivano le famiglie): per pubblicarla segui **[docs/PUBBLICARE.md](docs/PUBBLICARE.md)**, nell'ordine indicato.

---

## Indice

- [Funzionalità](#funzionalità)
- [Come si usa](#come-si-usa)
- [Architettura](#architettura)
- [Struttura dei file](#struttura-dei-file)
- [Configurazione](#configurazione)
- [Sviluppo e test](#sviluppo-e-test)
- [Aggiornare l'app](#aggiornare-lapp)
- [Sicurezza](#sicurezza)
- [Risoluzione problemi](#risoluzione-problemi)
- [Storico versioni](#storico-versioni)
- [Idee per il futuro](#idee-per-il-futuro)

---

## Funzionalità

### Famiglie
- Chiunque entra con Google e **crea la sua famiglia**, oppure entra in una esistente con un **codice d'invito** (8 caratteri, vale 7 giorni) o con il link che lo contiene.
- Ogni famiglia vede solo le sue voci. Si può far parte di più famiglie (es. casa e nonni) e passare dall'una all'altra.
- Ognuno sceglie il nome con cui compare in famiglia; la famiglia si può rinominare; si può uscire quando si vuole.

### Tre tipi di voce
| Tipo | Colore | A cosa serve |
|---|---|---|
| Impegno | Verde | Appuntamenti con data e ora ("mercoledì 6 dentista ore 16"), anche ricorrenti |
| Domanda | Rosa | Richieste con risposta Sì / No / Forse o testo libero ("venerdì posso andare a Magic?") |
| Da fare | Giallo | Cose da fare o **da comprare** (lista della spesa), con spunta |

### Inserimento intelligente
- Si scrive la frase come la si direbbe: giorno, ora e ripetizione vengono riconosciuti da soli.
- Giorni: `oggi`, `domani`, `dopodomani`, `stasera`, `tra 3 giorni`, `fra una settimana`, i giorni della settimana (`venerdì`, `martedì prossimo`, `mercoledì 6` = il primo 6 che cade di mercoledì), `il 25`, `6 dicembre`, `6/11`, `1/2/27`.
- Orari: `ore 16`, `alle 16:30`, `16.30`, `h8`, `mezzogiorno`.
- Ripetizioni: `ogni lunedì`, `tutte le domeniche`, `ogni giorno`, `ogni mese`, `ogni anno`; `compleanno` e `anniversario` si ripetono ogni anno da soli.
- Una frase con il `?` diventa una domanda; `comprare`, `manca`, `finito`… finiscono nella spesa.
- Toccando **Domanda** con il testo già scritto, la domanda parte subito.

### Per chi, promemoria, modifica
- **Per chi**: una voce può essere per tutti o per qualcuno in particolare; le notifiche arrivano solo a chi riguarda.
- **Promemoria** a scelta: 1 ora prima, 15 minuti prima, all'ora giusta, il giorno prima, nessuno. Senza ora: alle 8:00. Rispetta l'ora legale.
- Ogni voce si può **modificare** (✏️ nel dettaglio). Le voci ripetute mostrano 🔁 e compaiono in tutti i giorni giusti del calendario.

### Calendario
- Vista mensile con pallini colorati sui giorni occupati.
- Primo tocco su un giorno: mostra le sue voci. Secondo tocco: apre il foglio "nuovo" con la data già impostata.

### Da fare e spesa
- Filtri **Tutto / Spesa / Altro**.
- **Togli le cose fatte**: stacca dal frigo in un colpo tutto ciò che è spuntato.

### Notifiche
- Push nella tendina di Android anche ad app chiusa, quando qualcuno aggiunge, modifica o risponde.
- Toccando la notifica si apre **direttamente la voce**.
- Contatore sull'icona dell'app e sulle schede "Domande" e "Da fare".
- Il dispositivo da cui si scrive non riceve la propria notifica; chi esce da una famiglia smette subito di riceverne.

### Interfaccia
- Stile "frigo di casa": bigliettini colorati con calamita, sfondo con disegnini, font scritto a mano.
- Coriandoli quando si spunta una cosa fatta.
- Trascina giù per aggiornare: compare la busta con i **!!** che batte al centro dello schermo.
- Tasto indietro di Android gestito. Tasto **Installa** per installarla come app.
- Pallino di stato accanto alla versione: verde collegato, grigio offline, rosso errore.
- Funziona offline: le modifiche si sincronizzano al ritorno della rete.

---

## Come si usa

1. Aprire il link dell'app in Chrome dal telefono e toccare **Installa** (o menu ⋮ → "Aggiungi a schermata Home").
2. Entrare con il proprio account Google.
3. **Creare la famiglia**, oppure inserire il codice ricevuto (o aprire direttamente il link d'invito).
4. Per invitare: **👪 → Invita qualcuno → Condividi**.
5. Toccare la **campanella** e consentire le notifiche (una volta per dispositivo).

Toccando la **versione** accanto al nome si genera una notifica di prova locale.

---

## Architettura

```
 Telefono / PC (PWA)                    Firebase (piano gratuito Spark)
 ┌──────────────────┐   tempo reale    ┌──────────────────────────────┐
 │ index.html       │ ◄──────────────► │ Firestore: famiglie/{id}/voci│
 │ css/ js/         │                  │   utenti, inviti, dispositivi│
 │ sw.js            │                  │ Authentication (Google)      │
 └────────┬─────────┘                  │ Cloud Messaging (FCM)        │
          │ "avvisa"                   └──────────────▲───────────────┘
          ▼                                           │
 ┌──────────────────┐   legge voci e dispositivi      │
 │ Cloudflare Worker│ ────────────────────────────────┘
 │ (piano gratuito) │   invia le notifiche via FCM
 │ postino + sveglia│   cron ogni minuto per i promemoria
 └──────────────────┘
```

- **GitHub Pages** ospita l'app così com'è: nessuna compilazione, i moduli JavaScript vengono caricati direttamente dal browser.
- **Firebase** fa da database, accesso e canale delle notifiche. Le regole stanno in `firestore.rules`.
- **Cloudflare Worker** è il "postino": verifica chi scrive e che faccia parte della famiglia, spedisce le notifiche e ogni minuto i promemoria (calcolando la ripetizione successiva).

Costo totale: **0 €**.

---

## Struttura dei file

| File | Descrizione |
|---|---|
| `index.html` | Struttura delle schermate |
| `css/app.css` | Stile "frigo" |
| `js/versione.js` | **Unico** posto dove sta il numero di versione (lo leggono app e service worker) |
| `js/config.js` | Configurazione pubblica: Firebase, chiave VAPID, indirizzo del Worker |
| `js/app.js` | Interfaccia, famiglie, collegamento a Firebase |
| `js/capisci.js` | "Capisco la frase": giorno, ora, ripetizione, tipo |
| `js/ricorrenze.js` | Ripetizioni e calcolo dei promemoria (condiviso con il Worker) |
| `js/date.js` | Funzioni sulle date |
| `sw.js` | Service worker: cache offline, notifiche push, apertura della voce dalla notifica |
| `manifest.json` | Dati per l'installazione (nome, colori, icone, scorciatoia "Nuova voce") |
| `privacy.html` | Informativa privacy (serve anche per il Play Store) |
| `firestore.rules`, `firestore.indexes.json`, `firebase.json` | Regole e indici del database |
| `worker/postino.js` | Sorgente del Worker |
| `worker/cloudflare-worker.js` | **File generato** da incollare su Cloudflare (`npm run worker`) |
| `worker/wrangler.toml` | Per pubblicare il Worker da riga di comando (facoltativo) |
| `test/` | Test: frase, ricorrenze, Worker, regole, app nel browser |
| `scripts/` | Controlli e generazione del Worker |
| `docs/` | Guide: pubblicazione, Play Store; immagini per lo store |
| `icon-*.png`, `badge-96.png` | Icone |

Fuori dal repository: il file JSON dell'account di servizio Firebase, **solo** nel segreto `SA_JSON` di Cloudflare. **Mai su GitHub.**

### Dati in Firestore
| Collezione | Contenuto |
|---|---|
| `famiglie/{id}` | `nome`, `membri` (uid), `nomi` (uid → nome mostrato) |
| `famiglie/{id}/voci/{id}` | `tipo`, `testo`, `data`, `ora`, `ripeti`, `anticipo`, `fuso`, `perChi`, `lista`, `autoreUid`, `autoreNome`, `creato`, `fatto`, `risposte`, `avvisoAt` |
| `utenti/{uid}` | `famiglie` di cui fa parte |
| `inviti/{codice}` | `famiglia`, `nomeFamiglia`, `da`, `scade` |
| `dispositivi/{token}` | `uid`, `famiglie`: dove spedire le notifiche |
| `voci`, `migrazione` | Vecchio frigo della v0.2, solo per la migrazione |

---

## Configurazione

### Firebase
1. Progetto `rigordati` con **Firestore** (sede europea), **Authentication** con provider Google, **app Web** registrata.
2. Authentication → Impostazioni → Domini autorizzati: `wolve666.github.io`.
3. Cloud Messaging → Certificati push web: chiave VAPID (in `js/config.js`).
4. Regole: contenuto di `firestore.rules` (Firestore → Regole → incolla → Pubblica).
5. Indice per i promemoria: vedi [docs/PUBBLICARE.md](docs/PUBBLICARE.md#2-indice-per-i-promemoria).

### Cloudflare Worker
1. Codice: incollare `worker/cloudflare-worker.js` nell'editor del Worker `rigordati` e distribuire.
2. Impostazioni → Variabili e segreti, tipo **Secret**:

| Nome | Valore |
|---|---|
| `SA_JSON` | Intero contenuto del file JSON dell'account di servizio |
| `API_KEY` | `apiKey` di firebaseConfig |
| `ORIGINE` *(facoltativo, testo)* | Indirizzi ammessi separati da virgola. Predefinito `https://wolve666.github.io` |

3. Trigger events → Cron Triggers: `* * * * *`.

`AMMESSI` non serve più: ora decide l'appartenenza alla famiglia.

---

## Sviluppo e test

Serve solo Node.js 22. L'app non ha dipendenze; quelle in `package.json` servono solo ai test.

| Comando | Cosa fa |
|---|---|
| `npm test` | Test della frase, delle ricorrenze e del Worker (con un Firebase finto) |
| `npm run controlla` | Sintassi, file della cache offline, versione, Worker aggiornato |
| `npm run worker` | Rigenera `worker/cloudflare-worker.js` dopo aver toccato `worker/` o `js/ricorrenze.js` |
| `npm run test:regole` | Regole Firestore sull'emulatore ufficiale (serve Java; prima `npm install`) |
| `npm run test:app` | L'app vera in un browser, con due persone e un Firebase finto (serve Playwright) |

A ogni push GitHub Actions esegue tutto (`.github/workflows/controlli.yml`): la spunta verde sul commit vuol dire che si può pubblicare.

Per provare l'app sul computer: `python3 -m http.server` nella cartella e aprire `http://localhost:8000` (aggiungere `localhost` ai domini autorizzati di Firebase).

---

## Aggiornare l'app

1. Cambiare la versione **solo** in `js/versione.js` e qui nel README (la cache del service worker la segue da sola).
2. Se è cambiato il Worker: `npm run worker`, poi reincollare `worker/cloudflare-worker.js` su Cloudflare (la prima riga riporta la versione).
3. Unire il branch in `main`: GitHub Pages pubblica in 2-3 minuti.
4. Sul telefono: trascinare giù nell'app.

> **Attenzione:** non cancellare i dati del sito `wolve666.github.io` da Chrome: lo stesso indirizzo ospita anche altre app.

---

## Sicurezza

- Le regole Firestore (provate sull'emulatore in `test/regole/`) fanno sì che:
  - solo i membri leggano e scrivano le voci della famiglia, e ogni voce sia firmata da chi la scrive;
  - si entri in una famiglia solo con un invito valido e non scaduto di quella famiglia, aggiungendo solo sé stessi;
  - si esca solo togliendo sé stessi;
  - i codici d'invito non si possano elencare, i profili e i dispositivi siano visibili solo al proprietario.
- Il Worker verifica il token di accesso Google, controlla che chi scrive sia della famiglia, spedisce solo ai telefoni dei membri attuali e accetta richieste solo dall'indirizzo dell'app.
- `firebaseConfig` e la chiave VAPID sono pubbliche per natura: la protezione sta nelle regole.
- Il file JSON dell'account di servizio è l'unica vera chiave segreta: sta solo su Cloudflare.

---

## Risoluzione problemi

| Sintomo | Causa probabile | Soluzione |
|---|---|---|
| Resta la versione vecchia | Cache | Trascinare giù; se serve chiudere l'app dalle recenti e riaprirla |
| Pallino rosso | Errore di collegamento | Toccarlo per leggere il codice d'errore |
| "Codice non valido" / "scaduto" | Codice sbagliato o più vecchio di 7 giorni | Farsene mandare uno nuovo (👪 → Invita) |
| "Postino: app da aggiornare" | App vecchia v0.2 con il Worker nuovo | Trascinare giù per aggiornare |
| "Postino: non fai parte di questa famiglia" | Uscito dalla famiglia da un altro telefono | Rientrare con un invito |
| "Postino: accesso non verificato" | Segreto `API_KEY` mancante o errato | Reinserirlo su Cloudflare |
| "Nessun altro dispositivo ha le notifiche attive" | Campanella non attivata sugli altri telefoni | Toccare la campanella e consentire |
| I promemoria non arrivano | Manca l'indice su `avvisoAt` | Vedi [docs/PUBBLICARE.md](docs/PUBBLICARE.md#2-indice-per-i-promemoria) |
| La notifica di prova non compare | Notifiche bloccate da Android | Impostazioni → App → Rigordati!! → Notifiche |
| Notifiche in ritardo | Risparmio energetico | Togliere Chrome dalle app in sospensione |

---

## Storico versioni

| Versione | Novità |
|---|---|
| v0.3.0 | **Famiglie** con codice d'invito e migrazione del vecchio frigo; modifica delle voci; "per chi"; impegni ricorrenti; promemoria a scelta; lista della spesa e pulizia delle cose fatte; notifica che apre la voce; busta "!!" per aggiornare; eliminazione account e informativa privacy; codice diviso in moduli, test automatici, Worker e regole nel repository |
| v0.2.6 | Campanella monocromatica per la barra delle notifiche |
| v0.2.5 | Notifica di prova toccando la versione; ripristinato `sw.js` completo |
| v0.2.4 | Domanda inviata al tocco del tipo; errori del Worker più chiari |
| v0.2.3 | Doppio tocco sul giorno per creare una voce; esito dell'invio notifiche |
| v0.2.2 | Notifiche escluse per dispositivo invece che per account; collegamento alternativo per reti difficili |
| v0.2.1 | Trascina giù per aggiornare; pallino di stato; cache sempre fresca |
| v0.2.0 | Notifiche push, promemoria, contatore sull'icona, Cloudflare Worker |
| v0.1.1 | Icona ufficiale con la papera, versioni arrotondata e maskable |
| v0.1.0 | Prima versione: calendario, tre tipi di voce, inserimento a frase, sincronizzazione |

---

## Idee per il futuro

- App Android sul Play Store: tutto pronto in [docs/PLAY-STORE.md](docs/PLAY-STORE.md).
- Foto sui biglietti (richiede Firebase Storage, che oggi è solo sul piano a pagamento).
- Fine delle ripetizioni ("ogni lunedì fino a giugno") e salto di una singola occorrenza.
- Tema scuro.
