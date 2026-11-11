# Scusa, non stasera

**~~Scusa, non stasera.~~ ANZI SÌ!** Un sito in stile videogioco retrò per uscire
senza programmare. I posti sono i 673 della lista Google Maps **“RistoMat”** di
Matteo. Chi si registra fa punti con check-in e recensioni.

> Prima di andare online leggi **[LEGALE_E_SICUREZZA.md](LEGALE_E_SICUREZZA.md)**:
> elenca cosa è già fatto per sicurezza e GDPR e i passi che restano a te.

## Come si gioca

- **DA DOVE PARTIAMO?**: la prima scelta, in cima alla pagina e nella finestra che compare alla prima visita, è
  tra due strade ben distinte: **VICINO A ME** (usa la posizione) e **SCELGO LA ZONA** (quartiere, città o fuori
  porta, senza posizione). Anche la battuta “Anzi sì! Portami fuori.” apre questa scelta.
- **VICINO A ME**: usa il GPS del telefono (la posizione non esce dal browser) e
  mostra i posti in ordine di distanza, a fasce: *Sotto casa* (EASY, fino a 10
  minuti a piedi), *Due passi* (NORMAL, 10–25), *Vale il viaggio* (HARD).
- **ATTIVA LA POSIZIONE**: all’apertura, se la posizione non è già consentita, una finestra spiega a cosa
  serve e la chiede (dopo i termini, mai insieme). Se è bloccata o spenta il sito non può riaccenderla:
  la finestra mostra i passi per iPhone, Android o computer, e la stessa guida compare da VICINO A ME e dal
  gettone. Chi risponde “non ora” non se la ritrova alla visita dopo (`sns-posizione` nel browser).
- **SELEZIONA IL MONDO**: Roma, Firenze, Venezia, Milano, Bologna, Fuori porta.
- **LIVELLI**: a Roma ogni **quartiere** è un livello (38 quartieri in 5 aree:
  Centro, Sponda ovest, Nord, Est, Sud, più la Periferia). In fondo a ogni
  livello ci sono i 3 quartieri più vicini (*Prossimo livello*). Fuori porta i
  livelli sono le località con almeno 3 posti; le altre sono raggruppate per regione.
- **POWER-UP**: Come a casa · A tavola · Pizza, ovvio · Un calice · Due drink ·
  Dolce & caffè · Giro del mondo · Al volo · Sapore di mare · Brace & carne ·
  Spesa golosa · Da scoprire.
- **GETTONE**: pesca un posto a caso, in una finestra in primo piano. Lo spiegano il menu, una riga sopra la
  lista (finché non lo si usa) e la finestra stessa, che dice anche che è gratis: la moneta delle donazioni
  ha lo stesso disegno e qualcuno le confondeva. Con la posizione sceglie tra i posti
  a portata di piedi (12, poi 25, poi 45 minuti; altrimenti i 6 più vicini); dentro un livello pesca lì;
  senza posizione né livello chiede prima dove. Se non hai scelto un power-up tiene solo i tipi adatti
  all’ora (si può togliere). Non ripete un posto finché non sono usciti tutti; chi ha un commento esce
  più spesso. Gli orari di apertura non sono noti: il sito lo dice.
- **INDIETRO**: ogni passo (posti vicini, zona scelta, mappa, scheda aperta da gettone o mappa, finestra aperta,
  restart) è una voce nella cronologia della scheda. Il tasto Indietro del telefono e il pulsante ◀ nella barra
  tornano al passo prima, alla stessa altezza della pagina, invece di uscire dal sito; le finestre si chiudono con
  Indietro (tranne i termini). Se la pagina si ricarica, per esempio tornando da Maps nei browser dentro le app,
  si riprende da dove si era. Nella cronologia c'è solo il punto del sito, mai le coordinate.
- **RESTART**: compare nella barra, nella HUD e a lista vuota quando c’è qualcosa da azzerare; riporta
  tutto com’era all’apertura (mondo, livello, power-up, ricerca, posizione). L’accesso all’account resta.
- **MAPPA DEL MONDO**: Roma disegnata come la mappa dei livelli di un videogioco (Tevere a pixel,
  quartieri come caselle cliccabili, verdi quelli già visitati), senza servizi esterni.
- **MAPPA DEI RISULTATI**: strade, Tevere e Aniene di Roma con dati OpenStreetMap ospitati sul sito
  (`mappa/roma.js`, generato da `strumenti/mappa_osm.py`): si vede sempre, senza chiamare server esterni.
  I nomi delle vie (CARTO) sono un’aggiunta facoltativa.
- **PLAYER 1** (con account): accesso con codice via email, check-in entro 150 m dal posto,
  missioni, livelli con titolo, classifica facoltativa, esportazione e cancellazione dei dati.
- **Il percorso**: check-in → schermata premio con il dettaglio dei punti, missioni compiute e
  “LEVEL UP!” → ogni tanto (al primo check-in, poi ogni 3 posti nuovi) l’invito a recensire.
- **Recensioni stile nota**, come quella di Matteo sul Goccetto: voto, *com’è* in poche parole,
  *la dritta* pratica e fino a 3 etichette (aperitivo, in piedi, da prenotare…).

## Punti

| Azione | Punti |
| --- | --- |
| Primo check-in in un posto | +10 |
| Check-in ripetuto in un altro giorno (max 5 per posto) | +2 |
| Primo posto in un quartiere o località nuovi | +20 |
| Recensione | +5, +10 se com’è + dritta arrivano a 80 caratteri |
| Missioni: Primo passo, Dimmi com’è (+15) · Esploratore, Habitué (+30) · Critico, Giro completo (+50) · Re di Roma (+100) | bonus una tantum |

Un livello ogni 100 punti, con un titolo (Turista per caso, Passante, Buongustaio, Habitué,
Oste ad honorem, Guida del quartiere, Leggenda di Roma). I punti sono calcolati solo dal
database, non dal browser, e non danno premi. Test del database: `strumenti/test_database.mjs`.

## File

| File | Contenuto |
| --- | --- |
| `index.html` | La pagina (solo HTML: niente script inline, per la Content Security Policy) |
| `css/stile.css`, `js/app.js`, `js/conto.js` | Stile, gioco, account e punti |
| `config.js` | Indirizzo e chiave pubblica di Supabase (vuoti = account disattivati) |
| `privacy.html`, `termini.html` | Informativa privacy e termini d’uso (da completare con i tuoi dati) |
| `supabase/schema.sql` | Tabelle, regole di sicurezza e funzioni del database |
| `supabase/luoghi.sql` | Posti da caricare nel database (generato) |
| `supabase/statistiche.sql` | Contatori anonimi (visite e clic), chi può leggerli, donazioni segnate a mano |
| `statistiche.html`, `js/statistiche.js`, `css/statistiche.css` | Pagina di monitoraggio, riservata a chi gestisce il sito |
| `vendor/`, `fonts/` | Leaflet, supabase-js e caratteri ospitati sul sito, con licenze |
| `mappa/roma.js` | Strade e fiumi di Roma (© OpenStreetMap, ODbL), generati da `strumenti/mappa_osm.py` |
| `locali.js` | Dati **generati**: non modificarli a mano |
| `tipi.json` | Tipo di locale per i posti il cui nome non lo dice |
| `in_breve.json` | Descrizioni brevi (etichetta IN BREVE) per i posti senza una nota di Matteo: bozze da rileggere |
| `correzioni.json` | Correzioni manuali (tipo `t`, quartiere `q`, città `c`, nota `nt`): vincono su tutto |
| `strumenti/aggiorna_lista.py` | Scarica la lista da Google Maps e rigenera `locali.js` |
| `strumenti/quartieri.py` | I quartieri di Roma: centro, area e sponda del Tevere |
| `img/` | Il logo disegnato da Matteo: `logo.svg` e `logo-chiaro.svg` (1200×630), `gettone.svg`, `icona.svg`, i PNG per schede del browser e schermata Home, `anteprima.png` per i link condivisi, `logo.png` e `logo-chiaro.png` da usare altrove |
| `strumenti/logo.py` | Ridisegna gli SVG del logo con le misure del progetto di Matteo (gettone a pixel con segnaposto + scritte in Press Start 2P convertite in tracciati). I PNG sono esportazioni di quegli SVG |
| `manifest.webmanifest` | Nome e icone per "Aggiungi a schermata Home" |

Dopo aver aggiunto posti su Google Maps o modificato un file `.json`:

```bash
python3 strumenti/aggiorna_lista.py
```

## Pubblicazione

Questa cartella è pensata per essere la radice di un repository a sé (`scusa-non-stasera`).
Il workflow `.github/workflows/pubblica.yml` pubblica su GitHub Pages a ogni push su `main`
e ogni lunedì riscarica la lista da Google Maps: se è cambiata aggiorna `locali.js` e
`supabase/luoghi.sql` e ripubblica. Con i segreti `SUPABASE_URL` e `SUPABASE_SERVICE_KEY`
aggiorna anche i posti nel database. Serve *Settings → Pages → Source: GitHub Actions*.

### Descrizioni IN BREVE e posti chiusi

`in_breve.json` contiene le descrizioni brevi (chiave: nome del locale oppure il suo id). Quelle con l'id vengono da
una ricerca in rete fatta con assistenti automatici, con regole strette: una fonte per ogni descrizione, parole
proprie, niente giudizi, prezzi, orari o nomi di persone, campo vuoto se il locale non è identificato con certezza.
`tipi.json` (per id) corregge il tipo quando la ricerca lo ha accertato. `chiusi.json` elenca i posti che hanno chiuso:
restano nella lista di Google ma non compaiono sul sito.

**Il lunedì.** L'aggiornamento automatico di GitHub riscarica la lista e ci riattacca le descrizioni che ci sono già:
non se ne perde nessuna. Non sa però scriverne di nuove. Per i posti appena aggiunti c'è `strumenti/descrizioni.py`
(`stato`, `da-cercare`, `applica`): elenca chi è senza descrizione, controlla gli esiti di una ricerca e li salva.
Le regole e il giro completo sono in `strumenti/DESCRIZIONI.md`. I posti cercati senza trovare nulla sono segnati in
`descrizioni_tentate.json` e si riprovano dopo 120 giorni. Le chiusure non vengono mai applicate da sole.

### Monitoraggio: visite, clic e donazioni

`statistiche.html` (non è collegata dal gioco e non va nei motori di ricerca) mostra per prime le donazioni che
Matteo segna a mano copiandole da PayPal, con i tocchi sulle monete; sotto, quante volte il sito viene aperto, da
dove arrivano le visite e quali pulsanti si toccano. A chi non è entrato con l'email di chi gestisce il sito la
pagina mostra solo la richiesta di accesso: nessun numero e nessuna descrizione di che cosa c'è dentro.
L'esempio con numeri inventati (`?esempio`) funziona solo in prova sul proprio computer (localhost).

Il codice della pagina è pubblico come il resto del sito (sta nello stesso archivio su GitHub): a essere privati
sono i numeri, che il database consegna solo alle email nella tabella `amministratori`.

- **Come conta**: `js/app.js` chiama la funzione `conta` del database a ogni apertura e ai clic principali. Si salva
  solo un numero per giorno e per tipo di azione (`supabase/statistiche.sql`): niente cookie, niente indirizzi,
  niente nel browser. Chi ha acceso “non tracciare” non viene contato. Senza database non parte nessuna chiamata.
- **Chi legge**: solo le email elencate nella tabella `amministratori`, dopo l'accesso con il codice via email.
  La pagina in sé non contiene dati: i numeri arrivano dal database solo a chi è autorizzato.
- **Provenienza**: per distinguere i canali, condividi il sito come `ristomat.click/?da=instagram` (oppure
  `whatsapp`, `facebook`, `tiktok`, `telegram`, `google`, `qr`, `volantino`, `amici`).
- **Soldi**: il sito non vede i pagamenti. Le donazioni vere sono nell'attività di PayPal; in pagina si segnano
  a mano giorno e importo, mai il nome di chi ha donato.
- **Per accenderlo**: progetto Supabase → SQL Editor → `schema.sql`, poi `statistiche.sql`, poi una riga con la
  propria email in `amministratori`; infine URL e chiave pubblica in `config.js`. `conto: false` tiene spenti
  account e punti lasciando accesi i contatori; `statistiche: false` fa il contrario.
- **Prove**: `node strumenti/test_statistiche.mjs supabase/schema.sql supabase/statistiche.sql`.

### Donazioni

In `config.js`, `donazione` è il link della pagina dove ricevere una moneta (PayPal.Me). Se è vuoto non compare
nulla. Quando c'è, “Dona una moneta” compare, ben in vista: come voce del menu iniziale, in un riquadro in fondo
alla pagina, nel fumetto di ogni posto sulla mappa e nel risultato del gettone (un pulsante con il bordo d'oro). In più, toccando “Portami lì” si apre prima la finestra **Prima di andare**:
in cima il pulsante “Vai al posto” (che apre le indicazioni), sotto le monete. `monetaPrima` in `config.js`
decide quando: `"sempre"` (ogni volta), `"una"` (una volta per visita), `"mai"`. Vedi `LEGALE_E_SICUREZZA.md`.

### Indirizzo del sito: https://ristomat.click

Il dominio è registrato su Hostinger e collegato a GitHub Pages (Settings → Pages → Custom domain).
Il vecchio indirizzo `matteomonaco1996-code.github.io/scusa-non-stasera/` rimanda a questo.

### Se cambia l'indirizzo del sito

L'indirizzo compare per esteso in `index.html` (`og:url` e `og:image`, servono per l'anteprima dei link) e,
una volta attivato Supabase, tra gli indirizzi consentiti per l'accesso. Vanno aggiornati insieme.

## Limiti da sapere

- **Quartieri**: ogni posto va al quartiere col centro più vicino, sulla stessa
  sponda del Tevere. Il metodo è stato verificato sui locali che hanno il
  quartiere nel nome (50 su 53 coincidono; i 3 diversi citano un quartiere
  confinante). Ai confini può sbagliare: si corregge con `"q"` in `correzioni.json`.
- **Minuti a piedi**: stima in linea d’aria (+30% per le strade), non un percorso.
- **Tipo di locale**: dal nome o da `tipi.json`; 35 posti restano “Da scoprire”.
- **Niente orari di apertura**: la lista Google Maps non li fornisce.
- **IN BREVE**: 596 descrizioni scritte con l’aiuto dell’AI da informazioni pubbliche in rete. Circa 200
  (i posti più noti) sono state scritte a memoria e poi ricontrollate con una ricerca; le altre vengono da una
  ricerca con fonte. Non sono opinioni di Matteo e possono essere superate: vanno rilette. 57 posti restano senza
  descrizione perché in rete non si è trovato abbastanza: basta una nota di Matteo su Google Maps.
