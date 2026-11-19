# Collegare Supabase: che cosa fare, in ordine

Scritto il 17 novembre 2026 per chi (persona o sessione di Claude) accende il database del sito
**Scusa, non stasera · Ristomat** (https://ristomat.click, repository `matteomonaco1996-code/scusa-non-stasera`,
ramo `main`: ogni push pubblica il sito).

## Stato al 17 novembre 2026

- Progetto creato: `scusa-non-stasera`, ref `swjaorxphkfigqwgonqq`, Francoforte, piano gratuito
  (`https://swjaorxphkfigqwgonqq.supabase.co`). Fatto con il connettore Supabase di Claude.
- Nel database è stato eseguito **solo `statistiche.sql`** (non `schema.sql`, `luoghi.sql`, `comitive.sql`):
  per contare non servono, e ogni tabella o funzione in più è una porta in più da sorvegliare. Vanno eseguiti
  il giorno in cui si accendono account o comitive. Vale più di quanto dice il passo 2 qui sotto.
- Manca una funzione: `elimina_donazione` (toglie dalla pagina di monitoraggio una donazione segnata per errore).
  Contiene un `delete`, e il connettore chiede a Matteo una conferma che scade in un minuto: finora non è
  arrivata in tempo. Tutto il resto funziona senza.
- `config.js` ha l'indirizzo e la chiave pubblica, con `conto: false`.
- **Accesso alla pagina di monitoraggio: email e password**, non più il codice via email (il servizio di posta
  incluso in Supabase scrive solo ai membri dell'organizzazione e poche volte l'ora, e il connettore non arriva
  alle impostazioni delle email). È stato eseguito anche `accesso_monitoraggio.sql`: finché l'elenco
  `amministratori` è vuoto, il primo che conferma la propria email diventa l'amministratore; poi può registrarsi
  solo chi è in elenco. I passi 3 e 4 qui sotto non servono più.
- Accesso di Matteo alla pagina di monitoraggio: **creato** (al 19 novembre 2026 in `amministratori` c'è una riga).
  Si era fatto così: `statistiche.html`, «È la prima volta», email del suo account Supabase, password, link
  nell'email di conferma (la pagina che si apre dopo non si carica perché il Site URL del progetto è quello
  predefinito: la conferma vale lo stesso).
- **Quartieri scelti** (dal 17 novembre 2026): nel database ci sono anche `livelli_ammessi` e `contatori_livelli`
  (in `statistiche.sql`) e l'elenco dei nomi di `livelli.sql`. Quando compare una località nuova fuori Roma:
  `python3 strumenti/livelli_sql.py`, poi eseguire `livelli.sql` sul database.
- Se dimentica la password: dalla dashboard di Supabase, Authentication → Users, si cancella l'utente; poi si
  svuota `public.amministratori` e si rifà «È la prima volta».
- Il giorno in cui si accendono gli account del sito: `drop trigger solo_amministratori on auth.users;`
- Le prove automatiche non devono mai chiamare il database vero: gonfierebbero i contatori.

## Che cosa vuole Matteo, adesso

Solo **contare ingressi e clic** e leggerli nella pagina di monitoraggio (`statistiche.html`).
Account, punti, recensioni e comitive **restano spenti**. Matteo non è un tecnico: gli si parla in italiano
semplice, un passo alla volta.

## Regole che non si discutono

- La chiave `service_role` (o `secret`) non va **mai** nel sito, in un file del repository, in chat o in un registro.
  Nel sito va solo la chiave pubblica (`publishable` / `anon`).
- Nessuna password o token in chat: Matteo non li incolla, e non glieli si chiede.
- Regione del progetto: **Central EU (Frankfurt)**, `eu-central-1`. La privacy del sito lo dichiara: un'altra
  regione la renderebbe falsa.
- Piano gratuito. Se un'operazione ha un costo, ci si ferma e si chiede a Matteo.
- Niente pull request: si lavora su `main`. Niente force-push.

## Passi

1. **Progetto.** Se nell'organizzazione di Matteo non c'è già, crea il progetto `scusa-non-stasera` a Francoforte
   e aspetta che sia pronto. Se ce n'è già uno con quel nome, usa quello.
2. **Database.** Esegui, in quest'ordine, i file della cartella `supabase/`: `schema.sql`, `luoghi.sql`,
   `statistiche.sql`, `comitive.sql`. Si possono rieseguire senza danni. (`schema.sql` e `comitive.sql` creano
   tabelle che per ora restano inutilizzate: servono solo a non doverci tornare.)
3. **Chi può leggere i numeri.** Chiedi a Matteo con quale email vuole entrare nella pagina di monitoraggio, poi:
   `insert into public.amministratori (email) values (lower('<quella email>')) on conflict do nothing;`
4. **Accesso con il codice via email** (serve solo per la pagina di monitoraggio). In Authentication:
   - Site URL `https://ristomat.click/`; indirizzi consentiti `https://ristomat.click/` e `https://ristomat.click/**`;
   - codice (OTP) di 6 cifre, valido 600 secondi;
   - i modelli delle email *Magic Link* e *Confirm signup* devono contenere il codice `{{ .Token }}`, perché la
     pagina chiede di scrivere il codice e non usa il link. Testo proposto:
     oggetto «Il tuo codice per Scusa, non stasera», corpo
     `<h2>Scusa, non stasera</h2><p>Il tuo codice di accesso è:</p><p style="font-size:28px;letter-spacing:4px"><b>{{ .Token }}</b></p><p>Vale 10 minuti. Se non l'hai chiesto tu, ignora questa email.</p>`
   Se gli strumenti a disposizione non arrivano a queste impostazioni, guida Matteo nella dashboard di Supabase
   (Authentication → URL Configuration, e Authentication → Emails).
5. **Nel sito** (`config.js`): `supabaseUrl` = `https://<ref>.supabase.co`, `supabaseKey` = chiave pubblica,
   **`conto: false`**, `statistiche: true`, `comitive: false`. Nient'altro.
6. **Prove prima di pubblicare.**
   - `node strumenti/test_statistiche.mjs supabase/schema.sql supabase/statistiche.sql` (database di prova in locale);
   - dal sito in locale, con la configurazione nuova: aprire la pagina deve far partire una chiamata a
     `/rest/v1/rpc/conta` che risponde 204, e in `public.contatori` deve comparire la riga del giorno
     (`visita`); un tocco su GETTONE deve aggiungere `gettone`;
   - nessun errore in console; con `conto: false` non deve comparire «PLAYER 1» né nulla sugli account.
7. **Pubblica**: commit e push su `main`, poi controlla che `https://ristomat.click/config.js` abbia l'indirizzo nuovo
   e che una visita vera faccia salire il contatore.
8. **Pagina di monitoraggio**: Matteo apre `https://ristomat.click/statistiche.html`, scrive la sua email, riceve
   il codice e lo inserisce. Il servizio email incluso in Supabase manda pochissime email l'ora: per un solo
   amministratore basta, ma se il codice non arriva si aspetta qualche minuto prima di richiederlo.
9. **Dopo**: aggiorna `README.md` (sezione sul monitoraggio) e `LEGALE_E_SICUREZZA.md` con la data di accensione.
   In `LEGALE_E_SICUREZZA.md` c'è anche l'elenco di ciò che Matteo deve fare lui (per esempio firmare il DPA di
   Supabase): ricordaglielo.

## Che cosa NON fare

- Non accendere account (`conto: true`) o comitive (`comitive: true`): prima vanno aggiornati privacy e termini,
  come spiega `LEGALE_E_SICUREZZA.md`.
- Non cambiare privacy e termini: i contatori anonimi sono già descritti nella privacy (versione 1.5).
- Non toccare `locali.js`, `in_breve.json`, `tipi.json`, `correzioni.json`, `chiusi.json`: sono i dati dei posti.

## Che cosa viene contato

Un numero per giorno e per tipo di azione, senza cookie e senza dati personali: visite e provenienza
(`?da=instagram` e simili), termini accettati, START, gettone, scelta del livello, scelta del tipo di posto e
apertura dei filtri (dal 19 novembre 2026), posizione concessa o negata (dal 19 novembre anche il perché:
`posizione_rifiutata`, `posizione_bloccata`, `posizione_persa`), aperture dal browser interno di un'app
(`app_visita`, `app_posizione_si`, `app_posizione_no`),
«Portami lì», indicazioni aperte, «Apri su Maps», monete, inviti («Proponilo» e risposte). L'elenco completo è in
`eventi_ammessi()` dentro `supabase/statistiche.sql`. Chi ha acceso «non tracciare» nel browser non viene contato.
