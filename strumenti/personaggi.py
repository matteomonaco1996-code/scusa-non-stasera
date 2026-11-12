#!/usr/bin/env python3
"""Disegna i due personaggetti della vignetta iniziale (Gaia e Matteo) e li scrive in img/ come SVG.

    python3 strumenti/personaggi.py

Sono mezzibusti a pixel su una griglia 18x22: forme semplici (ellissi e rettangoli) messe sulla griglia,
poi un contorno scuro tutto intorno. Per cambiarli basta toccare le due righe GAIA e TU qui sotto:
  capelli = "lunghi" | "caschetto" | "raccolti" | "corti" | "ricci" | "rasato"
  col_capelli, pelle, maglia = colori; barba, occhiali, guance = True/False
"""
from pathlib import Path

GAIA = dict(capelli="lunghi", col_capelli="#6B3A1E", maglia="#B3263A", guance=True)
TU = dict(capelli="corti", col_capelli="#5E2A12", maglia="#22507A", barba=True)
# Le facce tra cui scegliere quando ci si siede in una comitiva (img/facce/0.svg … 5.svg): l'ordine conta,
# perché nel database c'è solo il numero.
FACCE = [
    dict(capelli="corti", col_capelli="#5E2A12", maglia="#22507A", barba=True),
    dict(capelli="lunghi", col_capelli="#6B3A1E", maglia="#B3263A", guance=True),
    dict(capelli="ricci", col_capelli="#2A1A12", maglia="#2F6B3A"),
    dict(capelli="caschetto", col_capelli="#C98A2B", maglia="#7A4FA3", guance=True),
    dict(capelli="rasato", col_capelli="#3A2A22", maglia="#C96F1E", occhiali=True),
    dict(capelli="raccolti", col_capelli="#8A2B1E", maglia="#1F7A7A", guance=True),
]


L, A = 18, 22   # griglia: larghezza e altezza in "pixel"
SCURO = "#2B040A"

def vuota(): return [[None] * L for _ in range(A)]

def ellisse(g, cx, cy, rx, ry, c, se=None):
    for y in range(A):
        for x in range(L):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1 and (se is None or se(x, y)):
                g[y][x] = c

def rett(g, x0, y0, x1, y1, c):
    for y in range(max(0, y0), min(A, y1 + 1)):
        for x in range(max(0, x0), min(L, x1 + 1)):
            g[y][x] = c

def punti(g, pts, c):
    for x, y in pts:
        if 0 <= x < L and 0 <= y < A: g[y][x] = c

def contorno(g, c=SCURO):
    out = [r[:] for r in g]
    for y in range(A):
        for x in range(L):
            if g[y][x] is None and any(0 <= y + dy < A and 0 <= x + dx < L and g[y + dy][x + dx] is not None for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[y][x] = c
    return out

def personaggio(capelli="corti", col_capelli="#5E2A12", pelle="#F3C9A8", maglia="#22507A", barba=False, occhiali=False, guance=False):
    luce = lambda h: "#%02X%02X%02X" % tuple(min(255, int(int(h[i:i + 2], 16) * 1.28 + 14)) for i in (1, 3, 5))
    ombra = lambda h: "#%02X%02X%02X" % tuple(int(int(h[i:i + 2], 16) * .78) for i in (1, 3, 5))
    g = vuota()
    cx = L / 2
    # capelli dietro (solo per i tagli lunghi)
    if capelli == "lunghi": ellisse(g, cx, 11.5, 7.2, 9.0, col_capelli, lambda x, y: y >= 4)
    if capelli == "caschetto": ellisse(g, cx, 10.0, 7.0, 7.0, col_capelli, lambda x, y: 4 <= y <= 14)
    if capelli == "raccolti": ellisse(g, cx, 2.6, 2.6, 2.4, col_capelli)
    # busto e collo
    rett(g, 3, 17, 14, 21, maglia); rett(g, 4, 16, 13, 16, maglia); rett(g, 2, 18, 15, 21, maglia)
    rett(g, 7, 14, 10, 16, pelle)                      # collo
    punti(g, [(7, 17), (10, 17), (8, 17), (9, 17)], pelle); punti(g, [(8, 18), (9, 18)], pelle)   # scollo a V
    rett(g, 2, 20, 15, 21, ombra(maglia))             # ombra in basso
    # testa
    ellisse(g, cx, 9.2, 5.2, 5.9, pelle)
    punti(g, [(3, 9), (3, 10), (14, 9), (14, 10)], pelle)   # orecchie
    # capelli davanti
    if capelli != "rasato":
        ellisse(g, cx, 8.4, 5.9, 6.4, col_capelli, lambda x, y: y <= 5 or (y <= 7 and (x <= 4 or x >= 13)))
        if capelli in ("lunghi", "caschetto", "raccolti"):
            punti(g, [(4, 6), (5, 6), (4, 7), (12, 6), (13, 6), (13, 7)], col_capelli)        # ciocche ai lati della fronte
            punti(g, [(3, y) for y in range(8, 12)] + [(14, y) for y in range(8, 12)], col_capelli)  # capelli sopra le orecchie
        else:
            punti(g, [(5, 6), (12, 6)], col_capelli)
        if capelli == "ricci":
            punti(g, [(5, 1), (6, 1), (8, 1), (9, 1), (11, 1), (12, 1), (3, 3), (14, 3), (2, 5), (15, 5), (3, 7), (14, 7), (4, 2), (13, 2)], col_capelli)
        punti(g, [(6, 3), (7, 3), (6, 4)], luce(col_capelli))     # riflesso
    else:
        ellisse(g, cx, 8.4, 5.4, 6.0, ombra(pelle), lambda x, y: y <= 3)
    # barba
    if barba:
        ellisse(g, cx, 9.2, 5.2, 5.9, col_capelli, lambda x, y: y >= 12 or (y >= 10 and (x <= 4 or x >= 13)))
        punti(g, [(6, 11), (7, 11), (10, 11), (11, 11)], col_capelli)   # baffi
    # viso
    punti(g, [(6, 8), (6, 9), (11, 8), (11, 9)], SCURO)                 # occhi
    if guance: punti(g, [(4, 11), (5, 11), (12, 11), (13, 11)], "#F29C8E")
    punti(g, [(8, 12), (9, 12)], "#B3263A" if not barba else "#F3C9A8") # bocca
    if barba: punti(g, [(8, 12), (9, 12)], "#B3263A")
    if occhiali:   # montatura scura con la lente chiara accanto all'occhio, così non sembrano occhiali da sole
        MONT, LENTE = "#3A2A2A", "#D9ECF7"
        for x0, occhio, lente in ((4, 6, 5), (10, 11, 12)):
            punti(g, [(x0 + k, 7) for k in range(4)] + [(x0 + k, 10) for k in range(4)] + [(x0, 8), (x0, 9), (x0 + 3, 8), (x0 + 3, 9)], MONT)
            punti(g, [(lente, 8), (lente, 9)], LENTE)
            punti(g, [(occhio, 8), (occhio, 9)], SCURO)
        punti(g, [(8, 8), (9, 8), (3, 8), (14, 8)], MONT)
    return contorno(g)

def svg(g, classe="tipo", px=None, titolo=None):
    colori = {}
    for y in range(A):
        x = 0
        while x < L:
            c = g[y][x]
            if c is None: x += 1; continue
            n = 1
            while x + n < L and g[y][x + n] == c: n += 1
            colori.setdefault(c, []).append(f"M{x} {y}h{n}v1h-{n}z"); x += n
    corpo = "".join(f'<path fill="{c}" d="{"".join(d)}"/>' for c, d in colori.items())
    mis = f' width="{L * px}" height="{A * px}"' if px else ""
    return f'<svg class="{classe}" viewBox="0 0 {L} {A}"{mis} shape-rendering="crispEdges" aria-hidden="true">{corpo}</svg>'

if __name__ == "__main__":
    img = Path(__file__).resolve().parent.parent / "img"
    (img / "facce").mkdir(exist_ok=True)
    for nome, tratti in [("gaia", GAIA), ("tu", TU)] + [(f"facce/{k}", t) for k, t in enumerate(FACCE)]:
        testo = svg(personaggio(**tratti)).replace('<svg class="tipo" ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace(' aria-hidden="true"', "") + "\n"
        (img / f"{nome}.svg").write_text(testo, "utf-8")
        print(f"img/{nome}.svg", len(testo), "byte")
