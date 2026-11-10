#!/usr/bin/env python3
"""Costruisce la mappa ospitata sul sito (mappa/roma.js) dai dati di OpenStreetMap.

Così la mappa con strade, Tevere e parchi si vede sempre, senza caricare immagini da
server esterni (nessun indirizzo IP dei visitatori va a terzi).

Uso:
    python3 strumenti/mappa_osm.py --scarica DIR   # scarica i dati grezzi da Overpass in DIR
    python3 strumenti/mappa_osm.py DIR             # genera mappa/roma.js dai file in DIR

Dati © OpenStreetMap contributors, licenza ODbL 1.0 (https://www.openstreetmap.org/copyright):
il file generato è un database derivato e resta sotto ODbL.
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RM = "(41.80,12.38,41.98,12.62)"        # tutta Roma: strade principali, fiumi, parchi
RMC = "(41.855,12.435,41.935,12.535)"   # centro: anche le vie di quartiere
RICHIESTE = {
    "roma_principali": f'way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"]{RM};out geom;',
    "roma_secondarie": f'way["highway"~"^(residential|unclassified|pedestrian|living_street)$"]{RMC};out geom;',
    "roma_fiumi": f'way["waterway"="river"]{RM};out geom;',
    "roma_parchi": f'way["leisure"="park"]{RM};out geom;',
    "roma_parchi_rel": f'relation["leisure"="park"]{RM};out geom;',
}
SERVER = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]


def scarica(cartella):
    cartella.mkdir(parents=True, exist_ok=True)
    for nome, q in RICHIESTE.items():
        for s in SERVER * 3:
            try:
                req = urllib.request.Request(s, data=urllib.parse.urlencode({"data": "[out:json][timeout:170];" + q}).encode(),
                                             headers={"User-Agent": "scusa-non-stasera-map-builder/1.0"})
                (cartella / f"{nome}.json").write_bytes(urllib.request.urlopen(req, timeout=190).read())
                print("scaricato", nome)
                break
            except Exception as e:  # il servizio pubblico a volte rifiuta: riprova con calma
                print(" ", nome, s, e)
                time.sleep(15)
        time.sleep(20)


def semplifica(pts, tol):
    """Douglas-Peucker su coordinate (lat, lon) in gradi."""
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[1] - a[1], b[0] - a[0]
    n = (dx * dx + dy * dy) ** .5 or 1e-12
    dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        d = abs(dy * (pts[i][1] - a[1]) - dx * (pts[i][0] - a[0])) / n
        if d > dmax:
            dmax, idx = d, i
    if dmax <= tol:
        return [a, b]
    return semplifica(pts[:idx + 1], tol)[:-1] + semplifica(pts[idx:], tol)


def codifica(pts):
    """Interi a 1e-5 gradi (circa 1 m), il primo assoluto e gli altri come differenze."""
    out, plat, plon = [], 0, 0
    for la, lo in pts:
        a, b = round(la * 1e5), round(lo * 1e5)
        out += [a - plat, b - plon]
        plat, plon = a, b
    return out


def area_m2(pts):
    if len(pts) < 3:
        return 0
    k = 111320 * 0.744
    s = 0
    for (a1, o1), (a2, o2) in zip(pts, pts[1:] + pts[:1]):
        s += (o1 * k) * (a2 * 110570) - (o2 * k) * (a1 * 110570)
    return abs(s) / 2


def linee(file, filtro=lambda t: True, tol=2e-5):
    if not file.exists():
        return []
    out = []
    for e in json.loads(file.read_text())["elements"]:
        if e.get("type") == "way" and "geometry" in e and filtro(e.get("tags", {})):
            pts = semplifica([(g["lat"], g["lon"]) for g in e["geometry"]], tol)
            if len(pts) >= 2:
                out.append(codifica(pts))
    return out


def parchi(cartella, minimo=15000):
    out = []
    for nome in ("roma_parchi", "roma_parchi_rel"):
        f = cartella / f"{nome}.json"
        if not f.exists():
            continue
        for e in json.loads(f.read_text())["elements"]:
            anelli = []
            if e["type"] == "way" and "geometry" in e:
                anelli = [[(g["lat"], g["lon"]) for g in e["geometry"]]]
            elif e["type"] == "relation":
                anelli = [[(g["lat"], g["lon"]) for g in m["geometry"]] for m in e.get("members", [])
                          if m.get("role") == "outer" and "geometry" in m]
            for an in anelli:
                if area_m2(an) >= minimo:
                    out.append(codifica(semplifica(an, 3e-5)))
    return out


def genera(cartella):
    grandi = lambda t: t.get("highway") in ("motorway", "trunk", "primary")
    medie = lambda t: t.get("highway") in ("secondary", "tertiary")
    dati = {
        "fiumi": linee(cartella / "roma_fiumi.json", tol=3e-5),
        "parchi": parchi(cartella),
        "grandi": linee(cartella / "roma_principali.json", grandi),
        "medie": linee(cartella / "roma_principali.json", medie),
        "vie": linee(cartella / "roma_secondarie.json", tol=2.5e-5),
    }
    js = ("// Mappa di Roma per \"Scusa, non stasera\": generata da strumenti/mappa_osm.py.\n"
          "// Dati © OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright\n"
          "window.SNS_MAPPA = window.SNS_MAPPA || {};\n"
          "window.SNS_MAPPA.roma = " + json.dumps(dati, separators=(",", ":")) + ";\n")
    out = ROOT / "mappa" / "roma.js"
    out.parent.mkdir(exist_ok=True)
    out.write_text(js, "utf-8")
    print(f"{out.relative_to(ROOT)}: {len(js) // 1024} KB · " + ", ".join(f"{k} {len(v)}" for k, v in dati.items()))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--scarica":
        scarica(Path(sys.argv[2]))
    elif len(sys.argv) == 2:
        genera(Path(sys.argv[1]))
    else:
        sys.exit(__doc__)
