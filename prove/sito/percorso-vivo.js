// Il percorso: Indietro fa un passo indietro nel sito, ◀ nella barra, ripresa dopo una ricarica.
const { chromium, devices } = require('playwright');
const out = process.argv[2];
const ok = [], ko = [];
const check = (n, c, x) => (c ? ok : ko).push(n + (c ? '' : ' → ' + JSON.stringify(x)));
const U = 'https://ristomat.click/';
const VAI = 'a[href^="https://www.google.com/maps/dir/"]';
(async () => {
  const b = await chromium.launch();
  const nuovo = async (opz = {}) => {
    const ctx = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce', geolocation: { latitude: 41.8893, longitude: 12.4707 }, permissions: ['geolocation'], ...opz });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
    await ctx.route(/google\.com|paypal\./, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>esterno</title><p>mappa finta</p>' }));
    const p = await ctx.newPage(); const err = [];
    p.on('pageerror', (e) => err.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text()); });
    await p.goto(U); await p.waitForTimeout(500);
    return { ctx, p, err };
  };
  const st = (p) => p.evaluate(() => ({ url: location.href, tit: document.querySelector('#titolo-ris').textContent, y: Math.round(scrollY), n: (history.state || {}).n, dlg: [...document.querySelectorAll('dialog[open]')].map((d) => d.id), vista: document.querySelector('.main').dataset.view, ind: !document.querySelector('#indietro').hidden, schede: document.querySelectorAll('.card').length, lung: history.length, pw: document.querySelector('#powerups [aria-pressed=true]')?.dataset.voglia || '', q: document.querySelector('#q').value }));
  const livello = async (p, nome) => { await p.evaluate((n) => document.querySelector(`button[data-livello="${n}"]`).click(), nome); await p.waitForTimeout(600); };
  const indietro = async (p) => { await p.goBack({ waitUntil: 'commit' }).catch(() => {}); await p.waitForTimeout(500); };

  // ===== 1) Zona → Indietro torna dov'eri, senza uscire dal sito =====
  let { ctx, p, err } = await nuovo();
  let s0 = await st(p);
  check('all’inizio: nessun passo, niente ◀', s0.n === 0 && !s0.ind && s0.tit === 'Tutta Roma', s0);
  await p.evaluate(() => document.querySelector('#m-livelli').click()); await p.waitForTimeout(700);
  const yZone = (await st(p)).y;
  await livello(p, 'Trastevere');
  let s = await st(p);
  check('scelgo Trastevere: è un passo, compare ◀', s.tit === 'Trastevere' && s.n === 1 && s.ind, s);
  await indietro(p);
  s = await st(p);
  check('Indietro: resto nel sito, torno a Tutta Roma all’altezza dei quartieri', s.url.startsWith(U) && s.tit === 'Tutta Roma' && s.n === 0 && !s.ind && Math.abs(s.y - yZone) < 60, { s, yZone });
  await p.goForward({ waitUntil: 'commit' }).catch(() => {}); await p.waitForTimeout(500);
  check('Avanti: di nuovo Trastevere', (await st(p)).tit === 'Trastevere');

  // ===== 2) Finestre: Indietro le chiude =====
  await p.evaluate(() => scrollBy(0, 700)); await p.waitForTimeout(600);
  const yLista = (await st(p)).y;
  // stessa scheda alla stessa altezza: un pixel di scarto è arrotondamento (la scheda sta a cavallo di mezzo pixel), non uno spostamento
  const stessaRiga = (x, y) => { const [ix, px] = x.split('@'), [iy, py] = y.split('@'); return !!ix && ix === iy && Math.abs(px - py) <= 1; };
  const riga = () => p.evaluate(() => { const c = [...document.querySelectorAll('.card')].find((x) => x.getBoundingClientRect().top > 120); return c ? c.id + '@' + Math.round(c.getBoundingClientRect().top) : ''; });
  const rigaPrima = await riga();
  await p.click('#gettone'); await p.waitForTimeout(500);
  s = await st(p);
  check('gettone aperto: è un passo in più', s.dlg.includes('dlg-gettone') && s.n === 2, s);
  await indietro(p);
  s = await st(p);
  check('Indietro chiude il gettone e la lista resta dov’era', s.dlg.length === 0 && s.tit === 'Trastevere' && s.n === 1 && stessaRiga(await riga(), rigaPrima), { s, rigaPrima, ora: await riga() });
  await p.click('#gettone'); await p.waitForTimeout(500); await p.click('#dlg-gettone [data-chiudi]'); await p.waitForTimeout(500);
  s = await st(p);
  check('CHIUDI: stesso effetto, nessun passo rimasto appeso', s.dlg.length === 0 && s.n === 1 && stessaRiga(await riga(), rigaPrima), { s, rigaPrima, ora: await riga() });

  // ===== 3) Portami lì → Vai al posto → torno: sono dove ero =====
  const visibile = p.locator('.card ' + VAI).nth(3); await visibile.scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
  const yPrima = (await st(p)).y;
  await visibile.click(); await p.waitForTimeout(400);
  check('Portami lì apre la finestra (un passo)', (await st(p)).dlg.includes('dlg-vai') && (await st(p)).n === 2);
  const [mappaTab] = await Promise.all([ctx.waitForEvent('page'), p.click('#vai-ora')]);
  await mappaTab.waitForLoadState().catch(() => {}); await mappaTab.close(); await p.bringToFront(); await p.waitForTimeout(900);
  s = await st(p);
  check('dopo Vai al posto: finestra chiusa, stessa zona, stessa altezza', s.dlg.length === 0 && s.tit === 'Trastevere' && s.n === 1 && Math.abs(s.y - yPrima) < 5, { s, yPrima });

  // ===== 4) Lista ↔ mappa =====
  await p.click('[data-view=mappa]'); await p.waitForTimeout(700);
  s = await st(p);
  check('MAPPA: è un passo', s.vista === 'mappa' && s.n === 2, s);
  await indietro(p);
  s = await st(p);
  check('Indietro dalla mappa: lista, alla stessa altezza', s.vista === 'lista' && s.n === 1 && Math.abs(s.y - yPrima) < 5, { s, yPrima });

  // ===== 5) Gettone → Apri la scheda → Indietro =====
  await p.click('#gettone'); await p.waitForTimeout(500);
  const nome = await p.textContent('#rullo');
  await p.click('[data-get=scheda]'); await p.waitForTimeout(900);
  s = await st(p);
  const inVista = await p.evaluate((nome) => { const c = [...document.querySelectorAll('.card h4')].find((h) => h.textContent.trim() === nome); if (!c) return false; const r = c.closest('.card').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; }, nome);
  check('Apri la scheda: scheda in vista, finestra chiusa, un solo passo in più', inVista && s.dlg.length === 0 && s.n === 2, s);
  await indietro(p);
  s = await st(p);
  check('Indietro dalla scheda: torno dov’ero prima del gettone', s.dlg.length === 0 && s.tit === 'Trastevere' && s.n === 1 && Math.abs(s.y - yPrima) < 5, { s, yPrima });

  // ===== 6) Il pulsante ◀ =====
  await livello(p, 'Monti');
  check('altro quartiere', (await st(p)).tit === 'Monti' && (await st(p)).n === 2);
  await p.click('#indietro'); await p.waitForTimeout(600);
  check('◀ nella barra: torna al quartiere di prima', (await st(p)).tit === 'Trastevere' && (await st(p)).n === 1);

  // ===== 7) Filtro e «Carica altri» ricordati; ricarica: si riprende da lì =====
  await p.evaluate(() => document.querySelector('[data-voglia="trattoria"]').click()); await p.waitForTimeout(400);
  await p.evaluate(() => scrollBy(0, 500)); await p.waitForTimeout(700);
  const prima = await st(p);
  await p.reload(); await p.waitForTimeout(900);
  s = await st(p);
  check('ricarico la pagina: stessa zona, stesso filtro, stessa altezza, nessuna finestra', s.tit === 'Trastevere' && s.pw === 'trattoria' && s.dlg.length === 0 && s.n === prima.n && Math.abs(s.y - prima.y) < 8 && s.ind, { s, prima });

  // ===== 8) Come nei browser dentro le app: Maps si apre nella stessa scheda, poi Indietro =====
  await p.goto('https://www.google.com/maps/dir/?api=1&destination=prova'); await p.waitForTimeout(400);
  await p.goBack(); await p.waitForTimeout(900);
  s = await st(p);
  check('torno da Maps nella stessa scheda: non devo ripartire', s.url.startsWith(U) && s.tit === 'Trastevere' && s.pw === 'trattoria' && Math.abs(s.y - prima.y) < 8, { s, prima });

  // ===== 8b) «Vai al posto» quando il link si apre nella stessa scheda (browser dentro le app) =====
  await p.locator('.card ' + VAI).first().scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  const y8 = (await st(p)).y;
  await p.locator('.card ' + VAI).first().click(); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#vai-ora').removeAttribute('target'));
  await Promise.all([p.waitForURL(/google\.com\/maps/, { timeout: 8000 }), p.click('#vai-ora')]);
  check('stessa scheda: Maps si apre davvero', /google\.com\/maps\/dir/.test(p.url()), p.url());
  await p.goBack(); await p.waitForTimeout(1200);
  s = await st(p);
  check('stessa scheda: Indietro da Maps riporta alla lista, senza finestre e senza ripartire', s.url.startsWith(U) && s.tit === 'Trastevere' && s.pw === 'trattoria' && s.dlg.length === 0 && Math.abs(s.y - y8) < 12, { s, y8 });

  // ===== 9) Restart si annulla con Indietro =====
  await p.click('[data-restart]:visible'); await p.waitForTimeout(600);
  check('restart: da capo', (await st(p)).tit === 'Tutta Roma' && (await st(p)).pw === '');
  await indietro(p);
  s = await st(p);
  check('Indietro annulla il restart', s.tit === 'Trastevere' && s.pw === 'trattoria', s);
  check('nessun errore (percorso)', err.length === 0, err);
  await ctx.close();

  // ===== 10) Posti vicini: ricarica e ritorno =====
  ({ ctx, p, err } = await nuovo());
  await p.click('#m-start'); await p.waitForTimeout(1300);
  s = await st(p);
  check('Vicino a me: è un passo', s.tit === 'Vicino a te' && s.n === 1 && s.ind, s);
  check('nella cronologia non ci sono coordinate', await p.evaluate(() => !/41\.8|12\.4|"la"|"lo"|pos/.test(JSON.stringify(history.state))), await p.evaluate(() => JSON.stringify(history.state)));
  await p.reload(); await p.waitForTimeout(1500);
  s = await st(p);
  check('ricarico: di nuovo i posti vicini, senza ripartire', s.tit === 'Vicino a te' && s.dlg.length === 0, s);
  await indietro(p);
  check('Indietro da Vicino a te: pagina iniziale', (await st(p)).tit === 'Tutta Roma');
  check('nessun errore (vicino)', err.length === 0, err);
  await ctx.close();

  // ===== 11) «Scelgo la zona» dalla finestra della prima visita: porta ai quartieri e ci resta =====
  // (la finestra si apre da sola solo a chi non ha ancora scelto: «Portami fuori» ora porta ai due tasti della pagina)
  ctx = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); } catch (e) {} });
  p = await ctx.newPage(); await p.goto(U); await p.waitForTimeout(900);
  await p.click('#pos-corpo [data-pos=no]'); await p.waitForTimeout(900);
  s = await st(p);
  const top = await p.evaluate(() => Math.round(document.querySelector('#sez-mondi').getBoundingClientRect().top));
  check('Scelgo la zona: resto sui quartieri, nessun passo appeso', s.dlg.length === 0 && s.n === 0 && Math.abs(top) < 80, { s, top });
  await ctx.close();

  // ===== 12) Prima visita: i termini non si saltano e non contano come passo =====
  const c2 = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
  const p2 = await c2.newPage(); await p2.goto(U); await p2.waitForTimeout(500);
  s = await st(p2);
  check('termini aperti: non sono un passo', s.dlg.includes('dlg-termini') && s.n === 0 && !s.ind, s);
  await p2.click('#termini-ok'); await p2.waitForTimeout(500);
  s = await st(p2);
  check('poi «Da dove partiamo?» (questa sì, si chiude con Indietro)', s.dlg.includes('dlg-posizione') && s.n === 1, s);
  await p2.goBack({ waitUntil: 'commit' }).catch(() => {}); await p2.waitForTimeout(500);
  s = await st(p2);
  check('Indietro: chiude la finestra e resta sul sito', s.dlg.length === 0 && s.url.startsWith(U) && s.n === 0, s);
  await c2.close();

  // ===== 13) Computer =====
  const cd = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await cd.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
  const pd = await cd.newPage(); const errd = []; pd.on('pageerror', (e) => errd.push(String(e)));
  await pd.goto(U); await pd.waitForTimeout(500);
  await livello(pd, 'Testaccio');
  s = await st(pd);
  const bar = await pd.evaluate(() => { const i = document.querySelector('#indietro').getBoundingClientRect(), t = document.querySelector('#titolo-ris').getBoundingClientRect(); return { testo: document.querySelector('#indietro').innerText.replace(/\s+/g, ' '), sinistra: i.right <= t.left + 2, visibile: i.width > 0 }; });
  check('computer: ◀ INDIETRO a sinistra del titolo', s.n === 1 && bar.visibile && bar.sinistra && /INDIETRO/.test(bar.testo), { s, bar });
  await pd.screenshot({ path: out + '/percorso-computer.png' });
  await pd.goBack({ waitUntil: 'commit' }).catch(() => {}); await pd.waitForTimeout(500);
  check('computer: Indietro torna a Tutta Roma', (await st(pd)).tit === 'Tutta Roma' && errd.length === 0, errd);
  await cd.close();

  await b.close();
  console.log(ok.length + ' ok, ' + ko.length + ' falliti'); ko.forEach((x) => console.log('FALLITO: ' + x));
})();
