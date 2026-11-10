// Scusa, non stasera — logica di gioco (mondi, livelli, power-up, risultati, mappa).
// Espone window.SNS per js/conto.js (account, punti, recensioni).
(() => {
  "use strict";
  const DATA = window.RISTOMAT || [];
  const META = window.RISTOMAT_META || {};

  // ---------- Icone a pixel (8x8) ----------
  const ICO = {
    casa:    ["...##...", "..####..", ".######.", "########", ".#....#.", ".#.##.#.", ".#.##.#.", ".######."],
    tavola:  ["#.#..#..", "#.#.##..", "#.#.##..", "###.##..", ".#..##..", ".#...#..", ".#...#..", ".#...#.."],
    pizza:   ["########", "########", ".##.###.", ".######.", "..#.##..", "..####..", "...##...", "...##..."],
    calice:  [".#....#.", ".######.", ".######.", "..####..", "...##...", "...##...", "...##...", "..####.."],
    boccale: [".####...", "######..", "#.##.###", "#.##.#.#", "#.##.#.#", "#.##.###", "#.##.#..", "######.."],
    tazza:   ["...#.#..", "..#.#...", "........", "######..", "#....###", "#....#.#", "#....###", ".####..."],
    mondo:   ["..####..", ".#.##.#.", "#..#...#", "######.#", "#.#..###", "#..#...#", ".#.##.#.", "..####.."],
    panino:  ["..####..", ".######.", "########", "........", "########", ".######.", "........", ".######."],
    pesce:   ["........", "....###.", "#..#####", "##.###.#", "#######.", "#..#####", "....###.", "........"],
    carne:   [".....##.", "....####", "...#####", "..####..", ".####...", "###.....", "##......", "#......."],
    borsa:   ["..####..", "..#..#..", "########", "########", "########", "########", "########", "########"],
    mistero: ["..####..", ".##..##.", ".....##.", "....##..", "...##...", "...##...", "........", "...##..."],
    stella:  ["...##...", "...##...", "########", ".######.", "..####..", ".##..##.", ".#....#.", "........"],
    moneta:  ["..####..", ".#....#.", "#..##..#", "#..#...#", "#..#...#", "#..##..#", ".#....#.", "..####.."],
  };
  function svg(nome) {
    let d = "";
    (ICO[nome] || ICO.mistero).forEach((r, y) => [...r].forEach((c, x) => { if (c === "#") d += `M${x} ${y}h1v1h-1z`; }));
    return `<svg class="pxi" viewBox="0 0 8 8" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
  }

  const PW = {
    trattoria:  ["Come a casa", "casa"],
    ristorante: ["A tavola", "tavola"],
    pizza:      ["Pizza, ovvio", "pizza"],
    vino:       ["Un calice", "calice"],
    bar:        ["Due drink", "boccale"],
    dolce:      ["Dolce & caffè", "tazza"],
    mondo:      ["Giro del mondo", "mondo"],
    street:     ["Al volo", "panino"],
    pesce:      ["Sapore di mare", "pesce"],
    carne:      ["Brace & carne", "carne"],
    bottega:    ["Spesa golosa", "borsa"],
    altro:      ["Da scoprire", "mistero"],
  };
  const FASCE = [
    { max: 10, nome: "Sotto casa", diff: "EASY", sotto: "fino a 10 minuti a piedi" },
    { max: 25, nome: "Due passi", diff: "NORMAL", sotto: "10–25 minuti a piedi" },
    { max: Infinity, nome: "Vale il viaggio", diff: "HARD", sotto: "oltre 25 minuti: bici, mezzi o motorino" },
  ];
  const PAGINA = 30;

  const $ = (s) => document.querySelector(s);
  const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtGiorno = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });
  const fmtKm = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });
  const ridotto = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = () => matchMedia("(max-width: 960px)").matches;
  const scorri = (el, block = "start") => el && el.scrollIntoView({ behavior: ridotto() ? "auto" : "smooth", block });
  const memoria = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* memoria non disponibile */ } },
  };

  // ---------- Mondi e livelli ----------
  const CITTA = ["Firenze", "Venezia", "Milano", "Bologna"];
  const mondoDi = (x) => x.c === "Roma" ? "roma" : CITTA.includes(x.c) ? x.c.toLowerCase() : "fuori";
  const perCitta = DATA.reduce((m, x) => (m[x.c] = (m[x.c] || 0) + 1, m), {});
  const perId = new Map();
  DATA.forEach((x, i) => {
    x.i = i; x.m = mondoDi(x);
    x.l = x.m === "roma" ? (x.q || "Periferia") : x.m === "fuori" ? (perCitta[x.c] >= 3 && x.c !== "Altre località" ? x.c : `Altro in ${x.r}`) : "";
    x.h = norm([x.n, x.a, x.nt, x.c, x.q, PW[x.t] && PW[x.t][0]].join(" "));
    perId.set(x.id, x);
  });
  const MONDI = [{ id: "roma", nome: "Roma" }, ...CITTA.map((c) => ({ id: c.toLowerCase(), nome: c })), { id: "fuori", nome: "Fuori porta" }]
    .map((m, k) => ({ ...m, w: k + 1, n: DATA.filter((x) => x.m === m.id).length })).filter((m) => m.n);

  const LIVELLI = {};
  {
    const q = (META.quartieri || []).filter((z) => DATA.some((x) => x.l === z.n));
    const aree = (META.aree || []).map((a) => ({ nome: a, livelli: q.filter((z) => z.a === a) })).filter((a) => a.livelli.length);
    if (DATA.some((x) => x.l === "Periferia")) aree.push({ nome: "Fuori dal centro", livelli: [{ n: "Periferia" }] });
    let k = 0;
    aree.forEach((a) => a.livelli.forEach((z) => { z.cod = `1-${String(++k).padStart(2, "0")}`; z.conta = DATA.filter((x) => x.l === z.n).length; }));
    LIVELLI.roma = aree;
    const reg = {};
    DATA.filter((x) => x.m === "fuori").forEach((x) => { reg[x.r] = reg[x.r] || {}; reg[x.r][x.l] = (reg[x.r][x.l] || 0) + 1; });
    const w = MONDI.find((m) => m.id === "fuori");
    const somma = (o) => Object.values(o).reduce((s, v) => s + v, 0);
    let j = 0;
    LIVELLI.fuori = Object.entries(reg).sort((a, b) => somma(b[1]) - somma(a[1])).map(([r, cs]) => ({
      nome: r,
      livelli: Object.entries(cs).sort((a, b) => a[0].startsWith("Altro") - b[0].startsWith("Altro") || b[1] - a[1] || a[0].localeCompare(b[0], "it"))
        .map(([c, n]) => ({ n: c, conta: n, cod: `${w ? w.w : 6}-${String(++j).padStart(2, "0")}` })),
    }));
  }
  const tuttiLivelli = (m) => (LIVELLI[m] || []).flatMap((a) => a.livelli);
  const centro = (lv) => {
    const z = (META.quartieri || []).find((q) => q.n === lv);
    if (z) return z;
    const arr = DATA.filter((x) => x.l === lv);
    return arr.length ? { la: arr.reduce((s, x) => s + x.la, 0) / arr.length, lo: arr.reduce((s, x) => s + x.lo, 0) / arr.length } : null;
  };

  // Tevere stilizzato (da nord a sud), solo per disegnare: non è un tracciato esatto
  const TEVERE = [[41.9620, 12.4960], [41.9540, 12.4860], [41.9445, 12.4762], [41.9395, 12.4700], [41.9355, 12.4670],
    [41.9300, 12.4655], [41.9230, 12.4672], [41.9180, 12.4695], [41.9125, 12.4705], [41.9105, 12.4722], [41.9045, 12.4728],
    [41.9025, 12.4715], [41.9017, 12.4665], [41.8995, 12.4650], [41.8963, 12.4653], [41.8922, 12.4706], [41.8907, 12.4745],
    [41.8902, 12.4775], [41.8886, 12.4796], [41.8840, 12.4777], [41.8810, 12.4749], [41.8780, 12.4706], [41.8745, 12.4675],
    [41.8700, 12.4700], [41.8660, 12.4735], [41.8600, 12.4760], [41.8560, 12.4745], [41.8500, 12.4720], [41.8460, 12.4650],
    [41.8440, 12.4560], [41.8430, 12.4470], [41.8390, 12.4390], [41.8320, 12.4330]];

  const stato = { mondo: "roma", livello: "", vicino: false, pos: null, posLv: "", voglia: "", consigli: false, q: "", mostrati: PAGINA, vista: "lista", pescato: null };

  // ---------- Distanze e link ----------
  function km(a, b) {
    const R = 6371, r = Math.PI / 180;
    const h = Math.sin((b.la - a.la) * r / 2) ** 2 + Math.cos(a.la * r) * Math.cos(b.la * r) * Math.sin((b.lo - a.lo) * r / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const minuti = (k) => Math.max(1, Math.round(k * 1000 * 1.3 / 80));
  function distanza(x) {
    if (!stato.pos) return "";
    const m = minuti(x.km);
    return m <= 45 ? `${m} min<small>a piedi</small>` : `${x.km < 100 ? fmtKm.format(x.km) : Math.round(x.km)} km<small>da qui</small>`;
  }
  const distTesto = (x) => distanza(x).replace(/<small>(.*?)<\/small>/, " $1");
  const fascia = (x) => FASCE.findIndex((f) => minuti(x.km) <= f.max);
  const sembraIndirizzo = (x) => !x.a || /^segnaposto/i.test(x.n) || /^(via|viale|piazza|piazzale|largo|vicolo)\b/i.test(x.n);
  const dest = (x) => sembraIndirizzo(x) ? `${x.la},${x.lo}` : `${x.n}, ${x.a}`;
  const linkMaps = (x) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(dest(x));
  const linkVai = (x) => "https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=" + encodeURIComponent(dest(x));
  const luogo = (x) => x.m === "roma" ? (x.l === "Periferia" ? "Roma" : x.l) : x.c === "Altre località" ? (x.r || "") : x.c;
  const via = (x) => (x.a || "").replace(/,\s*\d{5}.*$/, "");
  const EXT = 'target="_blank" rel="noopener noreferrer"';

  // ---------- Filtri ----------
  function passa(x, salta) {
    if (!stato.vicino && x.m !== stato.mondo) return false;
    if (stato.livello && x.l !== stato.livello) return false;
    if (salta !== "voglia" && stato.voglia && x.t !== stato.voglia) return false;
    if (salta !== "consigli" && stato.consigli && !x.nt) return false;
    if (stato.q) for (const p of stato.q.split(/\s+/)) if (p && !x.h.includes(p)) return false;
    return true;
  }
  function risultati() {
    const r = DATA.filter((x) => passa(x));
    if (stato.pos) r.sort((a, b) => a.km - b.km);
    else r.sort((a, b) => (!!b.nt - !!a.nt) || (b.d || 0) - (a.d || 0));
    return r;
  }

  // ---------- Disegno: mondi, livelli, power-up ----------
  function disegnaMondi() {
    $("#mondi").innerHTML = MONDI.map((m) => `<button type="button" class="tab px" data-mondo="${m.id}" aria-pressed="${!stato.vicino && stato.mondo === m.id}">
      <span class="w">MONDO ${m.w}</span><span class="nm">${esc(m.nome)}</span><span class="ct">× ${m.n} posti</span></button>`).join("");
    const nomeTutto = stato.mondo === "roma" ? "Tutta Roma" : stato.mondo === "fuori" ? "Tutto fuori porta" : "Tutta " + MONDI.find((m) => m.id === stato.mondo).nome;
    const tutti = `<div class="area"><div class="levels"><button type="button" class="level px" data-livello="" aria-pressed="${!stato.vicino && !stato.livello}">
      <span class="cod">TUTTO</span><span class="nm">${esc(nomeTutto)}</span><span class="ct">× ${DATA.filter((x) => x.m === stato.mondo).length}</span></button></div></div>`;
    $("#livelli").innerHTML = tutti + (LIVELLI[stato.mondo] || []).map((a) => `<div class="area"><h3>${esc(a.nome.toUpperCase())}</h3><div class="levels">${
      a.livelli.map((z) => `<button type="button" class="level px" data-livello="${esc(z.n)}" aria-pressed="${stato.livello === z.n}">
        ${stato.posLv === z.n ? `<span class="qui">SEI QUI</span>` : ""}
        <span class="cod">LIVELLO ${z.cod}</span><span class="nm">${esc(z.n)}</span><span class="ct">× ${z.conta}</span></button>`).join("")
    }</div></div>`).join("");
    $("#sott-mondi").textContent = stato.mondo === "roma" ? "Roma è divisa in quartieri: ogni quartiere è un livello."
      : stato.mondo === "fuori" ? "Gite, mare e borghi: ogni località è un livello." : "Un mondo, un livello: tutta la città.";
  }
  // ---------- Mappa del mondo (Roma): disegnata qui, senza servizi esterni ----------
  function disegnaOverworld() {
    const fig = $("#overworld");
    if (stato.mondo !== "roma" || !(META.quartieri || []).length) { fig.hidden = true; return; }
    fig.hidden = false;
    const C0 = { la: 41.892, lo: 12.488 }, kx = 111.32 * Math.cos(C0.la * Math.PI / 180), ky = 110.57;
    const proietta = (la, lo) => {           // lente: allarga il centro, comprime la periferia
      const dx = (lo - C0.lo) * kx, dy = (C0.la - la) * ky, r = Math.hypot(dx, dy);
      if (!r) return [0, 0];
      const f = Math.pow(r, 0.68) / r;
      return [dx * f, dy * f];
    };
    const livelli = tuttiLivelli("roma").filter((z) => z.n !== "Periferia").map((z) => ({ ...z, ...(META.quartieri.find((q) => q.n === z.n) || {}) }));
    const pts = livelli.map((z) => proietta(z.la, z.lo));
    const fiume = TEVERE.map(([la, lo]) => proietta(la, lo));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs) - .55, maxX = Math.max(...xs) + .55, minY = Math.min(...ys) - .45, maxY = Math.max(...ys) + .45;
    const W = 600, s = W / (maxX - minX), H = Math.round((maxY - minY) * s), G = 6;
    const xy = ([x, y]) => [(x - minX) * s, (y - minY) * s];
    const snap = (v) => Math.round(v / G) * G;
    // Fiume a quadretti (Bresenham sulla griglia)
    const celle = new Set();
    const fp = fiume.map(xy).map(([x, y]) => [Math.round(x / G), Math.round(y / G)]);
    for (let i = 1; i < fp.length; i++) {
      let [x0, y0] = fp[i - 1]; const [x1, y1] = fp[i];
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
      for (;;) { celle.add(`${x0},${y0}`); celle.add(`${x0 + 1},${y0}`); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
    }
    let d = "";
    celle.forEach((c) => { const [cx, cy] = c.split(",").map(Number); if (cx * G >= 0 && cx * G < W && cy * G >= 0 && cy * G < H) d += `M${cx * G} ${cy * G}h${G}v${G}h-${G}z`; });
    // Caselle dei livelli, allontanate se si sovrappongono
    const nodi = livelli.map((z, i) => ({ z, p: xy(pts[i]) }));
    for (let it = 0; it < 120; it++) for (let i = 0; i < nodi.length; i++) for (let j = i + 1; j < nodi.length; j++) {
      const a = nodi[i].p, b = nodi[j].p, dx = b[0] - a[0], dy = b[1] - a[1], dist = Math.hypot(dx, dy) || .01;
      if (dist < 38) { const k = (38 - dist) / 2 / dist; a[0] -= dx * k; a[1] -= dy * k; b[0] += dx * k; b[1] += dy * k; }
    }
    // Nomi: per ogni casella prova destra, sinistra, sotto, sopra e prende il primo lato libero
    const ostacoli = nodi.map(({ p }) => [snap(p[0]) - 13, snap(p[1]) - 13, 26, 26]);
    const urta = (r) => ostacoli.some((o) => r[0] < o[0] + o[2] && r[0] + r[2] > o[0] && r[1] < o[1] + o[3] && r[1] + r[3] > o[1]);
    nodi.forEach((n) => {
      const nome = n.z.n.split(" · ")[0], w = nome.length * 7.4 + 4, x = snap(n.p[0]) - 12, y = snap(n.p[1]) - 12;
      const lati = [
        { r: [x + 27, y + 4, w, 16], tx: x + 28, ty: y + 16, a: "start" },
        { r: [x - 3 - w, y + 4, w, 16], tx: x - 4, ty: y + 16, a: "end" },
        { r: [x + 12 - w / 2, y + 27, w, 16], tx: x + 12, ty: y + 39, a: "middle" },
        { r: [x + 12 - w / 2, y - 19, w, 16], tx: x + 12, ty: y - 6, a: "middle" },
      ].filter((l) => l.r[0] >= 0 && l.r[0] + l.r[2] <= W && l.r[1] >= 0 && l.r[1] + l.r[3] <= H);
      const scelto = lati.find((l) => !urta(l.r)) || lati[0];
      n.nome = { testo: nome, ...scelto };
      if (scelto) ostacoli.push(scelto.r);
    });
    const visti = new Set([...(SNS.visitati || [])].map((id) => perId.get(id)).filter(Boolean).map((x) => x.l));
    let io = "";
    if (stato.pos && stato.posLv && stato.mondo === "roma") {
      const [px, py] = xy(proietta(stato.pos.la, stato.pos.lo));
      if (px > 0 && px < W && py > 0 && py < H) io = `<g class="ow-io" aria-hidden="true"><rect x="${snap(px) - 7}" y="${snap(py) - 7}" width="14" height="14"/></g>`;
    }
    $("#ow-svg").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Mappa dei quartieri di Roma" shape-rendering="crispEdges">
      <path class="ow-fiume" d="${d}"/>
      ${nodi.map((n) => { const { z, p } = n;
        const x = snap(p[0]) - 12, y = snap(p[1]) - 12;
        const cls = stato.livello === z.n ? "on" : visti.has(z.n) ? "fatto" : "";
        return `<g class="ow-nodo ${cls}" data-livello="${esc(z.n)}" tabindex="0" role="button" aria-label="Livello ${z.cod}: ${esc(z.n)}, ${z.conta} posti">
          <title>${esc(z.n)} · ${z.conta} posti</title><rect x="${x}" y="${y}" width="24" height="24"/><text x="${x + 12}" y="${y + 17}" text-anchor="middle">${z.cod.split("-")[1]}</text>
          ${n.nome && n.nome.tx !== undefined ? `<text class="ow-nome" x="${n.nome.tx}" y="${n.nome.ty}" text-anchor="${n.nome.a}">${esc(n.nome.testo)}</text>` : ""}</g>`;
      }).join("")}
      ${io}
    </svg>`;
    // Area cliccabile invisibile che copre casella e nome
    $("#ow-svg").querySelectorAll(".ow-nodo").forEach((g) => {
      const bb = g.getBBox(), r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      r.setAttribute("class", "ow-hit"); r.setAttribute("x", bb.x - 3); r.setAttribute("y", bb.y - 3);
      r.setAttribute("width", bb.width + 6); r.setAttribute("height", bb.height + 6);
      g.insertBefore(r, g.firstChild);
    });
    const z = stato.livello && livelli.find((l) => l.n === stato.livello);
    $("#ow-info").textContent = z ? `Livello ${z.cod}: ${z.n} · ${z.conta} posti` : "Tocca un quartiere per giocare quel livello. Le caselle verdi sono quartieri dove hai già fatto check-in. Mappa disegnata a mano, non in scala.";
  }

  function disegnaPowerup() {
    const base = DATA.filter((x) => passa(x, "voglia"));
    const c = base.reduce((m, x) => (m[x.t] = (m[x.t] || 0) + 1, m), {});
    const ordine = Object.keys(PW).filter((k) => k !== "altro").sort((a, b) => (c[b] || 0) - (c[a] || 0)).concat("altro");
    $("#powerups").innerHTML = `<button type="button" class="pw px" data-voglia="" aria-pressed="${!stato.voglia}">${svg("stella")}Tutto <span class="n">${base.length}</span></button>` +
      ordine.map((k) => `<button type="button" class="pw px" data-voglia="${k}" aria-pressed="${stato.voglia === k}" ${!c[k] && stato.voglia !== k ? "disabled" : ""}>${svg(PW[k][1])}${esc(PW[k][0])} <span class="n">${c[k] || 0}</span></button>`).join("");
    const b = $("#consigli");
    b.innerHTML = `${svg("stella")}Solo i consigli di Matteo <span class="n">${DATA.filter((x) => passa(x, "consigli") && x.nt).length}</span>`;
    b.setAttribute("aria-pressed", stato.consigli);
  }

  // ---------- Disegno: risultati ----------
  function scheda(x) {
    const extra = SNS.extraScheda ? SNS.extraScheda(x) : "";
    return `<article class="card px" id="p${x.i}">
      <div class="card-top">
        <h4><button type="button" data-mappa="${x.i}" title="Mostra sulla mappa">${esc(x.n)}</button></h4>
        ${stato.pos ? `<span class="dist">${distanza(x)}</span>` : ""}
      </div>
      <div class="meta"><span class="tipo">${svg(PW[x.t][1])}${esc(PW[x.t][0])}</span><span class="quart">${esc(luogo(x))}</span></div>
      ${via(x) ? `<div class="addr">${esc(via(x))}</div>` : ""}
      ${x.nt ? `<div class="say"><b>MATTEO</b>${esc(x.nt)}</div>` : ""}
      ${extra}
      <div class="acts">
        <a class="vai" href="${linkVai(x)}" ${EXT}>▶ Portami lì</a>
        <a href="${linkMaps(x)}" ${EXT}>Apri su Maps</a>
      </div>
    </article>`;
  }
  let ultimi = [];
  function intestazione(n, conta) {
    const m = MONDI.find((m) => m.id === stato.mondo);
    let lv, tit;
    if (stato.livello) {
      const z = tuttiLivelli(stato.mondo).find((z) => z.n === stato.livello);
      lv = z ? `LIVELLO ${z.cod}` : `MONDO ${m.w}`; tit = stato.livello;
    } else if (stato.vicino) {
      lv = stato.posLv ? `SEI DALLE PARTI DI ${stato.posLv.toUpperCase()}` : "PLAYER 1"; tit = "Vicino a te";
    } else { lv = `MONDO ${m.w}`; tit = m.id === "roma" ? "Tutta Roma" : m.id === "fuori" ? "Fuori porta" : m.nome; }
    $("#lv").textContent = lv; $("#titolo-ris").textContent = tit;
    $("#conteggio").innerHTML = conta ? `<span class="tot">× ${n} posti · </span>${conta[0]} sotto casa` : `× ${n} ${n === 1 ? "posto" : "posti"}`;
  }
  function disegnaLista() {
    ultimi = risultati();
    const n = ultimi.length, vis = ultimi.slice(0, stato.mostrati);
    let h = "", conta = null;
    if (stato.pos && n) {
      conta = [0, 0, 0]; ultimi.forEach((x) => conta[fascia(x)]++);
      let cur = -1;
      for (const x of vis) {
        const f = fascia(x);
        if (f !== cur) { cur = f; h += `<div class="band"><h3>${FASCE[f].nome}</h3><span class="diff n${f + 1}">${FASCE[f].diff}</span><span>${FASCE[f].sotto} · ${conta[f]}</span></div>`; }
        h += scheda(x);
      }
    } else h = vis.map(scheda).join("");
    $("#cards").innerHTML = n ? h : `<div class="empty"><strong>Nessun posto</strong>Cambia power-up o livello e riprova.</div>`;
    intestazione(n, conta);
    const resto = n - vis.length;
    $("#more").hidden = resto <= 0;
    $("#more").textContent = `Carica altri ${Math.min(PAGINA, resto)} ▼`;
    disegnaProssimi();
  }
  function disegnaProssimi() {
    const box = $("#next-lv");
    if (stato.vicino || stato.mondo !== "roma" || !stato.livello || stato.livello === "Periferia") { box.hidden = true; return; }
    const c = centro(stato.livello);
    const vicini = tuttiLivelli("roma").filter((z) => z.n !== stato.livello && z.n !== "Periferia")
      .map((z) => ({ ...z, d: km(c, centro(z.n)) })).sort((a, b) => a.d - b.d).slice(0, 3);
    box.innerHTML = `<h3>Prossimo livello ▶</h3><div class="levels">${vicini.map((z) => `<button type="button" class="level px" data-livello="${esc(z.n)}" aria-pressed="false"><span class="cod">LIVELLO ${z.cod}</span><span class="nm">${esc(z.n)}</span><span class="ct">× ${z.conta}</span></button>`).join("")}</div>`;
    box.hidden = false;
  }
  function aggiorna({ adatta = true } = {}) {
    stato.mostrati = PAGINA;
    disegnaMondi(); disegnaOverworld(); disegnaPowerup(); disegnaLista();
    mappa.aggiorna(ultimi, adatta);
    rispondi();
  }

  // ---------- Dialogo ----------
  function domanda() {
    const h = new Date().getHours();
    if (h >= 6 && h < 11) return "Colazione insieme?";
    if (h >= 11 && h < 15) return "Pranziamo fuori?";
    if (h >= 15 && h < 18) return "Aperitivo dopo?";
    if (h >= 18 && h < 23) return "Usciamo stasera?";
    return "Ultimo giro?";
  }
  function rispondi(x) {
    const b = $("#bolla");
    let t;
    if (!x && !stato.vicino && !stato.livello) t = "Anzi sì! Premi start e dimmi dove sono.";
    else {
      x = x || ultimi[0];
      if (!x) t = "Anzi sì… ma qui non trovo niente. Cambiamo livello?";
      else if (stato.pos && x.km !== undefined) { const m = minuti(x.km); t = `Anzi sì: <b>${esc(x.n)}</b>, ${m <= 45 ? `a ${m} ${m === 1 ? "minuto" : "minuti"} a piedi` : `a ${fmtKm.format(x.km)} km`}. Ci vediamo lì?`; }
      else t = `Anzi sì: <b>${esc(x.n)}</b>, a ${esc(luogo(x))}. Ci vediamo lì?`;
    }
    b.innerHTML = t; b.dataset.i = x ? x.i : "";
  }

  // ---------- Mappa: i punti sempre, lo sfondo solo su richiesta ----------
  const mappa = (() => {
    const el = $("#mappa");
    if (!window.L) { el.innerHTML = `<div class="map-gate"><b>Mappa non disponibile</b>La lista funziona lo stesso.</div>`; return { aggiorna() {}, vai() {}, posizione() {}, mostra() {}, ridisegna() {} }; }
    const nascostaSubito = () => el.offsetParent === null || !el.clientWidth;
    const m = L.map(el, { zoomControl: true, attributionControl: true }).setView([41.9, 12.49], 12);
    m.attributionControl.setPrefix(false);
    m.attributionControl.addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>');
    // Mappa ospitata sul sito (mappa/roma.js, dati OpenStreetMap): strade, Tevere, parchi. Sempre visibile, nessun server esterno.
    const tela = L.canvas({ padding: 0.4 });
    const dec = (a) => { const out = []; let la = 0, lo = 0; for (let i = 0; i < a.length; i += 2) { la += a[i]; lo += a[i + 1]; out.push([la / 1e5, lo / 1e5]); } return out; };
    let vie = null, disegnata = false;
    function disegnaBase() {
      const D = window.SNS_MAPPA && window.SNS_MAPPA.roma;
      if (!D || disegnata) return;
      disegnata = true;
      const op = { renderer: tela, interactive: false, smoothFactor: 1.2 };
      if (D.parchi.length) L.polygon(D.parchi.map(dec), { ...op, stroke: false, fillColor: "#2F3F24", fillOpacity: 1 }).addTo(m);
      strati.fiume = L.polyline(D.fiumi.map(dec), { ...op, color: "#3E6A8C", lineCap: "round" }).addTo(m);
      vie = L.polyline(D.vie.map(dec), { ...op, color: "#4F3A29" });
      strati.medie = L.polyline(D.medie.map(dec), { ...op, color: "#6E4D33" }).addTo(m);
      strati.grandi = L.polyline(D.grandi.map(dec), { ...op, color: "#8E6840" }).addTo(m);
      mostraVie();
      if (fiumeDisegnato) { m.removeLayer(fiumeDisegnato); fiumeDisegnato = null; }
      base.forEach((l) => l.bringToFront && l.bringToFront());
    }
    // Spessori in base allo zoom: da lontano poche linee sottili, da vicino tutte le vie
    const strati = {};
    const SPESSORI = { fiume: [2.5, 4, 6, 9, 12], grandi: [.8, 1.4, 2.4, 3.6, 4.6], medie: [0, .7, 1.5, 2.4, 3.2], vie: [0, 0, .9, 1.6, 2.2] };
    const livello = () => Math.max(0, Math.min(4, m.getZoom() - 11));
    const mostraVie = () => {
      const k = livello();
      Object.entries(strati).forEach(([n, l]) => l.setStyle({ weight: SPESSORI[n][k], opacity: SPESSORI[n][k] ? 1 : 0 }));
      if (vie) { if (SPESSORI.vie[k]) { vie.setStyle({ weight: SPESSORI.vie[k] }); vie.addTo(m); } else m.removeLayer(vie); }
      el.classList.toggle("zoom-lontano", m.getZoom() < 13);
    };
    m.on("zoomend", mostraVie);
    let caricando = false;
    function caricaBase() {
      if (window.SNS_MAPPA && window.SNS_MAPPA.roma) return disegnaBase();
      if (caricando) return;
      caricando = true;
      const sc = document.createElement("script");
      sc.src = "mappa/roma.js"; sc.onload = disegnaBase;
      document.body.appendChild(sc);
    }
    let tiles = null;
    const gate = document.createElement("div");
    gate.className = "map-gate";
    gate.innerHTML = `<button class="btn mini alt" type="button" data-sfondo title="Carica lo sfondo con i nomi delle vie da CARTO: riceverà il tuo indirizzo IP (vedi Privacy)" aria-label="Carica i nomi delle vie da CARTO, che riceverà il tuo indirizzo IP">Nomi vie · CARTO</button>`;
    function accendi(ricorda) {
      if (tiles) return;
      tiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '© <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
        subdomains: "abcd", maxZoom: 20, referrerPolicy: "no-referrer",
      }).addTo(m);
      gate.remove();
      if (ricorda) memoria.set("sns-sfondo-mappa", "si");
      $("#spegni-mappa").hidden = false;
    }
    function spegni() {
      if (tiles) { m.removeLayer(tiles); tiles = null; }
      memoria.set("sns-sfondo-mappa", null);
      el.appendChild(gate);
      $("#spegni-mappa").hidden = true;
    }
    gate.addEventListener("click", (e) => { if (e.target.closest("[data-sfondo]")) accendi(true); });
    $("#spegni-mappa").addEventListener("click", spegni);
    if (memoria.get("sns-sfondo-mappa") === "si") accendi(false); else el.appendChild(gate);

    // Finché la mappa vera non è caricata: Tevere disegnato. Sempre: nomi dei quartieri.
    let fiumeDisegnato = L.polyline(TEVERE, { className: "base-fiume", interactive: false }).addTo(m);
    const base = [];
    (META.quartieri || []).forEach((q) => base.push(L.marker([q.la, q.lo], {
      icon: L.divIcon({ className: "", html: `<span class="base-quartiere">${esc(q.n.split(" · ")[0])}</span>`, iconSize: [0, 0] }),
      interactive: false, keyboard: false,
    }).addTo(m)));
    if (!nascostaSubito()) caricaBase();
    const strato = L.layerGroup().addTo(m);
    const punti = new Map();
    let io = null, ultima = [], daAdattare = false;
    const icona = (cls, s) => L.divIcon({ className: "", html: `<span class="pin ${cls}"></span>`, iconSize: [s, s], iconAnchor: [s / 2, s / 2] });
    const I = { base: icona("", 12), nota: icona("nota", 14), visto: icona("visto", 12), io: icona("io", 16) };
    function popup(x) {
      return `<strong>${esc(x.n)}</strong><div>${esc(PW[x.t][0])} · ${esc(luogo(x))}${stato.pos ? " · " + distTesto(x) : ""}</div>` +
        `<div class="popup-acts"><a href="${linkVai(x)}" ${EXT}>▶ Portami lì</a><a href="#p${x.i}" data-scheda="${x.i}">Scheda</a></div>`;
    }
    const nascosta = () => el.offsetParent === null || !el.clientWidth;
    function adattaA(lista) {
      let pts = lista.map((x) => [x.la, x.lo]);
      if (stato.pos && stato.vicino) {
        const vicini = lista.filter((x) => minuti(x.km) <= 25);
        pts = (vicini.length >= 3 ? vicini : lista.slice(0, 8)).map((x) => [x.la, x.lo]).concat([[stato.pos.la, stato.pos.lo]]);
      }
      if (pts.length) m.fitBounds(L.latLngBounds(pts).pad(0.12), { maxZoom: 16, animate: false });
    }
    function aggiorna(lista, adatta) {
      ultima = lista; strato.clearLayers(); punti.clear();
      const visti = SNS.visitati || new Set();
      for (const x of lista) {
        const ic = visti.has(x.id) ? I.visto : x.nt ? I.nota : I.base;
        punti.set(x.i, L.marker([x.la, x.lo], { icon: ic, keyboard: false }).bindPopup(() => popup(x), { maxWidth: 260 }).addTo(strato));
      }
      if (!adatta) return;
      if (nascosta()) daAdattare = true; else { daAdattare = false; adattaA(lista); }
    }
    function mostra() { caricaBase(); m.invalidateSize(); if (daAdattare) { adattaA(ultima); daAdattare = false; } }
    function vai(i) {
      caricaBase();
      const x = DATA[i]; daAdattare = false; m.invalidateSize();
      m.setView([x.la, x.lo], Math.max(m.getZoom(), 16), { animate: false });
      const mk = punti.get(i);
      if (mk) mk.openPopup(); else L.popup().setLatLng([x.la, x.lo]).setContent(popup(x)).openOn(m);
    }
    function posizione(p) { if (io) { m.removeLayer(io); io = null; } if (p) io = L.marker([p.la, p.lo], { icon: I.io, keyboard: false, zIndexOffset: 1000 }).bindTooltip("Tu").addTo(m); }
    m.on("popupopen", (e) => { const a = e.popup.getElement().querySelector("[data-scheda]"); if (a) a.addEventListener("click", (ev) => { ev.preventDefault(); mostraScheda(+a.dataset.scheda); }); });
    addEventListener("resize", () => m.invalidateSize());
    return { aggiorna, vai, posizione, mostra, ridisegna: () => aggiorna(ultima, false) };
  })();

  // ---------- Avvisi ----------
  let tToast;
  function toast(testo) {
    const t = $("#toast");
    t.textContent = testo; t.hidden = false;
    clearTimeout(tToast); tToast = setTimeout(() => { t.hidden = true; }, 4500);
  }

  // ---------- Azioni ----------
  function start() {
    const msg = $("#geo-msg");
    const errore = (t) => { msg.textContent = t; msg.hidden = false; scorri($("#sez-mondi")); };
    if (!navigator.geolocation) return errore("Niente GPS qui: seleziona il livello a mano.");
    msg.hidden = false; msg.textContent = "Ti cerco…";
    navigator.geolocation.getCurrentPosition((p) => {
      msg.hidden = true;
      stato.pos = { la: p.coords.latitude, lo: p.coords.longitude };
      DATA.forEach((x) => { x.km = km(stato.pos, x); });
      const vicino = DATA.reduce((a, b) => (a.km < b.km ? a : b));
      stato.mondo = vicino.km < 40 ? vicino.m : stato.mondo;
      stato.posLv = vicino.km < 3 ? vicino.l : "";
      stato.livello = ""; stato.vicino = true;
      $("#slot").hidden = true;
      mappa.posizione(stato.pos);
      aggiorna();
      scorri($(".bar"));
    }, () => errore("Niente posizione: consentila nelle impostazioni del browser, o seleziona il livello qui sotto."),
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 });
  }
  function scegliMondo(id) { stato.mondo = id; stato.livello = ""; stato.vicino = false; $("#slot").hidden = true; aggiorna(); }
  function scegliLivello(lv) { stato.livello = lv; stato.vicino = false; $("#slot").hidden = true; aggiorna(); scorri($(".bar")); }
  function impostaVista(v) {
    stato.vista = v; $(".main").dataset.view = v;
    document.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.view === v));
    if (v === "mappa") mappa.mostra();
  }
  function lampeggia(el) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
  function mostraScheda(i) {
    impostaVista("lista");
    let idx = ultimi.findIndex((x) => x.i === i);
    if (idx === -1) { const x = DATA[i]; Object.assign(stato, { mondo: x.m, livello: "", vicino: false, voglia: "", consigli: false, q: "" }); $("#q").value = ""; aggiorna({ adatta: false }); idx = ultimi.findIndex((y) => y.i === i); }
    if (idx >= stato.mostrati) { stato.mostrati = idx + 1; disegnaLista(); }
    const el = document.getElementById("p" + i);
    if (el) { scorri(el, "center"); lampeggia(el); }
  }
  function mostraSuMappa(i) { if (mobile()) impostaVista("mappa"); mappa.vai(i); const el = document.getElementById("p" + i); if (el && !mobile()) lampeggia(el); }

  let giro = null;
  function gettone() {
    let pool = ultimi.length ? ultimi : DATA.filter((x) => x.m === stato.mondo);
    if (stato.pos && stato.vicino) { const v = pool.filter((x) => minuti(x.km) <= 25); if (v.length) pool = v; }
    let x = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && stato.pescato === x.i) x = pool[(pool.indexOf(x) + 1) % pool.length];
    stato.pescato = x.i;
    const box = $("#slot");
    box.hidden = false; impostaVista("lista"); scorri(box);
    box.innerHTML = `<span class="eti">GETTONE INSERITO · ${pool.length} POSTI IN GIOCO</span><div class="rullo" id="rullo">…</div><div id="premio" class="list-col"></div>`;
    clearInterval(giro);
    const fine = () => {
      $("#rullo").textContent = x.n;
      $("#premio").innerHTML = `<div class="meta"><span class="tipo">${svg(PW[x.t][1])}${esc(PW[x.t][0])}</span><span class="quart">${esc(luogo(x))}</span>${stato.pos ? `<span>${distTesto(x)}</span>` : ""}</div>
        ${x.nt ? `<div class="say"><b>MATTEO</b>${esc(x.nt)}</div>` : ""}
        <div class="acts"><a class="btn" href="${linkVai(x)}" ${EXT}>▶ Portami lì</a><button class="btn alt" type="button" data-ancora>Altro gettone</button><button class="btn alt" type="button" data-dett="${x.i}">Dettagli</button></div>`;
      $("#premio [data-ancora]").addEventListener("click", gettone);
      $("#premio [data-dett]").addEventListener("click", () => mostraScheda(x.i));
      rispondi(x);
      if (!mobile()) mappa.vai(x.i);
    };
    if (ridotto() || pool.length < 2) return fine();
    let k = 0;
    giro = setInterval(() => {
      $("#rullo").textContent = pool[Math.floor(Math.random() * pool.length)].n;
      if (++k >= 14) { clearInterval(giro); fine(); }
    }, 70);
  }

  // ---------- Interfaccia per js/conto.js ----------
  const SNS = window.SNS = {
    DATA, perId, PW, esc, svg, luogo, toast, memoria,
    visitati: new Set(),
    extraScheda: null,
    ridisegna() { const m = stato.mostrati; disegnaLista(); if (m > PAGINA) { stato.mostrati = m; disegnaLista(); } disegnaOverworld(); mappa.ridisegna(); },
    start: () => start(),
    mostraScheda: (id) => { const x = perId.get(id); if (x) mostraScheda(x.i); },
  };

  // ---------- Eventi ----------
  $("#m-start").addEventListener("click", start);
  $("#m-livelli").addEventListener("click", () => scorri($("#sez-mondi")));
  $("#m-gettone").addEventListener("click", gettone);
  $("#gettone").addEventListener("click", gettone);
  $("#mondi").addEventListener("click", (e) => { const b = e.target.closest("[data-mondo]"); if (b) scegliMondo(b.dataset.mondo); });
  $("#ow-svg").addEventListener("keydown", (e) => { const n = e.target.closest("[data-livello]"); if (n && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); scegliLivello(n.dataset.livello); } });
  document.addEventListener("click", (e) => {
    const lv = e.target.closest("[data-livello]");
    if (lv) return scegliLivello(lv.dataset.livello);
    const b = e.target.closest("[data-mappa]");
    if (b) mostraSuMappa(+b.dataset.mappa);
  });
  $("#powerups").addEventListener("click", (e) => { const b = e.target.closest("[data-voglia]"); if (!b) return; stato.voglia = stato.voglia === b.dataset.voglia ? "" : b.dataset.voglia; aggiorna(); });
  $("#consigli").addEventListener("click", () => { stato.consigli = !stato.consigli; aggiorna(); });
  let t;
  $("#q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { stato.q = norm(e.target.value.trim()); aggiorna(); }, 160); });
  $("#more").addEventListener("click", () => { stato.mostrati += PAGINA; disegnaLista(); });
  $("#bolla").addEventListener("click", (e) => { const i = e.currentTarget.dataset.i; if (i) mostraScheda(+i); else start(); });
  document.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => impostaVista(b.dataset.view)));
  document.querySelectorAll("dialog [data-chiudi]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));

  // ---------- Avvio ----------
  $("#hi").textContent = String(DATA.length).padStart(6, "0");
  $("#domanda").textContent = domanda();
  $("#fonte").href = META.fonte || "https://www.google.com/maps";
  $("#agg").textContent = META.aggiornato ? fmtGiorno.format(new Date(META.aggiornato + "T12:00:00")) : "";
  document.querySelectorAll("svg[data-ico]").forEach((s) => { s.outerHTML = svg(s.dataset.ico); });
  aggiorna();
})();
