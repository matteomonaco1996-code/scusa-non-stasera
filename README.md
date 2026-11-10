# Scusa, non stasera

**~~Scusa, non stasera.~~ ANZI SÌ!** Un sito in stile videogioco retrò per uscire
senza programmare. I posti sono i 673 della lista Google Maps **“RistoMat”** di
Matteo. Chi si registra fa punti con check-in e recensioni.

> Prima di andare online leggi **[LEGALE_E_SICUREZZA.md](LEGALE_E_SICUREZZA.md)**:
> elenca cosa è già fatto per sicurezza e GDPR e i passi che restano a te.

## Come si gioca

- **PREMI START**: usa il GPS del telefono (la posizione non esce dal browser) e
  mostra i posti in ordine di distanza, a fasce: *Sotto casa* (EASY, fino a 10
  minuti a piedi), *Due passi* (NORMAL, 10–25), *Vale il viaggio* (HARD).
- **SELEZIONA IL MONDO**: Roma, Firenze, Venezia, Milano, Bologna, Fuori porta.
- **LIVELLI**: a Roma ogni **quartiere** è un livello (38 quartieri in 5 aree:
  Centro, Sponda ovest, Nord, Est, Sud, più la Periferia). In fondo a ogni
  livello ci sono i 3 quartieri più vicini (*Prossimo livello*). Fuori porta i
  livelli sono le località con almeno 3 posti; le altre sono raggruppate per regione.
- **POWER-UP**: Come a casa · A tavola · Pizza, ovvio · Un calice · Due drink ·
  Dolce & caffè · Giro del mondo · Al volo · Sapore di mare · Brace & carne ·
  Spesa golosa · Da scoprire. In più c'è il filtro *Solo i consigli di Matteo*.
- **GETTONE**: pesca un posto a caso tra quelli vicini o del livello.
- **PLAYER 1** (con account): accesso con codice via email, check-in entro 150 m dal posto,
  recensioni (solo dopo un check-in), punti, livelli, badge, classifica facoltativa,
  esportazione e cancellazione dei propri dati.

## Punti

| Azione | Punti |
| --- | --- |
| Primo check-in in un posto | +10 |
| Check-in ripetuto in un altro giorno (max 5 per posto) | +2 |
| Primo posto in un quartiere o località nuovi | +20 |
| Recensione | +5, +10 se il testo ha almeno 80 caratteri |

Un livello ogni 100 punti. I punti sono calcolati solo dal database, non dal browser, e non danno premi.

## File

| File | Contenuto |
| --- | --- |
| `index.html` | La pagina (solo HTML: niente script inline, per la Content Security Policy) |
| `css/stile.css`, `js/app.js`, `js/conto.js` | Stile, gioco, account e punti |
| `config.js` | Indirizzo e chiave pubblica di Supabase (vuoti = account disattivati) |
| `privacy.html`, `termini.html` | Informativa privacy e termini d’uso (da completare con i tuoi dati) |
| `supabase/schema.sql` | Tabelle, regole di sicurezza e funzioni del database |
| `supabase/luoghi.sql` | Posti da caricare nel database (generato) |
| `vendor/`, `fonts/` | Leaflet, supabase-js e caratteri ospitati sul sito, con licenze |
| `locali.js` | Dati **generati**: non modificarli a mano |
| `tipi.json` | Tipo di locale per i posti il cui nome non lo dice |
| `correzioni.json` | Correzioni manuali (tipo `t`, quartiere `q`, città `c`, nota `nt`): vincono su tutto |
| `strumenti/aggiorna_lista.py` | Scarica la lista da Google Maps e rigenera `locali.js` |
| `strumenti/quartieri.py` | I quartieri di Roma: centro, area e sponda del Tevere |

Dopo aver aggiunto posti su Google Maps o modificato un file `.json`:

```bash
python3 strumenti/aggiorna_lista.py
```

## Pubblicazione

Il workflow `.github/workflows/pubblica.yml` pubblica su GitHub Pages a ogni push su `main` e ogni lunedì riscarica la lista da Google Maps: se è cambiata aggiorna `locali.js` e `supabase/luoghi.sql` e ripubblica. Con i segreti `SUPABASE_URL` e `SUPABASE_SERVICE_KEY` aggiorna anche i posti nel database.

## Limiti da sapere

- **Quartieri**: ogni posto va al quartiere col centro più vicino, sulla stessa
  sponda del Tevere. Il metodo è stato verificato sui locali che hanno il
  quartiere nel nome (50 su 53 coincidono; i 3 diversi citano un quartiere
  confinante). Ai confini può sbagliare: si corregge con `"q"` in `correzioni.json`.
- **Minuti a piedi**: stima in linea d’aria (+30% per le strade), non un percorso.
- **Tipo di locale**: dal nome o da `tipi.json`; 100 posti restano “Da scoprire”.
- **Niente orari di apertura**: la lista Google Maps non li fornisce.
