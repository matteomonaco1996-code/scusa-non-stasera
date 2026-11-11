#!/usr/bin/env python3
"""Strade leggere per la mappa dei quartieri (quella con le caselle numerate).

Prende le strade principali da mappa/roma.js (già sul sito, dati OpenStreetMap), tiene solo
quelle che cadono nel riquadro della mappa dei quartieri, unisce i tratti consecutivi e
toglie i punti che a quella scala non si vedrebbero. Il risultato, mappa/quartieri.js,
pesa poco e si carica dopo il resto della pagina.

Uso:
    python3 strumenti/strade_quartieri.py            # genera mappa/quartieri.js
    python3 strumenti/strade_quartieri.py --prova    # stampa solo i numeri

Va rilanciato solo se cambia mappa/roma.js o l'elenco dei quartieri (strumenti/quartieri.py).
Dati © OpenStreetMap contributors, licenza ODbL 1.0: il file generato è un database derivato.
"""
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from quartieri import QUARTIERI  # noqa: E402

# La stessa "lente" di disegnaOverworld() in js/app.js: allarga il centro, comprime la periferia.
C0 = (41.892, 12.488)
KX, KY = 111.32 * math.cos(math.radians(C0[0])), 110.57
LARGHEZZA = 600          # larghezza del disegno, come in app.js
TOLLERANZA = {"grandi": 0.7, "medie": 0.9}    # in punti del disegno: sotto questa distanza un punto non si vede
MINIMO = {"grandi": 10, "medie": 16}          # tratti più corti di così (in punti del disegno) si tolgono


def lente(la, lo):
    dx, dy = (lo - C0[1]) * KX, (C0[0] - la) * KY
    r = math.hypot(dx, dy)
    if not r:
        return 0.0, 0.0
    f = r ** 0.68 / r
    return dx * f, dy * f


def riquadro():
    """Il riquadro del disegno, calcolato come in app.js dai centri dei quartieri."""
    pts = [lente(la, lo) for _, _, la, lo, _ in QUARTIERI]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    x0, x1, y0, y1 = min(xs) - .55, max(xs) + .55, min(ys) - .45, max(ys) + .45
    s = LARGHEZZA / (x1 - x0)
    return x0, y0, s, LARGHEZZA, (y1 - y0) * s


def decodifica(a):
    out, la, lo = [], 0, 0
    for i in range(0, len(a), 2):
        la += a[i]
        lo += a[i + 1]
        out.append((la, lo))
    return out


def unisci(linee):
    """Unisce i tratti che si toccano in un punto dove passano solo loro due (stessa strada spezzata in più pezzi)."""
    linee = [l for l in linee if len(l) > 1 and l[0] != l[-1] or len(l) > 2]
    capi = defaultdict(list)
    for i, l in enumerate(linee):
        capi[l[0]].append(i)
        capi[l[-1]].append(i)
    usata, out = [False] * len(linee), []
    for i, l in enumerate(linee):
        if usata[i]:
            continue
        usata[i] = True
        catena = list(l)
        for verso in (1, 0):                 # allunga prima in coda, poi in testa
            while True:
                capo = catena[-1] if verso else catena[0]
                vicini = [j for j in capi[capo] if not usata[j]]
                if len(capi[capo]) != 2 or len(vicini) != 1:
                    break
                j = vicini[0]
                usata[j] = True
                altro = linee[j] if linee[j][0] == capo else linee[j][::-1]
                catena = catena + altro[1:] if verso else altro[::-1][:-1] + catena
        out.append(catena)
    return out


def sfoltisci(p, tol):
    """Douglas-Peucker: tiene solo i punti che spostano la linea più di tol."""
    if len(p) < 3:
        return list(range(len(p)))
    tieni, pila = {0, len(p) - 1}, [(0, len(p) - 1)]
    while pila:
        a, b = pila.pop()
        (ax, ay), (bx, by) = p[a], p[b]
        dx, dy = bx - ax, by - ay
        lung = math.hypot(dx, dy) or 1e-9
        dmax, k = 0, None
        for i in range(a + 1, b):
            d = abs((p[i][0] - ax) * dy - (p[i][1] - ay) * dx) / lung
            if d > dmax:
                dmax, k = d, i
        if k is not None and dmax > tol:
            tieni.add(k)
            pila += [(a, k), (k, b)]
    return sorted(tieni)


def codifica(pts):
    out, la0, lo0 = [], 0, 0
    for la, lo in pts:
        out += [la - la0, lo - lo0]
        la0, lo0 = la, lo
    return out


def main():
    testo = (ROOT / "mappa" / "roma.js").read_text(encoding="utf-8")
    dati = json.loads(testo[testo.index("{", testo.index("window.SNS_MAPPA.roma")):testo.rindex("}") + 1])
    x0, y0, s, W, H = riquadro()
    margine = 6
    xy = lambda la, lo: ((lente(la / 1e5, lo / 1e5)[0] - x0) * s, (lente(la / 1e5, lo / 1e5)[1] - y0) * s)
    dentro = lambda q: -margine <= q[0] <= W + margine and -margine <= q[1] <= H + margine
    uscita, conti = {}, {}
    for classe in ("grandi", "medie"):
        linee = unisci([decodifica(a) for a in dati[classe]])
        tenute, punti = [], 0
        for l in linee:
            q = [xy(la, lo) for la, lo in l]
            # spezza dove la linea esce dal riquadro
            pezzi, cur = [], []
            for i, dq in enumerate(q):
                if dentro(dq):
                    cur.append(i)
                elif cur:
                    pezzi.append(cur)
                    cur = []
            if cur:
                pezzi.append(cur)
            for idx in pezzi:
                if len(idx) < 2:
                    continue
                pq = [q[i] for i in idx]
                if sum(math.hypot(pq[i + 1][0] - pq[i][0], pq[i + 1][1] - pq[i][1]) for i in range(len(pq) - 1)) < MINIMO[classe]:
                    continue
                keep = sfoltisci(pq, TOLLERANZA[classe])
                tenute.append(codifica([l[idx[k]] for k in keep]))
                punti += len(keep)
        uscita[classe] = tenute
        conti[classe] = (len(dati[classe]), len(tenute), punti)
    corpo = json.dumps(uscita, separators=(",", ":"))
    for classe, (prima, dopo, punti) in conti.items():
        print(f"{classe}: {prima} tratti → {dopo} linee, {punti} punti")
    print(f"disegno {W}×{round(H)} · file {len(corpo) / 1024:.0f} KB")
    if "--prova" in sys.argv:
        return
    (ROOT / "mappa" / "quartieri.js").write_text(
        '// Strade per la mappa dei quartieri di "Scusa, non stasera": generate da strumenti/strade_quartieri.py a partire da mappa/roma.js.\n'
        "// Dati © OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright\n"
        "window.SNS_MAPPA = window.SNS_MAPPA || {};\n"
        f"window.SNS_MAPPA.strade = {corpo};\n", encoding="utf-8")


if __name__ == "__main__":
    main()
