// Comitive: tavoli di amici, senza account (database: supabase/comitive.sql).
// Questo file si carica solo se in config.js ci sono il database e  comitive: true.
// Sul telefono resta una sola cosa, "sns-comitiva": il segreto del tuo posto a tavola, che serve per votare e aggiungere posti.
(function () {
  "use strict";
  const SNS = window.SNS;
  if (!SNS || !SNS.rpc) return;
  const { DATA, perId, PW, esc, svg, luogo, memoria, rpc, conta, toast } = SNS;
  const $ = (s) => document.querySelector(s);
  const MEM = "sns-comitiva", POSTI = 8;
  const d = $("#dlg-comitiva"), corpo = $("#com-corpo"), titolo = $("#com-t"), voce = $("#m-comitiva");
  let segreto = memoria.get(MEM) || "";   // il segreto del mio posto (vuoto = non sono seduto da nessuna parte)
  let tavola = null;                        // la comitiva come la manda il database
  let invito = null;                        // quando si arriva da un link: { chiave, nome, seduti, liberi }
  let timer = null, pescato = null;
  const NOMI = ["I Supplì Volanti", "Carbonara Club", "Quelli del Gettone", "Cacio e Pepe United", "Gli Affamati", "La Banda della Gricia",
    "Maritozzi a Colazione", "Tavolo per Otto", "Gli Scarpetta", "I Fuori Menù", "Abbacchio e Dintorni", "Amatriciana Social Club"];
  const REGOLE = `I nomi li vede chi ha il link della comitiva e chi gestisce il sito: niente insulti, cognomi, numeri o link. Una comitiva che non rispetta le <a href="termini.html" target="_blank" rel="noopener">regole</a> può essere cancellata.`;
  // 16 byte a caso → 22 caratteri: la chiave del link e il segreto del posto nascono qui, sul telefono
  const casuale = () => { const a = new Uint8Array(16); crypto.getRandomValues(a); return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const faccia = (k, cls) => `<img class="faccia${cls ? " " + cls : ""}" src="img/facce/${+k || 0}.svg" width="54" height="66" alt="">`;
  const giorno = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" });
  const quando = (g) => { try { return giorno.format(new Date(g + "T12:00:00")); } catch (e) { return g; } };
  const link = () => { const u = new URL(location.href); u.search = ""; u.hash = ""; u.searchParams.set("comitiva", tavola.chiave); u.searchParams.set("da", "amici"); return u.href; };
  const avviso = (t) => { const p = $("#com-err"); if (p) { p.textContent = t || ""; p.hidden = !t; } };
  const mioVoto = () => { const l = tavola.luoghi.find((x) => x.voti.includes(tavola.io)); return l ? l.id : ""; };
  const sonoCapo = () => tavola && tavola.io === tavola.capo;
  const posto = (n) => tavola.posti.find((p) => p.n === n);

  // ---------- Stato ----------
  function seduto(nuova) {            // dopo ogni risposta del database
    const prima = !!tavola;
    tavola = nuova;
    SNS.pulsanteComitiva = pulsante;
    aggiornaVoce();
    if (!prima) SNS.ridisegna();      // sulle schede compare "+ Comitiva"
  }
  function alzato(messaggio) {        // non sono più a questa tavola (uscito, tolto, comitiva cancellata)
    segreto = ""; memoria.set(MEM, null);
    const prima = !!tavola; tavola = null; SNS.pulsanteComitiva = null;
    document.querySelectorAll("[data-comitiva]").forEach((b) => b.remove());   // anche quelli rimasti in una finestra chiusa
    aggiornaVoce();
    if (prima) SNS.ridisegna();
    if (messaggio) toast(messaggio);
  }
  function aggiornaVoce() {
    voce.hidden = false;
    voce.querySelector(".voce").textContent = tavola ? "COMITIVA · " + tavola.nome.toUpperCase() : "COMITIVA";
    voce.querySelector("small").textContent = tavola ? `${tavola.posti.length} a tavola: la lista, i voti, il gettone` : "Un tavolo di amici: scegliete insieme dove andare. Senza account";
  }
  // Chiama il database a nome mio; se non sono più seduto, lo dice e torna alla schermata iniziale
  async function chiedi(nome, args) {
    try { const r = await rpc(nome, { p_segreto: segreto, ...args }); if (r) seduto(r); return r; }
    catch (e) {
      if (e.codice === "P0002") { alzato(); if (d.open) { schermoCrea(); avviso("Non sei più seduto a quella tavola: forse è stata chiusa, o il tuo posto è stato liberato."); } return null; }
      avviso(e.message); return null;
    }
  }
  // Rilegge la tavola. Quando parte da sola (ogni mezzo minuto) non ridisegna sotto le dita di chi sta facendo qualcosa.
  async function ricarica(daSola) {
    if (!segreto) return;
    const r = await chiedi("comitiva_vedi", {});
    if (!r || !d.open || !["tavola", "attesa"].includes(corpo.dataset.schermo)) return;
    if (daSola && corpo.querySelector("[data-sicuro], input:focus, details[open]")) return;
    schermoTavola();
  }

  // ---------- Il pulsante sulle schede e nel gettone ----------
  function pulsante(x, classe) {
    if (!tavola) return "";
    const dentro = tavola.luoghi.some((l) => l.id === x.id);
    return `<button type="button" class="${classe || "proponi"}" data-comitiva="${x.i}" ${dentro ? "disabled" : ""}>${dentro ? "In comitiva ✓" : "+ Comitiva"}</button>`;
  }
  async function aggiungi(x, b) {
    if (!tavola || !x) return;
    if (b) b.disabled = true;
    const r = await chiedi("comitiva_aggiungi", { p_luogo: x.id });
    if (!r) { if (b) b.disabled = false; return toast("Non sono riuscito ad aggiungerlo alla comitiva."); }
    conta("comitiva_aggiungi");
    document.querySelectorAll(`[data-comitiva="${x.i}"]`).forEach((p) => { p.disabled = true; p.textContent = "In comitiva ✓"; });
    if (!d.open && !document.querySelector("dialog[open]")) toast(`${x.n} è tra i posti da provare di «${tavola.nome}».`);
  }
  SNS.comitivaAggiungi = aggiungi;

  // ---------- Schermate ----------
  const facce = (scelta) => `<div class="facce" role="radiogroup" aria-label="La tua faccia">${[0, 1, 2, 3, 4, 5].map((k) =>
    `<label><input type="radio" name="com-faccia" value="${k}"${k === scelta ? " checked" : ""}><span class="sr">Faccia ${k + 1}</span>${faccia(k)}</label>`).join("")}</div>`;
  const facciaScelta = () => +((corpo.querySelector('[name="com-faccia"]:checked') || {}).value || 0);

  function schermoCrea() {
    corpo.dataset.schermo = "crea"; titolo.textContent = "COMITIVA";
    corpo.innerHTML = `<p class="get-cosa">Una comitiva è un <b>tavolo di amici</b>, fino a otto: mettete insieme i posti da provare, votate dove andare, segnate quelli fatti. Si entra con un link, <b>senza account</b>.</p>
      <form class="form" id="com-form" data-cosa="crea">
        <label class="riga">Nome della comitiva<input type="text" id="com-nome" maxlength="30" required autocomplete="off" placeholder="Per esempio: I Supplì Volanti"></label>
        <button class="link" type="button" data-com="pesca-nome">Non ti viene? Pescane uno</button>
        <label class="riga">Il tuo nome a tavola<input type="text" id="com-mio" maxlength="20" required autocomplete="off" placeholder="Come ti chiamano gli amici"></label>
        ${facce(0)}
        <p class="errore" id="com-err" role="alert" hidden></p>
        <button class="btn" type="submit">▶ Crea la comitiva</button>
        <small>${REGOLE}</small>
      </form>`;
  }
  function schermoEntra() {
    corpo.dataset.schermo = "entra"; titolo.textContent = "TI HANNO INVITATO";
    const testa = `<span class="eti">COMITIVA · ${invito.seduti} A TAVOLA</span><div class="rullo">${esc(invito.nome)}</div>`;
    if (segreto && !invito.mia) {
      corpo.innerHTML = `${testa}<p>Sei già seduto ${tavola ? `alla tavola di <b>${esc(tavola.nome)}</b>` : "a un’altra tavola"}: su un telefono si sta in una comitiva alla volta.</p>
        <p class="errore" id="com-err" role="alert" hidden></p>
        <div class="get-acts"><button class="btn" type="button" data-com="cambia">Lascio quella ed entro qui</button><button class="btn alt" type="button" data-com="tavola">Resto dove sono</button></div>`;
      return;
    }
    if (!invito.liberi) { corpo.innerHTML = `${testa}<p>La tavola è al completo: otto posti, tutti occupati. Chiedi a chi ti ha invitato se si libera un posto.</p>`; return; }
    corpo.innerHTML = `${testa}
      <form class="form" id="com-form" data-cosa="entra">
        <label class="riga">Il tuo nome a tavola<input type="text" id="com-mio" maxlength="20" required autocomplete="off" placeholder="Come ti chiamano gli amici"></label>
        ${facce(1)}
        <p class="errore" id="com-err" role="alert" hidden></p>
        <button class="btn" type="submit">▶ Mi siedo</button>
        <small>Niente account e niente email. Gli altri a tavola vedranno il nome che scrivi, i posti che aggiungi e i tuoi voti. Puoi alzarti quando vuoi. ${REGOLE}</small>
      </form>`;
  }
  function rigaPosto(l) {
    const x = perId.get(l.id);
    if (!x) return "";
    const mio = l.voti.includes(tavola.io), tolgo = l.da === tavola.io || sonoCapo();
    return `<li${l.voti.length && !l.fatto ? ' class="votato"' : ""}>
      <div><button type="button" class="nome" data-com="scheda" data-id="${esc(l.id)}">${esc(x.n)}</button><div class="dove">${esc(PW[x.t][0])} · ${esc(luogo(x))}${l.fatto ? " · " + esc(quando(l.fatto)) : ""}</div></div>
      <div class="chi">${l.fatto ? "" : l.voti.map((n) => { const p = posto(n); return p ? `<span class="mini" title="${esc(p.nome)}">${faccia(p.faccia)}</span>` : ""; }).join("")}</div>
      <div class="atti">${l.fatto
        ? `<button type="button" class="tasto" data-com="rifare" data-id="${esc(l.id)}">Da rifare</button>`
        : `<button type="button" class="tasto${mio ? " mio" : ""}" data-com="voto" data-id="${esc(l.id)}" aria-pressed="${mio}">${mio ? "Votato" : "Voto"}${l.voti.length ? " · " + l.voti.length : ""}</button>
           <button type="button" class="tasto" data-com="fatto" data-id="${esc(l.id)}">Fatto!</button>`}
        ${tolgo ? `<button type="button" class="tasto" data-com="togli" data-id="${esc(l.id)}" aria-label="Togli ${esc(x.n)} dalla lista">×</button>` : ""}</div>
    </li>`;
  }
  function schermoTavola() {
    corpo.dataset.schermo = "tavola"; titolo.textContent = "LA COMITIVA";
    const t = tavola, liberi = POSTI - t.posti.length;
    const daFare = t.luoghi.filter((l) => !l.fatto && perId.has(l.id)).sort((a, b) => b.voti.length - a.voti.length || (a.aggiunto < b.aggiunto ? -1 : 1));
    const fatti = t.luoghi.filter((l) => l.fatto && perId.has(l.id)).sort((a, b) => (a.fatto < b.fatto ? 1 : -1));
    const primo = daFare[0] && daFare[0].voti.length ? perId.get(daFare[0].id) : null;
    corpo.innerHTML = `<span class="eti">${t.posti.length} A TAVOLA · ${liberi === 1 ? "1 POSTO LIBERO" : liberi + " POSTI LIBERI"}</span>
      <div class="rullo">${esc(t.nome)}</div>
      <div class="tavola">${t.posti.map((p) => `<div class="posto${p.n === t.io ? " io" : ""}">${faccia(p.faccia)}<span>${esc(p.nome)}</span>${p.n === t.io ? "<small>sei tu</small>" : ""}</div>`).join("")}
        ${liberi ? `<button type="button" class="posto libero" data-com="invita">+ Invita</button>` : ""}</div>
      <h3 class="tit">Da provare<small>${daFare.length ? "votate dove andare: un voto a testa" : ""}</small></h3>
      ${daFare.length ? `<ul class="righe">${daFare.map(rigaPosto).join("")}</ul>` : `<p class="get-info">Ancora niente. Aggiungi un posto dalla lista con «+ Comitiva», oppure pescalo qui sotto.</p>`}
      ${primo ? `<button class="link" type="button" data-com="proponi" data-id="${esc(primo.id)}">Manda nel gruppo il più votato: ${esc(primo.n)}</button>` : ""}
      <p class="errore" id="com-err" role="alert" hidden></p>
      <div class="get-acts"><button class="btn" type="button" data-com="gettone">Gettone di comitiva</button><button class="btn alt" type="button" data-com="sfoglia">Sfoglia la lista</button></div>
      ${fatti.length ? `<h3 class="tit">Fatti<small>${fatti.length === 1 ? "1 posto" : fatti.length + " posti"}</small></h3><ul class="righe">${fatti.map(rigaPosto).join("")}</ul>` : ""}
      <details class="gestisci"><summary>Gestisci</summary>
        <div class="get-link"><button class="link" type="button" data-com="invita">Invita qualcuno</button><button class="link" type="button" data-com="esci">Mi alzo da tavola</button></div>
        ${sonoCapo() ? `<form class="form" id="com-form" data-cosa="rinomina"><label class="riga">Cambia nome alla comitiva<input type="text" id="com-nome" maxlength="30" required autocomplete="off" value="${esc(t.nome)}"></label><button class="btn alt" type="submit">Rinomina</button></form>
          <div class="get-link"><button class="link" type="button" data-com="nuovo-link">Cambia il link di invito</button></div>
          ${t.posti.filter((p) => p.n !== t.io).map((p) => `<div class="get-link"><span>${esc(p.nome)}</span><button class="link" type="button" data-com="libera" data-n="${p.n}">Libera il suo posto</button></div>`).join("")}
          <small>Hai creato tu la comitiva: puoi rinominarla, cambiare il link (quello vecchio smette di valere) e liberare un posto.</small>` : ""}
        <small>${REGOLE} Se un nome ti offende, <a href="termini.html#segnalazioni" target="_blank" rel="noopener">segnalalo</a>.</small>
      </details>`;
  }
  function schermoPescato() {
    corpo.dataset.schermo = "pescato"; titolo.textContent = "GETTONE DI COMITIVA";
    const z = SNS.zona(), dentro = new Set(tavola.luoghi.map((l) => l.id));
    const pool = DATA.filter((x) => x.m === z.mondo && (!z.livello || x.l === z.livello) && !dentro.has(x.id));
    if (!pool.length) {
      corpo.innerHTML = `<p class="get-dom">Niente di nuovo da pescare.</p><p>${z.livello ? "In questa zona" : "Qui"} avete già messo in lista tutti i posti. Scegli un’altra zona e riprova.</p>
        <p class="get-info"><button class="link" type="button" data-com="tavola">◀ Torna alla tavola</button></p>`;
      return;
    }
    const peso = (x) => (x.nt ? 3 : x.dr ? 2 : 1);
    let r = Math.random() * pool.reduce((s, x) => s + peso(x), 0);
    const x = pescato = pool.find((y) => (r -= peso(y)) <= 0) || pool[pool.length - 1];
    corpo.innerHTML = `<span class="eti">UNO TRA ${pool.length} POSTI NUOVI PER VOI${z.livello ? " · " + esc(z.livello.toUpperCase()) : ""}</span>
      <div class="rullo">${esc(x.n)}</div>
      <div class="meta"><span class="tipo">${svg(PW[x.t][1])}${esc(PW[x.t][0])}</span><span class="quart">${esc(luogo(x))}</span></div>
      ${SNS.nota(x)}
      <p class="errore" id="com-err" role="alert" hidden></p>
      <div class="get-acts"><button class="btn" type="button" data-com="tieni">Mettilo tra i posti da provare</button><button class="btn alt" type="button" data-com="gettone">Ripesca</button></div>
      <p class="get-info">Il gettone di comitiva pesca solo posti che non avete ancora in lista${z.livello ? ", nella zona che hai scelto" : ""}. <button class="link" type="button" data-com="tavola">◀ Torna alla tavola</button></p>`;
  }

  // ---------- Azioni ----------
  // Le azioni che non si annullano chiedono due tocchi: il primo cambia la scritta, il secondo le fa
  function sicuro(b, testo) {
    if (b.dataset.sicuro) return true;
    b.dataset.sicuro = "1"; const prima = b.textContent; b.textContent = testo;
    setTimeout(() => { if (b.isConnected) { delete b.dataset.sicuro; b.textContent = prima; } }, 4000);
    return false;
  }
  async function azione(cosa, b) {
    avviso("");
    if (cosa === "pesca-nome") { const c = $("#com-nome"); let n; do { n = NOMI[Math.floor(Math.random() * NOMI.length)]; } while (NOMI.length > 1 && n === c.value); c.value = n; return; }
    if (cosa === "tavola") { if (tavola) return schermoTavola(); return schermoCrea(); }
    if (cosa === "cambia") {
      if (!sicuro(b, "Sicuro? Tocca ancora")) return;
      try { await rpc("comitiva_alzati", { p_segreto: segreto }); } catch (e) { if (e.codice !== "P0002") return avviso(e.message); }
      alzato(); invito.mia = false; return schermoEntra();
    }
    if (!tavola) return;
    const id = b.dataset.id;
    if (cosa === "invita") return SNS.condividi({ titolo: "INVITA", eti: "IL LINK DELLA COMITIVA", nome: tavola.nome, evento: "comitiva_invita",
      testo: `Entra nella comitiva «${tavola.nome}» su Ristomat: scegliamo insieme dove andare.\n${link()}`,
      nota: "Chi ha questo link vede il nome della comitiva e può sedersi finché c’è posto: mandalo solo a chi vuoi a tavola." });
    if (cosa === "voto") { const r = await chiedi("comitiva_vota", { p_luogo: mioVoto() === id ? "" : id }); if (r) { conta("comitiva_voto"); schermoTavola(); } return; }
    if (cosa === "fatto" || cosa === "rifare") { const r = await chiedi("comitiva_fatto", { p_luogo: id, p_fatto: cosa === "fatto" }); if (r) { if (cosa === "fatto") conta("comitiva_fatto"); schermoTavola(); } return; }
    if (cosa === "togli") { if (!sicuro(b, "Tolgo?")) return; const r = await chiedi("comitiva_togli", { p_luogo: id }); if (r) { schermoTavola(); SNS.ridisegna(); } return; }
    if (cosa === "scheda") { d.close(); return SNS.mostraScheda(id); }
    if (cosa === "proponi") return SNS.proponi(perId.get(id));
    if (cosa === "gettone") return schermoPescato();
    if (cosa === "tieni") { const r = await chiedi("comitiva_aggiungi", { p_luogo: pescato.id }); if (r) { conta("comitiva_aggiungi"); schermoTavola(); SNS.ridisegna(); } return; }
    if (cosa === "sfoglia") { d.close(); document.querySelector("#sez-mondi").scrollIntoView(); return toast("Sui posti che vuoi proporre tocca «+ Comitiva»."); }
    if (cosa === "esci") {
      if (!sicuro(b, tavola.posti.length === 1 ? "Sei l’ultimo: la comitiva si chiude. Tocca ancora" : "Sicuro? Tocca ancora")) return;
      try { await rpc("comitiva_alzati", { p_segreto: segreto }); } catch (e) { if (e.codice !== "P0002") return avviso(e.message); }
      d.close(); return alzato("Ti sei alzato da tavola.");
    }
    if (cosa === "libera") { if (!sicuro(b, "Sicuro? Tocca ancora")) return; const r = await chiedi("comitiva_capo", { p_cosa: "togli", p_valore: String(b.dataset.n) }); if (r) schermoTavola(); return; }
    if (cosa === "nuovo-link") {
      if (!sicuro(b, "Il link vecchio smetterà di valere. Tocca ancora")) return;
      const r = await chiedi("comitiva_capo", { p_cosa: "chiave", p_valore: casuale() });
      if (r) { schermoTavola(); azione("invita", b); }
    }
  }
  async function modulo(e) {
    e.preventDefault(); avviso("");
    const cosa = e.target.dataset.cosa, b = e.target.querySelector('[type="submit"]');
    b.disabled = true;
    try {
      if (cosa === "crea") {
        const nuovo = casuale();
        const r = await rpc("comitiva_crea", { p_chiave: casuale(), p_nome: $("#com-nome").value, p_mio_nome: $("#com-mio").value, p_faccia: facciaScelta(), p_segreto: nuovo });
        segreto = nuovo; memoria.set(MEM, segreto); seduto(r); conta("comitiva_crea"); schermoTavola();
      } else if (cosa === "entra") {
        const nuovo = segreto || casuale();
        const r = await rpc("comitiva_siediti", { p_chiave: invito.chiave, p_nome: $("#com-mio").value, p_faccia: facciaScelta(), p_segreto: nuovo });
        segreto = nuovo; memoria.set(MEM, segreto); seduto(r); conta("comitiva_entra"); schermoTavola();
      } else if (cosa === "rinomina") {
        const r = await chiedi("comitiva_capo", { p_cosa: "rinomina", p_valore: $("#com-nome").value });
        if (r) schermoTavola();
      }
    } catch (err) { avviso(err.message); }
    if (b.isConnected) b.disabled = false;
  }

  // ---------- Aprire ----------
  async function apri() {
    if (!d.open) d.showModal();
    if (!segreto) return schermoCrea();
    if (tavola) schermoTavola(); else { corpo.dataset.schermo = "attesa"; titolo.textContent = "LA COMITIVA"; corpo.innerHTML = `<p class="get-dom">Apparecchio…</p><p class="errore" id="com-err" role="alert" hidden></p>`; }
    await ricarica();
  }
  // Arrivo da un link di invito: ?comitiva=<chiave>
  async function arrivo(chiave) {
    let a;
    try { a = await rpc("comitiva_anteprima", { p_chiave: chiave, p_segreto: segreto || null }); }
    catch (e) { return toast(e.codice === "P0002" ? "Questo invito alla comitiva non vale più." : e.message); }
    if (a.mia) return apri();
    invito = { chiave, ...a };
    if (segreto && !tavola) { try { seduto(await rpc("comitiva_vedi", { p_segreto: segreto })); } catch (e) { if (e.codice === "P0002") alzato(); } }
    schermoEntra();
    if (!d.open) d.showModal();
  }
  SNS.arrivoComitiva = arrivo;

  corpo.addEventListener("click", (e) => { const b = e.target.closest("[data-com]"); if (b) azione(b.dataset.com, b); });
  corpo.addEventListener("submit", modulo);
  voce.addEventListener("click", apri);
  d.addEventListener("close", () => { clearInterval(timer); timer = null; });
  // Finché la finestra è aperta sulla tavola, ogni mezzo minuto si guarda se gli altri hanno votato o aggiunto qualcosa
  new MutationObserver(() => { if (d.open && !timer) timer = setInterval(() => { if (corpo.dataset.schermo === "tavola") ricarica(true); }, 30000); }).observe(d, { attributes: true, attributeFilter: ["open"] });

  aggiornaVoce();
  if (segreto) rpc("comitiva_vedi", { p_segreto: segreto }).then(seduto).catch((e) => { if (e.codice === "P0002") alzato(); });   // all'avvio: se sono seduto, sulle schede serve "+ Comitiva"
  if (SNS.comitivaInAttesa) { const k = SNS.comitivaInAttesa; SNS.comitivaInAttesa = null; arrivo(k); }
})();
