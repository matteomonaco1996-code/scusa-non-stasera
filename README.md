# Scusa, non stasera

**~~Scusa, non stasera.~~ ANZI SÌ!** Un sito in stile videogioco retrò per uscire
senza programmare. I posti sono i 673 della lista Google Maps **“RistoMat”** di
Matteo. Chi si registra fa punti con check-in e recensioni.

> Prima di andare online leggi **[LEGALE_E_SICUREZZA.md](LEGALE_E_SICUREZZA.md)**:
> elenca cosa è già fatto per sicurezza e GDPR e i passi che restano a te.

## Come si gioca

- **LA VIGNETTA**: in cima c'è solo la scritta RISTOMAT. Sotto, tre battute: Gaia (personaggetto a sinistra)
  fa la domanda dell'ora; tu (personaggetto a destra) rispondi “Scusa, non stasera…” (barrato) e poi
  “Anzi sì! Portami fuori.”, che si tocca; infine il gettone, a nome di Ristomat, dice che cosa fa il sito e
  chiede “Da dove partiamo?”, proprio sopra le due scelte. Così l'intento si capisce dalla conversazione, senza
  un testo a parte. Dopo una ricerca il tuo fumetto dà il consiglio (“Anzi sì: … Ci vediamo lì?”).
  **L'entrata in scena** (dal 19 novembre 2026): all'apertura Gaia entra da sinistra e si apre il suo fumetto, poi
  entri tu da destra con il tuo, infine il gettone di Ristomat con la domanda; solo allora lampeggiano i due tasti.
  Dura poco più di due secondi (meno di cinque con il lampeggio), è fatta solo di trasformazioni nel foglio di
  stile (niente cambia posto nella pagina) e i due tasti si toccano dal primo istante. Si rifà quando la scena era
  coperta da una finestra e dopo un RESTART. Non parte con «riduci movimento» né nei browser che non sanno tagliare
  ciò che sporge di lato (`overflow: clip`, cioè Safari prima del 16): lì la scena è ferma, come prima.
  I due personaggi sono in `img/gaia.svg` e `img/tu.svg` e si ridisegnano con `strumenti/personaggi.py`
  (capelli, barba, occhiali e colori sono due righe in cima al file).
- **DA DOVE PARTIAMO?**: la prima scelta, subito sotto la vignetta, è
  tra due strade ben distinte: **VICINO A ME** (i posti a pochi minuti a piedi; chiede la posizione) e **SCELGO LA
  ZONA** (quartiere, città o fuori porta, senza posizione). Dal 19 novembre 2026 i due tasti hanno lo stesso peso
  (stesso fondo, nessuno evidenziato) e dicono prima che cosa ottieni e poi che cosa ti viene chiesto: nei primi
  due giorni di contatori metà dei tentativi di posizione non era arrivata, mentre la zona era la strada più usata.
  La battuta “Anzi sì! Portami fuori.” non apre più una finestra con le stesse due scelte: porta ai due tasti e
  li fa lampeggiare. Anche la finestra che si apriva da sola alla prima visita è stata tolta (vedi sotto, ATTIVA
  LA POSIZIONE): la domanda si fa in un posto solo. I due tasti hanno una cornice d'oro, che li stacca
  dai fumetti: quando la schermata d'apertura è libera (nessuna finestra sopra, niente ancora scelto) lampeggia per
  meno di cinque secondi, come «PREMI START», poi resta accesa; riparte dopo un RESTART. Dura poco apposta: un
  lampeggio continuo stanca chi legge e disturba chi è sensibile al movimento (con «riduci movimento» non parte).
- **VICINO A ME**: usa il GPS del telefono (la posizione non esce dal browser) e
  mostra i posti in ordine di distanza, a fasce: *Sotto casa* (EASY, fino a 10
  minuti a piedi), *Due passi* (NORMAL, 10–25), *Vale il viaggio* (HARD).
- **ATTIVA LA POSIZIONE**: la posizione si chiede solo quando tocchi VICINO A ME (o “Vicino a me” nel gettone),
  mai all’apertura. Fino al 19 novembre 2026, dopo i termini si apriva da sola una finestra «Da dove partiamo?»
  con le stesse due scelte dei tasti della pagina: è stata tolta perché copriva la scena d’apertura e veniva letta
  come una richiesta di posizione appena arrivati (il sito cancella dal browser la vecchia nota `sns-posizione`).
  La finestra resta per dopo il tocco: se la posizione è bloccata o spenta il sito non può riaccenderla, e
  mostra i passi per iPhone, Android o computer; la stessa guida compare dal gettone.
  Nel gettone, toccando “Vicino a me”, prima che il telefono chieda il permesso compare un avviso
  (“Posso usare la tua posizione?”): a che cosa serve, che cosa sta per succedere, dove finisce il dato, con
  “Sì, usa la posizione” e “No, scelgo io dove”. Non compare se il permesso è già dato o già rifiutato.
- **SELEZIONA IL MONDO**: Roma, Fuori porta, Firenze, Venezia, Milano, Bologna, Siena (dal 20 novembre 2026).
  Una città diventa un mondo aggiungendola all'elenco `CITTA` in `js/app.js` **e** in `strumenti/livelli_sql.py`
  (in fondo, così i numeri degli altri mondi non cambiano); poi `python3 strumenti/livelli_sql.py` e il file
  `supabase/livelli.sql` va eseguito sul database, altrimenti «Tutta <città>» finisce tra gli «Altri» nel
  monitoraggio. Vale solo per il comune: i posti della provincia restano in Fuori porta.
- **I TRE PASSI**: la pagina è in quest’ordine, e a ogni scelta scende da sola al passo dopo:
  **mondo → power-up → livello → posti**. Toccato un mondo si arriva al power-up; scelto il power-up (anche
  «Tutto») si arriva all’elenco dei livelli, oppure dritti ai posti se il mondo ha un livello solo o il livello
  è già scelto; scelto il livello si arriva ai posti. Ritoccare il power-up acceso lo spegne senza spostare la
  pagina. I numeri dei livelli (× N) contano solo i posti del power-up e della ricerca scelti: i livelli a zero
  sono spenti, nell’elenco e sulla mappa dei quartieri. A Roma la pagina arriva all’elenco dei livelli e non alla
  mappa dei quartieri, che resta appena sopra: riempie lo schermo e sembrava l’unico modo di scegliere.
  Sul telefono i power-up stanno su due colonne, con «Tutto» in cima a tutta larghezza: si vedono tutti insieme,
  senza scorrere di lato.
- **ZONE** (nel programma si chiamano ancora «livelli»): a Roma sono i **quartieri** (38 in 5 aree: Centro, Sponda
  ovest, Nord, Est, Sud, più la Periferia); fuori porta sono le **località** con almeno 3 posti, le altre sono
  raggruppate per regione. In fondo a ogni quartiere ci sono i 3 più vicini (*Quartieri vicini*).
  Dal 19 novembre 2026 a chi usa il sito la parola «livello» non si mostra più per i luoghi: un quartiere è un
  concetto geografico, «livello» fa pensare a difficoltà o progressione, e «Prossimo livello» faceva chiedere
  «rispetto a cosa?» (segnalato da chi ha provato il sito). Si legge «SCEGLI IL QUARTIERE» / «LA LOCALITÀ» / «LA
  ZONA», sulle tessere «QUARTIERE 6» (il numero è quello della mappa) o «LOCALITÀ», nella barra dove ci si trova
  («ROMA · CENTRO», «FUORI PORTA · LAZIO»). «Livello» resta solo per i livelli del giocatore (account, oggi spenti).
- **FILTRI** (dal 19 novembre 2026): un pulsante nella barra sopra i posti, sempre in vista, apre una finestra con
  gli stessi power-up (con i numeri) e il campo di ricerca. Serve a chi è già sui posti, soprattutto dopo
  «Vicino a me», dove i power-up della pagina restano cinque schermate più su. Scelto un tipo la finestra si
  chiude e la lista riparte dall'inizio, senza passare dalla scelta del livello; il pulsante diventa «FILTRI · 1»
  e in cima ai posti compare «Vedi solo … · Togli». INDIETRO toglie il filtro. Prova: `prove/sito/filtri.js`.
- **RICERCA LIBERA** (campo sotto i power-up): cerca in nome, indirizzo, quartiere, tipo, nota e descrizione. Dal
  19 novembre 2026, appena scrivi, sotto il campo compare quanti posti ha trovato («23 posti con «carbonara»») con
  il pulsante VEDI I POSTI, e Invio porta ai posti: prima la lista si aggiornava cinque schermate più giù e sembrava
  che la ricerca non funzionasse (segnalato da chi ha provato il sito).
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
| `js/comitiva.js`, `supabase/comitive.sql`, `img/facce/` | Comitive: tavoli di amici senza account (spente finché in `config.js` c’è `comitive: false`) |
| `config.js` | Indirizzo e chiave pubblica di Supabase (vuoti = account disattivati), link per la moneta, inviti accesi o spenti (`inviti`) |
| `privacy.html`, `termini.html` | Informativa privacy e termini d’uso (da completare con i tuoi dati) |
| `supabase/schema.sql` | Tabelle, regole di sicurezza e funzioni del database |
| `supabase/luoghi.sql` | Posti da caricare nel database (generato) |
| `supabase/statistiche.sql` | Contatori anonimi (visite e clic), chi può leggerli, donazioni segnate a mano |
| `statistiche.html`, `js/statistiche.js`, `css/statistiche.css` | Pagina di monitoraggio, riservata a chi gestisce il sito |
| `vendor/`, `fonts/` | Leaflet, supabase-js e caratteri ospitati sul sito, con licenze |
| `mappa/roma.js` | Strade e fiumi di Roma (© OpenStreetMap, ODbL), generati da `strumenti/mappa_osm.py` |
| `mappa/quartieri.js` | Le strade principali disegnate sotto la mappa dei quartieri: una versione leggera di `roma.js`, generata da `strumenti/strade_quartieri.py` (da rilanciare solo se cambiano `roma.js` o i quartieri) |
| `locali.js` | Dati **generati**: non modificarli a mano |
| `tipi.json` | Tipo di locale per i posti il cui nome non lo dice |
| `in_breve.json` | Descrizioni brevi (etichetta IN BREVE) per i posti senza una nota di Matteo (etichetta LA DRITTA, senza firma dal 21 novembre 2026): bozze da rileggere |
| `correzioni.json` | Correzioni manuali (tipo `t`, quartiere `q`, città `c`, nota `nt`): vincono su tutto |
| `prove/` | Prove automatiche del sito: `node prove/tutte.js` le lancia tutte (vedi `prove/LEGGIMI.md`). Non vengono pubblicate |
| `supabase/accesso_monitoraggio.sql`, `supabase/livelli.sql` | Chi può crearsi l'accesso alla pagina di monitoraggio; quartieri e località che si possono contare |
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

**Pagina non trovata** (`404.html`, dal 19 novembre 2026): a un indirizzo sbagliato il sito mostra una sua pagina con
il modo di tornare al gioco. I suoi collegamenti partono dalla radice (`/css/stile.css`, `/`) perché compare a
qualunque indirizzo, anche dentro una cartella. A tratti, proprio sugli indirizzi che non esistono, i server di
GitHub rispondono «503» (la loro pagina «Unicorn») invece di «404»: non dipende dal sito e le pagine vere non ne
risentono. La prova `prove/sito/vivo-file.js` in quel caso riprova, come chiede il server.

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
- **Quartieri e località**: ogni volta che viene scelto un quartiere, una località o «Tutta Roma» sale il suo
  numero del giorno (funzione `conta_livello`). I nomi ammessi stanno in `supabase/livelli.sql`, generato da
  `python3 strumenti/livelli_sql.py`: se nella pagina di monitoraggio cresce la voce «Altri», c'è una località
  nuova e il file va rigenerato ed eseguito sul database.
- **Chi legge**: solo le email elencate nella tabella `amministratori`, dopo l'accesso con email e password.
  L'accesso si crea una volta dalla pagina stessa («È la prima volta»): il primo che conferma la propria email
  diventa l'amministratore, poi le registrazioni si chiudono (`supabase/accesso_monitoraggio.sql`).
  La pagina in sé non contiene dati: i numeri arrivano dal database solo a chi è autorizzato.
- **Provenienza**: per distinguere i canali, condividi il sito come `ristomat.click/?da=instagram` (oppure
  `whatsapp`, `facebook`, `tiktok`, `telegram`, `google`, `qr`, `volantino`, `amici`).
- **Soldi**: il sito non vede i pagamenti. Le donazioni vere sono nell'attività di PayPal; in pagina si segnano
  a mano giorno e importo, mai il nome di chi ha donato.
- **Perché la posizione non arriva** (dal 19 novembre 2026): accanto a `posizione_no` si conta il motivo:
  `posizione_rifiutata` (la persona ha visto la richiesta e ha detto no), `posizione_bloccata` (il browser ha detto
  no senza chiedere: era già negata, oppure ha risposto in meno di 0,7 secondi) e `posizione_persa` (il telefono non
  l'ha trovata). `app_visita`, `app_posizione_si` e `app_posizione_no` contano le aperture dal browser interno di
  un'app (Instagram, Facebook, TikTok…), riconosciuto dal nome del browser, che non viene salvato. La distinzione
  tra «rifiutata» e «bloccata» è una stima fatta sul tempo di risposta, non una certezza.
- **Acceso dal 17 novembre 2026** (solo i contatori: `conto: false`). Stato e passi rimasti in `supabase/COLLEGARE.md`.
- **Per accenderlo**: progetto Supabase → SQL Editor → `schema.sql`, poi `statistiche.sql`, poi una riga con la
  propria email in `amministratori`; infine URL e chiave pubblica in `config.js`. `conto: false` tiene spenti
  account e punti lasciando accesi i contatori; `statistiche: false` fa il contrario.
- **Prove**: `node strumenti/test_statistiche.mjs supabase/schema.sql supabase/statistiche.sql supabase/livelli.sql` e
  `node strumenti/test_accesso.mjs supabase/statistiche.sql supabase/accesso_monitoraggio.sql`.

### Donazioni

In `config.js`, `donazione` è il link della pagina dove ricevere una moneta (PayPal.Me). Se è vuoto non compare
nulla. Quando c'è, “Dona una moneta” compare, ben in vista: come voce del menu iniziale, in un riquadro in fondo
alla pagina, nel fumetto di ogni posto sulla mappa e nel risultato del gettone (un pulsante con il bordo d'oro). In più, toccando “Portami lì” o “Apri su Maps” si apre prima la finestra **Prima di andare**:
in cima il pulsante per proseguire (“Vai al posto” oppure “Apri su Maps”), sotto le monete. `monetaPrima` in `config.js`
decide quando: `"sempre"` (ogni volta), `"una"` (una volta per visita), `"mai"`. Lo stesso riquadro con le monete
compare nella finestra “Proponilo”, sotto i pulsanti per mandare il messaggio (non con `"mai"`): lì non aggiunge
passaggi. Vedi `LEGALE_E_SICUREZZA.md`.

### Inviti: “Proponilo”

Su ogni scheda e nel risultato del gettone c'è “Proponilo”: apre una finestra con un messaggio pronto (“Stasera qui?
Enoteca Corsi, Pantheon. Ci stai?” più un link) da mandare con la condivisione del telefono, con WhatsApp o copiandolo.
Il link è `https://ristomat.click/?posto=<numero del posto>&m=<momento>&da=amici`: chi lo apre vede quel posto e può
rispondere “Ci sto!”, dire di no, o pescare un altro posto nella stessa zona e rimandarlo (“Meglio qui?”, con `&r=1`).
Il sito non riceve e non salva nulla: né messaggi né destinatari. `inviti: false` in `config.js` lo spegne.

### Comitive (spente: `comitive: false`)

Una comitiva è un tavolo di amici, fino a otto, **senza account**: un nome, chi è seduto (nome e faccia), i posti
da provare con un voto a testa, i posti fatti, e un “gettone di comitiva” che pesca solo posti non ancora in lista.
Si entra con un link (`?comitiva=<chiave>`); chi ha solo il link vede il nome e quanti sono a tavola. Sul telefono
resta una sola nota, `sns-comitiva`: il segreto del proprio posto. Nomi di comitiva e nomi a tavola sono **testo
libero** (corti, senza link, email o numeri): per questo nella pagina di monitoraggio c'è l'elenco dei nomi con il
tasto “Cancella”.

Per accenderle: database attivo, `supabase/comitive.sql` eseguito dopo `schema.sql` e `statistiche.sql`, privacy e
termini aggiornati (vedi `LEGALE_E_SICUREZZA.md`), poi `comitive: true` in `config.js`. Il codice è in
`js/comitiva.js`, che viene scaricato solo quando sono accese. Test: `strumenti/test_comitive.mjs`.

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
