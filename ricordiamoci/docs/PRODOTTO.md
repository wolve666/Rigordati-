# Ricordiamoci — documento di prodotto

*Bozza v0.1, 18 novembre 2026. Nome provvisorio: "Ricordiamoci" (in alternativa "RicordaMi"); si cambia in `js/marchio.js` e `manifest.webmanifest`.*

## In una frase

**L'app dei promemoria che non ti lascia scordare niente**: scrivi come parli, ti avvisa quando serve e, se serve, insiste finché non l'hai fatto.

## Per chi

| Profilo | Il problema | Cosa trova in Ricordiamoci |
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

## Il punto tecnico da sapere

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
2. **Protocollo comune**: ogni app può creare un promemoria aprendo `…/ricordiamoci/?aggiungi={"titolo":"Bolletta luce","data":"2026-12-05","lista":"scadenze","origine":"conti"}` oppure il link `web+ricordami:`. L'utente vede il promemoria già compilato e conferma.
3. **Account unico** (fase 2): un solo accesso per tutte le app, un solo abbonamento "Pacchetto".

Esempi di sinergie:

| App | Con Ricordiamoci |
|---|---|
| **Conti** (spese, bollette, abbonamenti) | Ogni bolletta diventa un promemoria con scadenza e avvisi; "pagata" in Conti = fatto in Ricordiamoci, e viceversa |
| **Spesa** | La lista spesa si attiva quando sei vicino al supermercato o il sabato mattina |
| **Casa** (manutenzioni, scadenze auto) | Tagliando, revisione, bollo, caldaia: ricorrenze già pronte |
| **Salute** | Farmaci con insistenza finché non li hai presi, visite, ricette |
| **Rigordati** (famiglia) | Il frigo condiviso di famiglia nasce dallo stesso nucleo |

## Tabella di marcia

| Fase | Contenuto |
|---|---|
| **1 — fatto** | App completa senza account: tutto quanto sopra |
| 2 — servizio avvisi | Account (Google/Apple/email), push al minuto ad app chiusa, email, sincronizzazione; riuso del "postino" Cloudflare di Rigordati (già testato) |
| 3 — vendita | Pagamenti, prova gratuita, Play Store, sito vetrina, dominio proprio |
| 4 — condivisione | Liste condivise (dal nucleo "famiglie" di Rigordati) |
| 5 — pacchetto | Conti come seconda app, account unico, sconto pacchetto |
| Idee | Promemoria legati a un luogo, comandi vocali ("Ok Google, ricordami…" tramite condivisione), widget Android (con la versione TWA), assistente che suggerisce quando fare le cose rimandate troppe volte |

## Domande aperte per te

1. **Nome**: Ricordiamoci o RicordaMi? (Prima di decidere: controllare marchi registrati su UIBM/EUIPO e disponibilità di dominio e nome sullo store.)
2. **Dominio**: serve un dominio proprio (es. `ricordiamoci.app`) per lo store e per la credibilità; GitHub Pages va bene solo per le prove.
3. **Tema predefinito** per chi installa: Elegante (scelto ora) o Allegro?
4. **Icona**: i due "!!" vanno bene come direzione? È provvisoria, si può far rifinire da un grafico.
5. **Prezzi**: la tabella sopra è una proposta, da confrontare con i concorrenti (Todoist, TickTick, Due, Any.do).
6. **Fase 2**: restiamo su Firebase + Cloudflare (gratis all'inizio, già conosciuti) o preferisci altro?
