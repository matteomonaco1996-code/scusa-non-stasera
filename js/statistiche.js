// Scusa, non stasera — pagina di monitoraggio (statistiche.html).
// Legge i contatori anonimi dal database (supabase/statistiche.sql) e li mostra. I numeri li può leggere
// solo chi è nella tabella "amministratori", dopo l'accesso: questa pagina da sola non contiene nessun dato.
// Solo in prova sul proprio computer (localhost), con ?esempio mostra numeri inventati: sul sito vero no.
(() => {
  "use strict";
  const C = window.SNS_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const SVG = "http://www.w3.org/2000/svg";
  const el = (tag, cls, testo) => { const n = document.createElement(tag); if (cls) n.className = cls; if (testo !== undefined) n.textContent = testo; return n; };
  const svg = (tag, attr = {}, testo) => { const n = document.createElementNS(SVG, tag); for (const k in attr) n.setAttribute(k, attr[k]); if (testo !== undefined) n.textContent = testo; return n; };
  const fmtN = new Intl.NumberFormat("it-IT");
  const fmtEuro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
  const fmtCorto = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });
  const fmtLungo = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
  const fmtMese = new Intl.DateTimeFormat("it-IT", { month: "short", year: "numeric" });
  const data = (iso) => new Date(iso + "T12:00:00");
  const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const piu = (g, n) => { const d = data(g); d.setDate(d.getDate() + n); return iso(d); };

  const AZIONI = [
    ["visita", "Aperture del sito"], ["termini_ok", "Termini accettati"], ["start", "PREMI START"],
    ["posizione_si", "Posizione trovata"], ["posizione_no", "Posizione non trovata"], ["livello", "Quartiere scelto"],
    ["gettone", "Gettoni inseriti"], ["portami", "“Portami lì” toccato"], ["vai", "Indicazioni aperte"], ["maps", "“Apri su Maps”"],
  ];
  const FONTI = {
    da_diretto: "Link diretto", da_google: "Google", da_instagram: "Instagram", da_facebook: "Facebook", da_whatsapp: "WhatsApp",
    da_tiktok: "TikTok", da_telegram: "Telegram", da_qr: "Codice QR", da_volantino: "Volantino", da_amici: "Amici", da_altro: "Altri siti",
  };
  const MONETE = [["dona_apri", "“Dona una moneta” aperto"], ["dona_1", "1 €"], ["dona_2", "2 €"], ["dona_5", "5 €"], ["dona_altro", "Altro"]];

  let sb = null, esempio = false, giorni = 30;
  let dati = { oggi: iso(new Date()), giorno: new Map(), primo: null, donazioni: [] };

  // ---------- Dati ----------
  function prepara(j) {
    const giorno = new Map();
    let primo = null;
    for (const r of (j && j.contatori) || []) {
      if (!giorno.has(r.g)) giorno.set(r.g, {});
      giorno.get(r.g)[r.e] = Number(r.n) || 0;
      if (!primo || r.g < primo) primo = r.g;
    }
    dati = { oggi: (j && j.oggi) || iso(new Date()), giorno, primo, donazioni: ((j && j.donazioni) || []).map((d) => ({ id: d.id, g: d.g, euro: Number(d.euro) || 0 })) };
  }
  const conta = (g, eventi) => { const r = dati.giorno.get(g); return r ? eventi.reduce((s, e) => s + (r[e] || 0), 0) : 0; };
  function somma(eventi, dal, al) { let s = 0; for (let g = dal; g <= al; g = piu(g, 1)) s += conta(g, eventi); return s; }
  const euro = (dal, al) => dati.donazioni.filter((d) => d.g >= dal && d.g <= al).reduce((s, d) => s + d.euro, 0);

  // Numeri inventati ma stabili, per l'esempio
  function finti() {
    let seme = 20261111;
    const caso = () => { seme = (seme + 0x6D2B79F5) | 0; let t = Math.imul(seme ^ (seme >>> 15), 1 | seme); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const oggi = iso(new Date()), contatori = [];
    for (let i = 179; i >= 0; i--) {
      const g = piu(oggi, -i), d = data(g).getDay();
      const visite = Math.round((14 + (179 - i) * 0.22) * (d === 5 || d === 6 ? 1.7 : d === 0 ? 1.3 : 1) * (0.7 + caso() * 0.6));
      const parte = (q) => Math.round(visite * q * (0.6 + caso() * 0.8));
      const r = { visita: visite, termini_ok: parte(0.55), start: parte(0.4), posizione_si: parte(0.27), posizione_no: parte(0.1), livello: parte(0.5),
        gettone: parte(0.45), portami: parte(0.3), vai: parte(0.27), maps: parte(0.12), dona_apri: parte(0.02), dona_1: parte(0.012), dona_2: parte(0.008), dona_5: parte(0.004), dona_altro: parte(0.003) };
      let resto = visite;
      for (const [f, q] of [["da_instagram", 0.34], ["da_qr", 0.12], ["da_google", 0.08], ["da_whatsapp", 0.07], ["da_altro", 0.03]]) { const n = Math.min(resto, parte(q)); r[f] = n; resto -= n; }
      r.da_diretto = resto;
      for (const e in r) if (r[e] > 0) contatori.push({ g, e, n: r[e] });
    }
    const donazioni = [[3, 5], [9, 2], [16, 1], [41, 2], [58, 5], [77, 1], [102, 2], [140, 10]].map(([fa, e], k) => ({ id: 100 - k, g: piu(oggi, -fa), euro: e }));
    return { oggi, contatori, donazioni };
  }

  // ---------- Etichetta che segue dito, mouse o tastiera ----------
  const tip = $("#tip");
  function mostraTip(valore, sotto, x, y) {
    tip.textContent = "";
    tip.append(el("b", "", valore), el("span", "", sotto));
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(x + 14, innerWidth - r.width - 8)) + "px";
    tip.style.top = Math.max(8, y - r.height - 14) + "px";
  }
  const nascondiTip = () => { tip.hidden = true; };

  // ---------- Numeri in evidenza ----------
  function confronto(ora, prima, c) {
    if (!c.conPrecedente) return "Nessun confronto: il contatore è partito da poco";
    const d = ora - prima, coda = ` dei ${giorni} giorni prima`;
    if (Math.abs(d) < 0.005) return "= come i " + giorni + " giorni prima";
    return (d > 0 ? "▲ " : "▼ ") + c.fmt(Math.abs(d)) + (d > 0 ? " in più" : " in meno") + coda;
  }
  function disegnaNumeri(p) {
    const c = { conPrecedente: !!dati.primo && dati.primo < p.dal, fmt: (n) => fmtN.format(n) };
    const voci = [
      ["Visite", ["visita"]], ["Nuovi visitatori", ["termini_ok"]], ["Gettoni inseriti", ["gettone"]], ["Indicazioni aperte", ["vai"]],
    ].map(([nome, ev]) => [nome, fmtN.format(somma(ev, p.dal, p.al)), confronto(somma(ev, p.dal, p.al), somma(ev, p.dalPrima, p.alPrima), c)]);
    const box = $("#numeri");
    box.textContent = "";
    for (const [nome, valore, delta] of voci) {
      const t = el("div", "mon-numero");
      t.append(el("span", "eti", nome), el("span", "val", valore), el("span", "delta", delta));
      box.append(t);
    }
  }

  // ---------- Grafico a linea: visite al giorno ----------
  function tetto(max) {   // il numero tondo subito sopra il massimo, per un asse leggibile
    if (max <= 4) return 4;
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    return [1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10].map((k) => k * p).find((v) => v >= max && Number.isInteger(v / 2));   // anche la metà dev'essere un numero intero
  }
  function disegnaLinea(p) {
    const box = $("#g-visite"), punti = [];
    for (let g = p.dal; g <= p.al; g = piu(g, 1)) punti.push({ g, n: conta(g, ["visita"]) });
    const W = Math.max(280, Math.round(box.clientWidth || 600)), H = 230, m = { l: 36, r: 46, t: 16, b: 26 };
    const N = punti.length, max = Math.max(0, ...punti.map((q) => q.n)), yMax = tetto(max);
    const x = (i) => m.l + (N > 1 ? i * (W - m.l - m.r) / (N - 1) : (W - m.l - m.r) / 2);
    const y = (v) => m.t + (1 - v / yMax) * (H - m.t - m.b);
    const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, "aria-hidden": "true" });
    for (const v of [0, yMax / 2, yMax]) {
      s.append(svg("line", { class: "griglia", x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }));
      s.append(svg("text", { class: "asse", x: m.l - 7, y: y(v) + 4, "text-anchor": "end" }, fmtN.format(v)));
    }
    const etichette = N > 2 ? [[0, "start"], [Math.floor((N - 1) / 2), "middle"], [N - 1, "end"]] : [[0, "start"], [N - 1, "end"]];
    for (const [i, ancora] of etichette) s.append(svg("text", { class: "asse", x: x(i), y: H - 7, "text-anchor": ancora }, fmtCorto.format(data(punti[i].g))));
    box.textContent = "";
    box.append(s);
    $("#tab-visite tbody").replaceChildren(...punti.slice().reverse().map((q) => { const tr = el("tr"); tr.append(el("td", "", fmtLungo.format(data(q.g))), el("td", "", fmtN.format(q.n))); return tr; }));
    if (!max) { s.append(svg("text", { class: "vuoto", x: W / 2, y: H / 2, "text-anchor": "middle" }, "Ancora nessuna visita in questo periodo")); box.onpointermove = box.onkeydown = null; return; }
    const d = punti.map((q, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(q.n).toFixed(1)).join(" ");
    s.append(svg("path", { class: "area", d: `${d} L${x(N - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z` }));
    s.append(svg("path", { class: "linea", d }));
    s.append(svg("circle", { class: "punto", cx: x(N - 1), cy: y(punti[N - 1].n), r: 4 }));
    s.append(svg("text", { class: "fine", x: x(N - 1) + 9, y: y(punti[N - 1].n) + 4 }, fmtN.format(punti[N - 1].n)));
    const mirino = svg("line", { class: "mirino", y1: m.t, y2: H - m.b, visibility: "hidden" }), fuoco = svg("circle", { class: "punto", r: 5, visibility: "hidden" });
    s.append(mirino, fuoco);
    let scelto = -1;
    const punta = (i, cx, cy) => {
      scelto = Math.max(0, Math.min(N - 1, i));
      const q = punti[scelto], r = s.getBoundingClientRect(), k = r.width / W;
      mirino.setAttribute("x1", x(scelto)); mirino.setAttribute("x2", x(scelto)); mirino.setAttribute("visibility", "visible");
      fuoco.setAttribute("cx", x(scelto)); fuoco.setAttribute("cy", y(q.n)); fuoco.setAttribute("visibility", "visible");
      mostraTip(fmtN.format(q.n), (q.n === 1 ? "visita · " : "visite · ") + fmtLungo.format(data(q.g)), cx ?? r.left + x(scelto) * k, cy ?? r.top + y(q.n) * k);
    };
    const via = () => { scelto = -1; mirino.setAttribute("visibility", "hidden"); fuoco.setAttribute("visibility", "hidden"); nascondiTip(); };
    box.onpointermove = (e) => { const r = s.getBoundingClientRect(); punta(Math.round(((e.clientX - r.left) / r.width * W - m.l) / ((W - m.l - m.r) / Math.max(1, N - 1))), e.clientX, e.clientY); };
    box.onpointerleave = via; box.onblur = via;
    box.onkeydown = (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); punta(scelto < 0 ? N - 1 : scelto + (e.key === "ArrowRight" ? 1 : -1)); }
      else if (e.key === "Escape") via();
    };
  }

  // ---------- Barre orizzontali ----------
  function disegnaBarre(box, righe, cosa, totale) {
    box.textContent = "";
    const max = Math.max(0, ...righe.map((r) => r.n));
    if (!max) { box.append(el("p", "niente", "Ancora niente in questo periodo.")); return; }
    for (const r of righe) {
      const riga = el("div", "mon-barra"), pista = el("span", "pista"), pieno = el("span", "pieno"), val = el("span", "val", cosa.fmt(r.n));
      const quota = totale ? Math.round(r.n / totale * 100) : null;
      if (quota !== null && cosa.quotaInRiga) val.append(" ", el("small", "", quota + "%"));
      pieno.style.width = (r.n / max * 100).toFixed(1) + "%";
      if (!r.n) pieno.hidden = true;
      pista.append(pieno);
      riga.append(el("span", "nome", r.nome), pista, val);
      riga.tabIndex = 0;
      const sotto = r.nome + (quota !== null ? ` · ${quota}% ${cosa.di}` : "");
      riga.addEventListener("pointermove", (e) => mostraTip(cosa.fmt(r.n), sotto, e.clientX, e.clientY));
      riga.addEventListener("pointerleave", nascondiTip);
      riga.addEventListener("focus", () => { const q = riga.getBoundingClientRect(); mostraTip(cosa.fmt(r.n), sotto, q.left + q.width / 2, q.top); });
      riga.addEventListener("blur", nascondiTip);
      box.append(riga);
    }
  }

  // ---------- Donazioni segnate a mano ----------
  function disegnaDonazioni(p) {
    const anno = dati.oggi.slice(0, 4), tot = $("#totali");
    const nelPeriodo = dati.donazioni.filter((d) => d.g >= p.dal && d.g <= p.al).length;
    $("#e-eti").textContent = `Ricevuto negli ultimi ${giorni} giorni`;
    $("#e-val").textContent = fmtEuro.format(euro(p.dal, p.al));
    $("#e-delta").textContent = confronto(euro(p.dal, p.al), euro(p.dalPrima, p.alPrima), { conPrecedente: dati.donazioni.some((d) => d.g < p.dal), fmt: (n) => fmtEuro.format(n) });
    tot.textContent = "";
    for (const [nome, v] of [["Nel " + anno, fmtEuro.format(euro(anno + "-01-01", anno + "-12-31"))], ["In tutto", fmtEuro.format(euro("0000-00-00", "9999-99-99"))],
      [`Donazioni in ${giorni} giorni`, fmtN.format(nelPeriodo)], [`Tocchi sulle monete in ${giorni} giorni`, fmtN.format(somma(["dona_1", "dona_2", "dona_5", "dona_altro"], p.dal, p.al))]]) {
      const d = el("div"); d.append(el("dt", "", nome), el("dd", "", v)); tot.append(d);
    }
    const mesi = [];
    for (let k = 5; k >= 0; k--) { const d = data(dati.oggi); d.setDate(1); d.setMonth(d.getMonth() - k); const chiave = iso(d).slice(0, 7); mesi.push({ nome: fmtMese.format(d), n: euro(chiave + "-01", chiave + "-31") }); }
    disegnaBarre($("#b-mesi"), mesi, { fmt: (n) => fmtEuro.format(n), di: "" }, 0);
    if (!dati.donazioni.length) $("#b-mesi").firstChild.textContent = "Ancora nessuna donazione segnata.";
    const elenco = $("#elenco");
    elenco.textContent = "";
    if (!dati.donazioni.length) elenco.append(el("li", "niente", "Quando ne ricevi una, segnala qui accanto."));
    for (const d of dati.donazioni.slice(0, 8)) {
      const li = el("li"), togli = el("button", "link", "Togli");
      togli.type = "button";
      togli.setAttribute("aria-label", `Togli la donazione di ${fmtEuro.format(d.euro)} del ${fmtLungo.format(data(d.g))}`);
      togli.addEventListener("click", () => togliDonazione(d));
      li.append(el("span", "", fmtLungo.format(data(d.g))), el("b", "", fmtEuro.format(d.euro)), togli);
      elenco.append(li);
    }
  }
  async function togliDonazione(d) {
    if (!confirm(`Tolgo la donazione di ${fmtEuro.format(d.euro)} del ${fmtCorto.format(data(d.g))}?`)) return;
    if (esempio) dati.donazioni = dati.donazioni.filter((x) => x !== d);
    else { const { error } = await sb.rpc("elimina_donazione", { p_id: d.id }); if (error) return avvisoForm("Non sono riuscito a toglierla: riprova."); await carica(); }
    disegna();
  }
  const avvisoForm = (t) => { const e = $("#d-err"); e.textContent = t; e.hidden = !t; };
  async function segnaDonazione(ev) {
    ev.preventDefault();
    avvisoForm("");
    const g = $("#d-giorno").value, v = Number($("#d-euro").value.trim().replace(/\s|€/g, "").replace(",", "."));
    if (!/^\d{4}-\d\d-\d\d$/.test(g) || g > piu(dati.oggi, 1) || g < "2026-01-01") return avvisoForm("Controlla il giorno: non può essere nel futuro.");
    if (!Number.isFinite(v) || v <= 0 || v > 10000) return avvisoForm("Scrivi l’importo in euro, per esempio 2 oppure 2,50.");
    if (esempio) dati.donazioni = [{ id: Date.now(), g, euro: Math.round(v * 100) / 100 }, ...dati.donazioni].sort((a, b) => (a.g < b.g ? 1 : a.g > b.g ? -1 : b.id - a.id));
    else { const { error } = await sb.rpc("registra_donazione", { p_giorno: g, p_euro: v }); if (error) return avvisoForm("Non sono riuscito a salvarla: riprova."); await carica(); }
    $("#d-euro").value = "";
    disegna();
  }

  // ---------- Tutto insieme ----------
  function disegna() {
    const al = dati.oggi, dal = piu(al, -(giorni - 1));
    const p = { dal, al, dalPrima: piu(dal, -giorni), alPrima: piu(dal, -1) };
    $("#periodo").textContent = `Dal ${fmtCorto.format(data(dal))} al ${fmtCorto.format(data(al))}`;
    document.querySelectorAll(".mon-filtri [data-giorni]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.giorni === giorni)));
    disegnaNumeri(p);
    disegnaLinea(p);
    const visite = somma(["visita"], dal, al);
    disegnaBarre($("#b-azioni"), AZIONI.map(([e, nome]) => ({ nome, n: somma([e], dal, al) })), { fmt: (n) => fmtN.format(n), di: "delle aperture" }, visite);
    const fonti = Object.keys(FONTI).map((e) => ({ nome: FONTI[e], n: somma([e], dal, al) })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n);
    disegnaBarre($("#b-fonti"), fonti, { fmt: (n) => fmtN.format(n), di: "delle visite", quotaInRiga: true }, fonti.reduce((s, r) => s + r.n, 0));
    disegnaBarre($("#b-monete"), MONETE.map(([e, nome]) => ({ nome, n: somma([e], dal, al) })), { fmt: (n) => fmtN.format(n), di: "" }, 0);
    disegnaDonazioni(p);
  }
  function mostraCruscotto() {
    $("#stato").textContent = "";
    $("#cruscotto").hidden = false;
    $("#esempio").hidden = !esempio;
    $("#esci").hidden = esempio;
    $("#d-giorno").value = dati.oggi; $("#d-giorno").max = piu(dati.oggi, 1); $("#d-giorno").min = "2026-01-01";
    disegna();
  }
  async function carica() {
    const { data: j, error } = await sb.rpc("statistiche", { p_giorni: 190 });
    if (error) throw error;
    prepara(j);
  }

  // ---------- Stati della pagina ----------
  function stato(html) { $("#cruscotto").hidden = true; const s = $("#stato"); s.innerHTML = html; return s; }
  function spento() {
    stato(`<h2>Non ancora attiva</h2><p>Questa pagina si accende insieme al database del sito. Per ora non c’è niente da vedere.</p>`);
  }
  function accesso(email = "") {
    const s = stato(`<h2>Entra</h2><p>Scrivi la tua email: ti mandiamo un codice, niente password.</p>
      <form class="form" id="f-email"><label class="riga">Email<input type="email" id="a-email" required autocomplete="email"></label>
      <p class="errore" id="a-err" hidden></p><div class="acts"><button class="btn" type="submit">MANDAMI IL CODICE</button></div></form>`);
    s.querySelector("#a-email").value = email;
    s.querySelector("#f-email").addEventListener("submit", async (e) => {
      e.preventDefault();
      const em = $("#a-email").value.trim();
      const { error } = await sb.auth.signInWithOtp({ email: em, options: { shouldCreateUser: true, emailRedirectTo: location.href.split("#")[0].split("?")[0] } });
      if (error) { const p = $("#a-err"); p.textContent = error.status === 429 ? "Troppe richieste in poco tempo: riprova tra qualche minuto." : "Non sono riuscito a mandare il codice: controlla l’email e riprova."; p.hidden = false; return; }
      codice(em);
    });
  }
  function codice(email) {
    const s = stato(`<h2>Controlla la posta</h2><p id="c-testo"></p>
      <form class="form" id="f-codice"><label class="riga">Codice<input type="text" id="a-codice" required inputmode="numeric" autocomplete="one-time-code" maxlength="10"></label>
      <p class="errore" id="c-err" hidden></p><div class="acts"><button class="btn" type="submit">ENTRA</button><button class="btn alt" type="button" id="c-indietro">CAMBIA EMAIL</button></div></form>`);
    s.querySelector("#c-testo").textContent = `Ti abbiamo scritto a ${email}. Inserisci il codice dell’email, oppure apri il link che contiene.`;
    s.querySelector("#c-indietro").addEventListener("click", () => accesso(email));
    s.querySelector("#f-codice").addEventListener("submit", async (e) => {
      e.preventDefault();
      const { error } = await sb.auth.verifyOtp({ email, token: $("#a-codice").value.trim(), type: "email" });
      if (error) { const p = $("#c-err"); p.textContent = "Codice non valido o scaduto."; p.hidden = false; }
    });
  }
  function riservata() {
    const s = stato(`<h2>Pagina riservata</h2><p>Con questa email non c’è niente da vedere qui.</p>
      <div class="acts"><button class="btn alt" type="button" id="r-esci">ESCI</button></div>`);
    s.querySelector("#r-esci").addEventListener("click", () => sb.auth.signOut());
  }
  let ultimo;
  async function entra(sessione) {
    const chi = sessione ? sessione.user.id : "";
    if (chi === ultimo) return;
    ultimo = chi;
    if (!sessione) return accesso();
    stato("<p>Carico i numeri…</p>");
    try {
      const { data: capo, error } = await sb.rpc("sono_admin");
      if (error) throw error;
      if (!capo) return riservata();
      await carica();
      mostraCruscotto();
    } catch (e) {
      stato(`<h2>Non riesco a caricare</h2><p>Il database non risponde. Riprova tra poco.</p>
        <div class="acts"><button class="btn" type="button" id="e-riprova">RIPROVA</button></div>`).querySelector("#e-riprova").addEventListener("click", () => { ultimo = undefined; entra(sessione); });
    }
  }

  // ---------- Avvio ----------
  document.querySelectorAll(".mon-filtri [data-giorni]").forEach((b) => b.addEventListener("click", () => { giorni = +b.dataset.giorni; disegna(); }));
  $("#f-dona").addEventListener("submit", segnaDonazione);
  $("#esci").addEventListener("click", () => sb && sb.auth.signOut());
  let tRidim;
  addEventListener("resize", () => { clearTimeout(tRidim); tRidim = setTimeout(() => { if (!$("#cruscotto").hidden) disegna(); }, 150); });

  const inProva = ["localhost", "127.0.0.1"].includes(location.hostname);   // l'esempio non esiste sul sito pubblicato
  if (inProva && new URLSearchParams(location.search).has("esempio")) { esempio = true; prepara(finti()); mostraCruscotto(); }
  else if (!C.supabaseUrl || !C.supabaseKey || !window.supabase) spento();
  else {
    sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce", storageKey: "sns-sessione" },
    });
    // setTimeout: dentro questa funzione non si possono fare altre chiamate al database
    sb.auth.onAuthStateChange((evento, sessione) => { if (["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT"].includes(evento)) setTimeout(() => entra(sessione), 0); });
  }
})();
