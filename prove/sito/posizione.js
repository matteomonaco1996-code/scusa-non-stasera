// La posizione si chiede solo quando si tocca «Vicino a me»: all'arrivo non si apre nessuna finestra (fino al 19 novembre
// 2026 dopo i termini compariva «Da dove partiamo?», tolta perché copriva la scena d'apertura). Qui: che cosa succede al
// tocco, la finestra "Attiva la posizione" quando è bloccata, e le spiegazioni del gettone.
const { chromium, devices } = require('playwright');
const out = process.argv[2];
const ok = [], ko = [];
const check = (n, c, x) => (c ? ok : ko).push(n + (x !== undefined ? ' → ' + JSON.stringify(x) : ''));
const ROMA = { latitude: 41.8893, longitude: 12.4707 };   // Trastevere
(async () => {
  const b = await chromium.launch();
  // opzioni: permesso = 'granted' | 'prompt' (concesso al clic) | 'denied'; termini già accettati o no
  const nuovo = async ({ device = 'iPhone 13', permesso = 'denied', termini = true, ua, ricordato = false } = {}) => {
    const ctx = await b.newContext({ ...devices[device], reducedMotion: 'reduce', ...(ua ? { userAgent: ua } : {}), ...(permesso !== 'denied' ? { geolocation: ROMA, permissions: ['geolocation'] } : {}) });
    await ctx.addInitScript(([termini, permesso, ricordato]) => {
      try { if (termini) localStorage.setItem('sns-termini', '1.1'); if (ricordato) localStorage.setItem('sns-posizione', 'no'); } catch (e) {}
      // "prompt": il browser non ha ancora deciso (nel test il permesso c'è già, ma la pagina non lo sa)
      if (permesso === 'prompt') navigator.permissions.query = async () => ({ state: 'prompt' });
      // quante volte la pagina chiede la posizione al telefono
      window.__richieste = 0; const g = navigator.geolocation, vera = g.getCurrentPosition.bind(g);
      g.getCurrentPosition = (...a) => { window.__richieste++; return vera(...a); };
    }, [termini, permesso, ricordato]);
    const p = await ctx.newPage(); const err = [];
    p.on('pageerror', (e) => err.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text()); });
    await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(600);
    return { ctx, p, err };
  };
  const st = (p) => p.evaluate(() => ({ pos: document.querySelector('#dlg-posizione').open, ter: document.querySelector('#dlg-termini').open, testo: document.querySelector('#pos-corpo').innerText.replace(/\s+/g, ' ').slice(0, 400), passi: [...document.querySelectorAll('#pos-corpo .passi li')].map((l) => l.innerText), bottoni: [...document.querySelectorAll('#pos-corpo button')].map((x) => x.innerText.trim()), ricordo: localStorage.getItem('sns-posizione'), aperte: [...document.querySelectorAll('dialog[open]')].map((d) => d.id), richieste: window.__richieste, titolo: document.querySelector('#titolo-ris').textContent }));

  // 1) Prima visita: i termini, e poi nessun'altra finestra. La posizione non viene chiesta finché non si tocca «Vicino a me»
  let { ctx, p, err } = await nuovo({ permesso: 'prompt', termini: false });
  let s = await st(p);
  check('prima visita: solo i termini', s.ter && !s.pos, s);
  await p.click('#termini-ok'); await p.waitForTimeout(1200);
  s = await st(p);
  check('dopo i termini non si apre nessuna finestra: si vede la scena con i due tasti', !s.ter && !s.pos && s.aperte.length === 0 && await p.evaluate(() => { const r = document.querySelector('#m-start').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), s.aperte);
  check('…e il sito non ha chiesto la posizione al telefono', s.richieste === 0, s.richieste);
  await p.screenshot({ path: out + '/pos-1-dopo-termini.png' });
  // 2) Toccato «Vicino a me»: solo adesso parte la richiesta; il permesso arriva e si vedono i posti vicini
  await p.click('#m-start'); await p.waitForTimeout(1200);
  s = await st(p);
  check('toccato «Vicino a me»: la richiesta parte adesso, posizione trovata, posti vicini', s.richieste >= 1 && !s.pos && s.titolo === 'Vicino a te' && s.ricordo === null, s);
  check('nessun errore (prima visita)', err.length === 0, err);
  await ctx.close();

  // 3) Permesso già dato: nessuna finestra, e comunque nessuna richiesta finché non si tocca
  ({ ctx, p, err } = await nuovo({ permesso: 'granted' }));
  s = await st(p);
  check('permesso già dato: nessuna finestra e nessuna richiesta da sola', !s.pos && s.aperte.length === 0 && s.richieste === 0, s);
  await ctx.close();

  // 3b) Chi aveva nel browser la vecchia nota «sns-posizione»: il sito non la usa più e la cancella
  ({ ctx, p, err } = await nuovo({ permesso: 'denied', ricordato: true }));
  // (la prova la riscrive a ogni caricamento, prima del sito: conta che dopo il caricamento non ci sia più)
  check('la vecchia nota «sns-posizione» viene cancellata', (await st(p)).ricordo === null, (await st(p)).ricordo);
  await ctx.close();

  // 4) Posizione bloccata su iPhone: all'arrivo niente; toccato «Vicino a me», le istruzioni per iPhone
  ({ ctx, p, err } = await nuovo({ permesso: 'denied' }));
  s = await st(p);
  check('bloccata: all’arrivo non compare nessuna finestra', !s.pos && s.aperte.length === 0, s.aperte);
  await p.click('#m-start'); await p.waitForTimeout(900);
  s = await st(p);
  check('bloccata su iPhone, toccato «Vicino a me»: tre passi per iPhone', s.pos && s.passi.length === 3 && /Impostazioni/.test(s.passi[0]) && /Safari/.test(s.passi[1]) && /Riprova/i.test(s.bottoni.join()), s);
  await p.screenshot({ path: out + '/pos-2-bloccata-iphone.png' });
  const rr = await p.evaluate(() => { const d = document.querySelector('#dlg-posizione').getBoundingClientRect(); return { top: d.top, bottom: d.bottom, vh: innerHeight }; });
  check('istruzioni dentro lo schermo', rr.top >= 0 && rr.bottom <= rr.vh, rr);
  await p.click('#pos-corpo [data-pos=no]'); await p.waitForTimeout(500);
  s = await st(p);
  const top = await p.evaluate(() => Math.round(document.querySelector('#sez-mondi').getBoundingClientRect().top));
  check('«Scelgo io la zona»: chiusa, porta alla scelta del mondo, niente viene ricordato nel browser', !s.pos && s.ricordo === null && Math.abs(top) < 60, { s: s.ricordo, top });
  await p.reload(); await p.waitForTimeout(600);
  check('alla visita dopo nessuna finestra', !(await st(p)).pos);
  // «Vicino a me» la riapre con le istruzioni
  await p.click('#m-start'); await p.waitForTimeout(900);
  s = await st(p);
  check('di nuovo «Vicino a me» con posizione bloccata: istruzioni', s.pos && s.passi.length === 3, s);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  check('Esc chiude', !(await st(p)).pos);
  check('nessun errore (bloccata)', err.length === 0, err);
  await ctx.close();

  // 5) Android: istruzioni per Android
  ({ ctx, p, err } = await nuovo({ device: 'Pixel 7', permesso: 'denied' }));
  await p.click('#m-start'); await p.waitForTimeout(900);
  s = await st(p);
  check('bloccata su Android: passi per Android', s.passi.length === 3 && /menu rapido/.test(s.passi[0]) && /Autorizzazioni/.test(s.passi[1]), s.passi);
  await p.screenshot({ path: out + '/pos-3-bloccata-android.png' });
  await ctx.close();

  // 6) Computer
  let cd = await b.newContext({ viewport: { width: 1366, height: 800 } });
  await cd.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); } catch (e) {} });
  let pd = await cd.newPage(); await pd.goto('http://localhost:8765/index.html'); await pd.waitForTimeout(600);
  check('computer, prima visita con i termini già accettati: nessuna finestra', await pd.evaluate(() => document.querySelectorAll('dialog[open]').length === 0));
  await pd.click('#m-start'); await pd.waitForTimeout(900);
  s = await st(pd);
  check('bloccata su computer: passi per computer', s.passi.length === 3 && /Clicca/.test(s.passi[0]), s.passi);
  await pd.screenshot({ path: out + '/pos-4-computer.png' });
  await cd.close();

  // 7) Dentro Instagram: avviso di aprire nel browser
  ({ ctx, p, err } = await nuovo({ permesso: 'denied', ua: devices['iPhone 13'].userAgent + ' Instagram 300.0.0.0' }));
  await p.click('#m-start'); await p.waitForTimeout(900);
  s = await st(p);
  check('dentro un’altra app: dice di aprire nel browser', /Apri nel browser/.test(s.testo), s.testo);
  await ctx.close();

  // 8) Gettone: spiegazioni, e dal gettone la guida per la posizione
  ({ ctx, p, err } = await nuovo({ permesso: 'denied', ricordato: true }));
  check('menu: il gettone si spiega', /a caso/.test(await p.textContent('#m-gettone small')) && /gratis/i.test(await p.textContent('#m-gettone small')), await p.textContent('#m-gettone small'));
  check('sopra la lista c’è il suggerimento', await p.evaluate(() => { const h = document.querySelector('#hint-gettone'); return !h.hidden && /a caso/.test(h.textContent) && h.getBoundingClientRect().height > 0; }));
  await p.click('#m-gettone'); await p.waitForTimeout(300);
  check('gettone: spiega che pesca a caso ed è gratis', await p.evaluate(() => /un posto a caso/.test(document.querySelector('#get-corpo .get-cosa').textContent) && /gratis/.test(document.querySelector('#get-corpo .get-cosa').textContent)));
  await p.screenshot({ path: out + '/get-1-dove.png' });
  await p.click('[data-get=vicino]'); await p.waitForTimeout(300);
  if (await p.locator('[data-get=vicino-ok]').count()) await p.click('[data-get=vicino-ok]');   // l'avviso prima della richiesta
  await p.waitForTimeout(900);
  check('gettone, vicino a me con posizione bloccata: «Come si attiva?»', await p.locator('#get-corpo [data-get=guida]').count() === 1);
  await p.click('#get-corpo [data-get=guida]'); await p.waitForTimeout(300);
  s = await st(p);
  check('la guida si apre sopra il gettone', s.pos && s.passi.length === 3 && await p.evaluate(() => document.querySelector('#dlg-gettone').open), s);
  await p.click('#pos-corpo [data-pos=no]'); await p.waitForTimeout(300);
  check('chiusa la guida, il gettone resta', await p.evaluate(() => document.querySelector('#dlg-gettone').open && !document.querySelector('#dlg-posizione').open));
  await p.click('[data-get=ovunque]'); await p.waitForTimeout(500);
  s = await p.evaluate(() => ({ eti: document.querySelector('#get-corpo .eti').textContent, hint: document.querySelector('#hint-gettone').hidden, h: document.querySelector('#dlg-gettone').getBoundingClientRect().bottom, vh: innerHeight }));
  check('risultato: «uno a caso tra N posti», suggerimento sparito', /UNO A CASO TRA \d+ POSTI/.test(s.eti) && s.hint && s.h <= s.vh, s);
  await p.screenshot({ path: out + '/get-2-esito.png' });
  check('nessun errore (gettone)', err.length === 0, err);
  await ctx.close();

  // 9) Dal gettone con permesso che arriva: dopo "Attiva" pesca vicino a te
  ({ ctx, p, err } = await nuovo({ permesso: 'prompt', ricordato: true }));
  await p.click('#m-gettone'); await p.waitForTimeout(300); await p.click('[data-get=vicino]'); await p.waitForTimeout(300);
  check('gettone vicino a me: prima l’avviso sulla posizione', await p.locator('#get-corpo .avviso').count() === 1);
  await p.click('[data-get=vicino-ok]'); await p.waitForTimeout(1200);
  s = await p.evaluate(() => ({ info: document.querySelector('.get-info')?.textContent || '', quanto: !!document.querySelector('#get-esito .quanto') }));
  check('gettone vicino a me con permesso: pesca a pochi minuti', /minuti a piedi|più vicini/.test(s.info) && s.quanto, s);
  await ctx.close();

  // 10) Telefono piccolo: le istruzioni non escono dallo schermo
  const cs = await b.newContext({ viewport: { width: 360, height: 640 }, userAgent: devices['iPhone 13'].userAgent, isMobile: true, hasTouch: true });
  await cs.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); } catch (e) {} });
  const ps = await cs.newPage(); await ps.goto('http://localhost:8765/index.html'); await ps.waitForTimeout(600);
  await ps.click('#m-start'); await ps.waitForTimeout(900);
  const q = await ps.evaluate(() => { const d = document.querySelector('#dlg-posizione'); const r = d.getBoundingClientRect(); const bt = document.querySelector('#pos-corpo [data-pos=no]').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: innerHeight, scorre: d.scrollHeight > d.clientHeight + 1 || document.querySelector('#pos-corpo').scrollHeight > document.querySelector('#pos-corpo').clientHeight + 1, btBottom: bt.bottom }; });
  check('360x640: finestra dentro lo schermo (o scorrevole)', q.top >= 0 && q.bottom <= q.vh, q);
  await ps.screenshot({ path: out + '/pos-5-piccolo.png' });
  await cs.close();

  await b.close();
  console.log(ok.length + ' ok, ' + ko.length + ' falliti'); ko.forEach((x) => console.log('FALLITO: ' + x));
})();
