// La donazione su tutti i pulsanti della scheda: "Portami lì", "Apri su Maps", "Proponilo". E dove NON deve comparire.
//   node dona-bottoni.js <cartella foto> [indirizzo]
const { chromium, devices } = require('playwright');
const out = process.argv[2];
const BASE = process.argv[3] || 'http://localhost:8765/index.html';
const LOCALE = /localhost/.test(BASE);
const ok = [], ko = [];
const check = (n, c, x) => (c ? ok : ko).push(n + (x !== undefined ? ' → ' + JSON.stringify(x) : ''));
const VAI = 'a[href^="https://www.google.com/maps/dir/"]', MAPS = 'a[href^="https://www.google.com/maps/search/"]';
const PAYPAL = ['https://www.paypal.me/MatteoMonaco01/1EUR', 'https://www.paypal.me/MatteoMonaco01/2EUR', 'https://www.paypal.me/MatteoMonaco01/5EUR', 'https://www.paypal.me/MatteoMonaco01'];
(async () => {
  const b = await chromium.launch();
  const nuovo = async ({ cfg, url = BASE, dispositivo = devices['iPhone 13'], conta = LOCALE, livello = 'Trastevere' } = {}) => {
    const ctx = await b.newContext({ ...dispositivo, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => {
      try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {}
      Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: async () => {} });
    });
    const eventi = [];
    await ctx.route(/google\.com|paypal\.|wa\.me|whatsapp\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>esterno</title>' }));
    await ctx.route('https://finto.supabase.co/**', (r) => { const q = r.request(); if (/\/rpc\/conta$/.test(q.url())) eventi.push(...(JSON.parse(q.postData() || '{}').p_eventi || [])); r.fulfill({ status: 204, body: '' }); });
    const p = await ctx.newPage(); const err = [];
    p.on('pageerror', (e) => err.push(String(e).slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text().slice(0, 200)); });
    if (conta || cfg) await p.route('**/config.js', async (route) => {
      let r = null, t;
      if (LOCALE) { r = await route.fetch(); t = await r.text(); }
      else t = require('child_process').execSync('curl -sS -m 30 ' + new URL('config.js', BASE).href).toString();   // da Node la rete non passa: si prende con curl
      if (conta) t = t.replace(/supabaseUrl: "[^"]*"/, 'supabaseUrl: "https://finto.supabase.co/"').replace(/supabaseKey: "[^"]*"/, 'supabaseKey: "sb_publishable_finta"').replace('conto: true', 'conto: false');
      if (cfg) t = cfg(t);
      await route.fulfill(r ? { response: r, body: t } : { status: 200, contentType: 'text/javascript', body: t });
    });
    await p.goto(url); await p.waitForTimeout(500);
    if (livello) { await p.evaluate((l) => { const q = document.querySelector(`button[data-livello="${l}"]`); if (q) q.click(); }, livello); await p.waitForTimeout(500); }
    const quanti = (e) => eventi.filter((x) => x === e).length;
    return { ctx, p, err, eventi, quanti };
  };
  const stato = (p) => p.evaluate(() => { const v = document.querySelector('#vai-ora'); return { vai: document.querySelector('#dlg-vai').open, href: v.getAttribute('href'), testo: v.textContent.trim(), importi: [...document.querySelectorAll('#monete-vai a')].map((a) => a.getAttribute('href')), fuoco: document.activeElement && document.activeElement.id }; });
  const invito = (p) => p.evaluate(() => {
    const d = document.querySelector('#dlg-invito'), box = d.querySelector('.dona-box'), invia = d.querySelector('.get-acts'), r = (e) => e && e.getBoundingClientRect();
    return { aperto: d.open, titolo: d.querySelector('#inv-t').textContent, box: !!box, importi: box ? [...box.querySelectorAll('.monete a')].map((a) => a.getAttribute('href')) : [],
      domanda: box ? box.querySelector('h3').textContent.trim() : '', avvertenze: !!(box && box.nextElementSibling && /maggiorenni/.test(box.nextElementSibling.textContent)),
      inviaSopra: !!(box && invia && r(invia).bottom <= r(box).top), domandaInVista: !!(box && r(box.querySelector('h3')).bottom <= innerHeight), inviaInVista: !!(invia && r(invia).top >= 0 && r(invia).bottom <= innerHeight),
      doppioni: document.querySelectorAll('#monete-vai').length, largo: d.scrollWidth - d.clientWidth, corpoLargo: d.querySelector('.corpo').scrollWidth - d.querySelector('.corpo').clientWidth };
  });

  // ===== monetaPrima: "sempre" (com'è sul sito) =====
  let { ctx, p, err, eventi, quanti } = await nuovo();
  // --- Apri su Maps, dalla scheda
  const hMaps = await p.evaluate((s) => document.querySelector('.card ' + s).href, MAPS);
  let pagine = ctx.pages().length;
  await p.locator('.card ' + MAPS).first().click(); await p.waitForTimeout(300);
  let s = await stato(p);
  check('Apri su Maps (scheda): si apre PRIMA DI ANDARE, niente scheda nuova', s.vai && ctx.pages().length === pagine, s);
  check('Apri su Maps: il pulsante in cima dice APRI SU MAPS e porta alla pagina del posto', s.testo === '▶ APRI SU MAPS' && s.href === hMaps, s);
  check('Apri su Maps: le quattro monete verso PayPal', JSON.stringify(s.importi) === JSON.stringify(PAYPAL), s.importi);
  check('Apri su Maps: il fuoco è sul pulsante per proseguire', s.fuoco === 'vai-ora', s.fuoco);
  if (LOCALE) check('Apri su Maps: finché non prosegui non conta "maps"', quanti('maps') === 0, eventi);
  await p.screenshot({ path: out + '/maps-1.png' });
  const [m1] = await Promise.all([ctx.waitForEvent('page'), p.click('#vai-ora')]);
  await m1.waitForLoadState().catch(() => {});
  check('APRI SU MAPS apre la pagina del posto su Google Maps', m1.url() === hMaps, m1.url());
  await m1.close(); await p.bringToFront(); await p.waitForTimeout(800);
  check('dopo APRI SU MAPS la finestra è chiusa', !(await stato(p)).vai);
  if (LOCALE) check('conta "maps" una volta, e nessun "vai" o "portami"', quanti('maps') === 1 && quanti('vai') === 0 && quanti('portami') === 0, eventi);
  // --- Portami lì subito dopo: l'etichetta torna quella giusta
  const hVai = await p.evaluate((s) => document.querySelector('.card ' + s).href, VAI);
  await p.locator('.card ' + VAI).first().click(); await p.waitForTimeout(300);
  s = await stato(p);
  check('Portami lì: come prima, VAI AL POSTO verso le indicazioni', s.vai && s.testo === '▶ VAI AL POSTO' && s.href === hVai, s);
  if (LOCALE) check('Portami lì: conta "portami", non ancora "vai"', quanti('portami') === 1 && quanti('vai') === 0, eventi);
  const [m2] = await Promise.all([ctx.waitForEvent('page'), p.click('#vai-ora')]); await m2.close(); await p.bringToFront(); await p.waitForTimeout(800);
  if (LOCALE) check('VAI AL POSTO: conta "vai", "maps" resta a 1', quanti('vai') === 1 && quanti('maps') === 1, eventi);
  // --- e di nuovo Maps: l'etichetta cambia di nuovo
  await p.locator('.card ' + MAPS).nth(1).click(); await p.waitForTimeout(300);
  s = await stato(p);
  check('sempre: Apri su Maps compare anche la seconda volta, con la sua etichetta', s.vai && s.testo === '▶ APRI SU MAPS', s);
  pagine = ctx.pages().length; await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  check('Esc chiude senza aprire nulla', !(await stato(p)).vai && ctx.pages().length === pagine);
  // --- il link alla lista su Google, in fondo alla pagina, resta diretto
  const [lf] = await Promise.all([ctx.waitForEvent('page'), p.evaluate(() => document.querySelector('#fonte').click())]);
  await lf.waitForLoadState().catch(() => {});
  check('link alla lista Google in fondo: si apre diretto, nessuna finestra', /google\.com\/maps\/placelists/.test(lf.url()) && !(await stato(p)).vai, lf.url());
  await lf.close(); await p.bringToFront();

  // --- Proponilo, dalla scheda
  await p.locator('.card [data-invita]').first().click(); await p.waitForTimeout(300);
  let v = await invito(p);
  check('Proponilo: la finestra si apre subito (nessun passaggio in più)', v.aperto && v.titolo === 'PROPONILO' && !(await stato(p)).vai, v);
  check('Proponilo: c’è il riquadro "Vuoi fare una donazione?" con le quattro monete', v.box && /donazione/i.test(v.domanda) && JSON.stringify(v.importi) === JSON.stringify(PAYPAL), v);
  check('Proponilo: ci sono le avvertenze (maggiorenni, non detraibile, rimborso)', v.avvertenze, v);
  check('Proponilo: i pulsanti per mandare stanno sopra il riquadro e si vedono senza scorrere', v.inviaSopra && v.inviaInVista, v);
  check('Proponilo: la domanda "Vuoi fare una donazione?" si vede appena si apre la finestra', v.domandaInVista, v);
  check('Proponilo: nessun doppione di identificativi, niente scorrimento laterale', v.doppioni === 1 && v.largo <= 0 && v.corpoLargo <= 0, v);
  await p.screenshot({ path: out + '/proponilo-1.png' });
  await p.evaluate(() => document.querySelector('#dlg-invito .dona-box').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
  await p.screenshot({ path: out + '/proponilo-2-riquadro.png' });
  const [pp] = await Promise.all([ctx.waitForEvent('page'), p.locator('#dlg-invito .dona-box .monete a').nth(1).click()]);
  check('Proponilo: la moneta da 2 € apre PayPal.Me/…/2EUR', pp.url() === PAYPAL[1], pp.url());
  await pp.close(); await p.bringToFront(); await p.waitForTimeout(300);
  check('Proponilo: dopo la moneta la finestra resta aperta', (await invito(p)).aperto);
  if (LOCALE) check('Proponilo: conta invito_apri e dona_2', quanti('invito_apri') === 1 && quanti('dona_2') === 1, eventi);
  // cambiare il momento ridisegna la finestra: il riquadro resta
  await p.locator('#dlg-invito [data-inv=quando]').nth(1).click(); await p.waitForTimeout(200);
  v = await invito(p);
  check('Proponilo: cambiando il momento il riquadro resta, una volta sola', v.box && await p.evaluate(() => document.querySelectorAll('#dlg-invito .dona-box').length === 1), v);
  // mandare funziona ancora
  await p.click('#dlg-invito [data-inv=condividi]'); await p.waitForTimeout(300);
  if (LOCALE) check('Proponilo: Invia conta ancora invito_manda', quanti('invito_manda') === 1, eventi);
  await p.click('#dlg-invito [data-chiudi]'); await p.waitForTimeout(200);

  // --- dal fumetto della mappa
  await p.locator('.card h4 button').first().click(); await p.waitForTimeout(1500);
  const hp = await p.evaluate((s) => { const a = document.querySelector('.leaflet-popup-content ' + s); return a && a.href; }, MAPS);
  if (hp) {
    pagine = ctx.pages().length;
    await p.click('.leaflet-popup-content ' + MAPS); await p.waitForTimeout(300);
    s = await stato(p);
    check('fumetto della mappa: Apri su Maps apre PRIMA DI ANDARE', s.vai && s.href === hp && s.testo === '▶ APRI SU MAPS' && ctx.pages().length === pagine, s);
    await p.screenshot({ path: out + '/maps-2-fumetto.png' });
    await p.click('#dlg-vai [data-chiudi]');
  } else check('fumetto della mappa: trovato', false);
  check('sempre: nessun errore in pagina', err.length === 0, err);
  await ctx.close();

  // ===== chi riceve un invito: niente richiesta di denaro prima di rispondere =====
  const id = '3935991939893424995';   // Enoteca Corsi
  ({ ctx, p, err, eventi, quanti } = await nuovo({ url: BASE + '?posto=' + id + '&m=c&da=amici', livello: '' }));
  v = await invito(p);
  check('chi riceve: l’invito si apre senza riquadro della donazione', v.aperto && !v.box, v);
  await p.click('#dlg-invito [data-inv=si]'); await p.waitForTimeout(200);
  v = await invito(p);
  check('chi riceve: nemmeno nella risposta "Ci sto!"', v.aperto && !v.box, v);
  await p.click('#dlg-invito ' + VAI); await p.waitForTimeout(300);
  s = await stato(p);
  check('chi riceve: su "Portami lì" la finestra PRIMA DI ANDARE c’è, come dappertutto', s.vai && s.testo === '▶ VAI AL POSTO', s);
  check('chi riceve: nessun errore', err.length === 0, err);
  await ctx.close();

  // ===== monetaPrima: "una" =====
  ({ ctx, p, err } = await nuovo({ cfg: (t) => t.replace('monetaPrima: "sempre"', 'monetaPrima: "una"') }));
  await p.locator('.card ' + MAPS).first().click(); await p.waitForTimeout(250);
  check('una: la prima volta (Apri su Maps) compare', (await stato(p)).vai);
  await p.click('#dlg-vai [data-chiudi]');
  const [u2] = await Promise.all([ctx.waitForEvent('page'), p.locator('.card ' + VAI).first().click()]);
  check('una: poi Portami lì va dritto', /google\.com\/maps\/dir/.test(u2.url()) && !(await stato(p)).vai, u2.url());
  await u2.close(); await p.bringToFront();
  const [u3] = await Promise.all([ctx.waitForEvent('page'), p.locator('.card ' + MAPS).nth(1).click()]);
  check('una: e anche Apri su Maps va dritto', /google\.com\/maps\/search/.test(u3.url()) && !(await stato(p)).vai, u3.url());
  await u3.close(); await p.bringToFront();
  await p.locator('.card [data-invita]').first().click(); await p.waitForTimeout(250);
  check('una: in Proponilo il riquadro c’è', (await invito(p)).box);
  await ctx.close();

  // ===== monetaPrima: "mai" =====
  ({ ctx, p, err } = await nuovo({ cfg: (t) => t.replace('monetaPrima: "sempre"', 'monetaPrima: "mai"') }));
  const [n1] = await Promise.all([ctx.waitForEvent('page'), p.locator('.card ' + MAPS).first().click()]);
  check('mai: Apri su Maps va dritto', /google\.com\/maps\/search/.test(n1.url()) && !(await stato(p)).vai, n1.url());
  await n1.close(); await p.bringToFront();
  await p.locator('.card [data-invita]').first().click(); await p.waitForTimeout(250);
  v = await invito(p);
  check('mai: Proponilo senza riquadro', v.aperto && !v.box, v);
  check('mai: nessun errore', err.length === 0, err);
  await ctx.close();

  // ===== senza link di donazione =====
  ({ ctx, p, err } = await nuovo({ cfg: (t) => t.replace(/donazione: "[^"]*"/, 'donazione: ""') }));
  const [z1] = await Promise.all([ctx.waitForEvent('page'), p.locator('.card ' + MAPS).first().click()]);
  check('senza link: Apri su Maps va dritto', /google\.com\/maps\/search/.test(z1.url()) && !(await stato(p)).vai, z1.url());
  await z1.close(); await p.bringToFront();
  await p.locator('.card [data-invita]').first().click(); await p.waitForTimeout(250);
  v = await invito(p);
  check('senza link: Proponilo senza riquadro, nessun errore', v.aperto && !v.box && err.length === 0, { v, err });
  await ctx.close();

  // ===== telefono stretto (320) e computer =====
  ({ ctx, p, err } = await nuovo({ dispositivo: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent } }));
  await p.locator('.card [data-invita]').first().click(); await p.waitForTimeout(300);
  v = await invito(p);
  const pagina = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check('320 px: Proponilo con riquadro, niente scorrimento laterale', v.box && v.largo <= 0 && v.corpoLargo <= 0 && pagina <= 0, { v, pagina });
  await p.evaluate(() => document.querySelector('#dlg-invito .dona-box').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
  const monete = await p.evaluate(() => [...document.querySelectorAll('#dlg-invito .dona-box .monete a')].map((a) => { const r = a.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), a.scrollWidth > a.clientWidth]; }));
  check('320 px: le monete si toccano bene (almeno 44 px) e non traboccano', monete.every((m) => m[0] >= 44 && m[1] >= 44 && !m[2]), monete);
  await p.screenshot({ path: out + '/proponilo-3-stretto.png' });
  await p.click('#dlg-invito [data-chiudi]');
  await p.locator('.card ' + MAPS).first().click(); await p.waitForTimeout(300);
  const st = await p.evaluate(() => { const d = document.querySelector('#dlg-vai').getBoundingClientRect(), a = document.querySelector('#vai-ora'); return { top: d.top, bottom: d.bottom, vh: innerHeight, trabocca: a.scrollWidth > a.clientWidth, h: a.getBoundingClientRect().height }; });
  check('320 px: PRIMA DI ANDARE con APRI SU MAPS sta nello schermo e l’etichetta non trabocca', st.top >= 0 && st.bottom <= st.vh && !st.trabocca && st.h >= 44, st);
  const mv = await p.evaluate(() => [...document.querySelectorAll('#monete-vai a')].map((a) => { const r = a.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), a.scrollWidth > a.clientWidth]; }));
  check('320 px: anche in PRIMA DI ANDARE le monete sono larghe almeno 44 px', mv.every((m) => m[0] >= 44 && m[1] >= 44 && !m[2]), mv);
  await p.screenshot({ path: out + '/maps-3-stretto.png' });
  await ctx.close();

  ({ ctx, p, err } = await nuovo({ dispositivo: { viewport: { width: 1366, height: 800 } } }));
  await p.locator('.card [data-invita]').first().click(); await p.waitForTimeout(300);
  check('computer: Proponilo con riquadro', (await invito(p)).box);
  await p.screenshot({ path: out + '/proponilo-4-computer.png' });
  await ctx.close();

  await b.close();
  console.log(ok.length + ' ok, ' + ko.length + ' falliti'); ko.forEach((x) => console.log('FALLITO: ' + x));
})();
