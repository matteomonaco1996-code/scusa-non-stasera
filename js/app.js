// Scusa, non stasera — logica di gioco (mondi, livelli, power-up, risultati, mappa).
// Espone window.SNS per js/conto.js (account, punti, recensioni).
(() => {
  "use strict";
  // Chi arriva in http passa a https. La regola vera è "Enforce HTTPS" nelle impostazioni di GitHub Pages:
  // questo è solo un paracadute, e non vale per le pagine senza script (privacy, termini).
  if (location.protocol === "http:" && !/^(localhost|127\.|\[::1\])/.test(location.hostname)) {
    location.replace("https://" + location.host + location.pathname + location.search + location.hash);
    return;
  }
  const DATA = window.RISTOMAT || [];
  const META = window.RISTOMAT_META || {};
  if (!DATA.length) {   // la lista dei posti non è arrivata (connessione che va e viene): lo si dice, e si offre di riprovare
    document.body.classList.add("senza-lista");
    const s = document.querySelector("#spiega"), b = document.createElement("button");
    b.type = "button"; b.textContent = "Riprova"; b.addEventListener("click", () => location.reload());
    if (s) { s.textContent = "Non riesco a caricare la lista dei posti: forse la connessione va e viene. "; s.after(b); }
    return;
  }

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
    restart: ["..###.##", ".#...###", "#....###", "#.......", "#.......", "#......#", ".#....#.", "..####.."],
    pin:     ["..####..", ".######.", ".##..##.", ".##..##.", ".######.", "..####..", "...##...", "...##..."],
    zona:    ["###..###", "###..###", "###..###", "........", "........", "###..###", "###..###", "###..###"],
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

  // ---------- Contatori anonimi ----------
  // Aggiungono uno al numero del giorno ("oggi 42 visite") e basta: niente cookie, niente identificativi,
  // niente nel browser, nessun legame con l'account. Sono attivi solo se in config.js c'è il database.
  // Chi ha acceso nel browser "non tracciare" (Do Not Track o Global Privacy Control) non viene contato.
  // I nomi ammessi sono elencati in supabase/statistiche.sql: gli altri vengono ignorati dal database.
  const CFG = window.SNS_CONFIG || {};
  const CONTA_URL = CFG.supabaseUrl && CFG.supabaseKey && CFG.statistiche !== false ? String(CFG.supabaseUrl).replace(/\/+$/, "") + "/rest/v1/rpc/conta" : "";
  function conta(...eventi) {
    if (!CONTA_URL || navigator.globalPrivacyControl || navigator.doNotTrack === "1") return;
    const testa = { "Content-Type": "application/json", apikey: CFG.supabaseKey };
    if (/^eyJ/.test(CFG.supabaseKey)) testa.Authorization = "Bearer " + CFG.supabaseKey;   // chiavi del vecchio tipo
    try { fetch(CONTA_URL, { method: "POST", keepalive: true, headers: testa, body: JSON.stringify({ p_eventi: eventi }) }).catch(() => {}); } catch (e) { /* contare non deve mai rompere il gioco */ }
  }
  // Una chiamata a una funzione del database aperta a tutti (le comitive). Restituisce il risultato, oppure lancia un
  // errore con un messaggio da mostrare: quello scritto nella funzione se l'ha rifiutata lei, altrimenti uno generico.
  async function rpc(nome, args) {
    const testa = { "Content-Type": "application/json", apikey: CFG.supabaseKey };
    if (/^eyJ/.test(CFG.supabaseKey)) testa.Authorization = "Bearer " + CFG.supabaseKey;
    let r;
    try { r = await fetch(String(CFG.supabaseUrl).replace(/\/+$/, "") + "/rest/v1/rpc/" + nome, { method: "POST", headers: testa, body: JSON.stringify(args || {}) }); }
    catch (e) { throw new Error("Non riesco a collegarmi: controlla la connessione e riprova."); }
    let j = null;
    try { const t = await r.text(); j = t ? JSON.parse(t) : null; } catch (e) { /* risposta vuota o non leggibile */ }
    if (r.ok) return j;
    const voluto = j && (j.code === "P0001" || j.code === "P0002");   // "raise exception" delle nostre funzioni
    const e = new Error(voluto ? j.message : "Qualcosa non ha funzionato: riprova tra poco.");
    e.codice = j && j.code;
    throw e;
  }
  // Comitive: accese solo se c'è il database e in config.js c'è  comitive: true
  const COMITIVE = !!(CFG.supabaseUrl && CFG.supabaseKey && CFG.comitive === true);
  // Da dove arriva la visita: solo una categoria tra poche, mai l'indirizzo della pagina di provenienza.
  // Con ?da=instagram (o qr, volantino, amici…) in fondo al link che condividi la decidi tu.
  function provenienza() {
    const da = (new URLSearchParams(location.search).get("da") || "").toLowerCase();
    if (["google", "instagram", "facebook", "whatsapp", "tiktok", "telegram", "qr", "volantino", "amici"].includes(da)) return da;
    const ua = navigator.userAgent || "";
    if (/Instagram/i.test(ua)) return "instagram";
    if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "facebook";
    if (/TikTok|musical_ly/i.test(ua)) return "tiktok";
    let h = "";
    try { h = new URL(document.referrer).hostname; } catch (e) { /* nessuna provenienza */ }
    if (!h || h === location.hostname) return "diretto";
    const noti = [["google", /(^|\.)google\./], ["instagram", /instagram\.com$/], ["facebook", /(facebook|fb)\.com$/], ["whatsapp", /whatsapp\.(com|net)$/], ["tiktok", /tiktok\.com$/], ["telegram", /(^|\.)(t\.me|telegram\.org)$/]];
    return (noti.find(([, re]) => re.test(h)) || ["altro"])[0];
  }

  // ---------- Mondi e livelli ----------
  const CITTA = ["Firenze", "Venezia", "Milano", "Bologna"];
  const mondoDi = (x) => x.c === "Roma" ? "roma" : CITTA.includes(x.c) ? x.c.toLowerCase() : "fuori";
  const perCitta = DATA.reduce((m, x) => (m[x.c] = (m[x.c] || 0) + 1, m), {});
  const perId = new Map();
  DATA.forEach((x, i) => {
    x.i = i; x.m = mondoDi(x);
    x.l = x.m === "roma" ? (x.q || "Periferia") : x.m === "fuori" ? (perCitta[x.c] >= 3 && x.c !== "Altre località" ? x.c : `Altro in ${x.r}`) : "";
    x.h = norm([x.n, x.a, x.nt, x.dr, x.c, x.q, PW[x.t] && PW[x.t][0]].join(" "));
    perId.set(x.id, x);
  });
  const MONDI = [{ id: "roma", nome: "Roma" }, { id: "fuori", nome: "Fuori porta" }, ...CITTA.map((c) => ({ id: c.toLowerCase(), nome: c }))]   // Fuori porta subito dopo Roma
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
    const PRIMO = "Tivoli";   // sempre il primo livello di Fuori porta, anche se un'altra località avesse più posti
    LIVELLI.fuori = Object.entries(reg).sort((a, b) => (PRIMO in b[1]) - (PRIMO in a[1]) || somma(b[1]) - somma(a[1])).map(([r, cs]) => ({
      nome: r,
      livelli: Object.entries(cs).sort((a, b) => (b[0] === PRIMO) - (a[0] === PRIMO) || a[0].startsWith("Altro") - b[0].startsWith("Altro") || b[1] - a[1] || a[0].localeCompare(b[0], "it"))
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

  // Tevere da nord a sud, dal tracciato di OpenStreetMap semplificato (© OpenStreetMap contributors, ODbL)
  const TEVERE = [
    [41.9673, 12.4957], [41.9666, 12.4983], [41.9663, 12.5028], [41.9657, 12.5042], [41.9650, 12.5049],
    [41.9638, 12.5049], [41.9616, 12.5038], [41.9603, 12.5025], [41.9596, 12.5012], [41.9591, 12.4985],
    [41.9591, 12.4955], [41.9598, 12.4924], [41.9598, 12.4901], [41.9595, 12.4896], [41.9590, 12.4892],
    [41.9578, 12.4888], [41.9566, 12.4888], [41.9551, 12.4895], [41.9537, 12.4908], [41.9496, 12.4987],
    [41.9485, 12.5005], [41.9474, 12.5018], [41.9466, 12.5025], [41.9455, 12.5025], [41.9443, 12.5020],
    [41.9435, 12.5013], [41.9428, 12.5003], [41.9425, 12.4995], [41.9421, 12.4967], [41.9421, 12.4932],
    [41.9416, 12.4884], [41.9413, 12.4873], [41.9408, 12.4865], [41.9402, 12.4861], [41.9390, 12.4858],
    [41.9355, 12.4870], [41.9347, 12.4869], [41.9340, 12.4866], [41.9334, 12.4860], [41.9329, 12.4850],
    [41.9328, 12.4839], [41.9330, 12.4832], [41.9360, 12.4791], [41.9366, 12.4773], [41.9366, 12.4750],
    [41.9361, 12.4700], [41.9355, 12.4664], [41.9343, 12.4641], [41.9330, 12.4623], [41.9315, 12.4609],
    [41.9295, 12.4598], [41.9283, 12.4595], [41.9265, 12.4597], [41.9254, 12.4602], [41.9243, 12.4613],
    [41.9231, 12.4632], [41.9218, 12.4684], [41.9213, 12.4693], [41.9203, 12.4702], [41.9187, 12.4708],
    [41.9160, 12.4706], [41.9139, 12.4709], [41.9102, 12.4722], [41.9068, 12.4743], [41.9054, 12.4744],
    [41.9045, 12.4740], [41.9034, 12.4730], [41.9029, 12.4721], [41.9023, 12.4702], [41.9018, 12.4654],
    [41.9011, 12.4642], [41.9005, 12.4637], [41.8999, 12.4635], [41.8991, 12.4636], [41.8965, 12.4656],
    [41.8916, 12.4718], [41.8898, 12.4780], [41.8886, 12.4796], [41.8871, 12.4794], [41.8859, 12.4783],
    [41.8843, 12.4766], [41.8808, 12.4715], [41.8800, 12.4708], [41.8787, 12.4700], [41.8774, 12.4699],
    [41.8759, 12.4703], [41.8716, 12.4721], [41.8687, 12.4736], [41.8672, 12.4747], [41.8654, 12.4768],
    [41.8638, 12.4773], [41.8630, 12.4770], [41.8620, 12.4760], [41.8607, 12.4731], [41.8600, 12.4696],
    [41.8599, 12.4643], [41.8593, 12.4624], [41.8586, 12.4616], [41.8554, 12.4606], [41.8538, 12.4607],
    [41.8527, 12.4616], [41.8522, 12.4625], [41.8493, 12.4702], [41.8488, 12.4709], [41.8480, 12.4714],
    [41.8470, 12.4713], [41.8467, 12.4711], [41.8461, 12.4699], [41.8443, 12.4637], [41.8412, 12.4600],
    [41.8360, 12.4553], [41.8334, 12.4524], [41.8312, 12.4494], [41.8264, 12.4404], [41.8260, 12.4379],
    [41.8262, 12.4355], [41.8274, 12.4335], [41.8319, 12.4298], [41.8332, 12.4277], [41.8332, 12.4253],
    [41.8328, 12.4242], [41.8321, 12.4231], [41.8312, 12.4221], [41.8305, 12.4216], [41.8286, 12.4210],
  ];

  const INIZIO = { mondo: "roma", livello: "", vicino: false, pos: null, posLv: "", voglia: "", q: "", mostrati: PAGINA, vista: "lista", pescato: null };
  const stato = { ...INIZIO };
  // C'è qualcosa da azzerare? Serve a mostrare RESTART solo quando ha senso.
  const inCorso = () => stato.vicino || !!stato.pos || !!stato.livello || stato.mondo !== INIZIO.mondo || !!stato.voglia || !!stato.q || stato.pescato !== null;

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
  const STRADA = "https://www.google.com/maps/dir/", PAGINA_MAPS = "https://www.google.com/maps/search/";
  const linkMaps = (x) => PAGINA_MAPS + "?api=1&query=" + encodeURIComponent(dest(x));
  const linkVai = (x) => STRADA + "?api=1&travelmode=walking&destination=" + encodeURIComponent(dest(x));
  const luogo = (x) => x.m === "roma" ? (x.l === "Periferia" ? "Roma" : x.l) : x.c === "Altre località" ? (x.r || "") : x.c;
  const via = (x) => (x.a || "").replace(/,\s*\d{5}.*$/, "");
  const EXT = 'target="_blank" rel="noopener noreferrer"';

  // ---------- Moneta: donazione facoltativa. Compare solo se in config.js c'è un link https ----------
  const DONA = (() => { try { const u = new URL((window.SNS_CONFIG || {}).donazione || ""); return u.protocol === "https:" ? u.href : ""; } catch (e) { return ""; } })();
  const moneta = () => DONA ? `<button class="moneta" type="button" data-moneta><img src="img/gettone.svg" width="24" height="24" alt="">Dona una moneta</button>` : "";
  // Con un link PayPal.Me l'importo si può mettere nell'indirizzo (…/2EUR): la pagina di PayPal si apre già compilata
  const linkDona = (euro) => /^https:\/\/(www\.)?paypal\.me\//i.test(DONA) && euro ? DONA.replace(/\/+$/, "") + "/" + euro + "EUR" : DONA;
  function importiMoneta() {
    const importi = /^https:\/\/(www\.)?paypal\.me\//i.test(DONA) ? [1, 2, 5] : [];
    return importi.map((n) => `<a class="moneta-importo px" href="${esc(linkDona(n))}" ${EXT} data-dona="${n}" aria-label="Dona ${n} euro con PayPal"><img src="img/gettone.svg" width="48" height="48" alt=""><b>${n} €</b></a>`).join("") +
      `<a class="moneta-importo px" href="${esc(DONA)}" ${EXT} data-dona="altro" aria-label="Dona la cifra che vuoi"><img src="img/gettone.svg" width="48" height="48" alt=""><b>${importi.length ? "Altro" : "Dona"}</b></a>`;
  }
  function apriMoneta() {
    conta("dona_apri");
    $("#monete").innerHTML = importiMoneta();
    const d = $("#dlg-moneta"); if (!d.open) d.showModal();
  }
  // Prima di aprire Google Maps verso un posto ("Portami lì" e "Apri su Maps"): una finestra con il pulsante
  // per proseguire in cima e, sotto, la moneta. Lo stesso riquadro sta nella finestra "Proponilo".
  // In config.js, monetaPrima = "sempre" (ogni volta), "una" (una volta per visita) oppure "mai".
  const PRIMA = (window.SNS_CONFIG || {}).monetaPrima || "sempre";
  const INVITI = (window.SNS_CONFIG || {}).inviti !== false;   // "Proponilo": l'invito da mandare a qualcuno
  let giaChiesto = false;
  // Restituisce true se ha fermato il clic per mostrare la finestra.
  function primaDiAndare(e, a) {
    if (!DONA || PRIMA === "mai" || (PRIMA === "una" && giaChiesto)) return false;
    giaChiesto = true;
    e.preventDefault();
    const v = $("#vai-ora");
    v.href = a.href;
    v.textContent = a.href.startsWith(STRADA) ? "▶ VAI AL POSTO" : "▶ APRI SU MAPS";
    $("#monete-vai").innerHTML = importiMoneta();
    const d = $("#dlg-vai"); if (!d.open) d.showModal();
    return true;
  }
  // Moneta, importi e link a Maps. È agganciata al documento e ai fumetti della mappa: il segno sull'evento
  // evita che lo stesso clic venga gestito (e contato) due volte.
  function suClic(e) {
    if (e.snsVisto) return;
    e.snsVisto = true;
    if (DONA && e.target.closest("[data-moneta]")) return apriMoneta();
    const m = e.target.closest("[data-dona]");
    if (m) return conta("dona_" + m.dataset.dona);
    versoMaps(e);
  }
  // Lo stesso riquadro della donazione di "Prima di andare", da mettere in un'altra finestra: il testo si prende
  // da lì (index.html), così le spiegazioni e le avvertenze restano scritte in un posto solo.
  function riquadroDona() {
    const box = DONA && PRIMA !== "mai" && $("#dlg-vai .dona-box");
    if (!box) return "";
    const copia = box.cloneNode(true), monete = copia.querySelector(".monete"), note = $("#dlg-vai .dona-box + small");
    if (monete) { monete.removeAttribute("id"); monete.innerHTML = importiMoneta(); }
    return copia.outerHTML + (note ? note.outerHTML : "");
  }
  // Ogni clic verso Google Maps: "Portami lì" (indicazioni), "Apri su Maps" (la pagina del posto) e il pulsante
  // per proseguire nella finestra. "portami" = pulsante toccato; "vai" e "maps" = Maps si è aperto davvero.
  function versoMaps(e) {
    const a = e.target.closest('a[href^="https://www.google.com/maps/"]');
    if (!a) return;
    const strada = a.href.startsWith(STRADA);
    if (a.id === "vai-ora") return conta(strada ? "vai" : "maps");
    if (!strada && !a.href.startsWith(PAGINA_MAPS)) return conta("maps");   // il link alla lista su Google, in fondo alla pagina
    if (strada) conta("portami");
    if (!primaDiAndare(e, a)) conta(strada ? "vai" : "maps");
  }

  // ---------- Filtri ----------
  function passa(x, salta) {
    if (!stato.vicino && x.m !== stato.mondo) return false;
    if (stato.livello && x.l !== stato.livello) return false;
    if (salta !== "voglia" && stato.voglia && x.t !== stato.voglia) return false;
    if (stato.q) for (const p of stato.q.split(/\s+/)) if (p && !x.h.includes(p)) return false;
    return true;
  }
  function risultati() {
    const r = DATA.filter((x) => passa(x));
    if (stato.pos) r.sort((a, b) => a.km - b.km);
    else r.sort((a, b) => (!!b.nt - !!a.nt) || (!!b.dr - !!a.dr) || (b.d || 0) - (a.d || 0));
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
  // Sotto le caselle, le strade principali di Roma: un file leggero (mappa/quartieri.js) che si carica dopo il resto della pagina.
  let stradeChieste = false, stradeDisegnate = null;
  function chiediStrade() {
    if (stradeChieste) return;
    stradeChieste = true;
    const carica = () => {
      const sc = document.createElement("script");
      sc.src = "mappa/quartieri.js";
      sc.onload = () => { if (stato.mondo === "roma" && !$("#ow-svg").contains(document.activeElement)) disegnaOverworld(); };   // se stai usando la mappa con la tastiera, le strade arrivano al prossimo ridisegno
      document.body.appendChild(sc);
    };
    if (window.requestIdleCallback) requestIdleCallback(carica, { timeout: 3000 }); else setTimeout(carica, 600);
  }
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
    // Strade: stessa proiezione delle caselle; il tracciato si calcola una volta sola
    const strade = window.SNS_MAPPA && window.SNS_MAPPA.strade;
    let vie = "";
    if (!strade) chiediStrade();
    else {
      const firma = [minX, minY, s].join();
      if (!stradeDisegnate || stradeDisegnate.firma !== firma) {
        const traccia = (linee) => linee.map((a) => {
          let la = 0, lo = 0, t = "";
          for (let i = 0; i < a.length; i += 2) { la += a[i]; lo += a[i + 1]; const [x, y] = xy(proietta(la / 1e5, lo / 1e5)); t += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1); }
          return t;
        }).join("");
        stradeDisegnate = { firma, html: `<path class="ow-via" d="${traccia(strade.medie)}"/><path class="ow-via grande" d="${traccia(strade.grandi)}"/>` };
      }
      vie = stradeDisegnate.html;
    }
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
      ${vie}<path class="ow-fiume" d="${d}"/>
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
    $("#ow-info").textContent = z ? `Livello ${z.cod}: ${z.n} · ${z.conta} posti` : "Tocca un quartiere per giocare quel livello. Le caselle verdi sono quartieri dove hai già fatto check-in.";
  }

  function disegnaPowerup() {
    const base = DATA.filter((x) => passa(x, "voglia"));
    const c = base.reduce((m, x) => (m[x.t] = (m[x.t] || 0) + 1, m), {});
    const ordine = Object.keys(PW).filter((k) => k !== "altro").sort((a, b) => (c[b] || 0) - (c[a] || 0)).concat("altro");
    $("#powerups").innerHTML = `<button type="button" class="pw px" data-voglia="" aria-pressed="${!stato.voglia}">${svg("stella")}Tutto <span class="n">${base.length}</span></button>` +
      ordine.map((k) => `<button type="button" class="pw px" data-voglia="${k}" aria-pressed="${stato.voglia === k}" ${!c[k] && stato.voglia !== k ? "disabled" : ""}>${svg(PW[k][1])}${esc(PW[k][0])} <span class="n">${c[k] || 0}</span></button>`).join("");
  }

  // ---------- Disegno: risultati ----------
  // La nota di Matteo, se c'è; altrimenti la descrizione breve del sito
  const nota = (x) => x.nt ? `<div class="say"><b>MATTEO</b>${esc(x.nt)}</div>`
    : x.dr ? `<div class="say breve"><b>IN BREVE</b>${esc(x.dr)}</div>` : "";
  function scheda(x) {
    const extra = SNS.extraScheda ? SNS.extraScheda(x) : "";
    return `<article class="card px" id="p${x.i}">
      <div class="card-top">
        <h4${stato.pos ? "" : ' aria-level="3"'}><button type="button" data-mappa="${x.i}" title="Mostra sulla mappa">${esc(x.n)}</button></h4>
        ${stato.pos ? `<span class="dist">${distanza(x)}</span>` : ""}
      </div>
      <div class="meta"><span class="tipo">${svg(PW[x.t][1])}${esc(PW[x.t][0])}</span><span class="quart">${esc(luogo(x))}</span></div>
      ${via(x) ? `<div class="addr">${esc(via(x))}</div>` : ""}
      ${nota(x)}
      ${extra}
      <div class="acts">
        <a class="vai" href="${linkVai(x)}" ${EXT}>▶ Portami lì</a>
        <a href="${linkMaps(x)}" ${EXT}>Apri su Maps</a>
        ${INVITI ? `<button type="button" class="proponi" data-invita="${x.i}">Proponilo</button>` : ""}
        ${SNS.pulsanteComitiva ? SNS.pulsanteComitiva(x) : ""}
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
    $("#cards").innerHTML = n ? h : `<div class="empty"><strong>Nessun posto</strong>Cambia power-up o livello, oppure ricomincia da capo.<button class="btn" type="button" data-restart>${svg("restart")}RESTART</button></div>`;
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
    segnaInCorso();
  }
  function segnaInCorso() { const si = inCorso(); document.querySelectorAll(".restart").forEach((b) => { b.hidden = !si; }); }

  // ---------- Dialogo ----------
  // I momenti della giornata: la domanda di Gaia, il "no" che le risponde a tono (di sera è il nome del sito)
  // e i tipi di posto che hanno senso a quell'ora (per il gettone)
  const MOMENTI = [
    { da: 6, a: 11, k: "c", breve: "Colazione", qui: "Colazione qui?", nome: "colazione", domanda: "Colazione insieme?", no: "Scusa, non stamattina…", tipi: ["dolce", "bottega"] },
    { da: 11, a: 15, k: "p", breve: "Pranzo", qui: "Pranzo qui?", nome: "pranzo", domanda: "Pranziamo insieme?", no: "Scusa, non oggi…", tipi: ["trattoria", "ristorante", "pizza", "street", "pesce", "carne", "mondo"] },
    { da: 15, a: 18, k: "a", breve: "Aperitivo", qui: "Aperitivo qui?", nome: "merenda o aperitivo", domanda: "Aperitivo dopo?", no: "Scusa, non stasera…", tipi: ["dolce", "bottega", "street", "vino", "bar"] },
    { da: 18, a: 23, k: "s", breve: "Stasera", qui: "Stasera qui?", nome: "sera", domanda: "Usciamo stasera?", no: "Scusa, non stasera…", tipi: ["trattoria", "ristorante", "pizza", "pesce", "carne", "mondo", "vino", "bar", "street"] },
  ];
  const NOTTE = { k: "n", breve: "Ultimo bicchiere", qui: "Un ultimo bicchiere qui?", nome: "dopocena", domanda: "Un ultimo bicchiere?", no: "Scusa, non stasera…", tipi: ["bar", "vino", "street", "dolce"] };
  const momento = () => { const h = new Date().getHours(); return MOMENTI.find((m) => h >= m.da && h < m.a) || NOTTE; };
  function rispondi(x) {
    const b = $("#bolla");
    let t;
    if (!x && !stato.vicino && !stato.livello) t = "Anzi sì! Portami fuori.";
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
    if (!window.L) { el.innerHTML = `<div class="map-gate"><b>Mappa non disponibile</b>La lista funziona lo stesso.</div>`; return { aggiorna() {}, vai() {}, posizione() {}, mostra() {}, ridisegna() {}, anticipa() {}, chiudi() {} }; }
    const nascostaSubito = () => el.offsetParent === null || !el.clientWidth;
    const m = L.map(el, { zoomControl: false, attributionControl: true }).setView([41.9, 12.49], 12);
    L.control.zoom({ position: "bottomleft" }).addTo(m);   // in basso: in alto si aprono i fumetti dei posti
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
      const stile = getComputedStyle(el), tinta = (nome, se) => stile.getPropertyValue(nome).trim() || se;   // i colori stanno nel foglio di stile
      if (D.parchi.length) L.polygon(D.parchi.map(dec), { ...op, stroke: false, fillColor: tinta("--parco", "#B7D5A8"), fillOpacity: 1 }).addTo(m);
      strati.fiume = L.polyline(D.fiumi.map(dec), { ...op, color: tinta("--fiume", "#82B1D3"), lineCap: "round" }).addTo(m);
      vie = L.polyline(D.vie.map(dec), { ...op, color: tinta("--via", "#D6C6AE") });
      strati.medie = L.polyline(D.medie.map(dec), { ...op, color: tinta("--via-media", "#C4A892") }).addTo(m);
      strati.grandi = L.polyline(D.grandi.map(dec), { ...op, color: tinta("--via-grande", "#A86F66") }).addTo(m);
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
      tiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {   // chiaro, come la mappa del sito
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
    // Due livelli: sopra i quadratini visibili (hanno sempre la precedenza), sotto un'area larga
    // e invisibile intorno a ciascuno, così col dito si prendono bene anche se manchi il centro.
    m.createPane("aree").style.zIndex = 590;
    const icona = (cls, s) => L.divIcon({ className: "pin-area", html: `<span class="pin ${cls}"></span>`, iconSize: [s, s], iconAnchor: [s / 2, s / 2], popupAnchor: [0, -6] });
    const I = { base: icona("", 14), nota: icona("nota", 16), breve: icona("breve", 14), visto: icona("visto", 14), io: icona("io", 18) };
    const AREA = L.divIcon({ className: "pin-hit", iconSize: [36, 36], iconAnchor: [18, 18] });
    function popup(x) {
      return `<strong>${esc(x.n)}</strong><div>${esc(PW[x.t][0])} · ${esc(luogo(x))}${stato.pos ? " · " + distTesto(x) : ""}</div>` +
        nota(x) +
        `<div class="popup-acts"><a href="${linkVai(x)}" ${EXT}>▶ Portami lì</a><a href="${linkMaps(x)}" ${EXT}>Apri su Maps</a><a href="#p${x.i}" data-scheda="${x.i}">Scheda</a></div>` + moneta();
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
    // I segnaposti si costruiscono solo quando la mappa si vede. Sul telefono la mappa parte nascosta dietro la
    // lista: farne quasi mille all'apertura, e rifarli a ogni filtro, rallentava tutto per niente.
    let sporca = false;
    function aggiorna(lista, adatta) {
      ultima = lista;
      if (nascosta()) { sporca = true; if (adatta) daAdattare = true; return; }
      sporca = false;
      disegna(lista);
      if (adatta) { daAdattare = false; adattaA(lista); }
    }
    function pronta() { if (sporca) { sporca = false; disegna(ultima); } }
    function disegna(lista) {
      strato.clearLayers(); punti.clear();
      const visti = SNS.visitati || new Set();
      for (const x of lista) {
        const ic = visti.has(x.id) ? I.visto : x.nt ? I.nota : x.dr ? I.breve : I.base;
        const mk = L.marker([x.la, x.lo], { icon: ic, title: x.n, alt: x.n, riseOnHover: true, zIndexOffset: x.nt ? 200 : x.dr ? 100 : 0 })
          .bindPopup(() => popup(x), { maxWidth: 290, minWidth: 200, autoPanPaddingTopLeft: [16, 56], autoPanPaddingBottomRight: [16, 24] }).addTo(strato);
        L.marker([x.la, x.lo], { icon: AREA, pane: "aree", keyboard: false, title: x.n }).on("click", () => mk.openPopup()).addTo(strato);
        punti.set(x.i, mk);
      }
    }
    function mostra() { caricaBase(); m.invalidateSize(); pronta(); if (daAdattare) { adattaA(ultima); daAdattare = false; } }
    function vai(i) {
      caricaBase();
      const x = DATA[i]; daAdattare = false; m.invalidateSize(); pronta();
      m.setView([x.la, x.lo], Math.max(m.getZoom(), 16), { animate: false });
      const mk = punti.get(i);
      if (mk) mk.openPopup(); else L.popup().setLatLng([x.la, x.lo]).setContent(popup(x)).openOn(m);
    }
    function posizione(p) { if (io) { m.removeLayer(io); io = null; } if (p) io = L.marker([p.la, p.lo], { icon: I.io, keyboard: false, zIndexOffset: 1000 }).bindTooltip("Tu").addTo(m); }
    m.on("popupopen", (e) => {
      const el = e.popup.getElement(), a = el.querySelector("[data-scheda]");
      if (a) a.addEventListener("click", (ev) => { ev.preventDefault(); mostraScheda(+a.dataset.scheda); });
      el.addEventListener("click", suClic);   // moneta e link a Maps: suClic li gestisce una volta sola, da qui o dal documento
    });
    addEventListener("resize", () => { m.invalidateSize(); if (!nascosta()) { pronta(); if (daAdattare) { adattaA(ultima); daAdattare = false; } } });
    // Lo sfondo di Roma pesa: lo si scarica in anticipo, senza fretta, solo dopo che è stata scelta una zona
    // (così chi apre la mappa non aspetta) e mai con il risparmio dati acceso o una rete molto lenta.
    let anticipata = false;
    function anticipa() {
      const rete = navigator.connection || {};
      if (anticipata || caricando || (window.SNS_MAPPA && window.SNS_MAPPA.roma) || rete.saveData || /2g/.test(rete.effectiveType || "")) return;
      anticipata = true;
      const l = document.createElement("link");
      l.rel = "prefetch"; l.href = "mappa/roma.js"; l.as = "script";
      document.head.appendChild(l);
    }
    return { aggiorna, vai, posizione, mostra, anticipa, chiudi: () => m.closePopup(), ridisegna: () => aggiorna(ultima, false) };
  })();

  // ---------- Avvisi ----------
  let tToast;
  function toast(testo) {
    const t = $("#toast");
    t.textContent = testo; t.hidden = false;
    clearTimeout(tToast); tToast = setTimeout(() => { t.hidden = true; }, 4500);
  }

  // ---------- Azioni ----------
  // Chiede la posizione al browser e aggiorna il gioco. Risolve con "" se va bene, altrimenti con il motivo:
  // "assente" (il browser non la offre), "bloccata" (permesso negato o posizione spenta), "errore" (non ti trova).
  const POS_ERR = { assente: "Questo browser non sa dirmi dove sei.", bloccata: "La posizione è bloccata o spenta.", errore: "Non riesco a trovarti in questo momento." };
  // Prima si prova la via rapida (reti e Wi-Fi: risponde in un attimo e in città basta per i minuti a piedi).
  // Il GPS vero, che può metterci parecchi secondi, si usa solo se la via rapida non risponde o è troppo vaga.
  function trovami() {
    return new Promise((fatto) => {
      if (!navigator.geolocation) return fatto("assente");
      const SVELTA = { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 };
      const PRECISA = { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 };
      const usa = (p) => {
        stato.pos = { la: p.coords.latitude, lo: p.coords.longitude };
        DATA.forEach((x) => { x.km = km(stato.pos, x); });
        const vicino = DATA.reduce((a, b) => (a.km < b.km ? a : b));
        stato.mondo = vicino.km < 40 ? vicino.m : stato.mondo;
        stato.posLv = vicino.km < 3 ? vicino.l : "";
        stato.livello = ""; stato.vicino = true;
        mappa.posizione(stato.pos);
        aggiorna();
        conta("posizione_si");
        mappa.anticipa();
        fatto("");
      };
      const no = (e) => { conta("posizione_no"); fatto(e && e.code === 1 ? "bloccata" : "errore"); };
      const precisa = () => navigator.geolocation.getCurrentPosition(usa, no, PRECISA);
      navigator.geolocation.getCurrentPosition(
        (p) => (p.coords.accuracy > 400 ? precisa() : usa(p)),          // più vaga di 400 metri: meglio aspettare il GPS
        (e) => (e && e.code === 1 ? no(e) : precisa()),                 // rifiutata: inutile riprovare; altrimenti GPS
        SVELTA);
    });
  }

  // "telefono" o "computer": per chiamare le cose con il loro nome nei testi sulla posizione
  const apparecchio = () => (/Android|iPhone|iPad|iPod/.test(navigator.userAgent || "") || mobile() ? "telefono" : "computer");
  // Che cosa risponderà il browser alla richiesta: "granted" (già consentita), "denied" (rifiutata) oppure
  // "prompt" (la chiederà all'utente). Dove il browser non lo dice si assume "prompt".
  async function permessoPosizione() {
    try { return (await navigator.permissions.query({ name: "geolocation" })).state; } catch (e) { return "prompt"; }
  }
  // Con gli account accesi la posizione parte solo al check-in: va detto, altrimenti "non arriva al sito" sarebbe falso.
  const CON_CHECKIN = !!(CFG.supabaseUrl && CFG.supabaseKey && CFG.conto !== false);

  // ---------- Posizione: la finestra che la chiede e, se è bloccata, spiega come riaccenderla ----------
  // Un sito non può accendere la posizione da solo: può solo far comparire la richiesta del browser (se non è
  // già stata rifiutata) oppure spiegare dove si riattiva. I passi cambiano da telefono a telefono.
  function guidaPosizione() {
    const ua = navigator.userAgent || "";
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const passi = ios ? [
      "Apri le <b>Impostazioni</b> del telefono → <b>Privacy e sicurezza</b> → <b>Localizzazione</b>: deve essere accesa.",
      "Nella stessa pagina tocca <b>Siti web di Safari</b> (o il nome del browser che usi) e scegli <b>Mentre usi l’app</b>.",
      "Torna qui e tocca <b>Riprova</b>: quando il telefono lo chiede, scegli <b>Consenti</b>.",
    ] : /Android/.test(ua) ? [
      "Accendi la <b>Posizione</b> del telefono, dal menu rapido che scende dall’alto.",
      "Tocca l’icona a sinistra dell’indirizzo del sito (lucchetto o cursori) → <b>Autorizzazioni</b> → <b>Posizione</b> → <b>Consenti</b>.",
      "Torna qui e tocca <b>Riprova</b>.",
    ] : [
      "Clicca l’icona a sinistra dell’indirizzo del sito (lucchetto o cursori) → <b>Posizione</b> → <b>Consenti</b>.",
      "Controlla che la posizione sia accesa per il browser anche nelle impostazioni del computer.",
      "Poi clicca <b>Riprova</b>.",
    ];
    const dentroApp = /Instagram|FBAN|FBAV|FB_IAB|Line\/|TikTok|musical_ly/i.test(ua);
    return (dentroApp ? `<p>Stai guardando il sito dentro un’altra app: lì la posizione spesso non funziona. Dal menu (⋯) scegli <b>Apri nel browser</b>.</p>` : "") +
      `<ol class="passi">${passi.map((p) => `<li>${p}</li>`).join("")}</ol>`;
  }
  function finestraPosizione(fase) {
    const d = $("#dlg-posizione"), c = $("#pos-corpo");
    const cosa = apparecchio();
    const scelte = (si, no) => `<div class="get-acts in-colonna">${si ? `<button class="btn" type="button" data-pos="attiva">${si}</button>` : ""}<button class="btn alt" type="button" data-pos="no">${no}</button></div>`;
    // Il titolo dice che cosa sta succedendo: una scelta, la ricerca, oppure la posizione da riattivare
    $("#pos-t").textContent = fase === "chiedi" ? "DA DOVE PARTIAMO?" : fase === "cerco" ? "TI CERCO…" : "ATTIVA LA POSIZIONE";
    if (fase === "chiedi") c.innerHTML = `<div class="get-scelte">
        <button type="button" class="px primo" data-pos="attiva"><b>▶ Vicino a me</b><small>Uso la posizione: il ${cosa} ti chiede il permesso, scegli «Consenti». Vedi i posti a pochi minuti a piedi.</small></button>
        <button type="button" class="px" data-pos="no"><b>Scelgo la zona</b><small>Un quartiere di Roma, un’altra città o fuori porta. Senza usare la posizione.</small></button>
      </div>
      <small>La posizione resta sul tuo ${cosa}: la inviamo solo quando fai un check-in, e non la salviamo.</small>`;
    else if (fase === "cerco") c.innerHTML = `<p class="get-dom">Ti cerco…</p><p>Se il ${cosa} te lo chiede, scegli <b>Consenti</b>.</p>`;
    else if (fase === "bloccata") c.innerHTML = `<p class="errore" role="alert">La posizione è bloccata per questo sito, oppure è spenta sul ${cosa}.</p>
      <p>Il sito non può riaccenderla da solo. Si fa così:</p>${guidaPosizione()}${scelte("Riprova", "Scelgo io la zona")}`;
    else c.innerHTML = `<p class="errore" role="alert">${POS_ERR[fase] || POS_ERR.errore}</p>
      <p>${fase === "assente" ? "Puoi comunque scegliere tu il quartiere." : `Controlla che la posizione del ${cosa} sia accesa, poi riprova. Oppure scegli tu la zona.`}</p>
      ${scelte(fase === "assente" ? "" : "Riprova", "Scelgo io la zona")}`;
    if (!d.open) d.showModal();
    const primo = c.querySelector("[data-pos]");   // il fuoco sul pulsante principale, non su "Chiudi"
    if (primo) primo.focus();
  }
  async function azionePosizione(cosa) {
    const d = $("#dlg-posizione");
    if (cosa === "no") { d.close(); if (!$("#dlg-gettone").open) scorri($("#sez-mondi")); return; }
    finestraPosizione("cerco");
    const err = await trovami();
    if (!d.open) return;
    if (err) return finestraPosizione(err);
    d.close();
    if ($("#dlg-gettone").open) gettone(); else { scorri($(".bar")); percorso.avanza(); }
  }
  // All'apertura del sito: se la posizione non è già consentita, la finestra che la propone.
  // Chi sceglie la zona (o chiude) non se la ritrova alla visita dopo: le due scelte restano in cima alla pagina.
  async function proponiPosizione() {
    if (!navigator.geolocation || stato.pos || memoria.get("sns-posizione") === "no") return;
    const permesso = await permessoPosizione();
    if (permesso === "granted" || stato.pos || document.querySelector("dialog[open]")) return;
    finestraPosizione("chiedi");
  }
  let cerco = false;
  async function start() {
    if (cerco) return;
    cerco = true;
    conta("start");
    const voce = $("#m-start .voce"), prima = voce.textContent;
    voce.textContent = "TI CERCO…"; toast("Ti cerco…");
    const err = await trovami();
    cerco = false; voce.textContent = prima;
    $("#toast").hidden = true;
    if (err) return finestraPosizione(err);
    scorri($(".bar"));
    percorso.avanza();
  }
  function scegliMondo(id) { stato.mondo = id; stato.livello = ""; stato.vicino = false; gt.ovunque = false; aggiorna(); percorso.avanza(); }
  function scegliLivello(lv) { stato.livello = lv; stato.vicino = false; aggiorna(); scorri($(".bar")); conta("livello"); percorso.avanza(); if (stato.mondo === "roma") mappa.anticipa(); }
  // Su telefono lista e mappa si alternano e sono alte in modo diverso: senza questo, passando alla mappa
  // dopo aver scorso la lista, la mappa restava quasi tutta fuori schermo. Porta l'inizio subito sotto la barra.
  function allinea() {
    const bar = $(".bar"), fermo = parseFloat(getComputedStyle(bar).top) || 0;
    scrollBy(0, Math.round($(".main").getBoundingClientRect().top - bar.getBoundingClientRect().height - fermo));
  }
  function impostaVista(v) {
    const cambia = stato.vista !== v;
    stato.vista = v; $(".main").dataset.view = v;
    document.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.view === v));
    if (cambia && mobile()) allinea();
    if (v === "mappa") mappa.mostra();
  }
  function lampeggia(el) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
  function mostraScheda(i) {
    impostaVista("lista");
    let idx = ultimi.findIndex((x) => x.i === i);
    if (idx === -1) { const x = DATA[i]; Object.assign(stato, { mondo: x.m, livello: "", vicino: false, voglia: "", q: "" }); $("#q").value = ""; aggiorna({ adatta: false }); idx = ultimi.findIndex((y) => y.i === i); }
    if (idx >= stato.mostrati) { stato.mostrati = idx + 1; disegnaLista(); }
    const el = document.getElementById("p" + i);
    if (el) { scorri(el, "center"); lampeggia(el); }
    percorso.avanza({ p: i });
  }
  function mostraSuMappa(i) { if (mobile()) { impostaVista("mappa"); allinea(); } mappa.vai(i); const el = document.getElementById("p" + i); if (el && !mobile()) lampeggia(el); if (mobile()) percorso.avanza({ p: i }); }   // sul computer la mappa è già lì: non è un passo

  // Restart: torna alla schermata del titolo come appena aperto il sito. L'accesso all'account resta.
  let tCerca;
  function restart() {
    clearInterval(gt.timer); clearTimeout(tCerca);
    document.querySelectorAll("dialog[open]").forEach((d) => d.close());
    Object.assign(stato, INIZIO);
    gt.usciti.clear(); gt.ovunque = false; gt.ora = true; inv.rilancio = false;
    $("#q").value = "";
    mappa.posizione(null); mappa.chiudi();
    impostaVista("lista");
    aggiorna();
    $("#domanda").textContent = momento().domanda; $("#risposta").textContent = momento().no;
    scrollTo({ top: 0, behavior: ridotto() ? "auto" : "smooth" });
    $("#m-start").focus({ preventScroll: true });
    toast("Si riparte da capo.");
    percorso.avanza();   // così "Indietro" annulla anche un restart fatto per sbaglio
  }

  // ---------- Gettone: un posto solo, pescato tra quelli che puoi raggiungere davvero ----------
  const gt = { usciti: new Set(), ovunque: false, ora: true, timer: null, x: null };

  // Chi è in gioco: prima i tipi adatti all'ora, poi i più vicini
  function inGioco() {
    const mom = momento();
    let pool = ultimi, ora = false, nessuno = false;
    if (gt.ora && !stato.voglia) {
      const adatti = pool.filter((x) => mom.tipi.includes(x.t));
      if (adatti.length) { pool = adatti; ora = true; } else nessuno = pool.length > 0;   // nessun posto adatto a quest'ora: si pesca tra tutti, e lo si dice
    }
    let dove = $("#titolo-ris").textContent;
    if (stato.pos && stato.vicino) {          // "ultimi" è già in ordine di distanza
      const passo = [12, 25, 45].find((t) => pool.filter((x) => minuti(x.km) <= t).length >= 4);
      if (passo) { pool = pool.filter((x) => minuti(x.km) <= passo); dove = `entro ${passo} minuti a piedi`; }
      else { pool = pool.slice(0, 6); dove = "i più vicini a te"; }
    }
    return { pool, dove, ora, mom, nessuno };
  }
  // Non ripete un posto finché non sono usciti tutti; chi ha un commento esce più spesso, chi hai già visitato meno
  function pesca(pool) {
    let cand = pool.filter((x) => !gt.usciti.has(x.i)), nuovoGiro = false;
    if (!cand.length) {
      pool.forEach((x) => gt.usciti.delete(x.i));
      cand = pool.filter((x) => x.i !== stato.pescato);
      if (!cand.length) cand = pool;
      nuovoGiro = pool.length > 1;
    }
    const peso = (x) => (x.nt ? 3 : x.dr ? 2 : 1) * (SNS.visitati.has(x.id) ? 0.3 : 1);
    let r = Math.random() * cand.reduce((s, x) => s + peso(x), 0);
    const x = cand.find((y) => (r -= peso(y)) <= 0) || cand[cand.length - 1];
    gt.usciti.add(x.i);
    return { x, nuovoGiro };
  }
  function gettone() {
    const d = $("#dlg-gettone");
    if (!d.open) d.showModal();
    clearInterval(gt.timer);
    const g = inGioco();
    if (!g.pool.length) {
      $("#get-corpo").innerHTML = `<p class="get-dom">Nessun posto in gioco.</p><p>Con questi filtri non c’è niente da pescare: cambia livello o power-up, oppure ricomincia.</p>
        <div class="get-acts"><button class="btn" type="button" data-restart>${svg("restart")}RESTART</button></div>`;
      return;
    }
    if (!stato.vicino && !stato.livello && !gt.ovunque && g.pool.length > 12) return chiediDove();
    estrai(g);
  }
  function chiediDove(errore) {
    const m = MONDI.find((m) => m.id === stato.mondo);
    const haLivelli = (LIVELLI[stato.mondo] || []).length > 0;
    $("#get-corpo").innerHTML = `<p class="get-cosa">Il gettone sceglie al posto tuo: pesca <b>un posto a caso</b> dalla lista. È gratis, puoi rimetterlo quante volte vuoi.</p>
      <p class="get-dom">Dove te lo pesco?</p>
      ${errore ? `<p class="errore" role="alert"><b>Non riesco a usare la posizione.</b> ${esc({ bloccata: `È bloccata per questo sito, oppure è spenta sul ${apparecchio()}.`, errore: `Il ${apparecchio()} non riesce a dirmi dove sei in questo momento.` }[errore] || POS_ERR[errore] || errore)}${errore === "assente" ? "" : ` <button class="link" type="button" data-get="guida" data-fase="${esc(errore)}">Come si attiva?</button>`} Intanto puoi scegliere tu dove pescare.</p>` : ""}
      <div class="get-scelte">
        <button type="button" class="px primo" data-get="vicino"><b>▶ Vicino a me</b><small>Ti chiedo la posizione: pesco solo tra i posti a pochi minuti a piedi</small></button>
        ${haLivelli ? `<button type="button" class="px" data-get="livello"><b>${stato.mondo === "roma" ? "Scelgo il quartiere" : "Scelgo la località"}</b><small>Poi rimetti il gettone: pesco solo lì</small></button>` : ""}
        <button type="button" class="px" data-get="ovunque"><b>Ovunque ${m.id === "fuori" ? "fuori porta" : "a " + esc(m.nome)}</b><small>Può uscire un posto lontano da te</small></button>
      </div>
      <small>La posizione la uso solo se scegli «Vicino a me», e resta sul tuo ${apparecchio()}.</small>`;
  }
  // Prima che il telefono chieda il permesso: a che cosa serve la posizione, che cosa sta per succedere, dove finisce.
  // Compare solo quando il browser sta davvero per chiederla: se è già consentita (o già rifiutata) non serve.
  function avvisoPosizione() {
    const cosa = apparecchio();
    $("#get-corpo").innerHTML = `<p class="get-dom">Posso usare la tua posizione?</p>
      <ul class="avviso">
        <li><b>A che cosa serve.</b> Solo a pescare tra i posti a pochi minuti a piedi da te.</li>
        <li><b>Che cosa succede adesso.</b> Il ${cosa} ti chiede il permesso: scegli «Consenti».</li>
        <li><b>Dove finisce.</b> Resta sul tuo ${cosa}: al sito non arriva e non viene salvata.${CON_CHECKIN ? " La inviamo solo se un giorno premi «Check-in», per verificare che sei lì." : ""}</li>
      </ul>
      <div class="get-acts in-colonna">
        <button class="btn" type="button" data-get="vicino-ok">▶ Sì, usa la posizione</button>
        <button class="btn alt" type="button" data-get="dove">No, scelgo io dove</button>
      </div>
      <small>Se dici di no non cambia nulla: il gettone pesca nella zona che scegli tu. <a href="privacy.html" target="_blank" rel="noopener">Privacy</a></small>`;
    $("#get-corpo [data-get=vicino-ok]").focus();
  }
  function estrai(g) {
    const { x, nuovoGiro } = pesca(g.pool);
    gt.x = x; stato.pescato = x.i;
    const n = g.pool.length;
    $("#hint-gettone").hidden = true;   // l'ha usato: il suggerimento sopra la lista non serve più
    conta("gettone");
    $("#get-corpo").innerHTML = `<span class="eti">GETTONE INSERITO · ${n === 1 ? "1 POSTO IN GIOCO" : "UNO A CASO TRA " + n + " POSTI"}</span>
      <div class="rullo gira" id="rullo" aria-hidden="true">…</div>
      <div class="get-esito" id="get-esito" aria-live="polite"></div>`;
    const rullo = $("#rullo");
    const fine = () => {
      rullo.classList.remove("gira"); rullo.removeAttribute("aria-hidden"); rullo.textContent = x.n;
      const filtro = stato.voglia ? ` · solo «${esc(PW[stato.voglia][0])}»` : g.ora ? ` · adatti all’ora (${esc(g.mom.nome)})` : g.nessuno ? ` · di ogni tipo, perché qui non ne ho di adatti all’ora (${esc(g.mom.nome)})` : !gt.ora ? " · di ogni tipo" : "";
      const cambia = stato.voglia ? "" : g.ora ? `<button class="link" type="button" data-get="ora">Vanno bene tutti i tipi</button>`
        : !gt.ora ? `<button class="link" type="button" data-get="ora">Solo quelli adatti all’ora</button>` : "";
      $("#get-esito").innerHTML = `<span class="sr">È uscito ${esc(x.n)}.</span>
        <div class="meta"><span class="tipo">${svg(PW[x.t][1])}${esc(PW[x.t][0])}</span><span class="quart">${esc(luogo(x))}</span>${stato.pos ? `<span class="quanto">${distTesto(x)}</span>` : ""}</div>
        ${nota(x)}
        ${via(x) ? `<div class="addr">${esc(via(x))}</div>` : ""}
        <div class="get-acts"><a class="btn" href="${linkVai(x)}" ${EXT}>▶ Portami lì</a><button class="btn alt" type="button" data-get="ancora" ${n < 2 ? "disabled" : ""}>Altro gettone</button></div>
        ${INVITI ? `<div class="get-acts"><button class="btn alt" type="button" data-get="invita">Proponilo: ${esc(inv.rilancio ? "Meglio qui?" : g.mom.qui)}</button></div>` : ""}
        <div class="get-link"><button class="link" type="button" data-get="mappa">Vedi sulla mappa</button><button class="link" type="button" data-get="scheda">Apri la scheda</button>${SNS.pulsanteComitiva ? SNS.pulsanteComitiva(x, "link") : ""}</div>
        ${DONA ? `<p class="moneta-riga">${moneta()}<small>Donazione facoltativa a Matteo, che cura il sito.</small></p>` : ""}
        <p class="get-info">${nuovoGiro ? "Li hai visti tutti: il giro ricomincia. " : ""}${n < 2 ? (g.ora ? `Qui è l’unico posto adatto all’ora (${esc(g.mom.nome)}).` : "È l’unico posto in gioco: cambia livello o power-up per pescarne altri.") : `Pescato tra ${n} posti · ${esc(g.dove)}${filtro}.`} ${cambia}</p>
        <small>Gli orari non li conosciamo: prima di partire controlla su Maps che sia aperto.</small>`;
      rispondi(x);
      segnaInCorso();
    };
    if (ridotto() || n < 2) return fine();
    let k = 0;
    gt.timer = setInterval(() => {
      rullo.textContent = g.pool[Math.floor(Math.random() * n)].n;
      if (++k >= 8) { clearInterval(gt.timer); fine(); }
    }, 55);
  }
  async function azioneGettone(cosa, b) {
    const d = $("#dlg-gettone");
    if (cosa === "guida") return finestraPosizione(b.dataset.fase);
    if (cosa === "ancora") return gettone();
    if (cosa === "invita") return proponi(gt.x);
    if (cosa === "ovunque") { gt.ovunque = true; return gettone(); }
    if (cosa === "ora") { gt.ora = !gt.ora; return gettone(); }
    if (cosa === "livello") { d.close(); scorri($("#sez-mondi")); return toast(stato.mondo === "roma" ? "Tocca un quartiere, poi rimetti il gettone." : "Scegli una località, poi rimetti il gettone."); }
    if (cosa === "mappa") { d.close(); mostraSuMappa(gt.x.i); if (!mobile()) scorri($(".bar")); return; }
    if (cosa === "scheda") { d.close(); return mostraScheda(gt.x.i); }
    if (cosa === "dove") return chiediDove();
    if (cosa === "vicino" || cosa === "vicino-ok") {
      // Il primo tocco su "Vicino a me": se il browser sta per chiedere il permesso, prima l'avviso
      if (cosa === "vicino" && navigator.geolocation && !stato.pos) {
        const permesso = await permessoPosizione();
        if (!d.open) return;
        if (permesso === "prompt") return avvisoPosizione();
      }
      $("#get-corpo").innerHTML = `<p class="get-dom">Ti cerco…</p><p>Se il ${apparecchio()} ti chiede il permesso, scegli <b>Consenti</b>.</p>
        <small>La posizione resta sul tuo ${apparecchio()}: serve solo a calcolare quanto dista ogni posto.</small>`;
      const err = await trovami();
      if (!d.open) return;
      if (err) chiediDove(err); else gettone();
    }
  }

  // ---------- Inviti: "Stasera qui?" ----------
  // Proponi un posto a qualcuno: parte un messaggio con un link; chi lo apre vede quel posto e risponde "Ci sto!"
  // oppure ne propone un altro. Tutto passa dall'app di messaggi di chi scrive: il sito non riceve né salva
  // messaggi, destinatari o risposte. Nel link ci sono solo il numero del posto e il momento della giornata.
  const QUANDO = [...MOMENTI, NOTTE];
  const quandoDi = (k) => QUANDO.find((m) => m.k === k);
  const inv = { x: null, k: "", contro: false, testo: "", fase: "", da: null, rilancio: false };   // posto e momento scelti; l'invito ricevuto (da); se stai rilanciando con un altro posto
  function linkInvito(x, k, contro) {
    const u = new URL(location.href);
    u.search = ""; u.hash = "";
    u.searchParams.set("posto", x.id); u.searchParams.set("m", k);
    if (contro) u.searchParams.set("r", "1");
    u.searchParams.set("da", "amici");
    return u.href;
  }
  const doveSta = (x) => (luogo(x) ? ", " + luogo(x) : "");
  // Il messaggio pronto e i modi per mandarlo: la condivisione del telefono (se c'è), WhatsApp, copia e incolla
  function invio(testo) {
    inv.testo = testo;
    return `<p class="messaggio" id="inv-testo">${esc(testo)}</p>
      <div class="get-acts">
        ${navigator.share ? `<button class="btn" type="button" data-inv="condividi" autofocus>▶ Invia</button>` : ""}
        <a class="btn${navigator.share ? " alt" : ""}" href="https://wa.me/?text=${encodeURIComponent(testo)}" ${EXT} data-inv="whatsapp"${navigator.share ? "" : " autofocus"}>WhatsApp</a>
        <button class="btn alt" type="button" data-inv="copia">Copia il messaggio</button>
      </div>
      <p class="errore" id="inv-avviso" role="status" hidden></p>`;
  }
  // Chi propone
  function proponi(x) {
    if (!INVITI || !x) return;
    Object.assign(inv, { x, contro: inv.rilancio, k: inv.rilancio && inv.da ? inv.da.k : momento().k });
    conta("invito_apri");
    schermoManda();
    const d = $("#dlg-invito"); if (!d.open) d.showModal();
  }
  function schermoManda() {
    const { x, k, contro } = inv;
    inv.fase = "manda";
    $("#inv-t").textContent = "PROPONILO";
    $("#inv-corpo").innerHTML = `<span class="eti">${contro ? "LA TUA CONTROPROPOSTA" : "MANDALO A CHI VUOI"}</span>
      <div class="rullo">${esc(x.n)}</div>
      ${contro ? "" : `<div class="quando" role="group" aria-label="Per quando?">${QUANDO.map((m) => `<button type="button" data-inv="quando" data-k="${m.k}" aria-pressed="${m.k === k}">${m.breve}</button>`).join("")}</div>`}
      ${invio(`${contro ? "Meglio qui?" : quandoDi(k).qui} ${x.n}${doveSta(x)}. Ci stai?\n${linkInvito(x, k, contro)}`)}
      ${riquadroDona()}
      <p class="get-info">Chi lo riceve apre il sito su questo posto e ti risponde «Ci sto!», oppure te ne propone un altro. Il sito non salva il messaggio né a chi lo mandi.</p>`;
  }
  // La stessa finestra per mandare un altro messaggio (per esempio il link di una comitiva)
  function condividi({ titolo, eti, nome, testo, nota, evento }) {
    Object.assign(inv, { fase: "altro", evento: evento || "" });
    $("#inv-t").textContent = titolo;
    $("#inv-corpo").innerHTML = `<span class="eti">${esc(eti)}</span>${nome ? `<div class="rullo">${esc(nome)}</div>` : ""}${invio(testo)}${nota ? `<p class="get-info">${esc(nota)}</p>` : ""}`;
    const d = $("#dlg-invito"); if (!d.open) d.showModal();
  }
  // Chi riceve
  function schermoInvito() {
    const { x, k, contro } = inv.da;
    $("#inv-t").textContent = (contro ? "Meglio qui?" : quandoDi(k).qui).toUpperCase();
    $("#inv-corpo").innerHTML = `<span class="eti">${contro ? "TI RISPONDONO CON UN ALTRO POSTO" : "TI HANNO PROPOSTO UN POSTO"}</span>
      <div class="rullo">${esc(x.n)}</div>
      <div class="meta"><span class="tipo">${svg(PW[x.t][1])}${esc(PW[x.t][0])}</span><span class="quart">${esc(luogo(x))}</span></div>
      ${nota(x)}
      ${via(x) ? `<div class="addr">${esc(via(x))}</div>` : ""}
      <div class="get-acts"><button class="btn" type="button" data-inv="si" autofocus>Ci sto!</button><button class="btn alt" type="button" data-inv="no">${esc(quandoDi(k).no)}</button></div>
      <div class="get-link"><button class="link" type="button" data-inv="mappa">Vedi sulla mappa</button><button class="link" type="button" data-inv="scheda">Apri la scheda</button></div>
      <p class="get-info">Il sito non sa chi ti ha scritto né che cosa rispondi: la risposta parte dal tuo telefono.</p>`;
  }
  function schermoNo() {
    const { x, k } = inv.da, zona = luogo(x);
    $("#inv-t").textContent = "ANZI SÌ?";
    $("#inv-corpo").innerHTML = `<p class="get-dom">${esc(quandoDi(k).no)}</p>
      <div class="get-scelte">
        <button type="button" class="px primo" data-inv="altro"><b>▶ Anzi sì: ne propongo un altro</b><small>Pesco un posto ${zona ? (x.m === "roma" && x.l !== "Periferia" ? "in zona " : "a ") + esc(zona) : "lì vicino"} e glielo mando</small></button>
        <button type="button" class="px" data-inv="passo"><b>No, stavolta passo</b><small>Rispondo che facciamo un’altra volta</small></button>
      </div>
      <p class="get-info"><button class="link" type="button" data-inv="invito">◀ Torna all’invito</button></p>`;
  }
  function schermoRisposta(si) {
    const { x, k } = inv.da;
    inv.fase = "risposta";
    $("#inv-t").textContent = si ? "CI STO!" : "UN’ALTRA VOLTA";
    $("#inv-corpo").innerHTML = `<span class="eti">LA TUA RISPOSTA</span>
      ${invio(si ? `Ci sto! ${x.n}${doveSta(x)}: ci vediamo lì.` : `${quandoDi(k).no} Facciamo un’altra volta?`)}
      ${si ? `<div class="get-acts"><a class="btn alt" href="${linkVai(x)}" ${EXT}>▶ Portami lì</a></div>` : ""}
      <p class="get-info"><button class="link" type="button" data-inv="invito">◀ Torna all’invito</button></p>`;
  }
  // Porta il sito nella zona di quel posto (serve per mappa, scheda e controproposta)
  function portaA(x) {
    Object.assign(stato, { mondo: x.m, livello: x.l === "Periferia" ? "" : (x.l || ""), vicino: false, voglia: "", q: "" });
    $("#q").value = "";
    aggiorna();
  }
  async function copia(testo) {
    try { await navigator.clipboard.writeText(testo); return true; } catch (e) { /* si prova alla vecchia maniera */ }
    try {
      const a = document.createElement("textarea");
      a.value = testo; a.setAttribute("readonly", ""); a.style.position = "fixed"; a.style.opacity = "0";
      $("#dlg-invito").appendChild(a); a.select();
      const fatto = document.execCommand("copy");
      a.remove();
      return fatto;
    } catch (e) { return false; }
  }
  async function azioneInvito(cosa, b) {
    const d = $("#dlg-invito"), avviso = (t) => { const a = $("#inv-avviso"); if (a) { a.textContent = t; a.hidden = !t; } };
    const manda = () => { const ev = inv.fase === "risposta" ? "invito_risposta" : inv.fase === "altro" ? inv.evento : "invito_manda"; if (ev) conta(ev); };
    if (cosa === "quando") { inv.k = b.dataset.k; return schermoManda(); }
    if (cosa === "whatsapp") return manda();   // è un link: si apre da solo
    if (cosa === "condividi") {
      manda();
      try { await navigator.share({ text: inv.testo }); } catch (e) { if (!e || e.name !== "AbortError") avviso("Qui la condivisione non parte: usa WhatsApp o copia il messaggio."); }
      return;
    }
    if (cosa === "copia") {
      manda();
      if (!(await copia(inv.testo))) return avviso("Non riesco a copiarlo: tieni premuto sul messaggio qui sopra e copialo a mano.");
      const prima = b.textContent; b.textContent = "Copiato ✓"; setTimeout(() => { if (b.isConnected) b.textContent = prima; }, 2000);
      return;
    }
    if (!inv.da) return;
    const x = inv.da.x;
    if (cosa === "invito") return schermoInvito();
    if (cosa === "si") { conta("invito_si"); return schermoRisposta(true); }
    if (cosa === "no") return schermoNo();
    if (cosa === "passo") { conta("invito_no"); return schermoRisposta(false); }
    if (cosa === "mappa") { d.close(); portaA(x); mostraSuMappa(x.i); if (!mobile()) scorri($(".bar")); return; }
    if (cosa === "scheda") { d.close(); portaA(x); return mostraScheda(x.i); }
    if (cosa === "altro") {   // controproposta: un gettone nella stessa zona, senza ripescare il posto proposto
      conta("invito_altro");
      d.close(); portaA(x);
      gt.usciti.add(x.i); inv.rilancio = true;
      scorri($(".bar"));
      return gettone();
    }
  }
  // Un invito in arrivo: ?posto=<numero del posto>&m=<momento>[&r=1 se è una controproposta]
  const arrivato = (() => {
    if (!INVITI) return null;
    let p;
    try { p = new URLSearchParams(location.search); } catch (e) { return null; }
    const id = p.get("posto");
    return id ? { x: perId.get(id) || null, k: (quandoDi(p.get("m")) || momento()).k, contro: p.get("r") === "1", visto: false } : null;
  })();
  // Un link a una comitiva: ?comitiva=<chiave>. Se ne occupa js/comitiva.js, che può arrivare un attimo dopo.
  let comitivaInArrivo = null;
  if (COMITIVE) { try { comitivaInArrivo = new URLSearchParams(location.search).get("comitiva"); } catch (e) { /* indirizzo non leggibile */ } }
  // Che cosa mostrare per primo: l'invito, se sei arrivato da un invito; altrimenti la domanda sulla posizione
  function accogli() {
    if ($("#dlg-termini").open) return;            // prima i termini: poi si riparte da qui
    if (comitivaInArrivo) {
      const k = comitivaInArrivo; comitivaInArrivo = null;
      try { const u = new URL(location.href); u.searchParams.delete("comitiva"); history.replaceState(history.state, "", u.pathname + u.search + u.hash); } catch (e) { /* non indispensabile */ }
      if (SNS.arrivoComitiva) SNS.arrivoComitiva(k); else SNS.comitivaInAttesa = k;
      return;
    }
    if (!arrivato || arrivato.visto) return proponiPosizione();
    arrivato.visto = true;
    // L'indirizzo torna pulito: ricaricando la pagina o tornando indietro l'invito non si riapre da solo
    try { const u = new URL(location.href); ["posto", "m", "r"].forEach((k) => u.searchParams.delete(k)); history.replaceState(history.state, "", u.pathname + u.search + u.hash); } catch (e) { /* non indispensabile */ }
    if (!arrivato.x) { toast("Questo invito non vale più: quel posto non è nella lista."); return proponiPosizione(); }
    inv.da = arrivato;
    conta("invito_arriva");
    schermoInvito();
    $("#dlg-invito").showModal();
  }

  // ---------- Interfaccia per js/conto.js ----------
  const SNS = window.SNS = {
    DATA, perId, PW, esc, svg, luogo, toast, memoria, rpc, conta, nota, condividi, proponi,
    zona: () => ({ mondo: stato.mondo, livello: stato.livello }),
    pulsanteComitiva: null, comitivaAggiungi: null, arrivoComitiva: null, comitivaInAttesa: null,
    visitati: new Set(),
    extraScheda: null,
    ridisegna() { const m = stato.mostrati; disegnaLista(); if (m > PAGINA) { stato.mostrati = m; disegnaLista(); } disegnaOverworld(); mappa.ridisegna(); },
    start: () => start(),
    mostraScheda: (id) => { const x = perId.get(id); if (x) mostraScheda(x.i); },
  };

  // ---------- Percorso: "Indietro" fa un passo indietro nel sito, e ricaricando si ritrova il punto ----------
  // Ogni passo (posti vicini, zona scelta, mappa, scheda aperta, finestra aperta, restart) è una voce nella
  // cronologia della scheda del browser. Dentro c'è solo dove sei nel sito (zona, filtri, altezza della pagina):
  // mai le coordinate. Il tasto Indietro del telefono e il pulsante ◀ della barra tornano al passo prima;
  // se la pagina viene ricaricata (capita tornando da Maps) si riparte da lì e non dall'inizio.
  const percorso = (() => {
    const ok = !!(window.history && history.pushState);
    let n = 0, muto = false, soloChiusura = false, tSegna, giro = 0;
    const BASE = { sns: 1, n: 0, mondo: INIZIO.mondo, livello: "", vicino: false, voglia: "", q: "", vista: "lista", mostrati: PAGINA, y: 0 };
    const foto = (extra) => ({ sns: 1, n, mondo: stato.mondo, livello: stato.livello, vicino: stato.vicino, voglia: stato.voglia, q: $("#q").value,
      vista: stato.vista, mostrati: stato.mostrati, y: Math.round(scrollY), ...extra });
    const bottone = () => { $("#indietro").hidden = !(n > 0); };
    const scrivi = (come, s) => { try { history[come](s, ""); } catch (e) { /* cronologia non disponibile: il sito funziona lo stesso */ } bottone(); };
    const finestraDi = (s) => (s && s.dlg ? document.getElementById(s.dlg) : null);
    const corrente = () => { try { return history.state; } catch (e) { return null; } };
    // Aggiorna la voce corrente (filtri, altezza a cui sei arrivato) senza aggiungerne una
    function segna() {
      if (!ok || muto) return;
      const s = corrente(), d = finestraDi(s);
      scrivi("replaceState", foto(d && d.open ? { dlg: s.dlg } : {}));
    }
    // Solo l'altezza della pagina, nella voce corrente. Serve PRIMA che un tocco cambi qualcosa: quando arriva
    // "avanza" lo stato è già quello nuovo, e la voce vecchia deve restare com'era.
    function segnaAltezza(e) {
      if (e && e.type !== "scroll" && e.type !== "pagehide") giro++;   // hai toccato qualcosa: basta riposizionare la pagina
      if (!ok || muto) return;
      const s = corrente();
      if (s && s.sns) scrivi("replaceState", { ...s, y: Math.round(scrollY), mostrati: stato.mostrati });
    }
    // Un passo nuovo
    function avanza(extra = {}) {
      if (!ok || muto) return;
      const d = finestraDi(corrente());
      if (d && !d.open) return scrivi("replaceState", foto(extra));   // la finestra di prima è già chiusa: il passo nuovo prende il suo posto
      n++; scrivi("pushState", foto(extra));
    }
    // Riporta il sito a come era in quel passo
    async function applica(s, soloFinestra) {
      const diverso = stato.mondo !== s.mondo || stato.livello !== s.livello || stato.vicino !== s.vicino || stato.voglia !== s.voglia || $("#q").value !== (s.q || "");
      if (diverso) {
        if (s.vicino && !stato.pos) {   // i posti vicini dopo una ricarica: la posizione va richiesta di nuovo, non è scritta da nessuna parte
          toast("Ti cerco…");
          const err = await trovami();
          $("#toast").hidden = true;
          if (err) finestraPosizione(err);
        }
        Object.assign(stato, { mondo: s.mondo, livello: s.livello, vicino: !!s.vicino && !!stato.pos, voglia: s.voglia, q: norm((s.q || "").trim()) });
        $("#q").value = s.q || "";
        aggiorna();
      }
      if (s.mostrati > stato.mostrati) { stato.mostrati = s.mostrati; disegnaLista(); }
      const stessaVista = stato.vista === s.vista;
      if (!stessaVista) impostaVista(s.vista);
      if (soloFinestra && !diverso && stessaVista) return;   // si è solo chiusa una finestra: la pagina non si muove
      // L'altezza di prima. Appena ricaricata la pagina i caratteri non sono ancora arrivati e tutto è un po'
      // più corto: per un paio di secondi, ogni volta che la pagina cambia altezza, si riprova. Se intanto
      // tocchi qualcosa, si smette.
      const io = ++giro, vai = () => { if (io === giro) scrollTo(0, s.y || 0); };
      requestAnimationFrame(vai);
      if (window.ResizeObserver) {
        const oss = new ResizeObserver(() => (io === giro ? vai() : oss.disconnect()));
        oss.observe(document.body);
        setTimeout(() => oss.disconnect(), 2500);
      } else if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(vai));
    }
    async function torna(s) {
      s = s && s.sns ? s : BASE;   // la prima voce può non avere stato: è la pagina iniziale
      n = s.n || 0;
      bottone();
      if (soloChiusura) { soloChiusura = false; return; }   // era solo una finestra che si chiudeva: la pagina è già a posto
      muto = true;
      let chiuse = 0;
      document.querySelectorAll("dialog[open]").forEach((d) => { if (d.id !== "dlg-termini" && d.id !== s.dlg) { d.close(); chiuse++; } });
      const d = finestraDi(s);
      if (d && !d.open) { muto = false; history.back(); return; }   // una finestra che non c'è più: si salta
      await applica(s, chiuse > 0);
      muto = false;
    }
    function avvio() {
      if (!ok) return false;
      try { history.scrollRestoration = "manual"; } catch (e) { /* non indispensabile */ }
      addEventListener("popstate", (e) => torna(e.state));
      addEventListener("scroll", () => { clearTimeout(tSegna); tSegna = setTimeout(segnaAltezza, 300); }, { passive: true });
      addEventListener("pointerdown", segnaAltezza, true);   // prima di ogni tocco
      addEventListener("wheel", () => { giro++; }, { passive: true });
      addEventListener("keydown", (e) => { giro++; if (e.key === "Enter" || e.key === " ") segnaAltezza(); }, true);
      addEventListener("pagehide", segnaAltezza);
      $("#indietro").addEventListener("click", () => history.back());
      // Ogni finestra aperta è un passo: Indietro la chiude. I termini no: vanno accettati, non saltati.
      document.querySelectorAll("dialog").forEach((d) => {
        if (d.id === "dlg-termini") return;
        const apri = d.showModal.bind(d);
        d.showModal = () => { apri(); avanza({ dlg: d.id }); };
        d.addEventListener("close", () => { const s = corrente(); if (ok && !muto && s && s.dlg === d.id) { soloChiusura = true; history.back(); } });
      });
      const s = corrente();
      const daRiprendere = s && s.sns && (s.n > 0 || s.livello || s.vicino || s.mondo !== INIZIO.mondo || s.voglia || s.q || s.y > 0);
      if (!daRiprendere) { scrivi("replaceState", foto()); return false; }
      n = s.n || 0; muto = true;
      applica(s).then(() => { muto = false; if (s.dlg) scrivi("replaceState", foto()); bottone(); });
      return true;
    }
    return { avanza, segna, avvio };
  })();

  // ---------- Eventi ----------
  $("#m-start").addEventListener("click", start);
  $("#m-livelli").addEventListener("click", () => scorri($("#sez-mondi")));
  $("#m-gettone").addEventListener("click", gettone);
  $("#gettone").addEventListener("click", gettone);
  $("#mondi").addEventListener("click", (e) => { const b = e.target.closest("[data-mondo]"); if (b) scegliMondo(b.dataset.mondo); });
  $("#ow-svg").addEventListener("keydown", (e) => { const n = e.target.closest("[data-livello]"); if (n && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); scegliLivello(n.dataset.livello); } });
  $("#get-corpo").addEventListener("click", (e) => { const b = e.target.closest("[data-get]"); if (b) azioneGettone(b.dataset.get, b); });
  $("#pos-corpo").addEventListener("click", (e) => { const b = e.target.closest("[data-pos]"); if (b) azionePosizione(b.dataset.pos); });
  $("#inv-corpo").addEventListener("click", (e) => { const b = e.target.closest("[data-inv]"); if (b) azioneInvito(b.dataset.inv, b); });
  // Chiusa senza posizione (non ora, Chiudi, Esc): si ricorda, così alla prossima visita non viene riproposta
  $("#dlg-posizione").addEventListener("close", () => { if (!stato.pos) memoria.set("sns-posizione", "no"); });
  $("#dlg-gettone").addEventListener("close", () => clearInterval(gt.timer));
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-restart]")) return restart();
    const lv = e.target.closest("[data-livello]");
    if (lv) return scegliLivello(lv.dataset.livello);
    const pr = e.target.closest("[data-invita]");
    if (pr) return proponi(DATA[+pr.dataset.invita]);
    const co = e.target.closest("[data-comitiva]");
    if (co) return SNS.comitivaAggiungi && SNS.comitivaAggiungi(DATA[+co.dataset.comitiva], co);
    const b = e.target.closest("[data-mappa]");
    if (b) mostraSuMappa(+b.dataset.mappa);
  });
  $("#powerups").addEventListener("click", (e) => { const b = e.target.closest("[data-voglia]"); if (!b) return; stato.voglia = stato.voglia === b.dataset.voglia ? "" : b.dataset.voglia; aggiorna(); percorso.segna(); });
  $("#q").addEventListener("input", (e) => { clearTimeout(tCerca); tCerca = setTimeout(() => { stato.q = norm(e.target.value.trim()); aggiorna(); percorso.segna(); }, 160); });
  $("#more").addEventListener("click", () => { stato.mostrati += PAGINA; disegnaLista(); percorso.segna(); });
  $("#bolla").addEventListener("click", (e) => { const i = e.currentTarget.dataset.i; if (i) mostraScheda(+i); else finestraPosizione("chiedi"); });   // "Portami fuori" → da dove partiamo?
  document.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => { const prima = stato.vista; impostaVista(b.dataset.view); if (prima !== stato.vista) percorso.avanza(); }));
  document.querySelectorAll("dialog [data-chiudi]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));

  // Moneta: nel fondo pagina sempre; dopo "Portami lì", al ritorno sulla pagina, un avviso che non blocca nulla.
  // Al massimo una volta per visita, e senza salvare niente nel browser.
  if (DONA) {
    $("#moneta-fondo").innerHTML = moneta();
    $("#dona-fondo").hidden = false;
    $("#m-dona").hidden = false;
    // La finestra si chiude un attimo dopo, non subito: nei browser dentro le app Maps si apre nella stessa pagina,
    // e chiudere la finestra (che fa un passo indietro nella cronologia) nello stesso istante potrebbe fermarlo.
    $("#vai-ora").addEventListener("click", () => setTimeout(() => $("#dlg-vai").close(), 400));
  }
  document.addEventListener("click", suClic);

  // Termini: alla prima visita, e ogni volta che cambiano, vanno accettati prima di giocare.
  // Si ricorda solo la versione accettata, nel browser. Privacy e termini restano leggibili senza accettare.
  const VER_TERMINI = (window.SNS_CONFIG || {}).versioneTermini || "1";
  if (memoria.get("sns-termini") !== VER_TERMINI) {
    const d = $("#dlg-termini");
    d.addEventListener("cancel", (e) => e.preventDefault());   // Esc non basta: serve una scelta esplicita
    if (arrivato && arrivato.x) $("#ter-invito").hidden = false;
    if (comitivaInArrivo) { $("#ter-invito").innerHTML = "<b>Ti hanno invitato in una comitiva.</b> La vedi appena accetti."; $("#ter-invito").hidden = false; }
    $("#termini-ok").addEventListener("click", () => { memoria.set("sns-termini", VER_TERMINI); d.close(); conta("termini_ok"); accogli(); });
    d.showModal();
  }

  // ---------- Avvio ----------
  $("#hi").textContent = String(DATA.length).padStart(6, "0");
  $("#domanda").textContent = momento().domanda; $("#risposta").textContent = momento().no;
  $("#fonte").href = META.fonte || "https://www.google.com/maps";
  $("#agg").textContent = META.aggiornato ? fmtGiorno.format(new Date(META.aggiornato + "T12:00:00")) : "";
  document.querySelectorAll("svg[data-ico]").forEach((s) => { s.outerHTML = svg(s.dataset.ico); });
  aggiorna();
  if (COMITIVE) { const sc = document.createElement("script"); sc.src = "js/comitiva.js"; document.body.appendChild(sc); }
  if (!percorso.avvio()) accogli();   // se si riprende da dove si era, niente finestra in mezzo
  // Una visita = un'apertura del sito. Ricaricare la pagina o tornare indietro non conta di nuovo.
  const arrivo = ((performance.getEntriesByType && performance.getEntriesByType("navigation")[0]) || {}).type;
  if (arrivo !== "reload" && arrivo !== "back_forward") conta("visita", "da_" + provenienza());
})();
