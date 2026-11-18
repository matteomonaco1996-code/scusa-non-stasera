# Prove automatiche

Qui dentro ci sono i controlli che si fanno prima di pubblicare una modifica: un browser guidato da un programma
apre il sito, tocca i pulsanti e guarda che succeda quello che deve. **Non fanno parte del sito pubblicato.**

## Come si lanciano

```bash
node prove/tutte.js                 # le prove di base, sulla copia del sito in questa cartella (5–10 minuti)
node prove/tutte.js --lunghe        # anche quelle lente: accessibilità, misure su tante larghezze, tocchi a caso
node prove/tutte.js --vivo          # sul sito pubblicato, https://ristomat.click
node prove/tutte.js passi moneta    # solo quelle nominate
```

Alla fine dice quante passano e quali sono da guardare. Le schermate finiscono in una cartella temporanea,
scritta nella prima riga.

Per il database ci sono due prove a parte, che usano un Postgres finto in memoria:

```bash
cd prove && npm install             # una volta sola
node ../strumenti/test_statistiche.mjs ../supabase/schema.sql ../supabase/statistiche.sql ../supabase/livelli.sql
node ../strumenti/test_accesso.mjs ../supabase/statistiche.sql ../supabase/accesso_monitoraggio.sql
```

## Che cosa serve

- Node 20 o più recente.
- [Playwright](https://playwright.dev) con Chromium: `npm install playwright && npx playwright install chromium`
  (negli ambienti di Claude Code c'è già).
- `cd prove && npm install` per le due librerie di contorno (axe-core e PGlite).

## Due regole

1. **Le prove non toccano mai il database vero.** `finto-db.js` viene caricato prima di ogni prova e ferma nel
   browser di prova tutte le chiamate verso Supabase: rispondono «fatto» senza partire. Altrimenti ogni giro di prove
   gonfierebbe i contatori delle visite. Chi scrive una prova nuova e vuole guardare quelle chiamate aggiunge la sua
   regola dopo, come fa `sito/conta-vero.js`.
2. **Una prova che fallisce va capita, non spenta.** Se il sito è cambiato apposta, si aggiorna l'attesa nella
   prova e lo si scrive nel messaggio del commit; se no, è un difetto.

## Che cosa coprono e che cosa no

L'elenco, con una riga per prova, è in cima a `tutte.js`.

Girano su Chromium, il motore di Chrome. **Non provano Safari né Firefox**, e non aprono davvero Google Maps,
PayPal, WhatsApp o la finestra di condivisione del telefono: quelle chiamate vengono fermate. Un giro a mano su un
iPhone e su un Android resta necessario per le modifiche che toccano scorrimento, finestre e posizione.

Alcune prove guardano i dati (per esempio quanti posti ha Tivoli): leggono i numeri da `locali.js`, così non si
rompono quando la lista cambia.
