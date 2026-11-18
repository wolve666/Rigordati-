# RicordaMi — dominio e server

*Proposta del 18 novembre 2026. Niente di questo è ancora acquistato o attivo.*

## Cosa cambia con l'app Android

Con l'APK gli avvisi li programma **Android stesso**, all'ora esatta, anche ad app chiusa e dopo un riavvio. Il server non serve più per far suonare i promemoria: serve per tutto quello che riguarda **più dispositivi o più persone**.

| Funzione | Senza server | Con server |
|---|---|---|
| Promemoria, ripetizioni, avvisi esatti sul telefono | ✓ | ✓ |
| Backup in un file | ✓ | ✓ |
| **Computer**: stessi promemoria sullo schermo grande | — | ✓ |
| Account e cambio telefono senza perdere niente | — | ✓ |
| Avvisi anche per **email** | — | ✓ |
| Liste condivise (coppia, famiglia, colleghi) | — | ✓ |
| Pagamenti e abbonamento Plus | — | ✓ |
| Le altre app del pacchetto (Conti…) con un solo account | — | ✓ |

Quindi è proprio il server a rendere possibile il passaggio telefono ↔ computer che vuoi rendere chiaro, ed è anche ciò che giustifica l'abbonamento.

## Dominio

| Dominio | Stato (controllo RDAP del 18/11/2026) |
|---|---|
| ricordami.app, ricordami.com, ricordami.net, ricordami.cloud, ricordamiapp.com | **già registrati** da altri |
| **ricordami.io**, **ricordami.me**, **ricordami.co**, ricordami.org, getricordami.com, ricorda-mi.com | risultano **liberi** |
| ricordami.it, ricordami.eu | non verificabili da qui: controllare su nic.it / eurid.eu |

Consiglio: **ricordami.io** o **ricordami.me** ("ricorda me" si legge bene), più il **.it** se libero. Prima di comprare conviene controllare che "RicordaMi" non sia un marchio registrato (UIBM, EUIPO) e cercare sul Play Store app con nomi uguali: un nome simile a un'app esistente può creare problemi alla pubblicazione.

## Due strade per il server

### A — Cloudflare, senza server da gestire (consigliata)

| Pezzo | Cosa fa | Costo iniziale |
|---|---|---|
| Cloudflare Registrar + DNS | Dominio al prezzo di costo, HTTPS automatico | ~10–40 €/anno di dominio |
| Cloudflare Pages | Sito vetrina + versione computer di RicordaMi | 0 € |
| Cloudflare Workers | API: accesso, sincronizzazione, pagamenti | 0 € (poi 5 $/mese oltre i limiti gratuiti) |
| Cloudflare D1 (SQLite) | Database di account e promemoria | 0 € fino a 5 GB |
| Durable Objects / Cron | Avvisi per email all'ora giusta | incluso |
| Firebase Cloud Messaging | "Svegliati e sincronizza" verso il telefono | 0 € |
| Resend o Postmark | Invio delle email | 0 € fino a ~3000/mese |

Vantaggi: niente da aggiornare o mettere in sicurezza, veloce in tutta Europa, si paga solo crescendo, ed è la stessa tecnica del "postino" di Rigordati che abbiamo già scritto e provato.

### B — Un server tuo (VPS)

Per esempio una macchina Hetzner da circa 5 €/mese con Debian, Caddy (HTTPS), Node.js e PostgreSQL.

Vantaggi: controllo totale, nessun limite di piattaforma. Svantaggi: aggiornamenti di sicurezza, backup, monitoraggio e guasti sono a carico nostro; se il server si ferma di notte, si ferma l'app.

**Consiglio la A.** La B ha senso se vuoi imparare a gestire un server o se un giorno serviranno cose che Cloudflare non fa. Si può anche partire con la A e spostarsi in seguito: l'API sarebbe la stessa.

## Come funzionerà la sincronizzazione

- **Il telefono resta il centro.** I dati vivono sul dispositivo e funzionano offline; il server tiene una copia e passa le modifiche agli altri dispositivi. Per ogni promemoria vince la modifica più recente.
- **Passaggio al computer, in modo chiaro:** nell'app, *Impostazioni › Telefono e computer › Collega il computer*. Il telefono mostra un codice di 6 cifre; sul computer si apre `ricordami.io`, si inserisce il codice e si è dentro, senza password. In alternativa, con lo stesso account Google su entrambi.
- **Dal computer al telefono:** quando scrivi sul computer, il server manda al telefono una notifica silenziosa ("sincronizza"); l'app scarica la modifica e riprogramma gli avvisi esatti.
- **Privacy:** in seguito potremo aggiungere la cifratura end-to-end (il server conserva solo dati illeggibili), un buon argomento di vendita.

## Cosa serve da parte tua (quando decidi)

1. Scegliere e comprare il dominio (con la strada A: direttamente su Cloudflare).
2. Creare un account Cloudflare e darmi accesso tramite un **token API** con permessi limitati (te lo spiego io passo per passo; il token non va mai scritto in chat).
3. Creare un progetto Firebase "ricordami" (serve solo per le notifiche di sincronizzazione).
4. Più avanti: account Google Play sviluppatore (25 $) e account Stripe o Paddle per i pagamenti.
