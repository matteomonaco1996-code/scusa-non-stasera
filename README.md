# Scusa, non stasera

**~~Scusa, non stasera.~~ ANZI SÌ!** Un sito in stile videogioco retrò per uscire
senza programmare. I posti sono i 673 della lista Google Maps **“RistoMat”** di
Matteo.

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

## File

| File | Contenuto |
| --- | --- |
| `index.html` | La pagina (HTML, CSS, JavaScript) |
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

Il workflow `.github/workflows/pubblica.yml` pubblica su GitHub Pages a ogni push su `main` e ogni lunedì riscarica la lista da Google Maps: se è cambiata aggiorna `locali.js` e ripubblica.

## Limiti da sapere

- **Quartieri**: ogni posto va al quartiere col centro più vicino, sulla stessa
  sponda del Tevere. Il metodo è stato verificato sui locali che hanno il
  quartiere nel nome (50 su 53 coincidono; i 3 diversi citano un quartiere
  confinante). Ai confini può sbagliare: si corregge con `"q"` in `correzioni.json`.
- **Minuti a piedi**: stima in linea d’aria (+30% per le strade), non un percorso.
- **Tipo di locale**: dal nome o da `tipi.json`; 100 posti restano “Da scoprire”.
- **Niente orari di apertura**: la lista Google Maps non li fornisce.
