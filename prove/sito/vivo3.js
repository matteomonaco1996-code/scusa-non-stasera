// Prova del sito pubblicato (https://ristomat.click), come un visitatore nuovo.
const { chromium, devices } = require('playwright');
const out = process.argv[2];
const ok = [], ko = [];
const check = (n, c, x) => (c ? ok : ko).push(n + (x !== undefined && !c ? ' → ' + JSON.stringify(x) : ''));
const B = 'https://ristomat.click/';
const ROMA = { latitude: 41.8893, longitude: 12.4707 };
(async () => {
  const b = await chromium.launch();
  const sessione = async (opz) => {
    const ctx = await b.newContext({ ...opz });
    await ctx.route(/google\.com|paypal\./, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>esterno</title>' }));
    const p = await ctx.newPage(); const guai = { errori: [], rotte: [], fuori: [] };
    p.on('pageerror', (e) => guai.errori.push(String(e)));
    p.on('console', (m) => { if (m.type() === 'error') guai.errori.push(m.text()); });
    p.on('response', (r) => { if (r.status() >= 400) guai.rotte.push(r.status() + ' ' + r.url()); });
    p.on('request', (r) => { const u = r.url(); if (!u.startsWith(B) && !u.startsWith('data:') && !u.startsWith('blob:') && !/google\.com|paypal\./.test(u) && !/^https:\/\/swjaorxphkfigqwgonqq\.supabase\.co\/rest\/v1\/rpc\/conta(_livello)?$/.test(u)) guai.fuori.push(u); });
    return { ctx, p, guai };
  };

  // ===== Telefono, prima visita =====
  let { ctx, p, guai } = await sessione({ ...devices['iPhone 13'], geolocation: ROMA, permissions: ['geolocation'] });
  await ctx.addInitScript(() => { navigator.permissions.query = async () => ({ state: 'prompt' }); });
  const r0 = await p.goto(B + '?t=' + Date.now()); await p.waitForTimeout(1200);
  check('la pagina si apre in https', r0.status() === 200 && p.url().startsWith('https://ristomat.click/'), [r0.status(), p.url()]);
  let s = await p.evaluate(() => ({ titolo: document.title, termini: document.querySelector('#dlg-termini').open, posti: window.RISTOMAT.length, agg: window.RISTOMAT_META.aggiornato, hi: document.querySelector('#hi').textContent }));
  check('titolo e dati caricati', /Scusa, non stasera/.test(s.titolo) && s.posti > 600 && Number(s.hi) === s.posti, s);
  check('prima visita: chiede di accettare i termini', s.termini, s);
  await p.click('#termini-ok'); await p.waitForTimeout(500);
  check('poi propone la posizione', await p.evaluate(() => document.querySelector('#dlg-posizione').open));
  await p.click('#pos-corpo [data-pos=attiva]'); await p.waitForTimeout(1500);
  s = await p.evaluate(() => ({ pos: document.querySelector('#dlg-posizione').open, tit: document.querySelector('#titolo-ris').textContent, lv: document.querySelector('#lv').textContent, schede: document.querySelectorAll('.card').length, dist: document.querySelector('.card .dist')?.textContent, primo: document.querySelector('.card h4')?.textContent }));
  check('attiva la posizione: posti vicini con la distanza', !s.pos && s.tit === 'Vicino a te' && s.schede > 0 && /min|km|m\b/.test(s.dist || ''), s);
  await p.screenshot({ path: out + '/vivo-1-vicino.png' });
  // gettone vicino
  await p.click('#gettone'); await p.waitForSelector('#get-esito a.btn', { timeout: 5000 }); await p.waitForTimeout(200);
  s = await p.evaluate(() => ({ aperto: document.querySelector('#dlg-gettone').open, nome: document.querySelector('#rullo')?.textContent, info: document.querySelector('.get-info')?.textContent, vai: document.querySelector('#get-esito a.btn')?.href, moneta: !!document.querySelector('#get-esito button.moneta') }));
  check('gettone: pesca un posto vicino, con indicazioni e moneta', s.aperto && s.nome && /minuti a piedi|più vicini/.test(s.info) && /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1/.test(s.vai) && s.moneta, s);
  await p.click('#get-esito a.btn'); await p.waitForTimeout(400);
  s = await p.evaluate(() => ({ vai: document.querySelector('#dlg-vai').open, href: document.querySelector('#vai-ora').href, monete: [...document.querySelectorAll('#monete-vai a')].map((a) => a.href), box: !!document.querySelector('#dlg-vai .dona-box') }));
  check('Portami lì: finestra con Vai al posto e donazione in riquadro', s.vai && /maps\/dir/.test(s.href) && s.box && JSON.stringify(s.monete) === JSON.stringify(['https://www.paypal.me/MatteoMonaco01/1EUR', 'https://www.paypal.me/MatteoMonaco01/2EUR', 'https://www.paypal.me/MatteoMonaco01/5EUR', 'https://www.paypal.me/MatteoMonaco01']), s);
  const [nuova] = await Promise.all([ctx.waitForEvent('page'), p.click('#vai-ora')]);
  check('Vai al posto apre Google Maps in un’altra scheda', /^https:\/\/www\.google\.com\/maps\/dir\//.test(nuova.url()), nuova.url());
  await nuova.close(); await p.bringToFront(); await p.click('#dlg-gettone [data-chiudi]');
  // restart, quartiere, mappa
  await p.click('[data-restart]:visible'); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('button[data-livello="Monti"]').click()); await p.waitForTimeout(700);
  s = await p.evaluate(() => ({ tit: document.querySelector('#titolo-ris').textContent, n: document.querySelectorAll('.card').length, cont: document.querySelector('#conteggio').textContent, hint: !document.querySelector('#hint-gettone').hidden }));
  check('restart e scelta di un quartiere (Monti)', s.tit === 'Monti' && s.n > 0, s);
  await p.click('[data-view=mappa]'); await p.waitForTimeout(1500);
  s = await p.evaluate(() => ({ segnaposti: document.querySelectorAll('.leaflet-marker-icon').length, strade: document.querySelectorAll('.leaflet-overlay-pane path, .leaflet-overlay-pane canvas').length, alto: Math.round(document.querySelector('#mappa').getBoundingClientRect().height) }));
  check('mappa: strade e segnaposti disegnati', s.segnaposti > 0 && s.strade > 0 && s.alto > 300, s);
  // tocco un segnaposto che sta dentro la parte visibile della mappa
  const dove = await p.evaluate(() => { const m = document.querySelector('#mappa').getBoundingClientRect(); const k = [...document.querySelectorAll('.leaflet-marker-icon')].map((e) => e.getBoundingClientRect()).find((r) => r.width > 0 && r.left > m.left + 30 && r.right < m.right - 30 && r.top > m.top + 120 && r.bottom < Math.min(m.bottom, innerHeight) - 40); return k ? { x: k.left + k.width / 2, y: k.top + k.height / 2 } : null; });
  if (dove) { await p.touchscreen.tap(dove.x, dove.y); await p.waitForTimeout(800); }
  s = await p.evaluate(() => ({ fumetto: document.querySelector('.leaflet-popup-content')?.innerText.replace(/\s+/g, ' '), moneta: !!document.querySelector('.leaflet-popup-content button.moneta') }));
  check('toccando un segnaposto si apre il fumetto con la moneta', !!s.fumetto && /Portami lì/.test(s.fumetto) && s.moneta, s);
  await p.screenshot({ path: out + '/vivo-2-mappa.png' });
  await p.click('[data-view=lista]'); await p.waitForTimeout(400);
  // ricerca e power-up
  await p.click('[data-restart]:visible'); await p.waitForTimeout(400);
  await p.fill('#q', 'carbonara'); await p.waitForTimeout(600);
  s = await p.evaluate(() => ({ n: document.querySelectorAll('.card').length, cont: document.querySelector('#conteggio').textContent }));
  check('ricerca «carbonara» trova qualcosa', s.n > 0, s);
  await p.fill('#q', ''); await p.waitForTimeout(400);
  const prima = await p.evaluate(() => document.querySelector('#conteggio').textContent);
  await p.evaluate(() => document.querySelector('[data-voglia="pizza"]').click()); await p.waitForTimeout(500);
  s = await p.evaluate(() => ({ cont: document.querySelector('#conteggio').textContent, tipi: [...new Set([...document.querySelectorAll('.card .tipo')].map((t) => t.textContent.trim()))] }));
  check('power-up Pizza: solo pizzerie', s.cont !== prima && s.tipi.length === 1, { prima, ...s });
  await p.evaluate(() => document.querySelector('[data-voglia="pizza"]').click());
  await p.evaluate(() => document.querySelector('[data-mondo="firenze"]').click()); await p.waitForTimeout(600);
  s = await p.evaluate(() => ({ tit: document.querySelector('#titolo-ris').textContent, n: document.querySelectorAll('.card').length }));
  check('cambio mondo: Firenze', /Firenze/.test(s.tit) && s.n > 0, s);
  // donazione dal menu
  await p.evaluate(() => scrollTo(0, 0)); await p.click('#m-dona'); await p.waitForTimeout(400);
  s = await p.evaluate(() => ({ aperta: document.querySelector('#dlg-moneta').open, testo: document.querySelector('#dlg-moneta .corpo').innerText.replace(/\s+/g, ' ').slice(0, 80), link: document.querySelectorAll('#monete a').length }));
  check('menu: Dona una moneta apre la finestra con le spiegazioni', s.aperta && /Che cos’è/.test(s.testo) && s.link === 4, s);
  await p.click('#dlg-moneta [data-chiudi]'); await p.waitForTimeout(700);
  check('fondo pagina: riquadro della donazione', await p.evaluate(() => !document.querySelector('#dona-fondo').hidden && !!document.querySelector('#moneta-fondo button')));
  // seconda visita: niente più finestre
  await p.reload(); await p.waitForTimeout(900);
  s = await p.evaluate(() => ({ termini: document.querySelector('#dlg-termini').open, aperte: [...document.querySelectorAll('dialog[open]')].map((d) => d.id) }));
  check('seconda visita: i termini non vengono richiesti di nuovo', !s.termini, s);
  console.log('nota: finestre aperte alla seconda visita (qui il permesso risulta sempre «da chiedere»):', JSON.stringify(s.aperte));
  check('telefono: nessuno scorrimento orizzontale', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  // contatori: con il database spento non parte nulla verso l'esterno
  check('nessuna richiesta verso altri server (a parte il contatore del sito)', guai.fuori.length === 0, guai.fuori.slice(0, 5));
  check('nessun file mancante (404)', guai.rotte.length === 0, guai.rotte.slice(0, 5));
  check('nessun errore nella pagina', guai.errori.length === 0, guai.errori.slice(0, 5));
  await ctx.close();

  // ===== Altre pagine =====
  ({ ctx, p, guai } = await sessione({ ...devices['iPhone 13'] }));
  for (const [pag, cosa] of [['privacy.html', /Versione 1\.5/], ['termini.html', /Versione 1\.1/], ['statistiche.html', /Area riservata/]]) {
    const r = await p.goto(B + pag + '?t=' + Date.now()); await p.waitForTimeout(500);
    check(pag + ' si apre', r.status() === 200 && cosa.test(await p.evaluate(() => document.body.innerText)), r.status());
  }
  check('statistiche.html non mostra numeri', await p.evaluate(() => document.querySelector('#cruscotto').hidden));
  for (const f of ['manifest.webmanifest', 'img/anteprima.png', 'img/icona-180.png', 'img/gettone.svg', '.well-known/security.txt', 'fonts/press-start-2p-latin-400-normal.woff2']) {
    const st = await p.evaluate((u) => fetch(u, { cache: 'no-store' }).then((r) => r.status, (e) => String(e)), B + f); check(f + ' raggiungibile', st === 200, st);
  }
  for (const f of ['in_breve.json', 'supabase/schema.sql', 'strumenti/descrizioni.py', 'README.md', '.git/config', 'chiusi.json']) {
    // 404 = non esiste; a volte il server risponde 503 per un attimo: conta che il contenuto non venga mai consegnato
    const st = await p.evaluate((u) => fetch(u, { cache: 'no-store' }).then(async (r) => ({ stato: r.status, lungo: (await r.text()).length }), (e) => ({ stato: String(e) })), B + f); check(f + ' NON pubblicato', st.stato === 404 || st.stato === 503, st);
  }
  check('altre pagine: nessun errore', guai.errori.filter((e) => !/404|503/.test(e)).length === 0 && guai.fuori.length === 0, guai);
  await ctx.close();

  // ===== Computer =====
  ({ ctx, p, guai } = await sessione({ viewport: { width: 1366, height: 800 } }));
  await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
  await p.goto(B + '?t=' + Date.now()); await p.waitForTimeout(1000);
  await p.evaluate(() => document.querySelector('button[data-livello="Testaccio"]').click()); await p.waitForTimeout(1200);
  s = await p.evaluate(() => { const l = document.querySelector('.list-col').getBoundingClientRect(), m = document.querySelector('#mappa').getBoundingClientRect(); return { fianco: m.left > l.left + 200 && m.width > 300, schede: document.querySelectorAll('.card').length, segnaposti: document.querySelectorAll('.leaflet-marker-icon').length, scorre: document.documentElement.scrollWidth > innerWidth + 1 }; });
  check('computer: lista e mappa affiancate', s.fianco && s.schede > 0 && s.segnaposti > 0 && !s.scorre, s);
  await p.screenshot({ path: out + '/vivo-3-computer.png' });
  check('computer: nessun errore', guai.errori.length === 0 && guai.rotte.length === 0, guai);
  await ctx.close();

  // ===== Telefono piccolo =====
  ({ ctx, p, guai } = await sessione({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true }));
  await p.goto(B + '?t=' + Date.now()); await p.waitForTimeout(900);
  s = await p.evaluate(() => { const d = document.querySelector('#dlg-termini'), r = d.getBoundingClientRect(), bt = document.querySelector('#termini-ok').getBoundingClientRect(); return { aperta: d.open, dentro: r.bottom <= innerHeight + 1 && bt.bottom <= innerHeight + 1 && bt.top >= 0, scorre: document.documentElement.scrollWidth > innerWidth + 1 }; });
  check('telefono piccolo: finestra dei termini tutta visibile', s.aperta && s.dentro && !s.scorre, s);
  await ctx.close();

  await b.close();
  console.log(ok.length + ' ok, ' + ko.length + ' falliti'); ko.forEach((x) => console.log('FALLITO: ' + x));
})();
