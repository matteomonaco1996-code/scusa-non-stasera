const { chromium, devices } = require('playwright');
const out = process.argv[2];
const ok = [], ko = [];
const check = (n, c, x) => (c ? ok : ko).push(n + (x !== undefined ? ' → ' + JSON.stringify(x) : ''));
const VAI = 'a[href^="https://www.google.com/maps/dir/"]';
(async () => {
  const b = await chromium.launch();
  const nuovo = async (cfg) => {
    const ctx = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
    // Niente rete verso Google o PayPal: le pagine esterne rispondono con una pagina vuota
    await ctx.route(/google\.com|paypal\./, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>esterno</title>' }));
    const p = await ctx.newPage(); const err = [];
    p.on('pageerror', (e) => err.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text()); });
    if (cfg) await p.route('**/config.js', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: cfg(await r.text()) }); });
    await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelector('button[data-livello="Trastevere"]').click()); await p.waitForTimeout(500);
    return { ctx, p, err };
  };
  const stato = (p) => p.evaluate(() => ({ vai: document.querySelector('#dlg-vai').open, href: document.querySelector('#vai-ora').getAttribute('href'), importi: [...document.querySelectorAll('#monete-vai a')].map((a) => a.getAttribute('href')), fuoco: document.activeElement && document.activeElement.id }));

  // ===== monetaPrima: "sempre" (predefinito) =====
  let { ctx, p, err } = await nuovo();
  check('il vecchio avviso al ritorno non c’è più', await p.evaluate(() => !document.querySelector('#moneta-avviso')));
  // 1) dalla scheda in elenco
  const atteso = await p.evaluate((s) => document.querySelector('.card ' + s).href, VAI);
  let pagine = ctx.pages().length;
  await p.locator('.card ' + VAI).first().click(); await p.waitForTimeout(300);
  let s = await stato(p);
  check('scheda: si apre PRIMA DI ANDARE', s.vai, s);
  check('scheda: nessuna scheda nuova aperta', ctx.pages().length === pagine, ctx.pages().length);
  check('scheda: VAI AL POSTO porta allo stesso indirizzo', s.href === atteso, [s.href, atteso]);
  check('scheda: il fuoco è su VAI AL POSTO', s.fuoco === 'vai-ora', s.fuoco);
  check('importi 1, 2, 5 e Altro verso PayPal', JSON.stringify(s.importi) === JSON.stringify(['https://www.paypal.me/MatteoMonaco01/1EUR', 'https://www.paypal.me/MatteoMonaco01/2EUR', 'https://www.paypal.me/MatteoMonaco01/5EUR', 'https://www.paypal.me/MatteoMonaco01']), s.importi);
  const r = await p.evaluate(() => { const d = document.querySelector('#dlg-vai').getBoundingClientRect(); const v = document.querySelector('#vai-ora').getBoundingClientRect(); const m = document.querySelector('#monete-vai').getBoundingClientRect(); const a = document.querySelector('#vai-ora'); return { top: d.top, bottom: d.bottom, vh: innerHeight, vaiTop: v.top, vaiH: v.height, moneteBottom: m.bottom, rel: a.rel, target: a.target }; });
  check('finestra tutta dentro lo schermo, VAI sopra le monete', r.top >= 0 && r.bottom <= r.vh && r.vaiTop < r.moneteBottom && r.vaiH >= 44, r);
  check('VAI AL POSTO apre in una scheda nuova senza referrer', r.target === '_blank' && /noopener/.test(r.rel) && /noreferrer/.test(r.rel), r);
  await p.screenshot({ path: out + '/vai-1.png' });
  // 2) VAI AL POSTO apre davvero Maps e chiude la finestra
  const [nuova] = await Promise.all([ctx.waitForEvent('page'), p.click('#vai-ora')]);
  await nuova.waitForLoadState().catch(() => {});
  check('VAI AL POSTO apre le indicazioni di Google Maps', nuova.url() === atteso, nuova.url());
  await nuova.close(); await p.bringToFront(); await p.waitForTimeout(800);
  check('dopo VAI la finestra è chiusa', !(await stato(p)).vai);
  // 3) "sempre": anche la seconda volta
  await p.locator('.card ' + VAI).nth(1).click(); await p.waitForTimeout(300);
  check('sempre: compare anche la seconda volta', (await stato(p)).vai);
  // 4) Esc chiude, e non apre niente
  pagine = ctx.pages().length; await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  check('Esc chiude senza aprire nulla', !(await stato(p)).vai && ctx.pages().length === pagine);
  // 5) CHIUDI
  await p.locator('.card ' + VAI).first().click(); await p.waitForTimeout(200); await p.click('#dlg-vai [data-chiudi]'); await p.waitForTimeout(200);
  check('CHIUDI chiude', !(await stato(p)).vai);
  // 6) una moneta apre PayPal in una scheda nuova, la finestra resta
  await p.locator('.card ' + VAI).first().click(); await p.waitForTimeout(200);
  const [pp] = await Promise.all([ctx.waitForEvent('page'), p.locator('#monete-vai a').first().click()]);
  check('la moneta da 1 € apre PayPal.Me/…/1EUR', pp.url() === 'https://www.paypal.me/MatteoMonaco01/1EUR', pp.url());
  await pp.close(); await p.bringToFront(); await p.waitForTimeout(200);
  check('dopo la moneta VAI AL POSTO è ancora lì', (await stato(p)).vai);
  await p.click('#dlg-vai [data-chiudi]');
  // 7) dal gettone
  await p.click('#gettone'); await p.waitForTimeout(600);
  const hg = await p.evaluate((s) => document.querySelector('#get-esito ' + s).href, VAI);
  await p.click('#get-esito ' + VAI); await p.waitForTimeout(300);
  s = await stato(p);
  check('gettone: si apre PRIMA DI ANDARE sopra il gettone', s.vai && s.href === hg && await p.evaluate(() => document.querySelector('#dlg-gettone').open), s);
  await p.screenshot({ path: out + '/vai-2-gettone.png' });
  await p.click('#dlg-vai [data-chiudi]'); await p.waitForTimeout(150);
  // 8) dal fumetto della mappa (i clic lì dentro non arrivano al documento)
  await p.click('[data-get=mappa]'); await p.waitForTimeout(1300);
  const hp = await p.evaluate((s) => document.querySelector('.leaflet-popup-content ' + s).href, VAI);
  pagine = ctx.pages().length;
  await p.click('.leaflet-popup-content ' + VAI); await p.waitForTimeout(300);
  s = await stato(p);
  check('fumetto: si apre PRIMA DI ANDARE', s.vai && s.href === hp && ctx.pages().length === pagine, s);
  await p.screenshot({ path: out + '/vai-3-mappa.png' });
  await p.click('#dlg-vai [data-chiudi]');
  // 9) "Dona una moneta" funziona ancora
  await p.click('.leaflet-popup-content button.moneta'); await p.waitForTimeout(200);
  check('Dona una moneta apre ancora la sua finestra', await p.evaluate(() => document.querySelector('#dlg-moneta').open && document.querySelectorAll('#monete a').length === 4));
  check('nessun errore in pagina', err.length === 0, err);
  await ctx.close();

  // ===== monetaPrima: "una" =====
  ({ ctx, p, err } = await nuovo((t) => t.replace('monetaPrima: "sempre"', 'monetaPrima: "una"')));
  await p.locator('.card ' + VAI).first().click(); await p.waitForTimeout(250);
  check('una: la prima volta compare', (await stato(p)).vai);
  await p.click('#dlg-vai [data-chiudi]');
  const [m2] = await Promise.all([ctx.waitForEvent('page'), p.locator('.card ' + VAI).nth(1).click()]);
  check('una: la seconda volta va dritto a Maps', /google\.com\/maps\/dir/.test(m2.url()) && !(await stato(p)).vai, m2.url());
  await ctx.close();

  // ===== monetaPrima: "mai" =====
  ({ ctx, p, err } = await nuovo((t) => t.replace('monetaPrima: "sempre"', 'monetaPrima: "mai"')));
  const [m3] = await Promise.all([ctx.waitForEvent('page'), p.locator('.card ' + VAI).first().click()]);
  check('mai: va dritto a Maps', /google\.com\/maps\/dir/.test(m3.url()) && !(await stato(p)).vai);
  check('mai: la moneta resta in fondo alla pagina', await p.evaluate(() => !!document.querySelector('#moneta-fondo button.moneta')));
  await ctx.close();

  // ===== senza link di donazione =====
  ({ ctx, p, err } = await nuovo((t) => t.replace(/donazione: "[^"]*"/, 'donazione: ""')));
  const [m4] = await Promise.all([ctx.waitForEvent('page'), p.locator('.card ' + VAI).first().click()]);
  check('senza link: va dritto a Maps, nessuna moneta', /google\.com\/maps\/dir/.test(m4.url()) && !(await stato(p)).vai && await p.evaluate(() => document.querySelectorAll('button.moneta').length === 0));
  check('senza link: nessun errore', err.length === 0, err);
  await ctx.close();

  // ===== computer =====
  const cd = await b.newContext({ viewport: { width: 1366, height: 800 } });
  await cd.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
  const pd = await cd.newPage(); await pd.goto('http://localhost:8765/index.html'); await pd.waitForTimeout(400);
  await pd.evaluate(() => document.querySelector('button[data-livello="Trastevere"]').click()); await pd.waitForTimeout(500);
  await pd.locator('.card ' + VAI).first().click(); await pd.waitForTimeout(300);
  check('computer: si apre', await pd.evaluate(() => document.querySelector('#dlg-vai').open));
  await pd.screenshot({ path: out + '/vai-4-computer.png' });
  await cd.close();

  await b.close();
  console.log(ok.length + ' ok, ' + ko.length + ' falliti'); ko.forEach((x) => console.log('FALLITO: ' + x));
})();
