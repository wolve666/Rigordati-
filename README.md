# Rigordati!!

**Il frigo di casa, ma nel telefono.**
Calendario condiviso in tempo reale per la famiglia: impegni, domande e cose da fare, con notifiche push e promemoria automatici.

Versione attuale: **v0.2.6**
App: https://wolve666.github.io/Rigordati/

---

## Indice

- [Funzionalità](#funzionalità)
- [Come si usa](#come-si-usa)
- [Architettura](#architettura)
- [Struttura dei file](#struttura-dei-file)
- [Configurazione](#configurazione)
- [Aggiornare l'app](#aggiornare-lapp)
- [Sicurezza](#sicurezza)
- [Risoluzione problemi](#risoluzione-problemi)
- [Storico versioni](#storico-versioni)
- [Idee per il futuro](#idee-per-il-futuro)

---

## Funzionalità

### Tre tipi di voce
| Tipo | Colore | A cosa serve |
|---|---|---|
| Impegno | Verde | Appuntamenti con data e ora ("mercoledì 6 dentista ore 16") |
| Domanda | Rosa | Richieste all'altro con risposta Sì / No / Forse o testo libero ("venerdì posso andare a Magic?") |
| Da fare | Giallo | Cose da prendere o da fare, con spunta ("prendere pane per la cena") |

### Inserimento intelligente
- Si scrive la frase come la si direbbe: giorno e ora vengono riconosciuti da soli.
- Capisce: `oggi`, `domani`, `dopodomani`, `stasera`, i giorni della settimana (anche con il numero, es. `mercoledì 6`), date come `6/11` o `6 novembre`, orari come `ore 16`, `alle 16:30`, `16.30`.
- Una frase con il `?` diventa automaticamente una domanda.
- Toccando **Domanda** con il testo già scritto, la domanda parte subito.

### Calendario
- Vista mensile con pallini colorati sui giorni occupati.
- Primo tocco su un giorno: mostra le sue voci.
- Secondo tocco sullo stesso giorno: apre il foglio "nuovo" con la data già impostata.

### Condivisione e notifiche
- Sincronizzazione in tempo reale tra tutti i dispositivi.
- Notifica push nella tendina di Android, anche ad app chiusa, quando l'altro aggiunge una voce o risponde a una domanda.
- Promemoria degli impegni: un'ora prima, oppure alle 8:00 del giorno se non c'è l'ora.
- Contatore sull'icona dell'app (badge) e sulle schede interne "Domande" e "Da fare".
- Il dispositivo da cui si scrive non riceve la propria notifica.

### Interfaccia
- Stile "frigo di casa": bigliettini colorati con calamita, sfondo con disegnini, font scritto a mano.
- Animazioni sui biglietti, coriandoli quando si spunta una cosa fatta.
- Trascina giù per aggiornare l'app.
- Tasto indietro di Android gestito (chiude i fogli e torna al calendario).
- Tasto "Scarica l'app" per installarla come PWA.
- Pallino di stato accanto alla versione: verde collegato, grigio offline, rosso errore.
- Funziona anche offline: le modifiche si sincronizzano al ritorno della rete.

---

## Come si usa

1. Aprire il link dell'app in Chrome dal telefono.
2. Toccare **Scarica l'app** (o menu ⋮ → "Aggiungi a schermata Home").
3. Accedere con il proprio account Google.
4. Toccare la **campanella** e consentire le notifiche (una volta sola per dispositivo).

Toccando la **versione** accanto al nome si genera una notifica di prova locale, utile per verificare che Android mostri le notifiche.

---

## Architettura

```
 Telefono / PC (PWA)                    Firebase (piano gratuito Spark)
 ┌──────────────────┐   tempo reale    ┌───────────────────────────┐
 │ index.html       │ ◄──────────────► │ Firestore: voci,          │
 │ sw.js            │                  │            dispositivi    │
 └────────┬─────────┘                  │ Authentication (Google)   │
          │ "avvisa"                   │ Cloud Messaging (FCM)     │
          ▼                            └─────────────▲─────────────┘
 ┌──────────────────┐   legge voci e dispositivi     │
 │ Cloudflare Worker│ ───────────────────────────────┘
 │ (piano gratuito) │   invia le notifiche via FCM
 │ postino + sveglia│   cron ogni minuto per i promemoria
 └──────────────────┘
```

- **GitHub Pages** ospita l'app.
- **Firebase** fa da database condiviso, accesso e canale delle notifiche.
- **Cloudflare Worker** è il "postino": spedisce le notifiche quando l'app è chiusa e ogni minuto controlla i promemoria in scadenza. Serve perché il piano gratuito di Firebase non permette di inviare notifiche dal server.

Costo totale: **0 €**, nessuna carta di credito richiesta.

---

## Struttura dei file

### Nel repository GitHub
| File | Descrizione |
|---|---|
| `index.html` | L'intera app: interfaccia, logica, collegamento a Firebase |
| `sw.js` | Service worker: cache offline, ricezione notifiche push, clic sulle notifiche |
| `manifest.json` | Dati per l'installazione come app (nome, colori, icone) |
| `icon-192.png`, `icon-512.png` | Icona con angoli arrotondati (PC e browser) |
| `icon-maskable-192.png`, `icon-maskable-512.png` | Icona con margini per il ritaglio di Android |
| `badge-96.png` | Campanella monocromatica per la barra delle notifiche |
| `README.md` | Questo file |

### Fuori dal repository
| File | Dove sta |
|---|---|
| `cloudflare-worker.js` | Incollato nell'editor del Worker su Cloudflare |
| File JSON dell'account di servizio Firebase | Solo nel segreto `SA_JSON` di Cloudflare. **Mai su GitHub.** |

### Dati in Firestore
**`voci`**: un documento per ogni voce.
| Campo | Contenuto |
|---|---|
| `tipo` | `impegno`, `domanda` o `todo` |
| `testo` | Testo ripulito da data e ora |
| `data`, `ora` | `AAAA-MM-GG` e `HH:MM` (anche vuoti) |
| `autore`, `autoreNome` | Email e nome di chi ha scritto |
| `creato` | Data di creazione |
| `fatto` | Spuntato o no |
| `risposte` | Elenco di risposte (email, nome, testo, quando) |
| `avvisoAt` | Momento del promemoria; viene cancellato dopo l'invio |

**`dispositivi`**: un documento per ogni dispositivo con notifiche attive (token, email, nome).

---

## Configurazione

### Firebase
1. Progetto `rigordati` con **Firestore** (sede europea), **Authentication** con provider Google, **app Web** registrata.
2. Authentication → Impostazioni → Domini autorizzati: aggiungere `wolve666.github.io`.
3. Cloud Messaging → Certificati push web: chiave VAPID (inserita in `index.html`).
4. Regole Firestore (sostituire le email):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function ok() {
      return request.auth != null &&
        request.auth.token.email in ['EMAIL_1', 'EMAIL_2'];
    }
    match /{doc=**} {
      allow read, write: if ok();
    }
  }
}
```

### Cloudflare Worker
1. Workers e Pages → Crea → "Inizia con Hello World!" → nome `rigordati`.
2. Modifica codice: incollare `cloudflare-worker.js` e distribuire.
3. Impostazioni → Variabili e segreti, tutti di tipo **Secret**:

| Nome | Valore |
|---|---|
| `SA_JSON` | Intero contenuto del file JSON dell'account di servizio |
| `API_KEY` | `apiKey` di firebaseConfig |
| `AMMESSI` | Email ammesse, separate da virgola |

4. Impostazioni → Trigger events → Cron Triggers: `* * * * *`.
5. Indirizzo: `https://rigordati.wolve666.workers.dev`.

### Costanti in `index.html`
| Costante | Contenuto |
|---|---|
| `VERSIONE` | Numero di versione mostrato accanto al nome |
| `firebaseConfig` | Configurazione del progetto Firebase |
| `VAPID` | Chiave pubblica per le notifiche web |
| `WORKER` | Indirizzo del Worker Cloudflare |

---

## Aggiornare l'app

1. Aggiornare `VERSIONE` in `index.html` e `CACHE` in `sw.js` (stesso numero).
2. Caricare i file **nella radice** del repository, non in una sottocartella.
3. Attendere 2-3 minuti per la pubblicazione di GitHub Pages.
4. Sul telefono: trascinare giù nell'app. Se serve, chiuderla dalle app recenti e riaprirla.

Se cambia `cloudflare-worker.js`, va reincollato anche su Cloudflare (la prima riga del file riporta la versione).

> **Attenzione:** non cancellare i dati del sito `wolve666.github.io` da Chrome: lo stesso indirizzo ospita anche altre app e i loro dati andrebbero persi.

---

## Sicurezza

- Solo le email elencate nelle regole di Firestore possono leggere e scrivere.
- Il Worker verifica chi scrive tramite il token di accesso Google e accetta solo le email in `AMMESSI`.
- Il Worker accetta richieste solo dall'indirizzo dell'app su GitHub Pages.
- `firebaseConfig` e la chiave VAPID sono pubbliche per natura: la protezione sta nelle regole.
- Il file JSON dell'account di servizio è l'unica vera chiave segreta: sta solo su Cloudflare.

---

## Risoluzione problemi

| Sintomo | Causa probabile | Soluzione |
|---|---|---|
| Resta la versione vecchia | File caricati in una sottocartella, o cache | Controllare la radice del repository, chiudere e riaprire l'app |
| Pallino rosso | Errore di collegamento | Toccarlo per leggere il codice d'errore |
| "Postino: accesso non verificato" | Segreto `API_KEY` mancante o errato | Reinserirlo su Cloudflare |
| "Postino: ... non è in AMMESSI" | Email non presente nel segreto | Correggere `AMMESSI` |
| "Nessun altro dispositivo ha le notifiche attive" | Campanella non attivata sull'altro dispositivo | Toccare la campanella e consentire |
| La notifica di prova non compare | Notifiche bloccate da Android | Impostazioni → App → Rigordati!! → Notifiche |
| Nessun numero sull'icona | Badge disattivati | Impostazioni → Notifiche → Avanzate → Badge icone app |
| Notifiche in ritardo | Risparmio energetico | Togliere Chrome dalle app in sospensione |

---

## Storico versioni

| Versione | Novità |
|---|---|
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

- Animazione di aggiornamento: busta delle lettere con "!!" al centro dello schermo con effetto battito (zoom avanti e indietro) al posto della papera che gira.
