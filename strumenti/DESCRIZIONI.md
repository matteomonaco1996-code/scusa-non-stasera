# Le descrizioni “IN BREVE”: regole e giro del lunedì

Ogni posto del sito mostra, in quest’ordine: la **nota di Matteo** (se c’è, viene dalla lista di Google Maps),
altrimenti la descrizione **IN BREVE** (da `in_breve.json`), altrimenti niente.

Le descrizioni già scritte **non si perdono mai**: l’aggiornamento del lunedì riscarica solo l’elenco dei posti
e ci riattacca sopra `in_breve.json`. Quello che l’aggiornamento automatico di GitHub **non** sa fare è scriverne
di nuove: per i posti appena aggiunti alla lista serve una ricerca in rete. Questo file dice come farla.

## Il giro (ogni lunedì, dopo l’aggiornamento della lista)

```bash
git pull
python3 strumenti/aggiorna_lista.py            # riscarica la lista (se GitHub l’ha già fatto, non cambia nulla)
python3 strumenti/descrizioni.py stato
python3 strumenti/descrizioni.py da-cercare > /tmp/da_cercare.json
#  … ricerca in rete, un posto alla volta, e scrittura di /tmp/esiti.json (formato qui sotto) …
python3 strumenti/descrizioni.py applica /tmp/esiti.json --prova   # guarda che cosa farebbe
python3 strumenti/descrizioni.py applica /tmp/esiti.json
python3 strumenti/aggiorna_lista.py            # rigenera locali.js con le descrizioni nuove
git add in_breve.json tipi.json descrizioni_tentate.json locali.js supabase/luoghi.sql
git commit -m "Descrizioni IN BREVE per i posti nuovi"
git push                                       # la pubblicazione parte da sola
```

Se `da-cercare` restituisce un elenco vuoto non c’è niente da fare: non si scrive e non si pubblica nulla.

## Come cercare

- **Una ricerca per posto**, scritta bene al primo colpo: `"<nome>" <via o zona> <città>`.
- **Verifica che sia lo stesso locale**: stessa città e stessa via. Se la via non compare ma il nome è particolare
  e la fonte lo colloca nello stesso quartiere, va bene con `confidenza: "media"`. Un omonimo altrove non vale.
- Se il “nome” è un indirizzo, un segnaposto o è vuoto: non cercare, lascia vuoto con `confidenza: "bassa"`.
- Se una ricerca viene rifiutata per limite d’uso, ci si ferma lì: non si insiste e non si aggira il limite.
  I posti rimasti si riprovano la volta dopo.
- **Non inventare mai nulla.** Un campo vuoto è sempre meglio di un dato incerto.

## Che cosa scrivere per ogni posto (`esiti.json` è un elenco di questi oggetti)

```json
{
  "id": "…copiato dall’elenco…",
  "tipo": "trattoria|ristorante|pizza|vino|bar|dolce|mondo|street|pesce|carne|bottega",
  "breve": "",
  "chiuso": "no|si|forse|ignoto",
  "prova_chiusura": "",
  "confidenza": "alta|media|bassa",
  "fonti": ["https://…", "https://…"]
}
```

### `tipo`
trattoria = cucina di casa, osteria · ristorante = ristorante in genere, cucina d’autore · pizza = pizzeria (anche al
taglio) · vino = enoteca, wine bar · bar = cocktail bar, pub, birreria · dolce = pasticceria, gelateria, caffetteria ·
mondo = cucina straniera (la cucina regionale italiana **non** è “mondo”) · street = cibo da strada, panini, supplì ·
pesce · carne = griglieria, braceria · bottega = alimentari, gastronomia, forno, mercato. Nel dubbio, lascia il tipo
che c’è.

### `breve`
- In italiano, **una o due frasi, al massimo 150 caratteri**, senza punto esclamativo.
- **Tono vivo ma vero** (Matteo non vuole righe da elenco telefonico): si parte da ciò per cui ci si va — un piatto,
  il posto, un dettaglio che resta in mente — e poi si dice che locale è. Il gancio deve essere un fatto, non un complimento.
- **Parole proprie**: non copiare né parafrasare da vicino recensioni, guide o siti.
- Niente giudizi (“il migliore”, “imperdibile”, “ottimo”), niente prezzi, niente orari, niente voti o stelle,
  niente nomi di persone, niente critiche.
- Solo fatti che compaiono in almeno una fonte affidabile (sito del locale, guide, giornali, più recensioni concordi).
- Se non si trova abbastanza, o non è certo che sia quel locale: `"breve": ""`.

**La voce (dal 21 novembre 2026).** Matteo ha voluto tutte le descrizioni in una voce più viva e asciutta, «un po’
cinica»: quel giorno sono state riscritte tutte. La regola per quelle nuove:
- l’ironia sta **nel modo di dirlo**: sul nome del posto, sul genere, su chi legge («vegetariani avvisati», «il mare
  non è compreso», «il nome mente a metà»);
- **mai in un giudizio sul locale**: per questi posti non c’è un’opinione di Matteo, ci sono solo fatti trovati in rete.
  Una frecciata che afferma un difetto (caro, lento, turistico) sarebbe un giudizio inventato: non si scrive, a meno che
  non sia un fatto già documentato («spesso c’è fila», «conto importante»);
- la battuta è una, in fondo, e corta. Se non viene, la descrizione resta asciutta: meglio niente che una forzata;
- non ripetere sempre la stessa mossa (su 629 descrizioni, «Il nome…» c’è già una ventina di volte).

Esempi di stile:
- “Il nome dice già tutto: in via Tuscolana si viene per la carne. Tanti tagli, provenienze diverse, vegetariani avvisati.”
- “Via del Boschetto, sotto la vecchia insegna Peroni. Fuori Monti è cambiata, qui dentro no.”
- “All’Esquilino, famosa per due cose: la carbonara e la cacio e pepe mantecata nella forma di pecorino. Il resto del menu è lì per educazione.”
- “Spagna in Corso di Francia, con un’aria da Ibiza: paella, pimientos del piquillo e carni alla griglia. Il mare non è compreso.”

Esempi della voce di prima (ancora validi come fatti e come gancio):
- “Si mangia sotto un glicine secolare, accanto al tempio di Vesta e davanti alle cascate. In attività dal Settecento.”
- “In un palazzo medievale con la scala a chiocciola: la cucina dei pastori riletta oggi, tra ravioli di ricotta di pecora e agnello.”
- “Un calice nel centro storico: lunga carta dei vini, cocktail, taglieri di formaggi e focaccia.”
- Da evitare: “Ristorante di Tivoli con prodotti del territorio.” (vero, ma non dice perché andarci).

Quando Matteo detta lui una riga su un posto (“la numero 1 per la pizza romana”), quella **non** è un IN BREVE: è una
sua nota e va in `correzioni.json` nel campo `nt`. I giudizi sono suoi e solo suoi.

### Le note di Matteo: «LA DRITTA» (regole dal 21 novembre 2026)
- **Senza firma**: sul sito compaiono con l’etichetta LA DRITTA, non più MATTEO.
- **Voce alternativa, ironica, parlata**, sul modello della nota del Goccetto: una battuta su chi ci trovi o
  sull’aria che tira, come si usa davvero il posto, il trucco che non ti dice nessuno. Corta: intorno ai 140 caratteri.
- **Pungente quanto serve.** Il 21 novembre 2026 Matteo aveva chiesto «sempre in positivo», poi ci ha ripensato
  il giorno stesso: le note gli piacciono come quelle del Grottino, della Rosetta e di LORE, con la frecciata e
  l’avviso detti chiari («il conto lo sa», «mettiti l’anima in pace»). Sono posti scelti, quindi la nota dice
  comunque perché andarci; ma non deve per forza addolcire. Quelle tre sono il modello, insieme al Goccetto.
- **La sostanza la dà Matteo** (anche cinque parole buttate lì); chi lo aiuta può dare la forma, non inventare
  giudizi né fatti. Una battuta aggiunta va fatta approvare.
- Niente frecciate a persone (titolari, camerieri); un fatto negativo si scrive solo se è vero e l’ha visto lui.

### «LA CANZONE» (in prova dal 23 novembre 2026)
Matteo vuole associare una canzone ad alcuni posti: serve a rendere Ristomat **riconoscibile, come la dritta**, non ad
aiutare a scegliere. Sul sito è una riga con la sua etichetta, subito sotto LA DRITTA (o sotto IN BREVE), ovunque
compaia la nota: scheda, fumetto sulla mappa, gettone, invito.
- **La canzone la sceglie Matteo**, come i giudizi delle note: chi lo aiuta può proporre, non decidere.
- Si scrive in `correzioni.json`, sotto il nome del posto: `"mu": "Titolo · Artista"` (al massimo 80 caratteri; il sito
  mette il titolo sulla prima riga e l’artista sotto, dividendo all’ultimo « · »).
- Facoltativo: `"ml": "https://…"`, il link per ascoltarla. Vale solo per Spotify, Apple Music e YouTube
  (`open.spotify.com`, `music.apple.com`, `music.youtube.com`, `www.youtube.com`, `youtu.be`): con il link la riga si
  tocca e mostra «▶ ASCOLTA», senza link si legge soltanto.
- **Niente player dentro la pagina**: il sito non carica nulla da servizi esterni (regola di sicurezza in `index.html`
  e impegno scritto nella privacy: nessun cookie di terze parti, quindi nessun banner).
- **Prima di pubblicare la prima canzone con un link**: aggiungere alla privacy una riga sui link ai servizi musicali,
  come quella che c’è già per Google Maps.
- I tocchi su «ASCOLTA» per ora non si contano.

### `chiuso`
- `"si"` solo con una prova chiara e recente di **chiusura definitiva** (scheda che dice “chiuso definitivamente”,
  articolo che la annuncia, sito ufficiale). In `prova_chiusura` che cosa e quando; l’indirizzo della fonte in `fonti`.
- `"forse"` con indizi ma senza prova (una sola recensione, un altro locale allo stesso indirizzo, un trasferimento).
- `"no"` con segni chiari di attività recente; `"ignoto"` se non emerge nulla.
- Ferie e ristrutturazioni non sono chiusure.

**Le chiusure non si applicano mai da sole.** `descrizioni.py applica` le elenca soltanto: decide Matteo, che può
togliere il posto dalla lista di Google Maps oppure farlo aggiungere a `chiusi.json`.

### `confidenza` e `fonti`
`alta` = locale identificato con certezza e fatti confermati · `media` = identificato, pochi dettagli ·
`bassa` = identificazione dubbia o niente trovato (allora `breve` resta vuoto).
`fonti`: da 1 a 3 indirizzi delle pagine usate davvero.

## Che cosa non si tocca
- Le note di Matteo e le descrizioni che ci sono già (lo script le protegge comunque).
- `chiusi.json`, i testi legali, il codice del sito: il giro del lunedì riguarda solo le descrizioni dei posti nuovi.
