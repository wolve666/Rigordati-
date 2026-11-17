# Ricordiamoci

**Le cose importanti, al momento giusto.**
Promemoria che capiscono come parli, avvisano quando serve e insistono finché non hai fatto. Nato dal nucleo di [Rigordati!!](../README.md), pensato per essere venduto.

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

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm test` | 44 test: frasi, ripetizioni, avvisi, pianificatore |
| `npm run test:app` | L'app vera nel browser: primo avvio, frasi, gesti, avvisi, temi, condivisione |
| `npm run anteprime` | Come sopra, salvando le schermate in `docs/anteprime/` |

Per provarla: `python3 -m http.server` in questa cartella e aprire `http://localhost:8000`.

## Collegamento dalle altre app del pacchetto

```
https://…/ricordiamoci/?aggiungi={"titolo":"Bolletta luce","data":"2026-12-05","ora":"","lista":"scadenze","origine":"conti"}
web+ricordami:Pagare la bolletta venerdì
```

Si apre il promemoria già compilato; l'utente conferma con un tocco.
