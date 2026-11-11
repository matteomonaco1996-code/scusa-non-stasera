#!/usr/bin/env python3
"""Ridisegna il logo di "Scusa, non stasera" e lo scrive in img/ come SVG.

    pip install fonttools brotli
    python3 strumenti/logo.py

Il logo è quello disegnato da Matteo: gettone a pixel con il segnaposto, "SCUSA, NON STASERA." in oro,
"ANZI SÌ!" nel riquadro chiaro, "RISTOMAT" sotto, intestazione "PLAYER 1 / INSERISCI GETTONE".
Misure, colori e posizioni qui sotto sono quelli del suo progetto (tavole 1200x630 e 512x512).
Le scritte usano Press Start 2P (licenza OFL in fonts/) convertito in tracciati, così gli SVG non
dipendono da nessun font. I PNG in img/ sono esportazioni di questi SVG.
"""
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

RADICE = Path(__file__).resolve().parent.parent
IMG = RADICE / "img"

BORDEAUX, CREMA, ORO, OMBRA = "#7A1022", "#FFF3D6", "#F2B632", "#3D0711"

# Gettone 24x24: d bordo, g oro, h luce, b segnaposto (bordeaux)
GETTONE = [
    "........dddddddd........",
    "......dddddddddddd......",
    ".....dddggggggggddd.....",
    "...dddgghhggggggggddd...",
    "...ddghhgggbbggggggdd...",
    "..ddghhggbbbbbbgggggdd..",
    ".ddghhggbbbbbbbbgggggdd.",
    ".ddghggbbbbbbbbbbggggdd.",
    "ddghgggbbbggggbbbgggggdd",
    "ddghggbbbbggggbbbbggggdd",
    "ddggggbbbbggggbbbbggggdd",
    "ddgggggbbbggggbbbgggggdd",
    "ddgggggbbbbbbbbbbgggggdd",
    "ddgggggbbbbbbbbbbgggggdd",
    "ddggggggbbbbbbbbggggggdd",
    "ddggggggbbbbbbbbggggggdd",
    ".ddggggggbbbbbbggggggdd.",
    ".ddgggggggbbbbgggggggdd.",
    "..ddgggggggbbgggggggdd..",
    "...ddggggggbbggggggdd...",
    "...dddggggggggggggddd...",
    ".....dddggggggggddd.....",
    "......dddddddddddd......",
    "........dddddddd........",
]
TINTE = {"d": "#A8700B", "g": ORO, "h": "#FFE39A", "b": BORDEAUX}

# Le stelline a pixel: (x, y, lato, chiara?)
STELLE_LOGO = [(150, 130, 6, 1), (1010, 150, 6, 0), (1100, 330, 4, 1), (60, 420, 4, 0),
               (930, 470, 6, 1), (420, 120, 4, 0), (700, 520, 4, 1), (250, 540, 6, 0)]
STELLE_ICONA = [(60, 70, 10, 1), (430, 90, 8, 0), (70, 420, 8, 0), (440, 410, 10, 1)]


def gettone(x, y, p):
    """Il gettone come rettangoli, uno per ogni tratto orizzontale dello stesso colore."""
    out = []
    for r, riga in enumerate(GETTONE):
        c = 0
        while c < len(riga):
            t, n = riga[c], 1
            while c + n < len(riga) and riga[c + n] == t:
                n += 1
            if t != ".":
                out.append(f'<rect x="{x + c * p:g}" y="{y + r * p:g}" width="{n * p:g}" height="{p:g}" fill="{TINTE[t]}"/>')
            c += n
    return "".join(out)


class Scritta:
    """Testo convertito in tracciato SVG."""

    def __init__(self, percorso):
        self.f = TTFont(percorso)
        self.gs, self.cmap, self.upm = self.f.getGlyphSet(), self.f.getBestCmap(), self.f["head"].unitsPerEm

    def tracciato(self, testo, x, base, corpo, spazio=0):
        """`corpo` = dimensione del carattere, `base` = linea di base, `spazio` = spaziatura tra le lettere."""
        s, pen = corpo / self.upm, SVGPathPen(self.gs)
        for c in testo:
            g = self.gs[self.cmap[ord(c)]]
            g.draw(TransformPen(pen, (s, 0, 0, -s, x, base)))
            x += g.width * s + spazio
        return pen.getCommands()


def svg(w, h, corpo, titolo):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w:g}" height="{h:g}" '
            f'shape-rendering="crispEdges" role="img" aria-label="{titolo}"><title>{titolo}</title>{corpo}</svg>\n')


def stelle(elenco, chiara, scura):
    return "".join(f'<rect x="{x}" y="{y}" width="{l}" height="{l}" fill="{chiara if c else scura}"/>' for x, y, l, c in elenco)


def logo(p, chiaro=False):
    """La tavola 1200x630. Press Start 2P ha lettere larghe quanto il corpo e la linea di base sul fondo."""
    fondo, testo, accento = (CREMA, BORDEAUX, BORDEAUX) if chiaro else (BORDEAUX, CREMA, ORO)
    # Le scritte con i bordi sfumati come le disegna il browser: a queste misure un pixel del carattere
    # non è un numero intero di pixel dello schermo, e con i bordi netti le lettere verrebbero irregolari.
    t = lambda s, x, base, corpo, colore, spazio=0: f'<path shape-rendering="geometricPrecision" fill="{colore}" d="{p.tracciato(s, x, base, corpo, spazio)}"/>'
    c = f'<rect width="1200" height="630" fill="{fondo}"/>'
    c += stelle(STELLE_LOGO, BORDEAUX if chiaro else CREMA, BORDEAUX if chiaro else ORO)
    c += t("PLAYER 1", 72, 66, 18, testo) + t("INSERISCI GETTONE", 1128 - 17 * 18, 66, 18, accento)
    c += gettone(72, 181, 256 / 24)
    titolo, ombra = (BORDEAUX, ORO) if chiaro else (ORO, OMBRA)
    for riga, base in (("SCUSA, NON", 254), ("STASERA.", 332)):
        c += t(riga, 388 + 6, base + 6, 52, ombra) + t(riga, 388, base, 52, titolo)
    c += f'<rect x="388" y="375" width="256" height="54" fill="{BORDEAUX if chiaro else CREMA}"/>'
    c += t("ANZI SÌ!", 404, 417, 28, CREMA if chiaro else BORDEAUX)
    c += t("RISTOMAT", 456, 582, 30, testo, 6)
    return svg(1200, 630, c, "Scusa, non stasera. Anzi sì! Ristomat")


def main():
    IMG.mkdir(exist_ok=True)
    p = Scritta(RADICE / "fonts" / "press-start-2p-latin-400-normal.woff2")
    (IMG / "gettone.svg").write_text(svg(24, 24, gettone(0, 0, 1), "Scusa, non stasera"), "utf-8")
    icona = f'<rect width="512" height="512" fill="{BORDEAUX}"/>' + stelle(STELLE_ICONA, CREMA, ORO) + gettone(76, 76, 15)
    (IMG / "icona.svg").write_text(svg(512, 512, icona, "Scusa, non stasera"), "utf-8")
    (IMG / "logo.svg").write_text(logo(p), "utf-8")
    (IMG / "logo-chiaro.svg").write_text(logo(p, chiaro=True), "utf-8")
    for n in sorted(IMG.glob("*.svg")):
        print(n.relative_to(RADICE), n.stat().st_size // 1024 or 1, "KB")


if __name__ == "__main__":
    main()
