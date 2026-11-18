// Gettone → "Vicino a me": l'avviso sulla posizione prima che il telefono chieda il permesso.
//   node avviso-posizione.js <cartella foto> [indirizzo]
const { chromium, devices } = require('playwright');
const out = process.argv[2];
const BASE = process.argv[3] || 'http://localhost:8765/index.html';
const LOCALE = /localhost/.test(BASE);
const ok = [], ko = [];
const check = (n, c, x) => (c ? ok : ko).push(n + (x !== undefined ? ' → ' + JSON.stringify(x) : ''));
const ROMA = { latitude: 41.8893, longitude: 12.4707 };   // Trastevere
(async () => {
  const b = await chromium.launch();
  // permesso: 'prompt' (il browser la chiederà), 'granted', 'denied', 'ignoto' (il browser non lo dice), 'assente' (niente posizione)
  const nuovo = async ({ permesso = 'prompt', dispositivo = devices['iPhone 13'], cfg } = {}) => {
    const concesso = permesso === 'prompt' || permesso === 'granted' || permesso === 'ignoto';
    const ctx = await b.newContext({ ...dispositivo, reducedMotion: 'reduce', ...(concesso ? { geolocation: ROMA, permissions: ['geolocation'] } : {}) });
    await ctx.addInitScript((permesso) => {
      try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {}
      Math.random = () => 0.37;
      if (permesso === 'prompt' || permesso === 'rifiuta') navigator.permissions.query = async () => ({ state: 'prompt' });   // nel test il permesso c'è già (o verrà negato), ma la pagina non lo sa
      if (permesso === 'denied') navigator.permissions.query = async () => ({ state: 'denied' });
      if (permesso === 'ignoto') navigator.permissions.query = async () => { throw new Error('non lo dico'); };
      if (permesso === 'assente') Object.defineProperty(Navigator.prototype, 'geolocation', { configurable: true, get: () => undefined });
      // quante volte la pagina chiede davvero la posizione
      window.__chieste = 0;
      const g = navigator.geolocation;
      if (g) { const vera = g.getCurrentPosition.bind(g); g.getCurrentPosition = (...a) => { window.__chieste++; return vera(...a); }; }
    }, permesso);
    await ctx.route(/google\.com|paypal\./, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>esterno</title>' }));
    await ctx.route('https://finto.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    const p = await ctx.newPage(); const err = [];
    p.on('pageerror', (e) => err.push(String(e).slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text().slice(0, 200)); });
    if (cfg) await p.route('**/config.js', async (route) => {
      const t = LOCALE ? await (await route.fetch()).text() : require('child_process').execSync('curl -sS -m 30 ' + new URL('config.js', BASE).href).toString();
      await route.fulfill({ status: 200, contentType: 'text/javascript', body: cfg(t) });
    });
    await p.goto(BASE); await p.waitForTimeout(600);
    return { ctx, p, err };
  };
  const vedi = (p) => p.evaluate(() => {
    const d = document.querySelector('#dlg-gettone'), c = document.querySelector('#get-corpo'), r = d.getBoundingClientRect();
    const avviso = c.querySelector('.avviso');
    return { aperto: d.open, domanda: (c.querySelector('.get-dom') || {}).textContent || '', avviso: !!avviso,
      righe: avviso ? [...avviso.querySelectorAll('li')].map((l) => l.innerText.replace(/\s+/g, ' ')) : [],
      bottoni: [...c.querySelectorAll('button')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()),
      fuoco: document.activeElement ? document.activeElement.innerText.replace(/\s+/g, ' ').trim() : '',
      errore: (c.querySelector('.errore') || {}).innerText || '', guida: c.querySelectorAll('[data-get=guida]').length,
      esito: !!c.querySelector('#get-esito'), quanto: (c.querySelector('#get-esito .quanto') || {}).textContent || '', info: (c.querySelector('.get-info') || {}).textContent || '',
      piccolo: [...c.querySelectorAll('small')].map((s) => s.innerText.replace(/\s+/g, ' ')).join(' | '),
      chieste: window.__chieste, dentro: r.top >= 0 && r.bottom <= innerHeight, largo: Math.max(d.scrollWidth - d.clientWidth, c.scrollWidth - c.clientWidth, document.documentElement.scrollWidth - innerWidth) };
  });
  const gettone = async (p) => { await p.click('#m-gettone'); await p.waitForTimeout(350); };

  // ===== 1) Il caso normale: il browser sta per chiedere il permesso =====
  let { ctx, p, err } = await nuovo();
  await gettone(p);
  let v = await vedi(p);
  check('gettone: «Dove te lo pesco?» con «Vicino a me» che dice che chiede la posizione', /Dove te lo pesco/.test(v.domanda) && /Vicino a me Ti chiedo la posizione/.test(v.bottoni[0]), v.bottoni);
  check('gettone: sotto le scelte, la posizione si usa solo con «Vicino a me»', /solo se scegli «Vicino a me»/.test(v.piccolo) && /resta sul tuo telefono/.test(v.piccolo), v.piccolo);
  await p.screenshot({ path: out + '/pos-0-scelte.png' });
  await p.click('[data-get=vicino]'); await p.waitForTimeout(400);
  v = await vedi(p);
  check('Vicino a me: compare l’avviso «Posso usare la tua posizione?»', v.aperto && v.avviso && /Posso usare la tua posizione\?/.test(v.domanda), v);
  check('avviso: tre righe (a che cosa serve, che cosa succede, dove finisce)', v.righe.length === 3 && /A che cosa serve\. Solo a pescare tra i posti a pochi minuti a piedi/.test(v.righe[0]) && /Il telefono ti chiede il permesso: scegli «Consenti»/.test(v.righe[1]) && /Resta sul tuo telefono: al sito non arriva e non viene salvata\.$/.test(v.righe[2]), v.righe);
  check('avviso: senza account non si parla di check-in', !/check-in/i.test(v.righe.join(' ')), v.righe);
  check('avviso: due pulsanti, sì e no, e il fuoco è sul sì', /Sì, usa la posizione/.test(v.bottoni[0]) && /No, scelgo io dove/.test(v.bottoni[1]) && /Sì, usa la posizione/.test(v.fuoco), { b: v.bottoni, f: v.fuoco });
  check('avviso: la posizione NON è ancora stata chiesta al telefono', v.chieste === 0, v.chieste);
  check('avviso: sta nello schermo, niente scorrimento laterale', v.dentro && v.largo <= 0, v);
  check('avviso: dice che dire di no non cambia nulla, con il link alla privacy', /Se dici di no non cambia nulla/.test(v.piccolo) && await p.locator('#get-corpo a[href="privacy.html"]').count() === 1, v.piccolo);
  const misure = await p.evaluate(() => [...document.querySelectorAll('#get-corpo .get-acts .btn')].map((x) => Math.round(x.getBoundingClientRect().height)));
  check('avviso: pulsanti alti almeno 44 px', misure.every((h) => h >= 44), misure);
  await p.screenshot({ path: out + '/pos-1-avviso.png' });
  // sì → la chiede e pesca vicino
  await p.click('[data-get=vicino-ok]'); await p.waitForTimeout(1300);
  v = await vedi(p);
  check('Sì: la posizione viene chiesta e il gettone pesca a pochi minuti', v.chieste >= 1 && v.esito && /min|km/.test(v.quanto) && /minuti a piedi|più vicini/.test(v.info), v);
  await p.screenshot({ path: out + '/pos-2-esito.png' });
  const prima = v.chieste;
  await p.click('[data-get=ancora]'); await p.waitForTimeout(500);
  v = await vedi(p);
  check('Altro gettone: niente più avviso né nuova richiesta', v.esito && !v.avviso && v.chieste === prima, v);
  check('caso normale: nessun errore in pagina', err.length === 0, err);
  await ctx.close();

  // ===== 2) No, scelgo io dove =====
  ({ ctx, p, err } = await nuovo());
  await gettone(p); await p.click('[data-get=vicino]'); await p.waitForTimeout(300);
  await p.click('[data-get=dove]'); await p.waitForTimeout(300);
  v = await vedi(p);
  check('No: torna a «Dove te lo pesco?», senza errori e senza chiedere la posizione', /Dove te lo pesco/.test(v.domanda) && !v.avviso && !v.errore && v.chieste === 0, v);
  await p.click('[data-get=ovunque]'); await p.waitForTimeout(500);
  v = await vedi(p);
  check('No: «Ovunque» pesca lo stesso, senza posizione', v.esito && !v.quanto && v.chieste === 0, v);
  // chiudere l'avviso con Esc
  await p.click('#dlg-gettone [data-chiudi]'); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('[data-restart]') && document.querySelector('[data-restart]').click()); await p.waitForTimeout(300);
  await gettone(p);
  v = await vedi(p);
  if (/Dove te lo pesco/.test(v.domanda)) {
    await p.click('[data-get=vicino]'); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    v = await vedi(p);
    check('Esc sull’avviso: la finestra si chiude e la posizione non viene chiesta', !v.aperto && v.chieste === 0, v);
  } else check('Esc sull’avviso: si è arrivati alla scelta', false, v);
  await ctx.close();

  // ===== 3) Permesso già dato: nessun passaggio in più =====
  ({ ctx, p, err } = await nuovo({ permesso: 'granted' }));
  await gettone(p); await p.click('[data-get=vicino]'); await p.waitForTimeout(1300);
  v = await vedi(p);
  check('permesso già dato: niente avviso, pesca subito vicino', !v.avviso && v.esito && /min|km/.test(v.quanto) && v.chieste >= 1, v);
  check('permesso già dato: nessun errore', err.length === 0, err);
  await ctx.close();

  // ===== 4) Posizione bloccata: niente avviso inutile, ma un messaggio chiaro =====
  ({ ctx, p, err } = await nuovo({ permesso: 'denied' }));
  await gettone(p); await p.click('[data-get=vicino]'); await p.waitForTimeout(1000);
  v = await vedi(p);
  check('bloccata: niente avviso, si torna alle scelte', !v.avviso && /Dove te lo pesco/.test(v.domanda), v);
  check('bloccata: «Non riesco a usare la posizione», il motivo, «Come si attiva?» e l’alternativa', /Non riesco a usare la posizione\./.test(v.errore) && /bloccata per questo sito, oppure è spenta sul telefono/.test(v.errore) && v.guida === 1 && /Intanto puoi scegliere tu dove pescare/.test(v.errore), v.errore);
  await p.screenshot({ path: out + '/pos-3-bloccata.png' });
  await p.click('#get-corpo [data-get=guida]'); await p.waitForTimeout(300);
  check('bloccata: «Come si attiva?» apre le istruzioni', await p.evaluate(() => document.querySelector('#dlg-posizione').open && document.querySelectorAll('#pos-corpo .passi li').length === 3));
  await ctx.close();

  // ===== 4b) L'avviso compare, la persona dice sì, ma poi al telefono risponde «Non consentire» =====
  ({ ctx, p, err } = await nuovo({ permesso: 'rifiuta' }));
  await gettone(p); await p.click('[data-get=vicino]'); await p.waitForTimeout(400);
  v = await vedi(p);
  check('rifiuto al telefono: prima l’avviso', v.avviso, v);
  await p.click('[data-get=vicino-ok]'); await p.waitForTimeout(1000);
  v = await vedi(p);
  check('rifiuto al telefono: messaggio chiaro, «Come si attiva?» e le altre scelte', !v.avviso && /Non riesco a usare la posizione\./.test(v.errore) && v.guida === 1 && /Dove te lo pesco/.test(v.domanda) && v.bottoni.some((t) => /Ovunque/.test(t)), v);
  await ctx.close();

  // ===== 5) Browser che non dice lo stato del permesso: l'avviso c'è =====
  ({ ctx, p, err } = await nuovo({ permesso: 'ignoto' }));
  await gettone(p); await p.click('[data-get=vicino]'); await p.waitForTimeout(400);
  v = await vedi(p);
  check('browser che non dice il permesso: l’avviso compare lo stesso', v.avviso && v.chieste === 0, v);
  await p.click('[data-get=vicino-ok]'); await p.waitForTimeout(1300);
  v = await vedi(p);
  check('…e dopo il sì pesca vicino', v.esito && /min|km/.test(v.quanto), v);
  check('browser che non dice il permesso: nessun errore', err.length === 0, err);
  await ctx.close();

  // ===== 6) Browser senza posizione =====
  ({ ctx, p, err } = await nuovo({ permesso: 'assente' }));
  await gettone(p); await p.click('[data-get=vicino]'); await p.waitForTimeout(500);
  v = await vedi(p);
  check('senza posizione: niente avviso, messaggio chiaro e nessun «Come si attiva?»', !v.avviso && /Non riesco a usare la posizione\./.test(v.errore) && /non sa dirmi dove sei/.test(v.errore) && v.guida === 0, v);
  check('senza posizione: nessun errore', err.length === 0, err);
  await ctx.close();

  // ===== 7) Con gli account accesi: l'avviso dice del check-in =====
  ({ ctx, p, err } = await nuovo({ cfg: (t) => t.replace(/supabaseUrl: "[^"]*"/, 'supabaseUrl: "https://finto.supabase.co/"').replace(/supabaseKey: "[^"]*"/, 'supabaseKey: "sb_publishable_finta"').replace(/^(\s*)conto: false,/m, '$1conto: true,') }));
  await gettone(p); await p.click('[data-get=vicino]'); await p.waitForTimeout(400);
  v = await vedi(p);
  check('account accesi: la riga «Dove finisce» dice quando viene inviata (check-in)', v.avviso && /La inviamo solo se un giorno premi «Check-in»/.test(v.righe[2] || ''), v.righe);
  await ctx.close();

  // ===== 8) Telefono stretto e computer =====
  ({ ctx, p, err } = await nuovo({ dispositivo: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent } }));
  await gettone(p); await p.click('[data-get=vicino]'); await p.waitForTimeout(400);
  v = await vedi(p);
  const stretto = await p.evaluate(() => { const d = document.querySelector('#dlg-gettone').getBoundingClientRect(); const si = document.querySelector('[data-get=vicino-ok]').getBoundingClientRect(); return { top: d.top, bottom: d.bottom, vh: innerHeight, siH: si.height, siW: si.width }; });
  check('320 px: l’avviso non esce dallo schermo né di lato', v.avviso && stretto.top >= 0 && stretto.bottom <= stretto.vh && v.largo <= 0 && stretto.siH >= 44, { stretto, largo: v.largo });
  await p.screenshot({ path: out + '/pos-4-stretto.png' });
  await p.evaluate(() => document.querySelector('[data-get=vicino-ok]').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
  await p.screenshot({ path: out + '/pos-5-stretto-pulsanti.png' });
  await ctx.close();

  ({ ctx, p, err } = await nuovo({ dispositivo: { viewport: { width: 1366, height: 800 } } }));
  await p.click('#gettone'); await p.waitForTimeout(350);
  if (await p.locator('[data-get=vicino]').count()) { await p.click('[data-get=vicino]'); await p.waitForTimeout(400); }
  v = await vedi(p);
  check('computer: l’avviso parla di «computer», non di telefono', v.avviso && /Il computer ti chiede il permesso/.test(v.righe[1]) && /Resta sul tuo computer/.test(v.righe[2]), v.righe);
  await p.screenshot({ path: out + '/pos-6-computer.png' });
  check('computer: nessun errore', err.length === 0, err);
  await ctx.close();

  await b.close();
  console.log(ok.length + ' ok, ' + ko.length + ' falliti'); ko.forEach((x) => console.log('FALLITO: ' + x));
})();
