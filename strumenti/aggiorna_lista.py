#!/usr/bin/env python3
"""Rigenera ristomat/locali.js a partire dalla lista Google Maps "RistoMat".

Uso (dalla cartella del sito):
    python3 strumenti/aggiorna_lista.py              # scarica la lista da Google Maps
    python3 strumenti/aggiorna_lista.py --file x.json # usa una risposta già scaricata

La lista deve essere condivisa pubblicamente (link "Chiunque abbia il link").
Il tipo di locale è dedotto dal nome (e dall'eventuale nota): per correggerlo,
o per cambiare città/zona/nota/indirizzo, aggiungi una voce in correzioni.json.
Il tipo dei posti con nomi poco chiari sta in tipi.json; i quartieri di Roma in strumenti/quartieri.py;
le descrizioni "IN BREVE" in in_breve.json; i posti che hanno chiuso, da non mostrare, in chiusi.json.
In tipi.json, in_breve.json e chiusi.json la chiave è il nome del locale oppure il suo id (più sicuro quando
due locali hanno lo stesso nome).
Solo libreria standard: nessuna dipendenza da installare.
"""
import argparse
import hashlib
import json
import os
import math
import re
import sys
import time
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

LIST_ID = "fLsXKx9eQFufjLbZv0j0SQ"
LIST_URL = f"https://www.google.com/maps/placelists/list/{LIST_ID}"
API = ("https://www.google.com/maps/preview/entitylist/getlist?authuser=0&hl=it&gl=it"
       "&pb=!1m4!1s{id}!2e1!3m1!1e1!2e2!3e2!4i{n}!16b1")

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "locali.js"
SQL_LUOGHI = ROOT / "supabase" / "luoghi.sql"
CORREZIONI = ROOT / "correzioni.json"
TIPI_EXTRA = ROOT / "tipi.json"
IN_BREVE = ROOT / "in_breve.json"
CHIUSI = ROOT / "chiusi.json"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from quartieri import AREE, QUARTIERI, quartiere  # noqa: E402

# --------------------------------------------------------------------------
# Province -> regione
REGIONI = {
    "Lazio": "RM LT VT RI FR",
    "Toscana": "FI GR SI PI LU LI AR PT PO MS",
    "Veneto": "VE VR VI PD TV BL RO",
    "Lombardia": "MI MB BG BS CO CR LC LO MN PV SO VA",
    "Emilia-Romagna": "BO MO PR RE FE RA FC RN PC",
    "Umbria": "PG TR",
    "Campania": "NA SA AV BN CE",
    "Calabria": "CS CZ KR RC VV",
    "Sicilia": "PA TP AG CL CT EN ME RG SR",
    "Puglia": "BA BT BR FG LE TA",
    "Liguria": "GE IM SP SV",
    "Piemonte": "TO AL AT BI CN NO VB VC",
    "Marche": "AN AP FM MC PU",
    "Abruzzo": "AQ CH PE TE",
    "Sardegna": "CA NU OR SS SU",
    "Trentino-Alto Adige": "TN BZ",
    "Friuli-Venezia Giulia": "TS UD PN GO",
}
PROV2REG = {p: r for r, ps in REGIONI.items() for p in ps.split()}

# Tipi di locale: la prima regola che corrisponde vince (l'ordine conta).
TIPI = [
    ("mondo", r"sushi|ramen|noodle|dumpling|damplings|ravioleria|cines|chinese|sichuan|coreano|korea|galbi|"
              r"thai|giappones|sakaba|izakaya|\bbao\b|hotpot|greco\b|greca\b|ippokrates|akropolis|persian|curd|"
              r"bangla|indian|messican|taqueria|tacos?\b|comida|cocina\b|kebab|shawarma|falafel|libanes|"
              r"churrascaria|gaucho|\bwu\b|mifang|jiamo|shiroya|waraku|yasu|kisaki|chopstick|wu xin|yezi|fan wu|"
              r"[\u4e00-\u9fff]"),
    ("pizza", r"pizz(?!icheria)|\bteglia\b|tiella|180grammi|50 kal[oò]"),
    ("pesce", r"pesce|pesc[ah]|pescatore|\bmare\b|marè|maré|da'mare|comeilmare|crudi|scialuppa|lampara|"
              r"molo\d*|frutti di mare|cavalluccio"),
    ("carne", r"macell|bistecc|brace\b|braceria|griglieria|girarrosto|steak|black angus|carnivori|"
              r"arrosticini|scottadito"),
    ("street", r"burger|panin|suppl[iì]|friggitoria|trapizzino|chiosco|kiosco|street|pastrami|panizz|"
               r"smash|\beggs\b|ciriola"),
    ("ristorante", r"^ristorante\b"),
    ("trattoria", r"trattoria|osteria|hosteria|hostaria|locanda|taverna|fraschetta|vinaino|bettola|"
                  r"ristoro|\boste\b"),
    ("vino", r"enoteca|\bvin[oi]\b|vineria|wine|mescita|cantin|bacaro|cicchetti|bollicine|bar à vin|"
             r"sorsi|stappo|spiriti|semi di vino|enofficina|enosake|vinificio|fiaschi"),
    ("dolce", r"forno|panific|\bpane\b|pasticceria|bakery|homebaked|caff[eèé]|caf[eè]\b|coffee|torrefazione|"
              r"maritozz|donut|gelat|brunch|dolce|vivoli|frumentario|farine"),
    ("bar", r"cocktail|mixology|lounge|\bpub\b|ludopub|birr|brewing|taproom|luppolo|hopificio|hopside|"
            r"\bbar\b|spritz|bitterino|blind pig|jungle juice|clubbino"),
    ("ristorante", r"ristorante|restaurant|cucina|bistrot"),
    ("bottega", r"mercato|bottega|salumeria|alimentari|formaggi|dispensa|provviste|azienda agricola|"
                r"ecofattorie|pastificio|enogastronomica|pizzicheria|salsamenteria|spaccio"),
    ("ristorante", r"^da\s"),
]
TIPI_RE = [(k, re.compile(rx, re.I)) for k, rx in TIPI]


def tipo_da_nome(nome, nota):
    """Prima prova con il nome, poi (se il nome non dice nulla) con la nota."""
    for testo in (nome, nota):
        for chiave, rx in TIPI_RE:
            if testo and rx.search(testo):
                return chiave
    return "altro"


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a["la"], a["lo"], b["la"], b["lo"]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def analizza_indirizzo(ind):
    """'Via X, 12, 00192 Roma RM' -> (cap, città, provincia)."""
    parti = [p.strip() for p in ind.split(",") if p.strip()]
    cap = citta = prov = None
    if parti:
        m = re.search(r"\b([A-Z]{2})$", parti[-1])
        if m:
            prov = m.group(1)
    for p in reversed(parti):
        m = re.match(r"^(\d{5})\s*(.*)$", p)
        if m:
            cap = m.group(1)
            citta = re.sub(r"\s+[A-Z]{2}$", "", m.group(2)).strip() or None
            break
    if citta in (None, prov):
        citta = None
    return cap, citta, prov


def scarica(n=2000):
    req = urllib.request.Request(API.format(id=LIST_ID, n=n), headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8")


def pulisci(s):
    return re.sub(r"\s+", " ", s or "").strip()


def g(a, i):
    return a[i] if isinstance(a, list) and len(a) > i else None


def righe_luoghi(locali):
    return [{"id": x["id"], "nome": x["n"], "lat": x["la"], "lon": x["lo"],
             "quartiere": x.get("q"), "citta": x["c"], "tipo": x["t"]} for x in locali]


def scrivi_sql(locali):
    """supabase/luoghi.sql: da incollare nel SQL Editor di Supabase dopo schema.sql."""
    q = lambda v: "null" if v is None else "'" + str(v).replace("'", "''") + "'"
    valori = ",\n".join(f"({q(r['id'])}, {q(r['nome'])}, {r['lat']}, {r['lon']}, {q(r['quartiere'])}, {q(r['citta'])}, {q(r['tipo'])})"
                         for r in righe_luoghi(locali))
    SQL_LUOGHI.parent.mkdir(exist_ok=True)
    SQL_LUOGHI.write_text(
        "-- Generato da strumenti/aggiorna_lista.py: posti della lista, per verificare i check-in.\n"
        "insert into public.luoghi (id, nome, lat, lon, quartiere, citta, tipo) values\n" + valori + "\n"
        "on conflict (id) do update set nome = excluded.nome, lat = excluded.lat, lon = excluded.lon,\n"
        "  quartiere = excluded.quartiere, citta = excluded.citta, tipo = excluded.tipo, aggiornato = now();\n", "utf-8")


def sincronizza_supabase(locali):
    """Se ci sono SUPABASE_URL e SUPABASE_SERVICE_KEY (solo come segreti, mai nel sito), aggiorna i luoghi."""
    url, chiave = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY")
    if not (url and chiave):
        return
    req = urllib.request.Request(
        url.rstrip("/") + "/rest/v1/luoghi?on_conflict=id", method="POST",
        data=json.dumps(righe_luoghi(locali)).encode(),
        headers={"apikey": chiave, "Authorization": f"Bearer {chiave}", "Content-Type": "application/json",
                 "Prefer": "resolution=merge-duplicates,return=minimal"})
    with urllib.request.urlopen(req, timeout=60) as r:
        print(f"Supabase: luoghi aggiornati ({r.status})")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--file", help="risposta getlist già scaricata (altrimenti scarica)")
    args = ap.parse_args()

    # Ogni tanto Google risponde in modo incompleto (senza la lista dentro): si riprova un paio di volte, con calma.
    lista, errore = None, ""
    for tentativo in range(1 if args.file else 4):
        if tentativo:
            time.sleep(6 * tentativo)
        try:
            raw = Path(args.file).read_text("utf-8") if args.file else scarica()
            raw = raw[raw.index("\n") + 1:] if raw.startswith(")]}'") else raw
            lista = json.loads(raw)[0]
        except Exception as e:  # rete, risposta non leggibile
            lista, errore = None, f"{type(e).__name__}: {e}"
        if lista and len(lista) > 12 and lista[8]:
            break
        lista = None
    if not lista:
        sys.exit("Errore: Google non ha restituito la lista" + (f" ({errore})" if errore else " (risposta incompleta)")
                 + ". locali.js non è stato toccato: riprova più tardi.")
    titolo, attesi, voci = lista[4], lista[12], lista[8] or []
    if attesi and len(voci) < attesi:
        print(f"Attenzione: ricevuti {len(voci)} locali su {attesi}", file=sys.stderr)

    correzioni = json.loads(CORREZIONI.read_text("utf-8")) if CORREZIONI.exists() else {}
    correzioni = {k: v for k, v in correzioni.items() if not k.startswith("_")}
    tipi_extra = json.loads(TIPI_EXTRA.read_text("utf-8")) if TIPI_EXTRA.exists() else {}
    in_breve = json.loads(IN_BREVE.read_text("utf-8")) if IN_BREVE.exists() else {}
    chiusi = json.loads(CHIUSI.read_text("utf-8")) if CHIUSI.exists() else {}
    chiusi = {k: v for k, v in chiusi.items() if not k.startswith("_")}

    locali = []
    for it in voci:
        p = it[1] or []
        coord = g(p, 5) or []
        nome, nota = pulisci(it[2]), pulisci(it[3])
        fid = g(p, 6)
        if fid and fid[1]:
            ident = str(int(fid[1]) % 2**64)  # CID di Google Maps: stabile nel tempo
        else:
            ident = "h" + hashlib.sha1(f"{nome}|{coord[2]:.5f}|{coord[3]:.5f}".encode()).hexdigest()[:15]
        ind = pulisci(g(p, 4))
        cap, citta, prov = analizza_indirizzo(ind)
        locali.append({
            "id": ident,
            "n": nome, "a": ind, "nt": nota,
            "la": round(coord[2], 6), "lo": round(coord[3], 6),
            "cap": cap, "c": citta, "p": prov,
            "t": tipo_da_nome(nome, nota),
            "d": it[9][0] if g(it, 9) else None,
        })

    # Indirizzi incompleti: eredita città/provincia/CAP dal locale più vicino.
    noti = [x for x in locali if x["c"] and x["p"]]
    for x in locali:
        if x["c"] and x["p"]:
            continue
        vicino = min(noti, key=lambda y: km(x, y))
        d = km(x, vicino)
        if not x["p"] and d < 60:
            x["p"] = vicino["p"]
        if not x["c"] and d < 3:
            x["c"], x["cap"] = vicino["c"], x["cap"] or vicino["cap"]

    # Posti che hanno chiuso: restano nella lista di Google ma non vanno mostrati
    tolti = [x for x in locali if x["id"] in chiusi or x["n"] in chiusi]
    locali = [x for x in locali if x not in tolti]

    for x in locali:
        x["r"] = PROV2REG.get(x["p"], "Altro")
        x["c"] = x["c"] or "Altre località"
        if x["id"] in tipi_extra:  # tipo accertato con una ricerca: vale più di quello dedotto dal nome
            x["t"] = tipi_extra[x["id"]]
        elif x["t"] == "altro":  # il nome non dice che locale è
            x["t"] = tipi_extra.get(x["n"], "altro")
        fix = correzioni.get(x["n"]) or {}
        x.update({k: v for k, v in fix.items() if k in ("c", "la", "lo", "r", "a")})  # prima del quartiere
        if x["c"] == "Roma":
            x["q"] = quartiere(x["la"], x["lo"])
        x.update({k: v for k, v in fix.items() if k in ("t", "q", "nt")})
        breve = in_breve.get(x["id"]) or in_breve.get(x["n"])
        if not x["nt"] and breve:
            x["dr"] = breve  # descrizione breve, mostrata solo se Matteo non ha scritto una nota
        del x["cap"]

    locali.sort(key=lambda x: -(x["d"] or 0))  # più recenti prima
    righe = ",\n".join(json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in locali)
    if OUT.exists() and righe in OUT.read_text("utf-8"):
        print(f"Nessuna novità: {len(locali)} locali, {OUT.name} invariato")
        return
    meta = {
        "titolo": titolo,
        "fonte": LIST_URL,
        "aggiornato": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "totale": len(locali),
        "aree": AREE,
        "quartieri": [{"n": n, "a": a, "la": la, "lo": lo} for n, a, la, lo, _ in QUARTIERI
                      if any(x.get("q") == n for x in locali)],
    }
    js = ("// Generato da strumenti/aggiorna_lista.py: non modificare a mano (usa correzioni.json).\n"
          f"window.RISTOMAT_META = {json.dumps(meta, ensure_ascii=False)};\n"
          "window.RISTOMAT = [\n" + righe + "\n];\n")
    OUT.write_text(js, "utf-8")
    scrivi_sql(locali)
    sincronizza_supabase(locali)

    print(f"{len(locali)} locali scritti in {OUT.name}" + (f" ({len(tolti)} chiusi esclusi)" if tolti else ""))
    print("Tipi:", dict(Counter(x["t"] for x in locali).most_common()))
    print("Città:", dict(Counter(x["c"] for x in locali).most_common(8)))
    print("Quartieri di Roma:", dict(Counter(x.get("q") for x in locali if x.get("q")).most_common()))


if __name__ == "__main__":
    main()
