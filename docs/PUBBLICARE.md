# Pubblicare la v0.3 (dalla v0.2)

La v0.3 sposta le voci dentro le **famiglie**. Per non perdere niente e non lasciare nessuno senza notifiche, segui i passi **in quest'ordine**. In tutto sono circa 15 minuti.

Durante i passi 1-3 l'app vecchia continua a funzionare (si vedono e si scrivono le voci); per pochi minuti le notifiche dall'app vecchia possono rispondere "app da aggiornare": è normale.

---

## 1. Regole Firestore

1. Apri `firestore.rules` e, nelle ultime righe, sostituisci `'EMAIL_1', 'EMAIL_2'` (compaiono **due volte**) con le due email che usate oggi, le stesse delle regole attuali.
2. Firebase → Firestore Database → **Regole** → cancella tutto, incolla il file → **Pubblica**.

Queste righe finali tengono aperto il vecchio frigo **solo** per voi due, il tempo di portarne le voci nella famiglia.

## 2. Indice per i promemoria

Il postino cerca i promemoria scaduti in tutte le famiglie insieme: serve un indice "a livello di gruppo di raccolte".

Firebase → Firestore Database → **Indici** → scheda **Esenzioni a livello di singolo campo** (Single field) → **Aggiungi esenzione**:

| Campo | Valore |
|---|---|
| ID raccolta | `voci` |
| Percorso del campo | `avvisoAt` |
| Ambito | spuntare **Gruppo di raccolte** (Collection group), indice **Crescente** |

Salva; la creazione impiega qualche minuto. (In alternativa, con Firebase CLI: `firebase deploy --only firestore:indexes`.)

Se lo dimentichi, il Worker scrive nei log un errore "requires an index" con un link che crea l'indice in un clic.

## 3. Worker su Cloudflare

1. Cloudflare → Workers e Pages → `rigordati` → **Modifica codice**.
2. Cancella tutto e incolla `worker/cloudflare-worker.js` (la prima riga dice `postino v0.3.0`) → **Distribuisci**.
3. Segreti: `SA_JSON` e `API_KEY` restano come sono. `AMMESSI` non serve più: puoi cancellarlo.
4. Il Cron Trigger `* * * * *` resta com'è.

Verifica: aprendo `https://rigordati.wolve666.workers.dev` nel browser deve comparire `{"ok":true,"servizio":"postino di Rigordati!!"}`.

## 4. App su GitHub Pages

Unisci il branch in `main` (pull request → Merge). GitHub Pages pubblica in 2-3 minuti.

Prima di unire controlla che la spunta di GitHub Actions sul branch sia verde.

## 5. Sui telefoni

**Chi crea la famiglia** (uno solo):
1. Apri l'app e trascina giù per aggiornare (deve comparire `v0.3.0`).
2. Compare "Crea una famiglia": scrivi il nome, lascia spuntato **"Porta in questa famiglia le N voci del vecchio frigo"** → **Crea la famiglia**.
3. 👪 → **Invita qualcuno** → **Condividi** e manda il link all'altro.
4. Tocca la campanella 🔔 se compare.

**Tutti gli altri**:
1. Aprite il link ricevuto (oppure aggiornate l'app e scrivete il codice).
2. **Entra nella famiglia**.
3. Toccate la campanella 🔔 se compare.

Se per sbaglio anche il secondo prova a creare una famiglia, l'app gli dice che il vecchio frigo è già stato portato e di chiedere il codice.

Prova finale: uno scrive una voce, all'altro arriva la notifica; toccandola si apre la voce.

## 6. Pulizia (dopo qualche giorno, facoltativa)

Quando tutto funziona:
- in `firestore.rules` togli il blocco "Transizione dalla v0.2" (le due `match /voci` e `match /migrazione`) e ripubblica le regole;
- in Firestore puoi cancellare la vecchia raccolta `voci` (quella in cima, **non** quelle dentro `famiglie`) e i vecchi documenti in `dispositivi` senza il campo `uid`.

---

## Se qualcosa va storto

- **L'app resta alla v0.2**: chiudila dalle app recenti e riaprila.
- **"Non riesco a crearla: permission-denied"**: le regole non sono state pubblicate (passo 1).
- **La proposta "porta le voci" non compare**: le email in fondo alle regole non corrispondono all'account con cui sei entrato.
- **Tornare indietro**: ripubblica le regole vecchie, rimetti il Worker vecchio e ripristina `main` al commit precedente. I dati vecchi non vengono toccati dalla migrazione (vengono copiati, non spostati).
