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

Esempi di stile:
- “Si mangia sotto un glicine secolare, accanto al tempio di Vesta e davanti alle cascate. In attività dal Settecento.”
- “In un palazzo medievale con la scala a chiocciola: la cucina dei pastori riletta oggi, tra ravioli di ricotta di pecora e agnello.”
- “Un calice nel centro storico: lunga carta dei vini, cocktail, taglieri di formaggi e focaccia.”
- Da evitare: “Ristorante di Tivoli con prodotti del territorio.” (vero, ma non dice perché andarci).

Quando Matteo detta lui una riga su un posto (“la numero 1 per la pizza romana”), quella **non** è un IN BREVE: è una
sua nota, firmata MATTEO, e va in `correzioni.json` nel campo `nt`. I giudizi sono suoi e solo suoi.

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
