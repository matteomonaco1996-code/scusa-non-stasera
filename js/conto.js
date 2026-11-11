// Scusa, non stasera — account, punti, missioni, check-in e recensioni (Supabase).
// Si attiva solo se config.js contiene URL e chiave pubblica del progetto Supabase.
// I punti li calcola il database: qui si mostrano e si racconta il percorso.
(() => {
  "use strict";
  const C = window.SNS_CONFIG || {};
  const SNS = window.SNS;
  if (!SNS) return;
  if (!C.supabaseUrl || !C.supabaseKey || !window.supabase || C.conto === false) {
    document.body.classList.add("senza-conto");
    return;
  }
  const { esc, toast, perId, luogo, memoria } = SNS;
  const $ = (s) => document.querySelector(s);
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce", storageKey: "sns-sessione" },
  });

  // ---------- Regole del gioco (i bonus veri sono nel database) ----------
  const TITOLI = ["Turista per caso", "Passante", "Buongustaio", "Habitué", "Oste ad honorem", "Guida del quartiere", "Leggenda di Roma"];
  const titolo = (liv) => TITOLI[Math.min(liv, TITOLI.length) - 1];
  const MISSIONI = [
    { c: "primo_passo", t: "Primo passo", d: "Fai il tuo primo check-in", n: 1, v: (s) => s.posti },
    { c: "dimmi_come", t: "Dimmi com’è", d: "Scrivi la tua prima recensione", n: 1, v: (s) => s.recensioni },
    { c: "esploratore", t: "Esploratore", d: "Check-in in 3 quartieri o località diversi", n: 3, v: (s) => s.zone },
    { c: "habitue", t: "Habitué", d: "Torna nello stesso posto in 3 giorni diversi", n: 3, v: (s) => s.ritorni },
    { c: "critico", t: "Critico", d: "5 recensioni con com’è e dritta (almeno 80 caratteri)", n: 5, v: (s) => s.lunghe },
    { c: "giro_completo", t: "Giro completo", d: "Visita 5 tipi di posto diversi", n: 5, v: (s) => s.tipi },
    { c: "re_di_roma", t: "Re di Roma", d: "Check-in in 10 quartieri di Roma", n: 10, v: (s) => s.quartieriRoma },
  ];
  const ETICHETTE = ["aperitivo", "in piedi", "da prenotare", "niente prenotazioni", "pausa pranzo", "dopocena",
    "compleanni", "all'aperto", "per gruppi", "economico", "caro", "smart working"];
  const OGNI_TOT = 3; // dopo il primo check-in, l'invito a recensire arriva ogni 3 posti nuovi

  const io = { utente: null, profilo: null, p: null, recensiti: new Set(), oggi: new Set(), valutazioni: new Map() };
  const oggiISO = () => new Date().toISOString().slice(0, 10);
  const pad = (n) => String(n).padStart(6, "0");
  const fmtData = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" });
  function errore(e) {
    const codice = (e && (e.code || e.error_code)) || "", testo = (e && (e.message || e.error_description)) || "";
    if (codice === "email_address_not_authorized" || /not authorized/i.test(testo)) return "Le iscrizioni non sono ancora aperte a tutti: riprova tra qualche giorno.";
    if (codice === "over_email_send_rate_limit" || codice === "over_request_rate_limit" || (e && e.status === 429)) return "Troppe richieste in poco tempo: riprova tra qualche minuto.";
    if (/failed to fetch|networkerror|load failed/i.test(testo)) return "Connessione assente o servizio non raggiungibile: riprova.";
    return testo || "Qualcosa è andato storto: riprova.";
  }
  const stelle = (n) => "★".repeat(n) + "☆".repeat(5 - n);

  // Statistiche dal punteggio, per avanzamento missioni e badge
  function statistiche(p) {
    const vis = p ? p.visite : [];
    const posti = [...new Set(vis.map((v) => v.luogo))].map((id) => perId.get(id)).filter(Boolean);
    const perPosto = vis.reduce((m, v) => (m[v.luogo] = (m[v.luogo] || 0) + 1, m), {});
    const rec = p ? p.recensioni : [];
    return {
      posti: posti.length,
      recensioni: rec.length,
      lunghe: rec.filter((r) => r.lunga).length,
      zone: new Set(posti.map((x) => x.q || x.c)).size,
      ritorni: Math.max(0, ...Object.values(perPosto)),
      tipi: new Set(posti.filter((x) => x.t !== "altro").map((x) => x.t)).size,
      quartieriRoma: new Set(posti.filter((x) => x.c === "Roma" && x.q && x.q !== "Periferia").map((x) => x.q)).size,
    };
  }
  const fatte = (p) => new Set(((p && p.missioni) || []).filter((m) => m.fatta).map((m) => m.codice));
  const bonus = (c) => { const m = ((io.p && io.p.missioni) || []).find((x) => x.codice === c); return m ? m.bonus : 0; };
  function prossimaMissione() {
    const f = fatte(io.p), st = statistiche(io.p);
    return MISSIONI.filter((m) => !f.has(m.c)).map((m) => ({ ...m, ora: Math.min(m.v(st), m.n) })).sort((a, b) => b.ora / b.n - a.ora / a.n)[0];
  }

  // ---------- Dati pubblici: medie dei voti ----------
  async function caricaValutazioni() {
    const { data, error } = await sb.from("valutazioni").select("luogo,n,media");
    if (error) return;
    io.valutazioni = new Map(data.map((v) => [v.luogo, v]));
    SNS.ridisegna();
  }

  // ---------- Sessione ----------
  async function caricaUtente(session) {
    io.utente = session ? session.user : null;
    io.profilo = null; io.p = null; io.recensiti = new Set(); io.oggi = new Set(); SNS.visitati = new Set();
    if (io.utente) {
      const { data } = await sb.from("profili").select("nickname,in_classifica,creato").eq("id", io.utente.id).maybeSingle();
      io.profilo = data || null;
      if (io.profilo) await caricaPunteggio();
    }
    aggiornaHud();
    SNS.ridisegna();
    if (io.utente && !io.profilo) apriPlayer();
  }
  async function caricaPunteggio() {
    const { data, error } = await sb.rpc("mio_punteggio");
    if (error) return;
    io.p = data;
    SNS.visitati = new Set(data.visite.map((v) => v.luogo));
    io.oggi = new Set(data.visite.filter((v) => v.giorno === oggiISO()).map((v) => v.luogo));
    io.recensiti = new Set(data.recensioni.map((r) => r.luogo));
  }
  function aggiornaHud() {
    $("#nick").textContent = io.profilo ? `${io.profilo.nickname.toUpperCase()} · LIV ${io.p ? io.p.livello : 1}` : "OSPITE";
    $("#punti").textContent = pad(io.p ? io.p.punti : 0);
    $("#apri-player").textContent = io.profilo ? "PLAYER" : "ACCEDI";
  }

  // ---------- Cosa aggiunge alle schede ----------
  SNS.extraScheda = (x) => {
    const v = io.valutazioni.get(x.id);
    const voto = v ? `<button class="link stelle" type="button" data-leggi="${esc(x.id)}" aria-expanded="false">★ ${String(v.media).replace(".", ",")} <span>· ${v.n} ${v.n === 1 ? "recensione" : "recensioni"}</span></button>` : "";
    let azioni;
    if (!io.profilo) azioni = `<button class="btn mini alt" type="button" data-accedi>Accedi per fare punti</button>`;
    else {
      const visto = SNS.visitati.has(x.id), fatto = io.oggi.has(x.id);
      azioni = `<button class="btn mini" type="button" data-checkin="${esc(x.id)}" ${fatto ? "disabled" : ""}>${fatto ? "Check-in fatto oggi" : visto ? "Check-in +2" : "Check-in +10"}</button>` +
        (visto ? `<button class="btn mini alt" type="button" data-scrivi="${esc(x.id)}">${io.recensiti.has(x.id) ? "Modifica recensione" : "Recensisci +5"}</button>` : "");
    }
    return `${voto}<div class="conto-acts">${azioni}</div><div class="recensioni" id="rec-${esc(x.id)}" hidden></div>`;
  };

  // ---------- Schermata premio (dopo check-in e recensioni) ----------
  function premio({ titolo: tit, sotto, righe, totale, livelloPrima, poi }) {
    const p = io.p;
    const levelUp = p && p.livello > livelloPrima;
    const prossima = prossimaMissione();
    $("#premio-corpo").innerHTML = `
      <p class="premio-titolo" id="premio-t">${esc(tit)}</p>
      ${sotto ? `<p class="premio-sotto">${esc(sotto)}</p>` : ""}
      <ul class="premio-righe">${righe.map(([pt, t, cls]) => `<li class="${cls || ""}"><b>+${pt}</b><span>${esc(t)}</span></li>`).join("")}</ul>
      <p class="premio-totale"><span>Totale</span><b class="num">+${totale}</b><span class="num">${p ? p.punti : 0} punti</span></p>
      ${levelUp ? `<div class="level-up"><b>LEVEL UP!</b><span>Livello ${p.livello} · ${esc(titolo(p.livello))}</span></div>` : ""}
      ${prossima ? `<p class="premio-next"><span>Prossima missione</span><b>${esc(prossima.t)}</b> ${esc(prossima.d)} <span class="num">(${prossima.ora}/${prossima.n}) · +${bonus(prossima.c)}</span></p>` : `<p class="premio-next"><b>Tutte le missioni completate.</b> Sei una leggenda.</p>`}
      <div class="conto-acts">${(poi || []).map((a, i) => `<button class="btn ${i ? "alt" : ""}" type="button" data-poi="${i}">${esc(a[0])}</button>`).join("")}</div>`;
    $("#premio-corpo").querySelectorAll("[data-poi]").forEach((b) => b.addEventListener("click", () => { $("#dlg-premio").close(); const f = poi[+b.dataset.poi][1]; if (f) f(); }));
    $("#dlg-premio").showModal();
  }
  function righeMissioni(prima) {
    const ora = fatte(io.p);
    return MISSIONI.filter((m) => ora.has(m.c) && !prima.has(m.c)).map((m) => [bonus(m.c), `Missione compiuta: ${m.t}`, "missione"]);
  }

  // ---------- Check-in ----------
  function posizioneFresca() {
    return new Promise((ok, ko) => {
      if (!navigator.geolocation) return ko(new Error("Questo browser non condivide la posizione."));
      navigator.geolocation.getCurrentPosition(ok, () => ko(new Error("Serve la posizione per il check-in: consentila nelle impostazioni del browser.")),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    });
  }
  function devoInvitare(id, nuovoPosto) {
    if (io.recensiti.has(id) || !nuovoPosto) return false;
    const n = Number(memoria.get("sns-invito-recensione") || 0) + 1;
    const primoDiSempre = io.p && new Set(io.p.visite.map((v) => v.luogo)).size === 1;
    if (primoDiSempre || n >= OGNI_TOT) { memoria.set("sns-invito-recensione", "0"); return true; }
    memoria.set("sns-invito-recensione", String(n));
    return false;
  }
  async function checkin(id, bottone) {
    bottone.disabled = true;
    try {
      const pos = await posizioneFresca();
      const prima = { punti: io.p ? io.p.punti : 0, livello: io.p ? io.p.livello : 1, missioni: fatte(io.p), visti: new Set(SNS.visitati),
        zone: new Set([...SNS.visitati].map((v) => perId.get(v)).filter(Boolean).map((x) => x.q || x.c)) };
      const { data, error } = await sb.rpc("fai_checkin", { p_luogo: id, p_lat: pos.coords.latitude, p_lon: pos.coords.longitude });
      if (error) throw error;
      if (!data.ok) { toast(`Sei a ${data.metri} m da qui: per il check-in serve essere entro 150 m.`); bottone.disabled = false; return; }
      await caricaPunteggio();
      aggiornaHud(); SNS.ridisegna();
      const x = perId.get(id), totale = io.p.punti - prima.punti;
      if (!data.nuovo || totale <= 0) { toast("Check-in già fatto oggi qui."); return; }
      const nuovoPosto = !prima.visti.has(id), zona = x.q || x.c;
      const righe = [];
      righe.push(nuovoPosto ? [10, "Posto nuovo"] : [2, "Bentornato: visita in un altro giorno"]);
      if (!prima.zone.has(zona)) righe.push([20, `${x.q ? "Quartiere" : "Località"} nuovo: ${zona}`]);
      righe.push(...righeMissioni(prima.missioni));
      const invito = devoInvitare(id, nuovoPosto);
      premio({
        titolo: "CHECK-IN!", sotto: `${x.n} · ${luogo(x)}`, righe, totale, livelloPrima: prima.livello,
        poi: invito ? [["Racconta com’è (+5, +10 con la dritta)", () => apriRecensione(id)], ["Dopo"]] : [["Continua"]],
      });
    } catch (e) { toast(errore(e)); bottone.disabled = false; }
  }

  // ---------- Recensioni pubbliche ----------
  function recensioneHtml(r) {
    return `<article class="rec say">
      <header><b>${esc(r.nickname)}</b><span>${stelle(r.voto)} · ${fmtData.format(new Date(r.creata))}</span></header>
      ${r.carattere ? `<p>${esc(r.carattere)}</p>` : ""}
      ${r.dritta ? `<p><span class="dritta">La dritta</span> ${esc(r.dritta)}</p>` : ""}
      ${r.etichette && r.etichette.length ? `<p class="etichette">${r.etichette.map((e) => `<span>${esc(e)}</span>`).join("")}</p>` : ""}
      ${io.profilo ? `<button class="link" type="button" data-segnala="${r.id}">Segnala</button>` : `<a href="termini.html#segnalazioni">Segnala</a>`}
    </article>`;
  }
  async function leggi(id, bottone) {
    const box = document.getElementById("rec-" + id);
    if (!box) return;
    if (!box.hidden) { box.hidden = true; bottone.setAttribute("aria-expanded", "false"); return; }
    box.hidden = false; bottone.setAttribute("aria-expanded", "true");
    box.innerHTML = `<small>Carico…</small>`;
    const { data, error } = await sb.from("recensioni_pubbliche").select("id,voto,carattere,dritta,etichette,creata,nickname").eq("luogo", id).order("creata", { ascending: false }).limit(30);
    if (error) { box.innerHTML = `<small class="errore">${esc(errore(error))}</small>`; return; }
    box.innerHTML = `<small class="nota-verifica">Solo recensioni di chi ha fatto check-in qui.</small>` + data.map(recensioneHtml).join("");
  }

  // ---------- Scrivere una recensione, "stile nota" ----------
  async function apriRecensione(id) {
    const x = perId.get(id);
    let esistente = null;
    if (io.recensiti.has(id)) {
      const { data } = await sb.from("recensioni").select("voto,carattere,dritta,etichette").eq("luogo", id).maybeSingle();
      esistente = data;
    }
    const e = esistente || { voto: 0, carattere: "", dritta: "", etichette: [] };
    $("#rec-corpo").innerHTML = `<p><b>${esc(x.n)}</b> · ${esc(luogo(x))}</p>
      <div class="esempio"><span>Come la nota di Matteo sul Goccetto</span>«Un po’ radical (apprezzato a volte), aperitivo tipico del centro in piedi. Puoi prendere bottiglie, lasciargliele e farti refillare ogni volta.»</div>
      <form class="form" id="f-rec">
        <fieldset class="voto-stelle"><legend>Voto</legend>
          ${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="voto" value="${n}" ${e.voto === n ? "checked" : ""} required><span aria-hidden="true">★</span><span class="sr">${n} su 5</span></label>`).join("")}
        </fieldset>
        <label class="riga">Com’è, in poche parole<input type="text" id="r-carattere" maxlength="120" value="${esc(e.carattere)}" placeholder="es. un po’ radical, ma ci torni volentieri"></label>
        <label class="riga">La dritta<textarea id="r-dritta" maxlength="400" rows="3" placeholder="es. prendi una bottiglia, lasciala lì e la volta dopo te la riempiono">${esc(e.dritta)}</textarea></label>
        <fieldset><legend>Etichette (fino a 3)</legend><div class="chips-et">${ETICHETTE.map((t) => `<label class="et"><input type="checkbox" value="${esc(t)}" ${e.etichette.includes(t) ? "checked" : ""}><span>${esc(t)}</span></label>`).join("")}</div></fieldset>
        <small id="r-conta"></small>
        <small>È pubblica col tuo nickname. Racconta solo la tua esperienza: niente insulti, niente dati di altre persone, niente recensioni del tuo locale o di concorrenti. <a href="termini.html#recensioni">Regole</a></small>
        <p class="errore" id="r-err" hidden></p>
        <div class="conto-acts"><button class="btn" type="submit">${esistente ? "Aggiorna" : "Pubblica"}</button>${esistente ? `<button class="btn rosso" type="button" id="r-elimina">Elimina la mia recensione</button>` : ""}</div>
      </form>`;
    const car = $("#r-carattere"), dri = $("#r-dritta"), conta = $("#r-conta");
    const aggiornaConta = () => { const n = car.value.trim().length + dri.value.trim().length; conta.textContent = n >= 80 ? "Com’è + dritta: bonus +10 sbloccato ✓" : `Com’è + dritta: ${n}/80 caratteri per il bonus +10`; };
    car.addEventListener("input", aggiornaConta); dri.addEventListener("input", aggiornaConta); aggiornaConta();
    const box = $("#rec-corpo .chips-et");
    box.addEventListener("change", () => {
      const sel = box.querySelectorAll("input:checked");
      box.querySelectorAll("input:not(:checked)").forEach((i) => { i.disabled = sel.length >= 3; });
    });
    box.dispatchEvent(new Event("change"));
    $("#f-rec").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const prima = { punti: io.p.punti, livello: io.p.livello, missioni: fatte(io.p), nuova: !io.recensiti.has(id), lunga: (io.p.recensioni.find((r) => r.luogo === id) || {}).lunga };
      const voto = Number(($("#f-rec input[name=voto]:checked") || {}).value);
      const etichette = [...box.querySelectorAll("input:checked")].map((i) => i.value);
      const { error } = await sb.rpc("scrivi_recensione", { p_luogo: id, p_voto: voto, p_carattere: car.value, p_dritta: dri.value, p_etichette: etichette });
      if (error) { const p = $("#r-err"); p.textContent = errore(error); p.hidden = false; return; }
      await caricaPunteggio(); await caricaValutazioni();
      aggiornaHud(); SNS.ridisegna();
      $("#dlg-recensione").close();
      const totale = io.p.punti - prima.punti;
      if (totale <= 0) { toast("Recensione aggiornata."); return; }
      const ora = io.p.recensioni.find((r) => r.luogo === id) || {};
      const righe = [];
      if (prima.nuova) righe.push([5, "Recensione"]);
      if (ora.lunga && !prima.lunga) righe.push([10, "Com’è + dritta"]);
      righe.push(...righeMissioni(prima.missioni));
      premio({ titolo: "RECENSIONE!", sotto: `${x.n} · grazie della dritta`, righe, totale, livelloPrima: prima.livello, poi: [["Continua"]] });
    });
    const el = $("#r-elimina");
    if (el) el.addEventListener("click", async () => {
      const { error } = await sb.from("recensioni").delete().eq("luogo", id);
      if (error) return toast(errore(error));
      await caricaPunteggio(); await caricaValutazioni();
      $("#dlg-recensione").close(); toast("Recensione eliminata."); aggiornaHud(); SNS.ridisegna();
    });
    if (!$("#dlg-recensione").open) $("#dlg-recensione").showModal();
  }

  function apriSegnala(idRecensione) {
    $("#seg-corpo").innerHTML = `<form class="form" id="f-seg">
      <label class="riga">Perché la segnali?<select id="s-motivo" required><option value="">Scegli…</option>
        <option value="falsa">Falsa o non basata su una visita</option><option value="offensiva">Offensiva o discriminatoria</option>
        <option value="dati_personali">Contiene dati personali</option><option value="spam">Spam o pubblicità</option>
        <option value="illegale">Contenuto illegale</option><option value="altro">Altro</option></select></label>
      <label class="riga">Dettagli (facoltativi)<textarea id="s-dett" maxlength="500" rows="4"></textarea></label>
      <small>La esaminiamo e decidiamo se rimuoverla, secondo i <a href="termini.html#segnalazioni">termini d’uso</a>.</small>
      <p class="errore" id="s-err" hidden></p>
      <div class="conto-acts"><button class="btn" type="submit">Invia segnalazione</button></div></form>`;
    $("#f-seg").addEventListener("submit", async (e) => {
      e.preventDefault();
      const { error } = await sb.from("segnalazioni").insert({ recensione: idRecensione, segnalante: io.utente.id, motivo: $("#s-motivo").value, dettagli: $("#s-dett").value.trim() || null });
      if (error) { const p = $("#s-err"); p.textContent = /duplicate|unique/i.test(error.message) ? "Hai già segnalato questa recensione." : errore(error); p.hidden = false; return; }
      $("#dlg-segnala").close(); toast("Segnalazione inviata. Grazie.");
    });
    $("#dlg-segnala").showModal();
  }

  // ---------- Player: accesso, registrazione, profilo ----------
  function apriPlayer() { disegnaPlayer(); const d = $("#player"); if (!d.open) d.showModal(); }
  function disegnaPlayer() {
    const corpo = $("#player-corpo");
    if (!io.utente) return disegnaAccesso(corpo);
    if (!io.profilo) return disegnaRegistrazione(corpo);
    disegnaProfilo(corpo);
  }

  function disegnaAccesso(corpo, email = "") {
    corpo.innerHTML = `<p>Entra con la tua email: ti mandiamo un codice, niente password.</p>
      <form class="form" id="f-email">
        <label class="riga">Email<input type="email" id="a-email" required autocomplete="email" value="${esc(email)}"></label>
        <small>Usiamo l’email solo per farti accedere. Dettagli nell’<a href="privacy.html">informativa privacy</a>.</small>
        <p class="errore" id="a-err" hidden></p>
        <div class="conto-acts"><button class="btn" type="submit">Mandami il codice</button></div>
      </form>`;
    $("#f-email").addEventListener("submit", async (e) => {
      e.preventDefault();
      const em = $("#a-email").value.trim();
      const { error } = await sb.auth.signInWithOtp({ email: em, options: { shouldCreateUser: true, emailRedirectTo: location.href.split("#")[0].split("?")[0] } });
      if (error) { const p = $("#a-err"); p.textContent = errore(error); p.hidden = false; return; }
      disegnaCodice(corpo, em);
    });
  }
  function disegnaCodice(corpo, email) {
    corpo.innerHTML = `<p>Ti abbiamo scritto a <b>${esc(email)}</b>. Inserisci il codice dell’email (oppure apri il link che contiene).</p>
      <form class="form" id="f-codice">
        <label class="riga">Codice<input type="text" id="a-codice" required inputmode="numeric" autocomplete="one-time-code" maxlength="10"></label>
        <p class="errore" id="c-err" hidden></p>
        <div class="conto-acts"><button class="btn" type="submit">Entra</button><button class="btn alt" type="button" id="c-indietro">Cambia email</button></div>
      </form>`;
    $("#c-indietro").addEventListener("click", () => disegnaAccesso(corpo, email));
    $("#f-codice").addEventListener("submit", async (e) => {
      e.preventDefault();
      const { error } = await sb.auth.verifyOtp({ email, token: $("#a-codice").value.trim(), type: "email" });
      if (error) { const p = $("#c-err"); p.textContent = "Codice non valido o scaduto."; p.hidden = false; }
    });
  }
  function disegnaRegistrazione(corpo) {
    corpo.innerHTML = `<p>Ultimo passo: scegli come ti vedranno gli altri giocatori.</p>
      <form class="form" id="f-reg">
        <label class="riga">Nickname<input type="text" id="g-nick" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_.\\-]{3,20}" autocomplete="nickname"><small>3–20 caratteri: lettere, numeri, punto, trattino. Non usare il tuo nome e cognome.</small></label>
        <label class="spunta"><input type="checkbox" id="g-eta" required><span>Ho almeno 14 anni.</span></label>
        <label class="spunta"><input type="checkbox" id="g-termini" required><span>Accetto i <a href="termini.html" target="_blank" rel="noopener">termini d’uso</a> e ho letto l’<a href="privacy.html" target="_blank" rel="noopener">informativa privacy</a>.</span></label>
        <label class="spunta"><input type="checkbox" id="g-classifica"><span>Mostra il mio nickname e i miei punti nella classifica pubblica (facoltativo, puoi cambiarlo quando vuoi).</span></label>
        <p class="errore" id="g-err" hidden></p>
        <div class="conto-acts"><button class="btn" type="submit">Inizia a giocare</button><button class="btn alt" type="button" id="g-esci">Annulla ed esci</button></div>
      </form>`;
    $("#g-esci").addEventListener("click", () => sb.auth.signOut());
    $("#f-reg").addEventListener("submit", async (e) => {
      e.preventDefault();
      const { error } = await sb.from("profili").insert({
        id: io.utente.id, nickname: $("#g-nick").value.trim(), eta_confermata: $("#g-eta").checked,
        in_classifica: $("#g-classifica").checked, termini_versione: C.versioneTermini || "1.0", privacy_versione: C.versionePrivacy || "1.0",
      });
      if (error) { const p = $("#g-err"); p.textContent = /duplicate|unique/i.test(error.message) ? "Nickname già preso: provane un altro." : errore(error); p.hidden = false; return; }
      await caricaUtente((await sb.auth.getSession()).data.session);
      $("#player").close();
      premio({
        titolo: "PLAYER 1 PRONTO", sotto: `Benvenuto, ${io.profilo.nickname}. Livello 1 · ${titolo(1)}`, righe: [], totale: 0, livelloPrima: 1,
        poi: [["Vicino a me: trova un posto qui intorno", () => SNS.start()], ["Dopo"]],
      });
    });
  }

  async function disegnaProfilo(corpo) {
    const p = io.p || { punti: 0, livello: 1, visite: [], recensioni: [], missioni: [] };
    const nelLivello = p.punti % 100, st = statistiche(p), f = fatte(p), prossima = prossimaMissione();
    corpo.innerHTML = `
      <p class="titolo-liv"><span>Livello ${p.livello}</span><b>${esc(titolo(p.livello))}</b></p>
      <div class="punteggio"><div><b class="num">${p.punti}</b><span>punti</span></div><div><b class="num">${st.posti}</b><span>posti</span></div><div><b class="num">${st.recensioni}</b><span>recensioni</span></div></div>
      <div><small>Livello ${p.livello + 1} · ${esc(titolo(p.livello + 1))} tra ${100 - nelLivello} punti</small><div class="barra-liv"><i id="barra"></i></div></div>
      ${prossima ? `<div class="missione-next"><span>Prossima missione · +${bonus(prossima.c)}</span><b>${esc(prossima.t)}</b><small>${esc(prossima.d)} (${prossima.ora}/${prossima.n})</small>
        ${prossima.c === "primo_passo" || prossima.c === "esploratore" || prossima.c === "re_di_roma" ? `<button class="btn mini" type="button" id="p-start">Vicino a me</button>` : ""}</div>` : ""}
      <details open><summary>Missioni (${f.size}/${MISSIONI.length})</summary><ul class="missioni">${MISSIONI.map((m) => {
        const ora = Math.min(m.v(st), m.n), ok = f.has(m.c);
        return `<li class="${ok ? "ok" : ""}"><div><b>${ok ? "★" : "☆"} ${esc(m.t)}</b><span class="num">+${bonus(m.c)}</span></div><small>${esc(m.d)}</small><div class="barra-mis"><i data-perc="${ok ? 100 : Math.round(ora / m.n * 100)}"></i></div></li>`;
      }).join("")}</ul></details>
      <details><summary>Come si fanno punti</summary><ul class="regole">
        <li>+10 al primo check-in in un posto (devi essere entro 150 m)</li>
        <li>+2 per ogni nuova visita in un altro giorno (fino a 5 volte per posto)</li>
        <li>+20 per il primo posto in un quartiere o località nuovi</li>
        <li>+5 per una recensione, +10 se com’è e dritta arrivano a 80 caratteri</li>
        <li>+15 / +100 per ogni missione compiuta</li>
        <li>Un livello ogni 100 punti. I punti non hanno valore e non danno premi.</li></ul></details>
      <details id="d-classifica"><summary>Classifica</summary><div id="classifica"><small>Carico…</small></div>
        <label class="spunta"><input type="checkbox" id="p-classifica" ${io.profilo.in_classifica ? "checked" : ""}><span>Mostrami in classifica (nickname e punti sono visibili a tutti)</span></label></details>
      <details><summary>I miei posti (${st.posti})</summary><ul class="regole">${[...new Set(p.visite.map((v) => v.luogo))].map((id) => { const x = perId.get(id); return x ? `<li><button class="link" type="button" data-vai="${esc(id)}">${esc(x.n)}</button>${io.recensiti.has(id) ? " ✓" : ""}</li>` : ""; }).join("") || "<li>Nessun check-in, per ora.</li>"}</ul></details>
      <details><summary>I miei dati</summary><div class="form">
        <small>Puoi scaricare tutto ciò che sappiamo di te (email, profilo, visite, recensioni, segnalazioni).</small>
        <div class="conto-acts"><button class="btn alt" type="button" id="p-esporta">Esporta i miei dati</button></div>
        <textarea class="esporta" id="p-json" readonly hidden></textarea><a id="p-scarica" hidden download="scusa-non-stasera-dati.json">Scarica il file</a>
        <div class="pericolo"><b>Elimina l’account</b><small>Cancella subito email, profilo, punti, visite e recensioni. Non si può annullare. Scrivi ELIMINA per confermare.</small>
          <input type="text" id="p-conferma" autocomplete="off" aria-label="Scrivi ELIMINA per confermare">
          <div class="conto-acts"><button class="btn rosso" type="button" id="p-elimina" disabled>Elimina definitivamente</button></div></div>
      </div></details>
      <div class="conto-acts"><button class="btn alt" type="button" id="p-esci">Esci</button></div>`;
    $("#barra").style.width = `${nelLivello}%`;
    corpo.querySelectorAll(".barra-mis i").forEach((i) => { i.style.width = `${i.dataset.perc}%`; });
    const ps = $("#p-start");
    if (ps) ps.addEventListener("click", () => { $("#player").close(); SNS.start(); });
    $("#p-esci").addEventListener("click", async () => { await sb.auth.signOut(); $("#player").close(); toast("Sei uscito."); });
    $("#d-classifica").addEventListener("toggle", caricaClassifica, { once: true });
    $("#p-classifica").addEventListener("change", async (e) => {
      const { error } = await sb.from("profili").update({ in_classifica: e.target.checked }).eq("id", io.utente.id);
      if (error) { toast(errore(error)); e.target.checked = !e.target.checked; return; }
      io.profilo.in_classifica = e.target.checked; caricaClassifica();
      toast(e.target.checked ? "Sei in classifica." : "Non compari più in classifica.");
    });
    corpo.querySelectorAll("[data-vai]").forEach((b) => b.addEventListener("click", () => { $("#player").close(); SNS.mostraScheda(b.dataset.vai); }));
    $("#p-esporta").addEventListener("click", async () => {
      const { data, error } = await sb.rpc("esporta_dati");
      if (error) return toast(errore(error));
      const testo = JSON.stringify(data, null, 2);
      const ta = $("#p-json"); ta.value = testo; ta.hidden = false;
      const a = $("#p-scarica"); a.href = URL.createObjectURL(new Blob([testo], { type: "application/json" })); a.hidden = false;
    });
    const conferma = $("#p-conferma"), elimina = $("#p-elimina");
    conferma.addEventListener("input", () => { elimina.disabled = conferma.value.trim() !== "ELIMINA"; });
    elimina.addEventListener("click", async () => {
      elimina.disabled = true;
      const { error } = await sb.rpc("elimina_account");
      if (error) { toast(errore(error)); elimina.disabled = false; return; }
      memoria.set("sns-invito-recensione", null);
      await sb.auth.signOut(); $("#player").close(); toast("Account eliminato. Ciao!");
    });
  }
  async function caricaClassifica() {
    const box = $("#classifica");
    if (!box) return;
    const { data, error } = await sb.rpc("classifica");
    if (error) { box.innerHTML = `<small class="errore">${esc(errore(error))}</small>`; return; }
    box.innerHTML = data.length ? `<ol class="classifica">${data.map((r) => `<li><b>${esc(r.nickname)}</b><span class="num">${r.punti} pt · ${esc(titolo(r.livello))}</span></li>`).join("")}</ol>`
      : `<small>Ancora nessuno in classifica.</small>`;
  }

  // ---------- Eventi ----------
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-accedi],[data-checkin],[data-scrivi],[data-leggi],[data-segnala]");
    if (!t) return;
    if (t.matches("[data-accedi]")) return apriPlayer();
    if (t.matches("[data-checkin]")) return checkin(t.dataset.checkin, t);
    if (t.matches("[data-scrivi]")) return apriRecensione(t.dataset.scrivi);
    if (t.matches("[data-leggi]")) return leggi(t.dataset.leggi, t);
    if (t.matches("[data-segnala]")) return apriSegnala(Number(t.dataset.segnala));
  });
  $("#apri-player").addEventListener("click", apriPlayer);
  $("#m-player").addEventListener("click", apriPlayer);

  sb.auth.onAuthStateChange((evento, session) => {
    // Non bloccare il client dentro il callback: rimanda il caricamento.
    setTimeout(() => { caricaUtente(session).then(() => { if ($("#player").open) disegnaPlayer(); }); }, 0);
  });
  caricaValutazioni();
})();
