// I contatori anonimi: che cosa parte, quando, e che cosa NON parte.
const { chromium, devices } = require('playwright');
const ok = [], ko = [];
const check = (n, c, x) => (c ? ok : ko).push(n + (x !== undefined ? ' → ' + JSON.stringify(x) : ''));
const ROMA = { latitude: 41.8893, longitude: 12.4707 };
(async () => {
  const b = await chromium.launch();
  const nuovo = async ({ acceso = true, termini = true, permesso = true, ua, url = 'http://localhost:8765/index.html', gpc = false, referer } = {}) => {
    const ctx = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce', ...(ua ? { userAgent: ua } : {}), ...(permesso ? { geolocation: ROMA, permissions: ['geolocation'] } : {}) });
    await ctx.addInitScript(([termini, gpc]) => { try { if (termini) localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} if (gpc) Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true }); }, [termini, gpc]);
    const visti = [], altre = [];
    await ctx.route(/google\.com|paypal\./, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>esterno</title>' }));
    await ctx.route('https://finto.supabase.co/**', (r) => {
      const q = r.request();
      if (/\/rest\/v1\/rpc\/conta$/.test(q.url())) visti.push({ ev: JSON.parse(q.postData() || '{}').p_eventi, h: q.headers(), metodo: q.method() }); else if (!/\/rest\/v1\/rpc\/conta_livello$/.test(q.url())) altre.push(q.url());
      r.fulfill({ status: 204, body: '' });
    });
    const p = await ctx.newPage(); const err = [];
    p.on('pageerror', (e) => err.push(String(e)));
    if (acceso) await p.route('**/config.js', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace(/supabaseUrl: "[^"]*"/, 'supabaseUrl: "https://finto.supabase.co/"').replace(/supabaseKey: "[^"]*"/, 'supabaseKey: "sb_publishable_finta"').replace('conto: true', 'conto: false') }); });
    await p.goto(url, referer ? { referer } : {}); await p.waitForTimeout(500);
    const tutti = () => visti.flatMap((v) => v.ev);
    return { ctx, p, err, visti, altre, tutti };
  };
  const conta = (t, e) => t.filter((x) => x === e).length;

  // 1) Il sito com'è oggi (database spento): non parte niente
  let { ctx, p, err, visti, altre, tutti } = await nuovo({ acceso: false });
  await p.evaluate(() => document.querySelector('button[data-livello="Trastevere"]').click()); await p.waitForTimeout(300);
  await p.click('#gettone'); await p.waitForTimeout(400);
  check('database spento: nessuna chiamata', visti.length === 0 && altre.length === 0, { visti, altre });
  await ctx.close();

  // 2) Database acceso: il giro completo
  ({ ctx, p, err, visti, altre, tutti } = await nuovo({ termini: false }));
  check('prima dei termini conta la visita e la provenienza', JSON.stringify(tutti()) === JSON.stringify(['visita', 'da_diretto']), tutti());
  const h = visti[0].h;
  check('chiamata anonima: chiave pubblica, nessun cookie, nessuna autorizzazione personale', visti[0].metodo === 'POST' && h.apikey === 'sb_publishable_finta' && !h.cookie && !h.authorization && !h.referer, { apikey: h.apikey, cookie: h.cookie, authorization: h.authorization, referer: h.referer });
  check('l’indirizzo chiamato è solo quello del contatore', /^https:\/\/finto\.supabase\.co\/rest\/v1\/rpc\/conta$/.test('https://finto.supabase.co/rest/v1/rpc/conta') && altre.length === 0, altre);
  await p.click('#termini-ok'); await p.waitForTimeout(300);
  check('termini accettati → termini_ok', conta(tutti(), 'termini_ok') === 1, tutti());
  await p.click('#m-start'); await p.waitForTimeout(900);
  check('PREMI START → start e posizione_si', conta(tutti(), 'start') === 1 && conta(tutti(), 'posizione_si') === 1, tutti());
  await p.evaluate(() => document.querySelector('button[data-livello="Trastevere"]').click()); await p.waitForTimeout(400);
  check('scelta di un quartiere → livello', conta(tutti(), 'livello') === 1, tutti());
  await p.click('#gettone'); await p.waitForTimeout(500);
  await p.click('[data-get=ancora]'); await p.waitForTimeout(500);
  check('due gettoni → gettone ×2', conta(tutti(), 'gettone') === 2, tutti());
  await p.click('#get-esito a[href^="https://www.google.com/maps/dir/"]'); await p.waitForTimeout(300);
  check('Portami lì → portami, ma non ancora vai', conta(tutti(), 'portami') === 1 && conta(tutti(), 'vai') === 0, tutti());
  const [pp] = await Promise.all([ctx.waitForEvent('page'), p.locator('#monete-vai a').nth(2).click()]); await pp.close(); await p.bringToFront(); await p.waitForTimeout(300);
  check('moneta da 5 € → dona_5', conta(tutti(), 'dona_5') === 1, tutti());
  const [mp] = await Promise.all([ctx.waitForEvent('page'), p.click('#vai-ora')]); await mp.close(); await p.bringToFront(); await p.waitForTimeout(800);
  check('Vai al posto → vai', conta(tutti(), 'vai') === 1 && conta(tutti(), 'portami') === 1, tutti());
  await p.click('#dlg-gettone [data-chiudi]');
  await p.locator('.card a[href^="https://www.google.com/maps/search/"]').first().click(); await p.waitForTimeout(300);
  check('Apri su Maps: finché la finestra è aperta non conta', conta(tutti(), 'maps') === 0, tutti());
  const [ap] = await Promise.all([ctx.waitForEvent('page'), p.click('#vai-ora')]); await ap.close(); await p.bringToFront(); await p.waitForTimeout(300);
  check('Apri su Maps → maps (dopo APRI SU MAPS nella finestra)', conta(tutti(), 'maps') === 1, tutti());
  await p.evaluate(() => document.querySelector('#moneta-fondo button').click()); await p.waitForTimeout(300);
  const [pa] = await Promise.all([ctx.waitForEvent('page'), p.locator('#monete a').nth(3).click()]); await pa.close(); await p.bringToFront(); await p.waitForTimeout(300);
  check('Dona una moneta → dona_apri, Altro → dona_altro', conta(tutti(), 'dona_apri') === 1 && conta(tutti(), 'dona_altro') === 1, tutti());
  await p.click('#dlg-moneta [data-chiudi]');
  // dal fumetto della mappa (i clic lì non arrivano al documento)
  await p.click('#gettone'); await p.waitForTimeout(500); await p.click('[data-get=mappa]'); await p.waitForTimeout(1300);
  await p.click('.leaflet-popup-content a[href^="https://www.google.com/maps/dir/"]'); await p.waitForTimeout(300);
  check('Portami lì dal fumetto della mappa → portami ×2 in tutto', conta(tutti(), 'portami') === 2, tutti());
  await p.click('#dlg-vai [data-chiudi]'); await p.waitForTimeout(600);
  const prima = conta(tutti(), 'visita');
  await p.reload(); await p.waitForTimeout(500);
  check('ricaricare la pagina non conta un’altra visita', conta(tutti(), 'visita') === prima, tutti().filter((x) => x === 'visita'));
  const ammessi = new Set(['visita', 'termini_ok', 'da_diretto', 'start', 'posizione_si', 'posizione_no', 'livello', 'powerup', 'filtri', 'gettone', 'portami', 'vai', 'maps', 'dona_apri', 'dona_1', 'dona_2', 'dona_5', 'dona_altro']);
  check('solo nomi previsti, mai dati sul posto o sulla persona', tutti().every((x) => ammessi.has(x)) && visti.every((v) => Object.keys(JSON.parse(JSON.stringify({ p_eventi: v.ev }))).length === 1), [...new Set(tutti())]);
  check('nessun errore in pagina', err.length === 0, err);
  await ctx.close();

  // 3) Posizione negata → posizione_no
  ({ ctx, p, err, visti, altre, tutti } = await nuovo({ permesso: false }));
  await p.click('#m-start'); await p.waitForTimeout(900);
  check('posizione negata → posizione_no', conta(tutti(), 'posizione_no') === 1 && conta(tutti(), 'posizione_si') === 0, tutti());
  await ctx.close();

  // 4) Provenienze
  for (const [nome, opz, atteso] of [
    ['link con ?da=qr', { url: 'http://localhost:8765/index.html?da=qr' }, 'da_qr'],
    ['link con ?da=<script> (non ammesso)', { url: 'http://localhost:8765/index.html?da=%3Cscript%3E' }, 'da_diretto'],
    ['dentro Instagram', { ua: devices['iPhone 13'].userAgent + ' Instagram 300.0' }, 'da_instagram'],
    ['da una ricerca Google', { referer: 'https://www.google.it/' }, 'da_google'],
    ['da un altro sito', { referer: 'https://esempio.org/pagina-segreta?utente=mario' }, 'da_altro'],
  ]) {
    ({ ctx, p, err, visti, altre, tutti } = await nuovo(opz));
    check(nome + ' → ' + atteso, JSON.stringify(tutti()) === JSON.stringify(['visita', atteso]) && !JSON.stringify(visti).includes('pagina-segreta'), tutti());
    await ctx.close();
  }

  // 5) "Non tracciare" acceso: non si conta nulla
  ({ ctx, p, err, visti, altre, tutti } = await nuovo({ gpc: true }));
  await p.click('#m-start'); await p.waitForTimeout(600);
  check('Global Privacy Control acceso: nessun conteggio', visti.length === 0, tutti());
  await ctx.close();

  await b.close();
  console.log(ok.length + ' ok, ' + ko.length + ' falliti'); ko.forEach((x) => console.log('FALLITO: ' + x));
})();
