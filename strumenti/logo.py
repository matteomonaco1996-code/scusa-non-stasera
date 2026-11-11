#!/usr/bin/env python3
"""Disegna il logo di "Scusa, non stasera" e lo scrive in img/ come SVG.

    pip install fonttools brotli
    python3 strumenti/logo.py

Il marchio è un gettone a pixel con una forchetta; la scritta usa Jersey 10 (lo stesso carattere
del sito, licenza OFL in fonts/) convertito in tracciati, così gli SVG non dipendono da nessun font.
I PNG in img/ (icone e anteprima per i link) sono esportazioni di questi SVG.
"""
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

RADICE = Path(__file__).resolve().parent.parent
IMG = RADICE / "img"

# Colori del sito (css/stile.css)
BORDEAUX, VINO, SCURO = "#7A1022", "#3A0610", "#220307"
ORO, ORO_LUCE, ORO_OMBRA = "#FFC233", "#FFE08A", "#C8900F"
CREMA, ROSA = "#FFF4E8", "#F1CFC6"

# Gettone 16x16: k contorno, h luce, g oro, d ombra, f forchetta
GETTONE = [
    "....kkkkkkkk....",
    "..kkhhhhhhggkk..",
    ".kkhhggggggggkk.",
    ".khgffgffgffgdk.",
    "khhgffgffgffgddk",
    "khggffgffgffggdk",
    "khggffffffffggdk",
    "khgggffffffgggdk",
    "khgggggffgggggdk",
    "khgggggffgggggdk",
    "khgggggffgggggdk",
    "kggggggffggggddk",
    ".kgggggffggggdk.",
    ".kkggggggggddkk.",
    "..kkggddddddkk..",
    "....kkkkkkkk....",
]
TINTE = {"k": SCURO, "h": ORO_LUCE, "g": ORO, "d": ORO_OMBRA, "f": BORDEAUX}


def gettone(x, y, p):
    """Il gettone come rettangoli, uno per ogni tratto orizzontale dello stesso colore."""
    out = []
    for r, riga in enumerate(GETTONE):
        c = 0
        while c < 16:
            t = riga[c]
            n = 1
            while c + n < 16 and riga[c + n] == t:
                n += 1
            if t != ".":
                out.append(f'<rect x="{x + c * p:g}" y="{y + r * p:g}" width="{n * p:g}" height="{p:g}" fill="{TINTE[t]}"/>')
            c += n
    return "".join(out)


class Scritta:
    """Testo convertito in un tracciato SVG. `px` è il lato di un pixel del carattere, nelle unità del disegno."""

    def __init__(self, percorso, pixel_font):
        self.f = TTFont(percorso)
        self.gs, self.cmap, self.pf = self.f.getGlyphSet(), self.f.getBestCmap(), pixel_font

    def larghezza(self, testo, px):
        return sum(self.gs[self.cmap[ord(c)]].width for c in testo) * px / self.pf

    def tracciato(self, testo, x, base, px):
        s, pen = px / self.pf, SVGPathPen(self.gs)
        for c in testo:
            g = self.gs[self.cmap[ord(c)]]
            g.draw(TransformPen(pen, (s, 0, 0, -s, x, base)))
            x += g.width * s
        return pen.getCommands()


def cornice(w, h, p, colore):
    """Rettangolo con gli angoli a scalino, come i bordi a pixel del sito."""
    return (f'<path fill="{colore}" d="M{2*p} 0H{w-2*p}V{p}H{w-p}V{2*p}H{w}V{h-2*p}H{w-p}V{h-p}H{w-2*p}V{h}'
            f'H{2*p}V{h-p}H{p}V{h-2*p}H0V{2*p}H{p}V{p}H{2*p}Z"/>')


def svg(w, h, corpo, titolo):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w:g}" height="{h:g}" '
            f'shape-rendering="crispEdges" role="img" aria-label="{titolo}"><title>{titolo}</title>{corpo}</svg>\n')


def marchio_e_scritta(j, x, y):
    """Gettone a sinistra; a destra "Scusa, non stasera." barrato e sotto "Anzi sì!" in oro. Restituisce (svg, larghezza, altezza)."""
    p1, p2, pg = 3, 5, 6            # pixel della prima riga, della seconda, del gettone
    tx = x + 16 * pg + 18           # inizio del testo
    b1 = y + 10 * p1                # linea di base della prima riga (maiuscole alte 10 pixel)
    b2 = b1 + 6 + 12 * p2           # seconda riga: la "ì" è alta 12 pixel
    r1, r2 = "Scusa, non stasera.", "Anzi sì!"
    w1, w2 = j.larghezza(r1, p1), j.larghezza(r2, p2)
    corpo = gettone(x, y, pg)
    # Il barrato passa dietro le lettere, come nel titolo del sito: il nome deve restare leggibile
    corpo += f'<rect x="{tx - p1:g}" y="{b1 - 5 * p1:g}" width="{w1 + p1:g}" height="{2 * p1:g}" fill="{VINO}"/>'
    corpo += f'<path fill="{ROSA}" d="{j.tracciato(r1, tx, b1, p1)}"/>'
    corpo += f'<path fill="{VINO}" d="{j.tracciato(r2, tx + p2, b2 + p2, p2)}"/>'                                    # ombra
    corpo += f'<path fill="{ORO}" d="{j.tracciato(r2, tx, b2, p2)}"/>'
    return corpo, tx - x + max(w1, w2 + p2), 16 * pg


def main():
    IMG.mkdir(exist_ok=True)
    j = Scritta(RADICE / "fonts" / "jersey-10-latin-400-normal.woff2", 75)

    # Icona: gettone su fondo bordeaux (scheda del browser, schermata Home)
    (IMG / "icona.svg").write_text(svg(20, 20, f'<rect width="20" height="20" fill="{BORDEAUX}"/>' + gettone(2, 2, 1), "Scusa, non stasera"), "utf-8")
    # Solo il gettone, senza fondo
    (IMG / "gettone.svg").write_text(svg(16, 16, gettone(0, 0, 1), "Scusa, non stasera"), "utf-8")

    # Logo completo, senza fondo (da usare sul bordeaux) e con il fondo (da usare ovunque)
    corpo, w, h = marchio_e_scritta(j, 0, 0)
    (IMG / "logo-trasparente.svg").write_text(svg(w, h, corpo, "Scusa, non stasera. Anzi sì!"), "utf-8")
    m = 20
    corpo, w, h = marchio_e_scritta(j, m, m)
    W, H = w + 2 * m, h + 2 * m
    (IMG / "logo.svg").write_text(svg(W, H, cornice(W, H, 5, BORDEAUX) + corpo, "Scusa, non stasera. Anzi sì!"), "utf-8")

    # Anteprima per i link condivisi (1200x630)
    f = Scritta(RADICE / "fonts" / "figtree-latin-500-normal.woff2", 1)
    W, H, pg, p1, p2 = 1200, 630, 15, 6, 12
    gx, gy = 64, (H - 16 * pg) // 2 - 22
    tx = gx + 16 * pg + 48
    b1 = gy + 10 * p1
    b2 = b1 + 26 + 12 * p2
    r1, r2 = "Scusa, non stasera.", "Anzi sì!"
    w1 = j.larghezza(r1, p1)
    sottotitolo = "Il gioco per uscire senza programmare."
    k = 40 / f.f["head"].unitsPerEm
    corpo = f'<rect width="{W}" height="{H}" fill="{BORDEAUX}"/><rect y="{H - 24}" width="{W}" height="24" fill="{VINO}"/>'
    corpo += gettone(gx, gy, pg)
    corpo += f'<rect x="{tx - p1}" y="{b1 - 5 * p1}" width="{w1 + p1:g}" height="{2 * p1}" fill="{VINO}"/><path fill="{ROSA}" d="{j.tracciato(r1, tx, b1, p1)}"/>'
    corpo += f'<path fill="{VINO}" d="{j.tracciato(r2, tx + p2, b2 + p2, p2)}"/><path fill="{ORO}" d="{j.tracciato(r2, tx, b2, p2)}"/>'
    corpo += f'<path fill="{CREMA}" shape-rendering="auto" d="{f.tracciato(sottotitolo, tx, b2 + 82, k)}"/>'
    (IMG / "anteprima.svg").write_text(svg(W, H, corpo, "Scusa, non stasera. Anzi sì! Il gioco per uscire senza programmare."), "utf-8")
    for n in sorted(IMG.glob("*.svg")):
        print(n.relative_to(RADICE), n.stat().st_size // 1024 or 1, "KB")


if __name__ == "__main__":
    main()
