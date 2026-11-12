#!/usr/bin/env python3
"""Le descrizioni "IN BREVE" dei posti: chi ne è senza, e come aggiungerle dopo una ricerca.

    python3 strumenti/descrizioni.py stato                 # quanti posti hanno nota, descrizione, niente
    python3 strumenti/descrizioni.py da-cercare            # posti senza descrizione ancora da cercare (JSON)
    python3 strumenti/descrizioni.py da-cercare --max 40   # al massimo 40
    python3 strumenti/descrizioni.py applica esiti.json    # controlla gli esiti di una ricerca e li salva

Lo script NON cerca in rete e NON scrive descrizioni: quello lo fa chi cerca (una persona o un assistente),
seguendo le regole di strumenti/DESCRIZIONI.md. Qui ci sono solo l'elenco e i controlli:

- una descrizione entra solo se ha almeno una fonte, confidenza alta o media, al massimo 165 caratteri,
  niente giudizi, prezzi, stelle o punti esclamativi; orari e prenotazioni vengono tolti;
- non sovrascrive mai una nota di Matteo né una descrizione che c'è già;
- le chiusure non vengono mai applicate da sole: le elenca, e si decide a mano (chiusi.json);
- i posti cercati senza trovare nulla finiscono in descrizioni_tentate.json, così non si ricercano ogni settimana
  (si riprova dopo 120 giorni).

Dopo `applica`, rigenera il sito con: python3 strumenti/aggiorna_lista.py
"""
import argparse
import datetime
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOCALI, IN_BREVE, TIPI = ROOT / "locali.js", ROOT / "in_breve.json", ROOT / "tipi.json"
TENTATE = ROOT / "descrizioni_tentate.json"
RIPROVA_DOPO = 120  # giorni

TIPI_VALIDI = {"trattoria", "ristorante", "pizza", "vino", "bar", "dolce", "mondo", "street", "pesce", "carne", "bottega"}
VIETATE = re.compile(r"\b(miglior[ei]?|imperdibil[ei]|ottim[oaie]|eccellent[ei]|eccezional[ei]|strepitos[oaie]|fantastic[oaihe]+|"
                     r"delizios[oaie]|buonissim[oaie]|top|stellat[oaie]|stell[ae] michelin|economic[oaihe]+|car[oaie]|prezz[oi]|euro)\b|€|!", re.I)
ORARI = re.compile(r"\b(apert[oa] (di sera|da mezzogiorno|fino a|tutto il giorno|tutti i giorni|a pranzo|a cena|solo|giorno e notte)|"
                   r"fino a tardi|prenotazion\w+|su prenotazione|chius[oa] (il|la|di)\b|"
                   r"(dalle|alle|fino alle|ore) \d{1,2}\b(?!\d)|\d{1,2}[:.]\d{2}\b)", re.I)   # anche le ore scritte in cifre
REGIONALE = re.compile(r"sicilian|puglies|sard[ao]|napoletan|abruzzes|venet|toscan|calabres|ligur|emilian|piemontes|romagnol|umbr[ao]|"
                       r"marchigian|lucan|campan|salentin|roman[ao]", re.I)
STRANIERA = re.compile(r"cines|giappon|thai|corean|indian|messican|peruvian|brasilian|liban|grec|etiop|vietnam|asiatic|american|"
                       r"ramen|sushi|dumpling|ravioleria|hot pot|kebab|taco|burger", re.I)


def leggi(f, vuoto):
    return json.loads(f.read_text("utf-8")) if f.exists() else vuoto


def scrivi(f, dati):
    f.write_text(json.dumps(dati, ensure_ascii=False, indent=1) + "\n", "utf-8")


def locali():
    s = LOCALI.read_text("utf-8")
    return json.JSONDecoder().raw_decode(s, s.index("window.RISTOMAT = ") + len("window.RISTOMAT = "))[0]


def senza(tutti):
    """Posti senza nota di Matteo e senza descrizione, con un nome vero da cercare."""
    return [x for x in tutti if not x.get("nt") and not x.get("dr") and len(x.get("n") or "") > 1]


def pulisci(b):
    """Toglie orari e prenotazioni (cambiano e non li verifichiamo), lasciando il resto della frase."""
    b = re.sub(r"\s+apert[oa] tutto il giorno", "", b)
    pezzi = re.split(r"(, |; )", b.rstrip(". "))
    fuori, i = [pezzi[0]], 1
    while i < len(pezzi) - 1:
        if not ORARI.search(pezzi[i + 1]):
            fuori += [pezzi[i], pezzi[i + 1]]
        i += 2
    b = "".join(fuori).strip()
    return "" if ORARI.search(b) else b + "."


def scaduto(giorno, oggi):
    try:
        return (oggi - datetime.date.fromisoformat(giorno)).days >= RIPROVA_DOPO
    except (TypeError, ValueError):
        return True


def cmd_stato(_):
    tutti = locali()
    nota, breve, vuoti = (sum(1 for x in tutti if x.get("nt")), sum(1 for x in tutti if not x.get("nt") and x.get("dr")), senza(tutti))
    tentate, oggi = leggi(TENTATE, {}), datetime.date.today()
    nuovi = [x for x in vuoti if scaduto(tentate.get(x["id"]), oggi)]
    print(f"{len(tutti)} posti: {nota} con la nota di Matteo, {breve} con IN BREVE, {len(tutti) - nota - breve} senza descrizione")
    print(f"da cercare adesso: {len(nuovi)} (gli altri {len(vuoti) - len(nuovi)} sono già stati cercati senza esito negli ultimi {RIPROVA_DOPO} giorni)")


def cmd_da_cercare(args):
    tutti = locali()
    tentate, oggi = leggi(TENTATE, {}), datetime.date.today()
    nuovi = [x for x in senza(tutti) if scaduto(tentate.get(x["id"]), oggi)]
    nuovi.sort(key=lambda x: -(x.get("d") or 0))  # i più recenti per primi
    fuori = [{"id": x["id"], "nome": x["n"], "indirizzo": x.get("a", ""), "citta": x.get("c", ""), "zona": x.get("q", ""), "tipo": x.get("t", "altro")}
             for x in nuovi[: args.max]]
    json.dump(fuori, sys.stdout, ensure_ascii=False, indent=1)
    print()
    print(f"{len(fuori)} da cercare (su {len(nuovi)} in attesa)", file=sys.stderr)


def cmd_applica(args):
    esiti = json.loads(Path(args.file).read_text("utf-8"))
    if not isinstance(esiti, list):
        sys.exit("Errore: il file deve contenere un elenco di esiti (vedi strumenti/DESCRIZIONI.md).")
    tutti = {x["id"]: x for x in locali()}
    brevi, tipi, tentate = leggi(IN_BREVE, {}), leggi(TIPI, {}), leggi(TENTATE, {})
    oggi = datetime.date.today().isoformat()
    accettate, scartate, cambi_tipo, chiusure, ignoti = [], [], [], [], []
    for r in esiti:
        x = tutti.get(str((r or {}).get("id")))
        if not x:
            ignoti.append(str((r or {}).get("id")))
            continue
        conf = r.get("confidenza")
        fonti = [f for f in (r.get("fonti") or []) if isinstance(f, str) and f.startswith("https://")]
        b = re.sub(r"\s+", " ", r.get("breve") or "").strip()
        libero = not x.get("nt") and not x.get("dr") and x["id"] not in brevi and x["n"] not in brevi
        if b and not libero:
            scartate.append((x["n"], "ha già una nota o una descrizione", b))
        elif b:
            motivo = ("confidenza bassa" if conf not in ("alta", "media") else "senza fonte" if not fonti
                      else f"troppo lunga ({len(b)})" if len(b) > 165
                      else f"parola vietata: {VIETATE.search(b).group(0)}" if VIETATE.search(b) else "")
            p = "" if motivo else pulisci(b)
            if p:
                brevi[x["id"]] = p
                accettate.append((x["n"], p))
                tentate.pop(x["id"], None)
            else:
                scartate.append((x["n"], motivo or "restavano solo orari o prenotazioni", b))
        if libero and x["id"] not in brevi:
            tentate[x["id"]] = oggi
        t = r.get("tipo")
        if t in TIPI_VALIDI and t != x.get("t") and conf in ("alta", "media") and fonti:
            if t == "mondo" and REGIONALE.search(b) and not STRANIERA.search(b):
                t = "ristorante" if x.get("t") == "altro" else x.get("t")  # la cucina regionale italiana non è "giro del mondo"
            if t != x.get("t"):
                tipi[x["id"]] = t
                cambi_tipo.append((x["n"], x.get("t"), t))
        if r.get("chiuso") in ("si", "forse"):
            chiusure.append((x["n"], x["id"], r["chiuso"], r.get("prova_chiusura") or "", fonti[:2]))

    print(f"esiti letti: {len(esiti)} · descrizioni accettate: {len(accettate)} · scartate: {len(scartate)} · tipi corretti: {len(cambi_tipo)}")
    for n, p in accettate:
        print(f"  + {n}: {p}")
    for n, m, b in scartate:
        print(f"  scartata [{m}] {n}: {b[:110]}")
    for n, da, a in cambi_tipo:
        print(f"  tipo {n}: {da} -> {a}")
    for i in ignoti:
        print(f"  id sconosciuto, ignorato: {i}")
    if chiusure:
        print("POSSIBILI CHIUSURE (non applicate: da decidere a mano in chiusi.json):")
        for n, i, c, prova, fonti in chiusure:
            print(f"  [{c}] {n} (id {i}): {prova} {' '.join(fonti)}")
    if args.prova:
        print("prova: non ho scritto nulla")
        return
    scrivi(IN_BREVE, brevi)
    scrivi(TIPI, tipi)
    scrivi(TENTATE, dict(sorted(tentate.items())))
    print("scritti in_breve.json, tipi.json e descrizioni_tentate.json · ora: python3 strumenti/aggiorna_lista.py")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cosa", required=True)
    sub.add_parser("stato").set_defaults(f=cmd_stato)
    p = sub.add_parser("da-cercare")
    p.add_argument("--max", type=int, default=40)
    p.set_defaults(f=cmd_da_cercare)
    p = sub.add_parser("applica")
    p.add_argument("file")
    p.add_argument("--prova", action="store_true", help="mostra che cosa farebbe, senza scrivere")
    p.set_defaults(f=cmd_applica)
    args = ap.parse_args()
    args.f(args)


if __name__ == "__main__":
    main()
