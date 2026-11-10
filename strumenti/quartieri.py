"""Quartieri di Roma per "Scusa, non stasera".

Ogni quartiere ha un centro approssimato (lat, lon), un'area per il menu e,
nel tratto centrale, la sponda del Tevere (E = sinistra/centro, W = destra).
Un locale va al quartiere più vicino sulla sua stessa sponda; oltre MAX_KM
finisce in "Periferia". Per correggere un caso singolo usa correzioni.json
con il campo "q".
"""
import math

AREE = ["Centro", "Sponda ovest", "Nord", "Est", "Sud"]

QUARTIERI = [
    # nome, area, lat, lon, sponda
    ("Navona · Campo de' Fiori", "Centro", 41.8962, 12.4718, "E"),
    ("Pantheon", "Centro", 41.8990, 12.4768, "E"),
    ("Ghetto", "Centro", 41.8925, 12.4785, "E"),
    ("Spagna · Popolo", "Centro", 41.9068, 12.4790, "E"),
    ("Trevi · Barberini", "Centro", 41.9015, 12.4850, "E"),
    ("Monti", "Centro", 41.8950, 12.4920, "E"),
    ("Esquilino", "Centro", 41.8948, 12.5040, "E"),
    ("San Lorenzo", "Centro", 41.8975, 12.5160, "E"),
    ("Celio · Colosseo", "Centro", 41.8865, 12.4960, "E"),
    ("Aventino · San Saba", "Centro", 41.8810, 12.4855, "E"),
    ("Testaccio", "Centro", 41.8768, 12.4755, "E"),
    ("Trastevere", "Sponda ovest", 41.8890, 12.4700, "W"),
    ("Monteverde", "Sponda ovest", 41.8800, 12.4600, "W"),
    ("Marconi · Portuense", "Sponda ovest", 41.8590, 12.4640, "W"),
    ("Magliana", "Sponda ovest", 41.8420, 12.4420, "W"),
    ("Borgo · San Pietro", "Sponda ovest", 41.9025, 12.4605, "W"),
    ("Prati", "Sponda ovest", 41.9085, 12.4625, "W"),
    ("Mazzini · Delle Vittorie", "Sponda ovest", 41.9175, 12.4610, "W"),
    ("Trionfale", "Sponda ovest", 41.9100, 12.4480, "W"),
    ("Aurelio", "Sponda ovest", 41.8990, 12.4420, "W"),
    ("Flaminio", "Nord", 41.9245, 12.4720, "E"),
    ("Ponte Milvio", "Nord", 41.9370, 12.4670, None),
    ("Parioli", "Nord", 41.9225, 12.4935, "E"),
    ("Salario · Trieste", "Nord", 41.9160, 12.5085, "E"),
    ("Castro Pretorio · Porta Pia", "Nord", 41.9060, 12.5020, "E"),
    ("Nomentano · Bologna", "Nord", 41.9130, 12.5210, "E"),
    ("Montesacro · Talenti", "Nord", 41.9440, 12.5330, "E"),
    ("Pigneto", "Est", 41.8880, 12.5310, "E"),
    ("Torpignattara", "Est", 41.8790, 12.5380, "E"),
    ("Centocelle", "Est", 41.8780, 12.5600, "E"),
    ("Tiburtino · Casal Bertone", "Est", 41.9010, 12.5320, "E"),
    ("San Giovanni · Re di Roma", "Sud", 41.8805, 12.5125, "E"),
    ("Appio Latino · Tuscolano", "Sud", 41.8690, 12.5230, "E"),
    ("Quadraro · Cinecittà", "Sud", 41.8550, 12.5470, "E"),
    ("Ostiense", "Sud", 41.8710, 12.4815, "E"),
    ("Garbatella", "Sud", 41.8620, 12.4885, "E"),
    ("EUR", "Sud", 41.8330, 12.4700, "E"),
]
PERIFERIA = "Periferia"
MAX_KM = 2.6

# Tevere nel tratto centrale, da nord a sud (lat, lon della mezzeria, approssimata)
TEVERE = [
    (41.9125, 12.4705), (41.9105, 12.4722), (41.9045, 12.4728), (41.9025, 12.4715),
    (41.9017, 12.4665), (41.8995, 12.4650), (41.8963, 12.4653), (41.8922, 12.4706),
    (41.8907, 12.4745), (41.8902, 12.4775), (41.8886, 12.4796), (41.8840, 12.4777),
    (41.8810, 12.4749), (41.8780, 12.4706), (41.8745, 12.4675), (41.8700, 12.4700),
    (41.8660, 12.4735), (41.8600, 12.4760), (41.8560, 12.4745),
]


def sponda(lat, lon):
    """'W' o 'E' nel tratto centrale del Tevere, None fuori dal tratto."""
    if not (TEVERE[-1][0] <= lat <= TEVERE[0][0]):
        return None
    for (la1, lo1), (la2, lo2) in zip(TEVERE, TEVERE[1:]):
        if la2 <= lat <= la1 or la1 <= lat <= la2:
            t = 0 if la1 == la2 else (lat - la1) / (la2 - la1)
            return "W" if lon < lo1 + t * (lo2 - lo1) else "E"
    return None


def km(la1, lo1, la2, lo2):
    r = math.pi / 180
    h = math.sin((la2 - la1) * r / 2) ** 2 + math.cos(la1 * r) * math.cos(la2 * r) * math.sin((lo2 - lo1) * r / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def quartiere(lat, lon):
    s = sponda(lat, lon)
    best = None
    for nome, _, qla, qlo, qs in QUARTIERI:
        if s and qs and s != qs:
            continue
        d = km(lat, lon, qla, qlo)
        if best is None or d < best[0]:
            best = (d, nome)
    return best[1] if best and best[0] <= MAX_KM else PERIFERIA
