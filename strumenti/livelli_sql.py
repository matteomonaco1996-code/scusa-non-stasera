#!/usr/bin/env python3
"""Elenco dei quartieri e delle località che il sito può contare (supabase/livelli.sql).

Il sito conta quante volte viene scelto ogni quartiere o località. Per non far entrare nel database testo scritto
da fuori, la funzione `conta_livello` accetta solo i nomi di questo elenco; gli altri finiscono in "Altri".
Va rilanciato (e il file eseguito sul database) quando nella lista compare una località nuova fuori Roma:
se nella pagina di monitoraggio cresce la voce "Altri", è il segnale.

Uso:
    python3 strumenti/livelli_sql.py            # scrive supabase/livelli.sql
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from quartieri import QUARTIERI  # noqa: E402

CITTA = ["Firenze", "Venezia", "Milano", "Bologna", "Siena"]   # come in js/app.js: le città che sono un mondo a sé


def main():
    testo = (ROOT / "locali.js").read_text("utf-8")
    inizio = testo.index("[", testo.index("window.RISTOMAT ="))
    fine = testo.index("];", inizio) + 1
    locali = json.loads(testo[inizio:fine])
    nomi = {q[0] for q in QUARTIERI} | {"Periferia", "Tutta Roma", "Tutto fuori porta"} | {f"Tutta {c}" for c in CITTA}
    for x in locali:
        if x["c"] == "Roma" or x["c"] in CITTA:
            continue
        if x["c"] != "Altre località":
            nomi.add(x["c"])                      # anche le località con meno di tre posti: diventano livelli quando crescono
        nomi.add(f"Altro in {x['r']}")
    nomi = sorted(n for n in nomi if n and len(n) <= 80)
    righe = ",\n".join("  ('" + n.replace("'", "''") + "')" for n in nomi)
    (ROOT / "supabase" / "livelli.sql").write_text(
        "-- Generato da strumenti/livelli_sql.py: quartieri e località che il sito può contare.\n"
        "-- Da eseguire dopo statistiche.sql; si può rieseguire senza danni.\n"
        "insert into public.livelli_ammessi (nome) values\n" + righe + "\non conflict (nome) do nothing;\n", "utf-8")
    print(f"{len(nomi)} nomi scritti in supabase/livelli.sql")


if __name__ == "__main__":
    main()
