# Sicurezza, GDPR e obblighi: cosa è fatto e cosa devi fare tu

> Questo documento e i testi di `privacy.html` e `termini.html` sono una base scritta con cura
> ma **non sono una consulenza legale**. Prima di aprire le registrazioni al pubblico falli
> rileggere da un avvocato o da un consulente privacy, soprattutto per le recensioni di
> attività commerciali (rischio diffamazione) e per gli utenti tra 14 e 17 anni.

## 1. Già fatto nel codice

**Privacy by design**
- Senza account il sito non raccoglie nulla: niente analytics, niente cookie di terze parti, niente banner.
- Caratteri e librerie ospitati sul sito: nessuna chiamata a Google Fonts o CDN all’apertura.
- Sfondo della mappa (CARTO) spento finché l’utente non lo accende; scelta ricordata e revocabile.
- Posizione GPS: usata nel browser; inviata al server solo al check-in, confrontata e scartata.
  Nel database restano solo posto + giorno (`visite.giorno`, nessuna ora, nessuna coordinata).
- Registrazione minima: email (solo login), nickname, conferma 14+ anni, versioni dei documenti accettati.
- Classifica pubblica solo con consenso esplicito (casella non pre-spuntata, revocabile).
- Diritti self-service: **Esporta i miei dati** (JSON) ed **Elimina account** (cancellazione a cascata).
- Pulizia automatica (da attivare, vedi sotto): account inattivi 24 mesi, iscrizioni incomplete 30 giorni, segnalazioni chiuse 12 mesi.

**Sicurezza**
- Content Security Policy: il browser esegue solo i file del sito; niente script o stili inline.
- `referrer` disattivato; link esterni con `noopener noreferrer`; tutto il testo degli utenti è “escaped”.
- Database con Row Level Security su ogni tabella, permessi revocati e riaperti uno per uno:
  ognuno legge solo i propri dati; punti e visite si scrivono **solo** tramite funzioni del server,
  che verificano distanza (≤ 150 m), limiti (15 check-in e 10 recensioni al giorno) e regole.
- Recensioni possibili solo dopo un check-in nel posto; lunghezza massima 600 caratteri.
- Nickname validati (3–20 caratteri sicuri); niente password (accesso con codice monouso).
- La chiave nel browser è quella pubblica (`anon`): senza le regole del database non apre nulla.
- Tutte queste regole sono verificate da test automatici (33 controlli) su un vero Postgres.

**Altri obblighi coperti**
- DSA (Reg. UE 2022/2065): punto di contatto, regole chiare, pulsante “Segnala”, procedura con
  motivazione delle decisioni e possibilità di contestarle (`termini.html#segnalazioni`).
- Recensioni (Direttiva Omnibus, D.lgs. 26/2023): spiegato come vengono verificate (check-in GPS).
- Concorsi a premi (DPR 430/2001): **non applicabile** finché i punti non danno premi. Se un giorno
  vuoi dare sconti, omaggi o buoni, serve prima una verifica con un consulente.
- Licenze: dati © OpenStreetMap (ODbL) citati; licenze dei componenti in `vendor/LICENZE.md`.
- Trasparenza sui contenuti: le descrizioni “IN BREVE” sono dichiarate nel sito come scritte con l’aiuto
  dell’intelligenza artificiale e sono distinte dalle note personali (MATTEO) e dalle recensioni degli utenti.
  Rileggile in `in_breve.json`: di un’informazione sbagliata su un locale risponde chi pubblica il sito.

## 2. Da fare prima di andare online (obbligatorio)

1. **Dati del titolare**: nome, email e data sono già in `privacy.html` e `termini.html`
   (Matteo Monaco, Matteo-m96@hotmail.it). Prima di attivare gli account scrivi in `privacy.html`
   il nome del fornitore delle email. Valuta un’email dedicata al progetto: questa è pubblica.
2. **Crea il progetto Supabase** (supabase.com) scegliendo la regione **Central EU (Frankfurt)**.
3. **Firma il DPA** di Supabase (Data Processing Addendum): lo trovi nella dashboard tra i documenti legali dell’organizzazione o partendo da supabase.com/legal/dpa.
4. **Database**: SQL Editor → incolla `supabase/schema.sql` → Run; poi `supabase/luoghi.sql` → Run.
5. **Auth** (Authentication → Providers / URL Configuration / Email Templates):
   - lascia attivo solo il provider **Email**; disattiva gli altri;
   - Site URL e Redirect URLs = l’indirizzo del sito (`https://ristomat.click/`);
   - template “Magic Link” in italiano con il codice `{{ .Token }}` (il sito chiede il codice);
   - scadenza OTP 10 minuti.
6. **Email**: il servizio email incluso in Supabase è solo per prove (pochissimi invii l’ora).
   Configura un SMTP con server in UE (es. Brevo o Mailjet) in Authentication → SMTP,
   firma anche il suo DPA e scrivi il nome del fornitore in `privacy.html`.
7. **Pulizia automatica**: Database → Extensions → attiva `pg_cron`, poi esegui il blocco
   commentato in fondo a `schema.sql` (togliendo i `--`).
8. **Collega il sito**: in `config.js` metti *Project URL* e chiave **anon public**.
   **Mai** la chiave `service_role` nel sito.
9. **GitHub Pages**: repository pubblico, Settings → Pages → Source: GitHub Actions,
   spunta **Enforce HTTPS**. Facoltativo: Settings → Secrets → `SUPABASE_URL` e
   `SUPABASE_SERVICE_KEY` per aggiornare ogni lunedì anche i posti nel database.
10. **Prova tutto** con un tuo account: accesso, nickname, check-in vicino e lontano,
    recensione, segnalazione, classifica, esporta dati, elimina account.

### Dominio personalizzato (se lo compri)

Il sito resta su GitHub Pages: cambia solo l’indirizzo. L’ordine conta, per non lasciare aperta
la possibilità che qualcun altro agganci un proprio sito al tuo dominio.

1. **Venditore**: account con password unica e verifica in due passaggi, rinnovo automatico attivo,
   blocco del trasferimento attivo. Per un `.it` intestato a persona fisica **non dare il consenso**
   alla pubblicazione dei dati nel WHOIS (è facoltativo).
2. **Verifica il dominio su GitHub** (impostazioni dell’account → Pages → *Add a domain*): GitHub dà
   una riga TXT da aggiungere nel DNS del venditore. Fallo per primo.
3. **Repository → Settings → Pages → Custom domain**: scrivi il dominio e salva.
4. **Solo ora il DNS**: quattro righe `A` per il dominio (185.199.108.153, 185.199.109.153,
   185.199.110.153, 185.199.111.153) e una riga `CNAME` per `www` verso `<utente>.github.io`.
   Togli le righe di “parcheggio” messe dal venditore. Niente righe jolly (`*`).
5. Quando GitHub ha emesso il certificato, spunta **Enforce HTTPS**.
6. **Email**: il dominio non spedisce posta, quindi dichiaralo, così nessuno può spedire a suo nome:
   TXT su `@` = `v=spf1 -all` e TXT su `_dmarc` = `v=DMARC1; p=reject;`. Quando configurerai
   l’SMTP per i codici di accesso, queste due righe andranno sostituite con quelle del fornitore.
7. **Nel sito**: aggiorna `og:url` e `og:image` in `index.html` e, in Supabase, Site URL e Redirect URLs.
8. **Se un giorno lasci scadere il dominio**: prima togli il dominio da GitHub Pages e le righe DNS.

### Donazioni: la moneta “Dona una moneta” (attiva dall’11 novembre 2026)

Il link in `config.js` (`donazione`) porta a PayPal.Me. Il sito non tratta pagamenti né dati di pagamento:
la moneta apre una finestra con gli importi (1, 2, 5 € o libero) e poi la pagina di PayPal in una nuova scheda.

**Già fatto nel sito**
- Finestra con le informazioni prima di uscire verso PayPal: a chi va la somma, che è un regalo facoltativo, che
  non siamo un ente benefico, che serve la maggiore età. Che non si riceve nulla in cambio (né punti né altri
  vantaggi) non è più ripetuto nella finestra: resta scritto nei termini, punto 8, a cui la finestra rimanda.
  Se un giorno si accendono account e punti, conviene rimetterlo in una riga, perché lì il dubbio può nascere.
- `termini.html` (punto 8, versione 1.1) e `privacy.html` (ora versione 1.4) aggiornati; i dati che arrivano da PayPal
  (nome, email, importo, messaggio) sono nel registro dei trattamenti dell’informativa.
- Nessun vantaggio nel gioco per chi dona.
- **Prima di andare** (dall’11 novembre 2026): toccando “Portami lì” si apre una finestra che ricorda la moneta.
  Il primo pulsante è “Vai al posto”, quindi nessuno resta bloccato e si prosegue senza donare; Esc e “Chiudi”
  funzionano. Resta però un passaggio in più a ogni posto: se dà fastidio, in `config.js` metti
  `monetaPrima: "una"` (una volta per visita) oppure `"mai"`. Non renderlo mai obbligatorio e non nascondere
  “Vai al posto”: un invito a donare che ostacola il servizio diventa una pratica scorretta verso chi usa il sito.

### Inviti: “Proponilo” (dal 12 novembre 2026)

- Su ogni scheda e dopo il gettone c’è “Proponilo”: prepara un messaggio (“Stasera qui?”, il nome del posto, un link)
  che l’utente manda da sé con la condivisione del telefono, WhatsApp o copia e incolla. Chi apre il link vede il
  posto e può rispondere “Ci sto!”, rifiutare o proporne un altro.
- **Il sito non riceve nulla**: né il messaggio, né il destinatario, né la risposta. Nel link ci sono solo il numero
  del posto e il momento della giornata. Per questo non servono account, moderazione o nuovi trattamenti di dati:
  è spiegato in `privacy.html` (versione 1.5, sezione “Proporre un posto a qualcuno”).
- Nel link **non si può scrivere testo libero** (nomi, messaggi): è voluto, così nessuno può far comparire sul sito
  frasi scritte da lui. Se in futuro si vuole aggiungere “da parte di…”, va ripensato questo punto.
- Per spegnerlo: `inviti: false` in `config.js`. I pulsanti spariscono e i vecchi link aprono il sito normale.


**Da fare tu (non si risolve dal codice)**
1. **Fisco**: ricevere denaro dal pubblico può essere reddito da dichiarare. Conta la sostanza: una somma data
   senza nulla in cambio è una cosa, un compenso “per il servizio” un’altra; se diventa abituale può servire la
   partita IVA. **Parlane con un commercialista** e tieni traccia di quanto ricevi.
2. **Regole di PayPal**: PayPal distingue le donazioni dai trasferimenti tra amici e familiari e applica una
   commissione (3,40% più una quota fissa). Leggi le “Regole sull’utilizzo consentito” di PayPal e verifica che il
   tuo tipo di conto vada bene per ricevere donazioni dal pubblico; in dubbio, chiedilo a PayPal.
3. **Indirizzo del gestore**: se il sito viene considerato un’attività economica, la legge sul commercio
   elettronico (D.Lgs. 70/2003, art. 7) chiede di indicare anche un indirizzo fisico, non solo nome ed email.
   Con le donazioni questo argomento si rafforza. Non è stato inserito: decidi con un professionista.
4. **Rimborsi**: nei termini c’è l’impegno a restituire entro 14 giorni le donazioni fatte per errore.

### Contatori anonimi e pagina di monitoraggio

Per sapere quante visite riceve il sito non si usano servizi esterni né cookie: il sito aggiunge uno a un
contatore del giorno nel database (visite, clic principali, provenienza per categoria). Non si salvano
indirizzi IP, identificativi o legami con gli account, e chi ha acceso “non tracciare” non viene contato.
Per questo **non serve un banner dei cookie**; l'informativa (versione 1.3) lo spiega nella sezione
“Contatori anonimi”.

Da ricordare:
- i contatori contano le aperture, non le persone; chiunque potrebbe farli salire a mano: sono indicativi;
- `statistiche.html` è leggibile solo dalle email nella tabella `amministratori`: non aggiungerne altre senza motivo;
- le donazioni si segnano con giorno e importo soltanto: i nomi di chi dona restano in PayPal;
- se un giorno vuoi sapere *quante persone* (non quante aperture) servono identificativi nel browser: a quel punto
  cambia il quadro legale (consenso e banner) e va rifatta la valutazione.

### Accettazione dei termini

Alla prima visita, e quando cambia `versioneTermini` in `config.js`, compare una finestra in basso: finché non
si preme “Accetto i termini” il gioco non parte. Nel browser si salva solo la versione accettata (`sns-termini`).
Non è un banner per i cookie: il sito non usa cookie di tracciamento, quindi quel consenso non serve.
Quando cambi termini o informativa in modo importante, alza i numeri di versione in `config.js` e nelle due pagine.

## 3. Da fare nel tempo

- **Segnalazioni**: almeno una volta a settimana guarda Table Editor → `segnalazioni` con
  `gestita` vuoto. Per rimuovere: in `recensioni` metti `stato = 'nascosta'`; in `segnalazioni`
  compila `esito`, `motivazione_esito`, `gestita`. Scrivi all’autore (email da Authentication → Users)
  il motivo e come contestare. Tieni la traccia: serve a dimostrare la diligenza.
- **Richieste privacy** via email: rispondi entro 30 giorni. Prima verifica che chi scrive sia
  davvero il titolare dell’account (es. rispondendo dall’email registrata).
- **Violazioni di dati** (accessi non autorizzati, chiave service_role esposta, ecc.): valuta il
  rischio e, se c’è, notifica al Garante entro 72 ore (servizio online sul sito del Garante);
  annota comunque l’accaduto in un registro interno. Ruota subito le chiavi in Supabase.
- **Aggiornamenti**: una volta ogni qualche mese aggiorna supabase-js e Leaflet (`vendor/`).
- **Backup**: controlla quali backup offre il tuo piano Supabase; se non ce ne sono,
  esporta il database periodicamente (Database → Backups o `pg_dump`).

## 4. Registro dei trattamenti (modello)

Una persona fisica senza dipendenti non è sempre obbligata (art. 30.5 GDPR), ma qui il
trattamento è continuativo: tieni questo registro aggiornato.

| Trattamento | Dati | Interessati | Base giuridica | Destinatari | Extra UE | Conservazione | Misure |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Account e accesso | email, nickname, 14+, versioni documenti, date | utenti registrati | contratto | Supabase, fornitore SMTP | SCC (supporto Supabase) | fino a cancellazione o 24 mesi di inattività | RLS, OTP, HTTPS |
| Gioco (visite, punti) | posto, giorno | utenti registrati | contratto | Supabase | come sopra | come l’account | scrittura solo via funzioni server |
| Recensioni pubbliche | voto, testo, nickname | utenti registrati | contratto | pubblico | — | fino a cancellazione | moderazione, limiti |
| Classifica | nickname, punti | utenti che aderiscono | consenso | pubblico | — | fino a revoca | opt-in |
| Moderazione (DSA) | segnalazioni, decisioni | segnalanti, autori | obbligo legale | — | — | 12 mesi dopo la decisione | accesso solo admin |
| Log del sito | IP, user agent | visitatori | legittimo interesse | GitHub | DPF | secondo GitHub | — |

## 5. Valutazione d’impatto (DPIA): perché non è obbligatoria, oggi

Il check-in tratta un dato di posizione, ma in modo puntuale, su richiesta dell’utente, senza
tracciamento continuo e senza conservare coordinate o orari. Non c’è profilazione né decisioni
automatizzate, e la scala è piccola. Se in futuro aggiungessi tracciamento continuo, premi,
pubblicità o analisi dei comportamenti, rifai questa valutazione.

## 6. Limiti noti

- GitHub Pages non permette di impostare header HTTP (es. `frame-ancestors` contro il clickjacking,
  `Permissions-Policy`). La CSP è nel meta tag. Per header completi pubblica tramite
  Cloudflare Pages o Netlify, o metti Cloudflare davanti al dominio.
- La posizione GPS si può falsificare: i punti sono un gioco, non una prova di presenza.
- Le recensioni sono verificate dal check-in, non dall’acquisto.
