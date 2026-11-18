const { chromium, devices } = require('playwright');
const out = process.argv[2];
const ok = []; const ko = [];
const check = (nome, cond, extra) => { (cond ? ok : ko).push(nome + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };
(async () => {
  const b = await chromium.launch(); const _nc = b.newContext.bind(b); b.newContext = async (o) => { const c = await _nc(o); await c.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} }); return c; };
  // ===== TELEFONO, senza posizione =====
  let ctx = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
  let p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await p.clock.install({ time: new Date('2026-11-10T20:30:00') });
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(400);
  check('restart nascosto all\'avvio', await p.evaluate(() => [...document.querySelectorAll('.restart')].every(b => b.hidden)));
  await p.click('#m-gettone'); await p.waitForTimeout(200);
  check('gettone senza posizione chiede dove', await p.locator('#dlg-gettone[open] .get-scelte').count() === 1);
  await p.screenshot({ path: out + '/n1-dove.png' });
  await p.click('[data-get=ovunque]'); await p.clock.runFor(1500); await p.waitForTimeout(200);
  let r = await p.evaluate(() => { const d = document.querySelector('#dlg-gettone'); const r = d.getBoundingClientRect(); const n = document.querySelector('#rullo').getBoundingClientRect(); const a = document.querySelector('#get-esito .btn').getBoundingClientRect(); return { open: d.open, top: r.top, bottom: r.bottom, vh: innerHeight, nomeTop: n.top, nome: document.querySelector('#rullo').textContent, btnBottom: a.bottom, info: document.querySelector('.get-info').textContent.trim(), col: getComputedStyle(document.querySelector('#get-esito a.btn')).color }; });
  check('risultato tutto visibile', r.open && r.nomeTop > 0 && r.btnBottom < r.vh, r);
  check('filtro ora (sera) attivo', /adatti all’ora \(sera\)/.test(r.info), r.info);
  await p.screenshot({ path: out + '/n2-esito.png' });
  // tipi adatti alla sera, niente ripetizioni su 25 gettoni
  const visti = new Set(); const tipi = new Set(); let rip = 0;
  for (let i = 0; i < 25; i++) {
    const n = await p.evaluate(() => document.querySelector('#rullo').textContent);
    if (visti.has(n)) rip++; visti.add(n);
    tipi.add(await p.evaluate(() => document.querySelector('#get-esito .tipo').textContent));
    await p.click('[data-get=ancora]'); await p.clock.runFor(1500);
  }
  check('nessuna ripetizione in 25 gettoni', rip === 0, rip);
  check('solo tipi da sera', ![...tipi].some(t => /Dolce|Spesa|Da scoprire/.test(t)), [...tipi]);
  // toggle ora
  await p.click('[data-get=ora]'); await p.clock.runFor(1500);
  r = await p.evaluate(() => document.querySelector('.get-info').textContent.trim());
  check('toggle: di ogni tipo', /di ogni tipo/.test(r), r);
  // scheda
  const nome = await p.evaluate(() => document.querySelector('#rullo').textContent);
  await p.click('[data-get=scheda]'); await p.waitForTimeout(900);
  r = await p.evaluate((nome) => { const c = [...document.querySelectorAll('.card h4')].find(h => h.textContent.trim() === nome); if (!c) return null; const q = c.closest('.card').getBoundingClientRect(); const bar = document.querySelector('.bar').getBoundingClientRect(); return { top: q.top, bar: bar.bottom, vh: innerHeight, dlg: document.querySelector('#dlg-gettone').open }; }, nome);
  check('scheda visibile sotto la barra', r && !r.dlg && r.top >= r.bar && r.top < r.vh, r);
  check('restart visibile dopo il gettone', await p.locator('.bar .restart').isVisible());
  await p.screenshot({ path: out + '/n3-barra.png' });
  // sulla mappa
  await p.click('#gettone'); await p.clock.runFor(1500);
  await p.click('[data-get=mappa]'); await p.waitForTimeout(900);
  r = await p.evaluate(() => ({ view: document.querySelector('.main').dataset.view, popup: !!document.querySelector('.leaflet-popup'), mapTop: document.querySelector('#mappa').getBoundingClientRect().top }));
  check('sulla mappa: vista mappa con popup', r.view === 'mappa' && r.popup, r);
  await p.screenshot({ path: out + '/n4-mappa.png' });
  // livello + powerup + ricerca, poi restart
  await p.evaluate(() => document.querySelector('button[data-livello="Trastevere"]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-voglia="pizza"]').click());
  await p.fill('#q', 'pizz'); await p.waitForTimeout(400);
  await p.click('.bar .restart'); await p.waitForTimeout(900);
  r = await p.evaluate(() => ({ y: scrollY, tit: document.querySelector('#titolo-ris').textContent, cont: document.querySelector('#conteggio').textContent, q: document.querySelector('#q').value, pw: document.querySelector('[data-voglia=""]').getAttribute('aria-pressed'), view: document.querySelector('.main').dataset.view, bolla: document.querySelector('#bolla').textContent, nasc: [...document.querySelectorAll('.restart')].every(b => b.hidden), lv: document.querySelector('button[data-livello="Trastevere"]').getAttribute('aria-pressed') }));
  check('restart azzera tutto', r.y < 5 && r.tit === 'Tutta Roma' && /× \d+ posti/.test(r.cont) && r.q === '' && r.pw === 'true' && r.view === 'lista' && /Portami fuori/.test(r.bolla) && r.nasc && r.lv === 'false', r);
  await p.screenshot({ path: out + '/n5-restart.png' });
  // gettone dentro un livello: nessuna domanda
  await p.evaluate(() => document.querySelector('button[data-livello="Testaccio"]').click()); await p.waitForTimeout(300);
  await p.click('#gettone'); await p.clock.runFor(1500);
  r = await p.evaluate(() => ({ q: document.querySelector('#get-esito .quart')?.textContent, info: document.querySelector('.get-info')?.textContent.trim() }));
  check('gettone nel livello: pesca lì', r.q === 'Testaccio', r);
  await p.click('#dlg-gettone [data-chiudi]');
  // lista vuota → restart
  await p.fill('#q', 'zzzzqqq'); await p.waitForTimeout(400);
  check('lista vuota offre restart', await p.locator('.empty [data-restart]').isVisible());
  await p.click('#gettone'); await p.waitForTimeout(200);
  check('gettone a vuoto offre restart', await p.locator('#dlg-gettone [data-restart]').isVisible());
  await p.screenshot({ path: out + '/n6-vuoto.png' });
  await p.click('#dlg-gettone [data-restart]'); await p.waitForTimeout(600);
  r = await p.evaluate(() => ({ dlg: document.querySelector('#dlg-gettone').open, tit: document.querySelector('#titolo-ris').textContent }));
  check('restart dal gettone', !r.dlg && r.tit === 'Tutta Roma', r);
  await ctx.close();

  // ===== TELEFONO, con posizione (Campo de' Fiori) =====
  ctx = await b.newContext({ ...devices['iPhone 13'], geolocation: { latitude: 41.8956, longitude: 12.4722 }, permissions: ['geolocation'] });
  p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e)));
  await p.clock.install({ time: new Date('2026-11-10T08:30:00') });
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(400);
  await p.click('#m-gettone'); await p.waitForTimeout(200);
  await p.click('[data-get=vicino]'); await p.waitForTimeout(800); await p.clock.runFor(1500); await p.waitForTimeout(200);
  r = await p.evaluate(() => ({ nome: document.querySelector('#rullo')?.textContent, info: document.querySelector('.get-info')?.textContent.trim(), quanto: document.querySelector('.quanto')?.textContent, tipo: document.querySelector('#get-esito .tipo')?.textContent, tit: document.querySelector('#titolo-ris').textContent }));
  check('vicino a me dal gettone', /minuti a piedi|più vicini/.test(r.info) && /min/.test(r.quanto || '') && r.tit === 'Vicino a te', r);
  check('colazione: tipi giusti', /Dolce|Spesa/.test(r.tipo), r.tipo);
  await p.screenshot({ path: out + '/n7-vicino.png' });
  const mins = [];
  for (let i = 0; i < 12; i++) { mins.push(parseInt(await p.evaluate(() => document.querySelector('.quanto').textContent))); await p.click('[data-get=ancora]'); await p.clock.runFor(1500); }
  check('sempre a portata di piedi', Math.max(...mins) <= 25, mins);
  await p.click('#dlg-gettone [data-chiudi]');
  await p.click('.bar .restart'); await p.waitForTimeout(600);
  r = await p.evaluate(() => ({ io: !!document.querySelector('.pin.io'), dist: !!document.querySelector('.card .dist'), tit: document.querySelector('#titolo-ris').textContent }));
  check('restart dimentica la posizione', !r.io && !r.dist && r.tit === 'Tutta Roma', r);
  // START normale
  await p.click('#m-start'); await p.waitForTimeout(1200);
  r = await p.evaluate(() => ({ tit: document.querySelector('#titolo-ris').textContent, voce: document.querySelector('#m-start .voce').textContent, toast: document.querySelector('#toast').hidden }));
  check('start dopo restart', r.tit === 'Vicino a te' && r.voce === 'VICINO A ME' && r.toast, r);
  await ctx.close();

  // ===== TELEFONO, posizione negata =====
  ctx = await b.newContext({ ...devices['iPhone 13'] });
  p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e)));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(400);
  await p.click('#m-gettone'); await p.click('[data-get=vicino]'); await p.waitForTimeout(300);
  if (await p.locator('[data-get=vicino-ok]').count()) await p.click('[data-get=vicino-ok]');   // l'avviso prima della richiesta
  await p.waitForTimeout(1500);
  r = await p.evaluate(() => ({ err: document.querySelector('#get-corpo .errore')?.textContent, scelte: document.querySelectorAll('.get-scelte button').length }));
  check('posizione negata: messaggio e scelte', !!r.err && r.scelte === 3, r);
  await p.screenshot({ path: out + '/n8-negata.png' });
  await p.click('[data-get=livello]'); await p.waitForTimeout(700);
  r = await p.evaluate(() => ({ dlg: document.querySelector('#dlg-gettone').open, toast: document.querySelector('#toast').textContent, top: document.querySelector('#livelli').getBoundingClientRect().top }));
  check('scelgo il quartiere', !r.dlg && /quartiere/.test(r.toast) && r.top >= 0 && r.top < 130, r);
  await p.click('#dlg-gettone [data-chiudi]', { timeout: 500 }).catch(() => {});
  await p.click('#m-start'); await p.waitForTimeout(1500);
  r = await p.evaluate(() => ({ dlg: document.querySelector('#dlg-posizione').open, passi: document.querySelectorAll('#pos-corpo .passi li').length, err: document.querySelector('#pos-corpo .errore')?.textContent, voce: document.querySelector('#m-start .voce').textContent }));
  check('start con posizione negata: finestra con le istruzioni', r.dlg && r.passi === 3 && /bloccata/.test(r.err) && r.voce === 'VICINO A ME', r);
  await ctx.close();

  // ===== DESKTOP =====
  ctx = await b.newContext({ viewport: { width: 1366, height: 800 } });
  p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e)));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('button[data-livello="Monti"]').click()); await p.waitForTimeout(800);
  await p.screenshot({ path: out + '/d1-barra.png' });
  await p.click('#gettone'); await p.waitForTimeout(1500);
  await p.screenshot({ path: out + '/d2-gettone.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  check('esc chiude il gettone', !(await p.evaluate(() => document.querySelector('#dlg-gettone').open)));
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
  check('restart nella HUD (desktop)', await p.locator('.hud .restart').isVisible());
  await p.screenshot({ path: out + '/d3-hud.png' });
  await p.click('.hud .restart'); await p.waitForTimeout(500);
  check('restart da HUD', (await p.evaluate(() => document.querySelector('#titolo-ris').textContent)) === 'Tutta Roma');
  await ctx.close();

  console.log('OK ' + ok.length); ok.forEach(x => console.log('  ✓ ' + x.split(' → ')[0]));
  console.log('KO ' + ko.length); ko.forEach(x => console.log('  ✗ ' + x));
  console.log('errori pagina:', errs);
  await b.close();
})();
