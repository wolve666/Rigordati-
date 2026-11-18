# RicordaMi — documento di prodotto

*Bozza v0.2, 18 novembre 2026. Nome scelto: **RicordaMi** (da verificare su marchi, dominio e Play Store prima del lancio).*

## In una frase

**L'app dei promemoria che non ti lascia scordare niente**: scrivi come parli, ti avvisa quando serve e, se serve, insiste finché non l'hai fatto.

## Per chi

| Profilo | Il problema | Cosa trova in RicordaMi |
|---|---|---|
| 🗂️ **Organizzato** | Vuole vedere la settimana in ordine, odia le app lente e confuse | Calendario con pallini per lista, liste colorate, avviso il giorno prima, riepilogo serale di domani, esportazione verso il calendario |
| 🫣 **Scordarello** | Si dimentica le cose anche con l'avviso, perché lo chiude e se ne dimentica | Più avvisi per ogni cosa (1 h, 10 min, al momento), **"insisti finché non è fatto"**, riepilogo del mattino, bollino rosso sull'icona |
| ⏱️ **Ultimo minuto** | Fa tutto all'ultimo e a volte troppo tardi | "tra 2 ore…", conto alla rovescia sul prossimo impegno, avvisi a 2 giorni / 1 giorno / 2 ore / 30 min, scadenze in rosso, rimanda con un gesto |

Il profilo si sceglie al primo avvio e imposta gli avvisi predefiniti; si cambia quando si vuole.

## Cosa c'è già (v0.1, funzionante)

- **Scrivi come parli**: "ogni lunedì e giovedì palestra alle 18 #salute", "tra 2 ore chiamare il commercialista urgente", "pagare il bollo entro venerdì!!", "nei giorni feriali timbrare alle 8:30", "3 marzo compleanno di Luca". Sotto il testo compare subito cosa ho capito.
- **Ripetizioni complete**: ogni N giorni/settimane/mesi/anni, giorni della settimana a scelta, feriali, weekend, fino a una data. Ora legale gestita.
- **Avvisi multipli** per ogni promemoria, **insistenza** dopo la scadenza (ogni 5/10/15/30 min, fino a 6 volte), **riepilogo** del mattino e della sera.
- **Notifiche con azioni**: "✓ Fatto" e "⏰ Tra 10 min" direttamente dalla tendina, senza aprire l'app. Bollino monocromatico "!!" nella barra di stato.
- **Bollino sull'icona** con il numero di cose in ritardo o da fare oggi.
- **Gesti**: scorri a destra = fatto, a sinistra = rimanda (10 min, 1 ora, stasera, domani mattina, weekend, settimana prossima, o a scelta). Ogni azione si può annullare.
- **Vista Oggi** pensata per chi va di fretta: in ritardo, prossimo con conto alla rovescia, oggi, domani, settimana, più avanti, "quando capita".
- **Calendario** mensile, **liste** con emoji e colori, **ricerca**.
- **Due temi**, Elegante e Allegro, ciascuno chiaro/scuro/automatico; cambio tema con transizione a cerchio; animazioni disattivabili.
- **Senza account e offline**: i dati restano sul telefono (IndexedDB). Backup/ripristino in un file.
- **Integrazione**: esportazione `.ics` (Google Calendar, Outlook, Apple) con ripetizioni e avvisi; **condividi da altre app** (un messaggio o una mail diventa un promemoria); link `web+ricordami:` e `?aggiungi=` per le altre app del pacchetto.
- **Computer**: barra laterale e scorciatoie da tastiera (`n` nuovo, `/` cerca, `Esc` chiudi).
- Velocità: nessuna libreria esterna, circa 37 KB compressi in tutto, si apre dalla cache in un istante.

## App Android (APK)

Dalla v0.1 RicordaMi è anche un'**app Android vera** (Capacitor): stesso codice dell'app web, più le funzioni del telefono.

- **Avvisi all'ora esatta programmati nel sistema**, anche ad app chiusa e dopo il riavvio del telefono: per gli avvisi sul telefono non serve nessun server.
- Tasti **"✓ Fatto"** e **"⏰ Tra 10 min"** direttamente nella notifica; canali di notifica separati (promemoria, insistenti, riepiloghi) regolabili dalle impostazioni di Android.
- **"Condividi → Ricordamelo"** da WhatsApp, Gmail, browser: il testo diventa un promemoria già capito.
- Bollino sull'icona, vibrazione tattile, barra di stato del colore del tema, schermata d'avvio con l'icona "!!".
- Backup ed esportazione calendario tramite il menu "Condividi" di Android.

Si scarica da GitHub (Actions › "APK RicordaMi") e si installa sul telefono; per il Play Store servirà una chiave di firma dedicata.

L'interfaccia resta pensata **prima per il telefono**; il computer avrà la stessa app, sincronizzata (vedi [SERVER.md](SERVER.md)).

## Il punto tecnico da sapere (versione web)

Un'app web **non può** far suonare un avviso all'ora esatta quando è completamente chiusa senza un server che la "svegli". Oggi:

- ad app aperta o in sottofondo gli avvisi sono precisi;
- ad app chiusa, su Android con l'app installata, Chrome la sveglia periodicamente (*periodic background sync*), ma non all'ora esatta.

Per avvisi affidabili al minuto serve il **servizio avvisi** (fase 2): il telefono comunica al server solo *quando* svegliarlo; il server manda una notifica push "vuota" e il telefono calcola da solo cosa mostrare (il service worker lo fa già: vedi `sw.js`, evento `push`). **Il server non vede mai il contenuto dei promemoria**: un argomento di vendita forte sulla privacy.

Questo servizio, insieme a sincronizzazione ed email, è anche la ragione naturale dell'abbonamento.

## Modello di vendita (proposta)

| | **Gratis** | **Plus** | **Pacchetto** |
|---|---|---|---|
| Promemoria, ripetizioni, liste, temi | ✓ illimitati | ✓ | ✓ |
| Avvisi ad app aperta / in sottofondo | ✓ | ✓ | ✓ |
| **Avvisi al minuto anche ad app chiusa** | — | ✓ | ✓ |
| **Avvisi per email** (cose che non puoi scordare) | — | ✓ | ✓ |
| Sincronizzazione tra telefono e computer | — | ✓ | ✓ |
| Liste condivise (famiglia, coppia, colleghi) | — | ✓ | ✓ |
| Backup automatico | — | ✓ | ✓ |
| Le altre app (Conti, …) | — | — | ✓ |
| **Prezzo indicativo** | 0 € | 2,49 €/mese · 19,99 €/anno | 4,99 €/mese · 39,99 €/anno |

Il gratuito deve essere già **molto buono** (è il passaparola). Plus si vende da solo nel momento in cui un avviso importante arriva in ritardo: lì l'app propone la prova gratuita di 14 giorni.

Canali: Google Play (stessa tecnica TWA già preparata per Rigordati), sito web con pagamento (Stripe o Paddle), iPhone come app installata dal browser (le notifiche web su iOS funzionano dalla 16.4 se l'app è aggiunta alla schermata Home).

## Il pacchetto: app sinergiche

Ogni app si compra a parte ma, se ne hai più d'una, si potenziano a vicenda. Le basi sono già nel codice:

1. **Stesso aspetto** (temi Elegante/Allegro, stessi componenti): sembrano una famiglia.
2. **Protocollo comune**: ogni app può creare un promemoria aprendo `…/ricordami/?aggiungi={"titolo":"Bolletta luce","data":"2026-12-05","lista":"scadenze","origine":"conti"}` oppure il link `web+ricordami:`. L'utente vede il promemoria già compilato e conferma.
3. **Account unico** (fase 2): un solo accesso per tutte le app, un solo abbonamento "Pacchetto".

Esempi di sinergie:

| App | Con RicordaMi |
|---|---|
| **Conti** (spese, bollette, abbonamenti) | Ogni bolletta diventa un promemoria con scadenza e avvisi; "pagata" in Conti = fatto in RicordaMi, e viceversa |
| **Spesa** | La lista spesa si attiva quando sei vicino al supermercato o il sabato mattina |
| **Casa** (manutenzioni, scadenze auto) | Tagliando, revisione, bollo, caldaia: ricorrenze già pronte |
| **Salute** | Farmaci con insistenza finché non li hai presi, visite, ricette |
| **Rigordati** (famiglia) | Il frigo condiviso di famiglia nasce dallo stesso nucleo |

## Tabella di marcia

| Fase | Contenuto |
|---|---|
| **1 — fatto** | App completa senza account: tutto quanto sopra |
| **1b — fatto** | App Android (APK) con avvisi esatti nel sistema, azioni nella notifica, condivisione da altre app |
| **1c — fatto** | Famiglia come in Rigordati: domande e risposte, per chi, Rispondi tu, avvisi agli altri, inviti; server portabile (Cloudflare o tuo) |
| 2 — server | Dominio, account, sincronizzazione telefono ↔ computer, avvisi per email ([SERVER.md](SERVER.md)) |
| 3 — vendita | Pagamenti, prova gratuita, Play Store, sito vetrina, dominio proprio |
| 4 — condivisione | Liste condivise (dal nucleo "famiglie" di Rigordati) |
| 5 — pacchetto | Conti come seconda app, account unico, sconto pacchetto |
| Idee | Promemoria legati a un luogo, comandi vocali ("Ok Google, ricordami…" tramite condivisione), widget Android (con la versione TWA), assistente che suggerisce quando fare le cose rimandate troppe volte |

## Domande aperte per te

1. ~~Nome~~ → **RicordaMi**. Resta da controllare: marchi (UIBM, EUIPO), dominio, nome sul Play Store.
2. ~~Dominio~~ → sì. `ricordami.app` e `.com` sono già presi: proposte in [SERVER.md](SERVER.md).
3. ~~Tema predefinito~~ → Elegante, con la scelta al primo avvio.
4. ~~Icona~~ → piace; da rivedere più avanti.
5. **Prezzi**: da rivedere insieme verso la fine.
6. **Server**: Cloudflare (consigliato) o VPS tuo? Vedi [SERVER.md](SERVER.md).
