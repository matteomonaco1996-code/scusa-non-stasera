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
    ("Ghetto", "Centro", 41.8930, 12.4775, "E"),
    ("Spagna · Popolo", "Centro", 41.9068, 12.4790, "E"),
    ("Trevi · Barberini", "Centro", 41.9015, 12.4850, "E"),
    ("Monti", "Centro", 41.8950, 12.4920, "E"),
    ("Esquilino", "Centro", 41.8948, 12.5040, "E"),
    ("San Lorenzo", "Centro", 41.8975, 12.5160, "E"),
    ("Celio · Colosseo", "Centro", 41.8865, 12.4960, "E"),
    ("Aventino · Circo Massimo", "Centro", 41.8830, 12.4845, "E"),
    ("Testaccio", "Centro", 41.8768, 12.4755, "E"),
    ("Trastevere", "Sponda ovest", 41.8890, 12.4700, "W"),
    ("Porta Portese", "Sponda ovest", 41.8775, 12.4685, "W"),
    ("Monteverde", "Sponda ovest", 41.8800, 12.4580, "W"),
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
    ("Salario · Trieste", "Nord", 41.9155, 12.5045, "E"),
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

# Tevere da nord a sud (verso della corrente), dal tracciato di OpenStreetMap semplificato a ~12 m.
# © OpenStreetMap contributors, ODbL.
TEVERE = [
    (41.9673, 12.4957), (41.9666, 12.4983), (41.9663, 12.5028), (41.9657, 12.5042), (41.9650, 12.5049),
    (41.9638, 12.5049), (41.9616, 12.5038), (41.9603, 12.5025), (41.9596, 12.5012), (41.9591, 12.4985),
    (41.9591, 12.4955), (41.9598, 12.4924), (41.9598, 12.4901), (41.9595, 12.4896), (41.9590, 12.4892),
    (41.9578, 12.4888), (41.9566, 12.4888), (41.9551, 12.4895), (41.9537, 12.4908), (41.9496, 12.4987),
    (41.9485, 12.5005), (41.9474, 12.5018), (41.9466, 12.5025), (41.9455, 12.5025), (41.9443, 12.5020),
    (41.9435, 12.5013), (41.9428, 12.5003), (41.9425, 12.4995), (41.9421, 12.4967), (41.9421, 12.4932),
    (41.9416, 12.4884), (41.9413, 12.4873), (41.9408, 12.4865), (41.9402, 12.4861), (41.9390, 12.4858),
    (41.9355, 12.4870), (41.9347, 12.4869), (41.9340, 12.4866), (41.9334, 12.4860), (41.9329, 12.4850),
    (41.9328, 12.4839), (41.9330, 12.4832), (41.9360, 12.4791), (41.9366, 12.4773), (41.9366, 12.4750),
    (41.9361, 12.4700), (41.9355, 12.4664), (41.9343, 12.4641), (41.9330, 12.4623), (41.9315, 12.4609),
    (41.9295, 12.4598), (41.9283, 12.4595), (41.9265, 12.4597), (41.9254, 12.4602), (41.9243, 12.4613),
    (41.9231, 12.4632), (41.9218, 12.4684), (41.9213, 12.4693), (41.9203, 12.4702), (41.9187, 12.4708),
    (41.9160, 12.4706), (41.9139, 12.4709), (41.9102, 12.4722), (41.9068, 12.4743), (41.9054, 12.4744),
    (41.9045, 12.4740), (41.9034, 12.4730), (41.9029, 12.4721), (41.9023, 12.4702), (41.9018, 12.4654),
    (41.9011, 12.4642), (41.9005, 12.4637), (41.8999, 12.4635), (41.8991, 12.4636), (41.8965, 12.4656),
    (41.8916, 12.4718), (41.8898, 12.4780), (41.8886, 12.4796), (41.8871, 12.4794), (41.8859, 12.4783),
    (41.8843, 12.4766), (41.8808, 12.4715), (41.8800, 12.4708), (41.8787, 12.4700), (41.8774, 12.4699),
    (41.8759, 12.4703), (41.8716, 12.4721), (41.8687, 12.4736), (41.8672, 12.4747), (41.8654, 12.4768),
    (41.8638, 12.4773), (41.8630, 12.4770), (41.8620, 12.4760), (41.8607, 12.4731), (41.8600, 12.4696),
    (41.8599, 12.4643), (41.8593, 12.4624), (41.8586, 12.4616), (41.8554, 12.4606), (41.8538, 12.4607),
    (41.8527, 12.4616), (41.8522, 12.4625), (41.8493, 12.4702), (41.8488, 12.4709), (41.8480, 12.4714),
    (41.8470, 12.4713), (41.8467, 12.4711), (41.8461, 12.4699), (41.8443, 12.4637), (41.8412, 12.4600),
    (41.8360, 12.4553), (41.8334, 12.4524), (41.8312, 12.4494), (41.8264, 12.4404), (41.8260, 12.4379),
    (41.8262, 12.4355), (41.8274, 12.4335), (41.8319, 12.4298), (41.8332, 12.4277), (41.8332, 12.4253),
    (41.8328, 12.4242), (41.8321, 12.4231), (41.8312, 12.4221), (41.8305, 12.4216), (41.8286, 12.4210),
]


def sponda(lat, lon):
    """'W' (riva destra: Prati, Trastevere) o 'E' (riva sinistra: centro), None fuori dal tratto mappato."""
    if not (TEVERE[-1][0] <= lat <= TEVERE[0][0]):
        return None
    k = math.cos(math.radians(lat))
    px, py = lon * k, lat
    best = None
    for (la1, lo1), (la2, lo2) in zip(TEVERE, TEVERE[1:]):
        ax, ay, bx, by = lo1 * k, la1, lo2 * k, la2
        dx, dy = bx - ax, by - ay
        u = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / ((dx * dx + dy * dy) or 1e-18)))
        d2 = (px - ax - u * dx) ** 2 + (py - ay - u * dy) ** 2
        if best is None or d2 < best[0]:
            best = (d2, dx * (py - ay) - dy * (px - ax))
    return "W" if best[1] < 0 else "E"


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
