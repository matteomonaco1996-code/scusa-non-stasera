// Scusa, non stasera — account, punti, check-in e recensioni (Supabase).
// Si attiva solo se config.js contiene URL e chiave pubblica del progetto Supabase.
(() => {
  "use strict";
  const C = window.SNS_CONFIG || {};
  const SNS = window.SNS;
  if (!SNS) return;
  if (!C.supabaseUrl || !C.supabaseKey || !window.supabase) {
    document.body.classList.add("senza-conto");
    return;
  }
  const { esc, svg, toast, perId, DATA, luogo } = SNS;
  const $ = (s) => document.querySelector(s);
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce", storageKey: "sns-sessione" },
  });

  const io = { utente: null, profilo: null, punteggio: null, recensiti: new Set(), oggi: new Set(), valutazioni: new Map() };
  const oggiISO = () => new Date().toISOString().slice(0, 10);
  const pad = (n) => String(n).padStart(6, "0");
  const fmtData = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" });
  const errore = (e) => (e && (e.message || e.error_description)) || "Qualcosa è andato storto: riprova.";

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
    io.profilo = null; io.punteggio = null; io.recensiti = new Set(); io.oggi = new Set(); SNS.visitati = new Set();
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
    io.punteggio = data;
    SNS.visitati = new Set(data.visite.map((v) => v.luogo));
    io.oggi = new Set(data.visite.filter((v) => v.giorno === oggiISO()).map((v) => v.luogo));
    io.recensiti = new Set(data.recensioni);
  }
  function aggiornaHud() {
    $("#nick").textContent = io.profilo ? io.profilo.nickname.toUpperCase() : "OSPITE";
    $("#punti").textContent = pad(io.punteggio ? io.punteggio.punti : 0);
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

  // ---------- Check-in ----------
  function posizioneFresca() {
    return new Promise((ok, ko) => {
      if (!navigator.geolocation) return ko(new Error("Questo browser non condivide la posizione."));
      navigator.geolocation.getCurrentPosition(ok, () => ko(new Error("Serve la posizione per il check-in: consentila nelle impostazioni del browser.")),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    });
  }
  async function checkin(id, bottone) {
    bottone.disabled = true;
    try {
      const p = await posizioneFresca();
      const prima = io.punteggio ? io.punteggio.punti : 0;
      const { data, error } = await sb.rpc("fai_checkin", { p_luogo: id, p_lat: p.coords.latitude, p_lon: p.coords.longitude });
      if (error) throw error;
      if (!data.ok) { toast(`Sei a ${data.metri} m da qui: per il check-in serve essere entro 150 m.`); bottone.disabled = false; return; }
      await caricaPunteggio();
      const presi = io.punteggio.punti - prima;
      toast(presi > 0 ? `Check-in! +${presi} punti` : "Check-in già fatto oggi qui.");
      aggiornaHud(); SNS.ridisegna();
    } catch (e) { toast(errore(e)); bottone.disabled = false; }
  }

  // ---------- Recensioni pubbliche ----------
  async function leggi(id, bottone) {
    const box = document.getElementById("rec-" + id);
    if (!box) return;
    if (!box.hidden) { box.hidden = true; bottone.setAttribute("aria-expanded", "false"); return; }
    box.hidden = false; bottone.setAttribute("aria-expanded", "true");
    box.innerHTML = `<small>Carico…</small>`;
    const { data, error } = await sb.from("recensioni_pubbliche").select("id,voto,testo,creata,nickname").eq("luogo", id).order("creata", { ascending: false }).limit(30);
    if (error) { box.innerHTML = `<small class="errore">${esc(errore(error))}</small>`; return; }
    box.innerHTML = `<small class="nota-verifica">Solo recensioni di chi ha fatto check-in qui.</small>` + data.map((r) => `<article class="rec">
      <header><b>${esc(r.nickname)}</b><span>${"★".repeat(r.voto)}${"☆".repeat(5 - r.voto)} · ${fmtData.format(new Date(r.creata))}</span></header>
      ${r.testo ? `<p>${esc(r.testo)}</p>` : ""}
      ${io.profilo ? `<button class="link" type="button" data-segnala="${r.id}">Segnala</button>` : `<a href="termini.html#segnalazioni">Segnala</a>`}
    </article>`).join("");
  }

  function apriRecensione(id) {
    const x = perId.get(id);
    const corpo = $("#rec-corpo");
    corpo.innerHTML = `<p><b>${esc(x.n)}</b> · ${esc(luogo(x))}</p>
      <form class="form" id="f-rec">
        <fieldset class="riga"><legend>Voto</legend>
          <select id="r-voto" required><option value="">Scegli…</option><option value="5">★★★★★ Da tornarci</option><option value="4">★★★★ Molto buono</option><option value="3">★★★ Nella media</option><option value="2">★★ Così così</option><option value="1">★ Da evitare</option></select>
        </fieldset>
        <label class="riga">La tua esperienza (facoltativa)<textarea id="r-testo" maxlength="600" rows="5" placeholder="Cosa hai preso, com'era, quanto hai speso…"></textarea><small id="r-conta">0/600 · da 80 caratteri in su vale +10 punti</small></label>
        <small>La recensione è pubblica con il tuo nickname. Racconta solo la tua esperienza: niente insulti, niente dati personali di altri, niente recensioni del tuo locale o di concorrenti. <a href="termini.html#recensioni">Regole</a></small>
        <p class="errore" id="r-err" hidden></p>
        <div class="conto-acts"><button class="btn" type="submit">Pubblica</button>${io.recensiti.has(id) ? `<button class="btn rosso" type="button" id="r-elimina">Elimina la mia recensione</button>` : ""}</div>
      </form>`;
    const testo = $("#r-testo"), conta = $("#r-conta");
    testo.addEventListener("input", () => { conta.textContent = `${testo.value.length}/600 · da 80 caratteri in su vale +10 punti`; });
    $("#f-rec").addEventListener("submit", async (e) => {
      e.preventDefault();
      const prima = io.punteggio ? io.punteggio.punti : 0;
      const { error } = await sb.rpc("scrivi_recensione", { p_luogo: id, p_voto: Number($("#r-voto").value), p_testo: testo.value });
      if (error) { const p = $("#r-err"); p.textContent = errore(error); p.hidden = false; return; }
      await caricaPunteggio(); await caricaValutazioni();
      const presi = io.punteggio.punti - prima;
      $("#dlg-recensione").close();
      toast(presi > 0 ? `Recensione pubblicata: +${presi} punti` : "Recensione aggiornata.");
      aggiornaHud(); SNS.ridisegna();
    });
    const el = $("#r-elimina");
    if (el) el.addEventListener("click", async () => {
      const { error } = await sb.from("recensioni").delete().eq("luogo", id);
      if (error) return toast(errore(error));
      await caricaPunteggio(); await caricaValutazioni();
      $("#dlg-recensione").close(); toast("Recensione eliminata."); aggiornaHud(); SNS.ridisegna();
    });
    $("#dlg-recensione").showModal();
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
        <label class="spunta"><input type="checkbox" id="g-termini" required><span>Accetto i <a href="termini.html" target="_blank">termini d’uso</a> e ho letto l’<a href="privacy.html" target="_blank">informativa privacy</a>.</span></label>
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
      disegnaPlayer(); toast("Benvenuto, player 1!");
    });
  }

  function badge() {
    const vis = io.punteggio ? io.punteggio.visite : [];
    const posti = [...new Set(vis.map((v) => v.luogo))].map((id) => perId.get(id)).filter(Boolean);
    const perQ = {};
    posti.forEach((x) => { const k = x.q || x.c; perQ[k] = (perQ[k] || 0) + 1; });
    const migliore = Object.entries(perQ).sort((a, b) => b[1] - a[1])[0];
    const giorniPerPosto = vis.reduce((m, v) => (m[v.luogo] = (m[v.luogo] || 0) + 1, m), {});
    return [
      ["Primo passo", "il primo check-in", posti.length >= 1],
      ["Habitué", "3 visite nello stesso posto", Object.values(giorniPerPosto).some((n) => n >= 3)],
      ["Esploratore", "5 quartieri o località diversi", Object.keys(perQ).length >= 5],
      [migliore && migliore[1] >= 5 ? `Re di ${migliore[0]}` : "Re del quartiere", "5 posti nello stesso quartiere", !!(migliore && migliore[1] >= 5)],
      ["Critico", "5 recensioni", io.recensiti.size >= 5],
      ["Giramondo", "posti in 3 mondi diversi", new Set(posti.map((x) => x.m)).size >= 3],
    ];
  }

  async function disegnaProfilo(corpo) {
    const p = io.punteggio || { punti: 0, livello: 1, visite: [] };
    const nelLivello = p.punti % 100;
    const posti = new Set(p.visite.map((v) => v.luogo)).size;
    corpo.innerHTML = `
      <div class="punteggio"><div><b class="num">${p.punti}</b><span>punti</span></div><div><b class="num">${p.livello}</b><span>livello</span></div><div><b class="num">${posti}</b><span>posti visitati</span></div></div>
      <div><small>Livello ${p.livello + 1} tra ${100 - nelLivello} punti</small><div class="barra-liv"><i id="barra"></i></div></div>
      <div><h3 class="sr">Badge</h3><ul class="badge-list">${badge().map(([n, d, ok]) => `<li class="${ok ? "" : "off"}" title="${esc(d)}">${ok ? "★" : "☆"} ${esc(n)}</li>`).join("")}</ul></div>
      <details><summary>Come si fanno punti</summary><ul class="regole">
        <li>+10 al primo check-in in un posto (devi essere entro 150 m)</li>
        <li>+2 per ogni nuova visita in un altro giorno (fino a 5 volte per posto)</li>
        <li>+20 per il primo posto in un quartiere o località nuovi</li>
        <li>+5 per una recensione, +10 se racconti almeno 80 caratteri</li>
        <li>Un livello ogni 100 punti. I punti non hanno valore e non danno premi.</li></ul></details>
      <details id="d-classifica"><summary>Classifica</summary><div id="classifica"><small>Carico…</small></div>
        <label class="spunta"><input type="checkbox" id="p-classifica" ${io.profilo.in_classifica ? "checked" : ""}><span>Mostrami in classifica (nickname e punti sono visibili a tutti)</span></label></details>
      <details><summary>I miei posti (${posti})</summary><ul class="regole">${[...new Set(p.visite.map((v) => v.luogo))].map((id) => { const x = perId.get(id); return x ? `<li><button class="link" type="button" data-vai="${esc(id)}">${esc(x.n)}</button></li>` : ""; }).join("") || "<li>Nessun check-in, per ora.</li>"}</ul></details>
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
      await sb.auth.signOut(); $("#player").close(); toast("Account eliminato. Ciao!");
    });
  }
  async function caricaClassifica() {
    const box = $("#classifica");
    if (!box) return;
    const { data, error } = await sb.rpc("classifica");
    if (error) { box.innerHTML = `<small class="errore">${esc(errore(error))}</small>`; return; }
    box.innerHTML = data.length ? `<ol class="classifica">${data.map((r) => `<li><b>${esc(r.nickname)}</b><span class="num">${r.punti} pt · liv. ${r.livello}</span></li>`).join("")}</ol>`
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
    setTimeout(() => {
      caricaUtente(session).then(() => { if ($("#player").open) disegnaPlayer(); });
    }, 0);
  });
  caricaValutazioni();
})();
