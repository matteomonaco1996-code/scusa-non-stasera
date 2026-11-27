// FILTRI: dalla barra sopra i posti si sceglie il tipo di posto (o si cerca) senza risalire la pagina.
// Nato perché da «Vicino a me» i power-up restavano cinque schermate più su.
//   node filtri.js <cartella foto> [indirizzo]
const { chromium, devices } = require('playwright');
const out = process.argv[2], BASE = process.argv[3] || 'http://localhost:8765/index.html';
const ok = [], ko = [];
const check = (n, c, x) => (c ? ok : ko).push(n + (x !== undefined ? ' → ' + JSON.stringify(x) : ''));
const TRASTEVERE = { latitude: 41.8893, longitude: 12.4707 };
(async () => {
  const b = await chromium.launch();
  const nuovo = async ({ dispositivo = devices['iPhone 13'], posizione = true } = {}) => {
    const ctx = await b.newContext({ ...dispositivo, reducedMotion: 'reduce', ...(posizione ? { geolocation: TRASTEVERE, permissions: ['geolocation'] } : {}) });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
    await ctx.route(/google\.com|paypal\./, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>esterno</title>' }));
    const eventi = [];
    await ctx.route(/^https:\/\/[a-z0-9-]+\.supabase\.co\//, (r) => { try { const c = JSON.parse(r.request().postData() || '{}'); if (c.p_eventi) eventi.push(...c.p_eventi); } catch (e) {} r.fulfill({ status: 204, body: '' }); });
    const p = await ctx.newPage(); const err = [];
    p.on('pageerror', (e) => err.push(String(e).slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text().slice(0, 200)); });
    await p.goto(BASE); await p.waitForTimeout(800);
    return { ctx, p, err, eventi };
  };
  const vedi = (p) => p.evaluate(() => {
    const r = (e) => { if (!e || e.hidden) return null; const q = e.getBoundingClientRect(); return { top: Math.round(q.top), bottom: Math.round(q.bottom), left: Math.round(q.left), right: Math.round(q.right) }; };
    const $ = (s) => document.querySelector(s), bf = $('#apri-filtri'), riga = $('#filtri-attivi');
    return { y: Math.round(scrollY), vh: innerHeight, vw: innerWidth, largo: document.documentElement.scrollWidth,
      barra: r($('.bar')), prima: r($('#cards .card')), filtri: r(bf), gettone: r($('#gettone')), vista: r($('.seg')),
      titolo: $('#titolo-ris').textContent, conteggio: $('#conteggio').textContent.trim(), schede: document.querySelectorAll('#cards .card').length,
      tipi: [...new Set([...document.querySelectorAll('#cards .card .tipo, #cards .card .voglia')].map((e) => e.textContent.trim()))],
      aperta: $('#dlg-filtri').open, altreAperte: [...document.querySelectorAll('dialog[open]')].map((d) => d.id).filter((i) => i !== 'dlg-filtri'),
      bottone: bf.textContent.trim(), acceso: bf.classList.contains('attivo'), riga: riga.hidden ? null : riga.textContent.replace(/\s+/g, ' ').trim(),
      q: $('#q').value, ok: $('#filtri-ok').textContent.trim(), vuoto: !!$('#cards .empty'), indietro: !$('#indietro').hidden };
  });
  const totale = (v) => { const m = /×\s*(\d+)/.exec(v.conteggio); return m ? +m[1] : null; };
  // la barra è in cima allo schermo e la lista comincia subito sotto (in mezzo ci possono stare la riga dei filtri e il suggerimento del gettone)
  const daCapo = (v) => v.barra && v.barra.top >= 0 && v.barra.top <= 60 && (v.vuoto || (v.prima && v.prima.top >= v.barra.bottom - 2 && v.prima.top <= v.barra.bottom + 330));
  const nellaBarra = (v) => v.filtri && v.filtri.top >= v.barra.top && v.filtri.bottom <= v.barra.bottom && v.filtri.left >= 0 && v.filtri.right <= v.vw;
  const pwPagina = (p) => p.evaluate(() => [...document.querySelectorAll('#powerups .pw')].map((e) => e.dataset.voglia + ':' + e.querySelector('.n').textContent + ':' + e.disabled).join(' '));
  const pwFinestra = (p) => p.evaluate(() => [...document.querySelectorAll('#filtri-pw .pw')].map((e) => e.dataset.voglia + ':' + e.querySelector('.n').textContent + ':' + e.disabled).join(' '));
  const numero = (p, voglia) => p.evaluate((v) => +document.querySelector(`#filtri-pw [data-voglia="${v}"] .n`).textContent, voglia);
  const apri = async (p) => { await p.click('#apri-filtri'); await p.waitForTimeout(350); };
  // Nella finestra un tocco accende o spegne un tipo e la finestra resta aperta: si chiude con «Mostra i posti»
  const tocca = async (p, v) => { await p.click(`#filtri-pw [data-voglia="${v}"]`); await p.waitForTimeout(450); };
  const scegli = async (p, v) => { await tocca(p, v); await p.click('#filtri-ok'); await p.waitForTimeout(550); };
  const accesiFinestra = (p) => p.evaluate(() => [...document.querySelectorAll('#filtri-pw [aria-pressed="true"]')].map((e) => e.dataset.voglia).sort().join(','));

  // ---------- 1. Vicino a me, sul telefono ----------
  {
    const { ctx, p, err, eventi } = await nuovo();
    await p.click('#m-start'); await p.waitForTimeout(1500);
    let v = await vedi(p);
    const tutti = totale(v);
    check('vicino a me: si arriva ai posti, e il pulsante FILTRI è nella barra, in vista', v.titolo === 'Vicino a te' && daCapo(v) && nellaBarra(v) && v.bottone === 'FILTRI' && !v.acceso && v.riga === null, { titolo: v.titolo, barra: v.barra, filtri: v.filtri, bottone: v.bottone });
    check('vicino a me: nella riga dei comandi ci stanno FILTRI, GETTONE e LISTA/MAPPA senza uscire dallo schermo', v.largo <= v.vw && v.gettone.right <= v.vista.left && v.filtri.right <= v.gettone.left && v.vista.right <= v.vw, { largo: v.largo, vw: v.vw });
    await p.screenshot({ path: out + '/filtri-1-vicino.png' });
    // scorro la lista come chi guarda i posti: FILTRI resta lì
    await p.evaluate(() => scrollBy(0, 1400)); await p.waitForTimeout(300);
    v = await vedi(p);
    check('scorrendo i posti il pulsante FILTRI resta in vista', nellaBarra(v) && v.barra.top <= 60, { barra: v.barra, filtri: v.filtri });
    await apri(p);
    v = await vedi(p);
    check('toccato FILTRI si apre la finestra con gli stessi power-up della pagina, con gli stessi numeri', v.aperta && (await pwFinestra(p)) === (await pwPagina(p)) && (await pwFinestra(p)).split(' ').length >= 10, await pwFinestra(p));
    check('il pulsante in fondo dice quanti posti si vedranno', v.ok === `MOSTRA I ${tutti} POSTI`, v.ok);
    await p.screenshot({ path: out + '/filtri-2-finestra.png' });
    const pizze = await numero(p, 'pizza');
    await tocca(p, 'pizza');
    v = await vedi(p);
    check('toccata la pizza: la finestra resta aperta, la pizza è accesa e il pulsante dice quanti posti escono', v.aperta && (await accesiFinestra(p)) === 'pizza' && v.ok === `MOSTRA I ${pizze} POSTI` && await p.evaluate(() => document.activeElement.dataset.voglia === 'pizza'), { aperta: v.aperta, ok: v.ok, accesi: await accesiFinestra(p) });
    await p.click('#filtri-ok'); await p.waitForTimeout(600);
    v = await vedi(p);
    check('«Mostra i posti»: la finestra si chiude e restano solo le pizzerie, sempre vicino a te', !v.aperta && v.titolo === 'Vicino a te' && totale(v) === pizze && pizze > 0 && pizze < tutti && v.tipi.length === 1 && /Pizza/.test(v.tipi[0]), { conteggio: v.conteggio, pizze, tipi: v.tipi });
    check('…la lista riparte dall’inizio', daCapo(v), { y: v.y, barra: v.barra, prima: v.prima });
    check('…il pulsante dice che c’è un filtro e in cima ai posti c’è scritto quale', v.bottone === 'FILTRI · 1' && v.acceso && /Vedi solo Pizza/.test(v.riga || '') && /Togli/.test(v.riga || ''), { bottone: v.bottone, riga: v.riga });
    check('…anche nella pagina il power-up acceso è la pizza', await p.evaluate(() => document.querySelector('#powerups [aria-pressed="true"]').dataset.voglia === 'pizza'));
    await p.screenshot({ path: out + '/filtri-3-pizza.png' });
    check('contatori: «filtri» all’apertura e «powerup» alla scelta', eventi.filter((e) => e === 'filtri').length === 1 && eventi.filter((e) => e === 'powerup').length === 1, eventi);
    // INDIETRO toglie il filtro, senza riaprire la finestra
    await p.click('#indietro'); await p.waitForTimeout(900);
    v = await vedi(p);
    check('INDIETRO: torna la lista intera di prima, la finestra non si riapre', !v.aperta && v.titolo === 'Vicino a te' && totale(v) === tutti && !v.acceso && v.riga === null && v.bottone === 'FILTRI', { conteggio: v.conteggio, bottone: v.bottone, aperta: v.aperta });
    // «Togli» in cima alla lista
    await apri(p); await scegli(p, 'pizza');
    await p.click('#filtri-attivi [data-togli-filtri]'); await p.waitForTimeout(500);
    v = await vedi(p);
    check('«Togli» in cima ai posti: torna tutto, dall’inizio', totale(v) === tutti && !v.acceso && v.riga === null && daCapo(v), { conteggio: v.conteggio, y: v.y });
    // riaprire e toccare il filtro già acceso lo spegne
    await apri(p); await scegli(p, 'pizza');
    await apri(p);
    check('riaperta la finestra, la pizza risulta accesa', (await accesiFinestra(p)) === 'pizza', await accesiFinestra(p));
    await tocca(p, 'pizza');
    v = await vedi(p);
    check('toccata di nuovo, si spegne e la finestra resta aperta', v.aperta && (await accesiFinestra(p)) === '' && v.ok === `MOSTRA I ${tutti} POSTI`, { aperta: v.aperta, ok: v.ok });
    await p.click('#filtri-ok'); await p.waitForTimeout(500);
    v = await vedi(p);
    check('…e chiusa la finestra si vedono di nuovo tutti', !v.aperta && totale(v) === tutti && !v.acceso, { conteggio: v.conteggio });
    // Più tipi insieme: pizza e trattoria
    const trattorie = (await apri(p), await numero(p, 'trattoria'));
    const primaDiDue = eventi.filter((e) => e === 'powerup').length;
    await tocca(p, 'pizza'); await tocca(p, 'trattoria');
    v = await vedi(p);
    check('due tipi insieme: restano accesi tutti e due e il pulsante somma i posti', v.aperta && (await accesiFinestra(p)) === 'pizza,trattoria' && v.ok === `MOSTRA I ${pizze + trattorie} POSTI`, { accesi: await accesiFinestra(p), ok: v.ok, pizze, trattorie });
    await p.click('#filtri-ok'); await p.waitForTimeout(600);
    v = await vedi(p);
    check('…nella lista ci sono le pizzerie e le trattorie, e nient’altro', !v.aperta && totale(v) === pizze + trattorie && v.tipi.length === 2 && v.tipi.some((t) => /Pizza/.test(t)) && v.tipi.some((t) => /Come a casa/.test(t)) && daCapo(v), { conteggio: v.conteggio, tipi: v.tipi });
    check('…il pulsante dice «FILTRI · 2» e la riga in cima li nomina tutti e due', v.bottone === 'FILTRI · 2' && /^Vedi solo Come a casa e Pizza, ovvio Togli$/.test(v.riga || ''), { bottone: v.bottone, riga: v.riga });
    check('…nella pagina sono accesi gli stessi due power-up', await p.evaluate(() => [...document.querySelectorAll('#powerups [aria-pressed="true"]')].map((e) => e.dataset.voglia).sort().join(',') === 'pizza,trattoria'));
    check('…il contatore «powerup» scatta una volta per ogni tipo acceso', eventi.filter((e) => e === 'powerup').length === primaDiDue + 2, eventi);
    await p.click('#indietro'); await p.waitForTimeout(900);
    v = await vedi(p);
    check('INDIETRO toglie i due tipi in un passo solo', !v.aperta && totale(v) === tutti && !v.acceso && v.riga === null, { conteggio: v.conteggio, riga: v.riga });
    // «Tutto»
    await apri(p); await scegli(p, 'trattoria');
    await apri(p); await tocca(p, 'pizza'); await tocca(p, '');
    check('«Tutto» nella finestra spegne tutti i tipi accesi, e la finestra resta aperta', (await vedi(p)).aperta && (await accesiFinestra(p)) === '', await accesiFinestra(p));
    await p.click('#filtri-ok'); await p.waitForTimeout(500);
    v = await vedi(p);
    check('«Tutto» nella finestra toglie il tipo', !v.aperta && totale(v) === tutti && !v.acceso && daCapo(v), { conteggio: v.conteggio });

    // ---------- la ricerca nella finestra ----------
    await apri(p);
    await p.fill('#q-f', 'carbonara'); await p.waitForTimeout(500);
    v = await vedi(p);
    const conCarbonara = +(/(\d+)/.exec(v.ok) || [0, 0])[1];
    check('scrivendo nella finestra il pulsante dice subito quanti posti restano', v.aperta && conCarbonara > 0 && conCarbonara < tutti && /^MOSTRA I \d+ POSTI$/.test(v.ok), v.ok);
    await p.click('#filtri-ok'); await p.waitForTimeout(600);
    v = await vedi(p);
    check('«Mostra i posti»: finestra chiusa, lista filtrata dall’inizio, la ricerca è scritta anche nel campo della pagina', !v.aperta && totale(v) === conCarbonara && v.q === 'carbonara' && daCapo(v) && v.bottone === 'FILTRI · 1' && /carbonara/.test(v.riga || ''), { conteggio: v.conteggio, q: v.q, riga: v.riga });
    await p.click('#indietro'); await p.waitForTimeout(900);
    v = await vedi(p);
    check('INDIETRO toglie la ricerca e non riapre la finestra', !v.aperta && v.q === '' && totale(v) === tutti && !v.acceso, { q: v.q, conteggio: v.conteggio, aperta: v.aperta });
    // Invio nel campo vale come il pulsante
    await apri(p); await p.fill('#q-f', 'carbonara'); await p.press('#q-f', 'Enter'); await p.waitForTimeout(600);
    v = await vedi(p);
    check('Invio nel campo della finestra vale come «Mostra i posti», anche senza aspettare', !v.aperta && totale(v) === conCarbonara && v.q === 'carbonara', { conteggio: v.conteggio, q: v.q });
    // tipo + ricerca insieme, poi niente da mostrare
    await apri(p); await p.fill('#q-f', 'zzzqqq'); await p.waitForTimeout(400);
    v = await vedi(p);
    check('una ricerca che non trova niente: il pulsante lo dice', v.ok === 'NESSUN POSTO: CHIUDI', v.ok);
    await p.click('#filtri-chiudi'); await p.waitForTimeout(600);
    v = await vedi(p);
    check('chiusa la finestra con CHIUDI la ricerca scritta vale lo stesso, e la lista vuota offre «Togli i filtri»', !v.aperta && v.vuoto && v.q === 'zzzqqq' && await p.evaluate(() => !!document.querySelector('#cards .empty [data-togli-filtri]')), { vuoto: v.vuoto, q: v.q });
    await p.screenshot({ path: out + '/filtri-4-vuoto.png' });
    await p.click('#cards .empty [data-togli-filtri]'); await p.waitForTimeout(500);
    v = await vedi(p);
    check('«Togli i filtri» nella lista vuota: tornano tutti i posti', !v.vuoto && totale(v) === tutti && v.q === '' && !v.acceso, { conteggio: v.conteggio });
    // aprire e chiudere senza toccare niente non lascia passi in più
    const statoPrima = await p.evaluate(() => JSON.stringify({ ...history.state, y: 0 }));
    await apri(p); await p.click('#filtri-chiudi'); await p.waitForTimeout(600);
    await apri(p); await p.click('#filtri-ok'); await p.waitForTimeout(600);
    v = await vedi(p);
    check('aprire e chiudere la finestra senza scegliere non cambia niente', !v.aperta && totale(v) === tutti && !v.acceso && await p.evaluate(() => JSON.stringify({ ...history.state, y: 0 })) === statoPrima, { conteggio: v.conteggio, prima: statoPrima, dopo: await p.evaluate(() => JSON.stringify({ ...history.state, y: 0 })) });
    // il tasto Indietro del telefono con la finestra aperta la chiude soltanto
    await apri(p); await p.goBack(); await p.waitForTimeout(700);
    v = await vedi(p);
    check('con la finestra aperta, il tasto Indietro del telefono la chiude e basta', !v.aperta && v.titolo === 'Vicino a te' && totale(v) === tutti, { aperta: v.aperta, titolo: v.titolo });
    // filtro acceso, poi ricarico la pagina: resta
    await apri(p); await scegli(p, 'pizza');
    await p.reload(); await p.waitForTimeout(1800);
    v = await vedi(p);
    check('ricaricata la pagina il filtro c’è ancora, e il pulsante lo dice', v.titolo === 'Vicino a te' && totale(v) === pizze && v.acceso && v.bottone === 'FILTRI · 1' && !v.aperta, { titolo: v.titolo, conteggio: v.conteggio, bottone: v.bottone });
    // sulla mappa
    await p.click('[data-view="mappa"]'); await p.waitForTimeout(1500);
    await apri(p); await scegli(p, ''); await p.waitForTimeout(250);
    v = await vedi(p);
    check('dalla MAPPA: FILTRI funziona allo stesso modo e si resta sulla mappa', !v.aperta && totale(v) === tutti && await p.evaluate(() => document.querySelector('main.main').dataset.view === 'mappa'), { conteggio: v.conteggio });
    check('vicino a me: nessun errore', err.length === 0, err);
    await ctx.close();
  }

  // ---------- 2. Da un livello e da un mondo, senza posizione ----------
  {
    const { ctx, p, err } = await nuovo({ posizione: false });
    await p.evaluate(() => document.querySelector('#livelli [data-livello="Trastevere"]').click()); await p.waitForTimeout(700);
    let v = await vedi(p);
    const aTrastevere = totale(v);
    await apri(p);
    const pizze = await numero(p, 'pizza');
    check('in un livello i numeri della finestra sono quelli del livello', (await pwFinestra(p)) === (await pwPagina(p)) && pizze > 0 && pizze < aTrastevere && await numero(p, '') === aTrastevere, { pizze, aTrastevere });
    await scegli(p, 'pizza');
    v = await vedi(p);
    check('da un livello: scelta la pizza si resta in quel livello, sui posti', !v.aperta && v.titolo === 'Trastevere' && totale(v) === pizze && daCapo(v) && v.acceso, { titolo: v.titolo, conteggio: v.conteggio, y: v.y });
    await p.click('#indietro'); await p.waitForTimeout(900);
    v = await vedi(p);
    check('INDIETRO: Trastevere per intero', v.titolo === 'Trastevere' && totale(v) === aTrastevere && !v.acceso && !v.aperta, { titolo: v.titolo, conteggio: v.conteggio });
    await ctx.close();

    // «Tutta Roma», arrivando ai posti scorrendo: il filtro NON riporta su alla scelta del livello
    const s = await nuovo({ posizione: false });
    await s.p.evaluate(() => document.querySelector('main.main').scrollIntoView()); await s.p.waitForTimeout(400);
    await apri(s.p); await scegli(s.p, 'pizza');
    v = await vedi(s.p);
    check('da «Tutta Roma» (nessun livello scelto): il filtro lascia sui posti, non riporta alla scelta del livello', !v.aperta && v.titolo === 'Tutta Roma' && daCapo(v) && v.acceso && v.tipi.length === 1, { titolo: v.titolo, y: v.y, barra: v.barra });
    // il power-up della pagina, invece, continua a portare al passo dopo (il livello)
    await s.p.evaluate(() => { document.querySelector('#sez-pw').scrollIntoView(); document.querySelector('#powerups [data-voglia="trattoria"]').click(); }); await s.p.waitForTimeout(600);
    const dopo = await s.p.evaluate(() => { const r = document.querySelector('#livelli').getBoundingClientRect(); return { livelli: Math.round(r.top), vh: innerHeight, premuti: [...document.querySelectorAll('#filtri-pw [aria-pressed="true"]')].map((e) => e.dataset.voglia).sort().join(',') }; });
    check('il power-up toccato nella pagina si aggiunge a quello acceso, porta ancora alla scelta del livello, e la finestra lo sa', dopo.livelli >= 0 && dopo.livelli < dopo.vh * 0.6 && dopo.premuti === 'pizza,trattoria', dopo);
    check('livello e mondo: nessun errore', err.length === 0 && s.err.length === 0, [...err, ...s.err]);
    await s.ctx.close();
  }

  // ---------- 3. Schermi stretti e computer ----------
  for (const larg of [320, 360, 375, 412]) {
    const { ctx, p, err } = await nuovo({ dispositivo: { viewport: { width: larg, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } });
    await p.click('#m-start'); await p.waitForTimeout(1400);
    await apri(p);
    const fin = await p.evaluate(() => { const d = document.querySelector('#dlg-filtri').getBoundingClientRect(), k = document.querySelector('#filtri-ok').getBoundingClientRect();
      return { sx: Math.round(d.left), dx: Math.round(d.right), vw: innerWidth, vh: innerHeight, okSotto: Math.round(k.bottom), okSopra: Math.round(k.top), piccoli: [...document.querySelectorAll('#filtri-pw .pw')].filter((e) => e.getBoundingClientRect().height < 44).length,
        fuori: [...document.querySelectorAll('#filtri-pw .pw')].filter((e) => e.scrollWidth > e.clientWidth + 1).length }; });
    check(larg + ' px: la finestra sta nello schermo, i tasti sono alti almeno 44 px e «Mostra i posti» è in vista', fin.sx >= 0 && fin.dx <= fin.vw && fin.piccoli === 0 && fin.fuori === 0 && fin.okSopra > 0 && fin.okSotto <= fin.vh, fin);
    await scegli(p, 'pizza');
    const v = await vedi(p);
    check(larg + ' px: con il filtro acceso («FILTRI · 1») la riga dei comandi non esce dallo schermo', v.largo <= v.vw && v.filtri.left >= 0 && v.filtri.right <= v.gettone.left && v.gettone.right <= v.vista.left && v.vista.right <= v.vw && v.filtri.bottom - v.filtri.top >= 40, { largo: v.largo, vw: v.vw, filtri: v.filtri, gettone: v.gettone, vista: v.vista });
    if (larg === 320) await p.screenshot({ path: out + '/filtri-5-stretto.png' });
    check(larg + ' px: nessun errore', err.length === 0, err);
    await ctx.close();
  }
  {
    const { ctx, p, err } = await nuovo({ dispositivo: { viewport: { width: 1366, height: 800 } } });
    await p.click('#m-start'); await p.waitForTimeout(1500);
    let v = await vedi(p);
    check('computer: FILTRI è nella barra accanto al gettone', nellaBarra(v) && v.largo <= v.vw, { filtri: v.filtri, barra: v.barra });
    await apri(p); await p.keyboard.press('Escape'); await p.waitForTimeout(500);
    v = await vedi(p);
    check('computer: Esc chiude la finestra', !v.aperta);
    // Esc in un campo di ricerca, in Chrome, prima lo svuota: quello che conta è che lista, campo e pulsante dicano la stessa cosa
    const tutti = totale(v);
    await apri(p); await p.fill('#q-f', 'carbonara'); await p.waitForTimeout(500); await p.keyboard.press('Escape'); await p.waitForTimeout(600);
    if ((await vedi(p)).aperta) { await p.keyboard.press('Escape'); await p.waitForTimeout(600); }
    v = await vedi(p);
    check('computer: Esc dopo aver scritto: finestra chiusa, e lista, campo e pulsante dicono la stessa cosa', !v.aperta && ((v.q === '' && totale(v) === tutti && !v.acceso && v.riga === null) || (v.q === 'carbonara' && totale(v) < tutti && v.acceso)), { q: v.q, conteggio: v.conteggio, acceso: v.acceso });
    if (v.acceso) { await p.click('#filtri-attivi [data-togli-filtri]'); await p.waitForTimeout(400); }
    await apri(p); await scegli(p, 'pizza');
    v = await vedi(p);
    check('computer: scelta la pizza e «Mostra i posti», la finestra si chiude e la lista è filtrata', !v.aperta && v.acceso && v.tipi.length === 1, { tipi: v.tipi });
    await p.screenshot({ path: out + '/filtri-6-computer.png' });
    check('computer: nessun errore', err.length === 0, err);
    await ctx.close();
  }

  // ---------- 4. Il campo di ricerca della pagina: i posti trovati sono più giù, quindi lo dice e ci porta ----------
  for (const [nome, disp] of [['telefono', devices['iPhone 13']], ['computer', { viewport: { width: 1366, height: 800 } }]]) {
    const { ctx, p, err } = await nuovo({ dispositivo: disp, posizione: false });
    const tutti = totale(await vedi(p));
    await p.click('#m-livelli'); await p.waitForTimeout(600);
    await p.locator('#q').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    const esito = () => p.evaluate(() => { const e = document.querySelector('#q-esito'), r = e.getBoundingClientRect(); return { nascosto: e.hidden, testo: document.querySelector('#q-quanti').textContent, vai: !document.querySelector('#q-vai').hidden, inVista: !e.hidden && r.top >= 0 && r.bottom <= innerHeight }; });
    check(nome + ': ricerca della pagina: senza parole non c’è nessun avviso', (await esito()).nascosto);
    await p.click('#q'); await p.keyboard.type('carbonara', { delay: 30 }); await p.waitForTimeout(500);
    let v = await vedi(p), e = await esito();
    const trovati = totale(v);
    check(nome + ': scritto «carbonara», sotto il campo c’è scritto quanti posti ha trovato, con il pulsante per andarci', !e.nascosto && e.inVista && trovati > 0 && trovati < tutti && e.testo === `${trovati} posti con «carbonara»` && e.vai, { e, trovati });
    await p.screenshot({ path: out + '/filtri-7-cerca-' + nome + '.png' });
    const yCampo = v.y;
    await p.keyboard.press('Enter'); await p.waitForTimeout(700);
    v = await vedi(p);
    check(nome + ': Invio porta ai posti trovati, dall’inizio', daCapo(v) && v.y > yCampo + 300 && totale(v) === trovati && v.q === 'carbonara' && /carbonara/.test(v.riga || ''), { y: v.y, yCampo, conteggio: v.conteggio, riga: v.riga });
    check(nome + ': …e i posti mostrati parlano davvero di carbonara', await p.evaluate(() => [...document.querySelectorAll('#cards .card')].every((c) => /carbonara/i.test(c.textContent))));
    await p.click('#indietro'); await p.waitForTimeout(900);
    v = await vedi(p);
    check(nome + ': INDIETRO riporta al campo di ricerca, con la parola ancora scritta', Math.abs(v.y - yCampo) < 40 && v.q === 'carbonara' && totale(v) === trovati, { y: v.y, yCampo, q: v.q });
    await p.click('#q-vai'); await p.waitForTimeout(700);
    v = await vedi(p);
    check(nome + ': anche «VEDI I POSTI» porta ai posti', daCapo(v) && totale(v) === trovati, { y: v.y });
    await p.locator('#q').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    await p.fill('#q', 'zzzqqq'); await p.waitForTimeout(500);
    e = await esito();
    check(nome + ': una parola che non trova niente: lo dice sotto il campo, senza pulsante', !e.nascosto && /^Nessun posto con «zzzqqq»/.test(e.testo) && !e.vai, e);
    const yPrima = (await vedi(p)).y;
    await p.press('#q', 'Enter'); await p.waitForTimeout(600);
    check(nome + ': …e Invio non porta a una lista vuota', Math.abs((await vedi(p)).y - yPrima) < 40);
    await p.fill('#q', ''); await p.waitForTimeout(500);
    check(nome + ': cancellata la parola, l’avviso sparisce e tornano tutti i posti', (await esito()).nascosto && totale(await vedi(p)) === tutti);
    check(nome + ': ricerca della pagina: nessun errore', err.length === 0, err);
    await ctx.close();
  }

  await b.close();
  for (const x of ko) console.log('✗ ' + x);
  console.log(`${ok.length} ok, ${ko.length} falliti`);
  process.exit(ko.length ? 1 : 0);
})();
