// «Prossimo livello» in fondo all'elenco: scelto il livello, la pagina riparte dall'inizio dell'elenco dei posti.
//   node prossimo.js <cartella foto> [indirizzo]
const { chromium, devices } = require('playwright');
const out = process.argv[2], BASE = process.argv[3] || 'http://localhost:8765/index.html';
const ok = [], ko = [];
const check = (n, c, x) => (c ? ok : ko).push(n + (x !== undefined ? ' → ' + JSON.stringify(x) : ''));
(async () => {
  const b = await chromium.launch();
  const nuovo = async ({ dispositivo = devices['iPhone 13'], fermo = true } = {}) => {
    const ctx = await b.newContext({ ...dispositivo, ...(fermo ? { reducedMotion: 'reduce' } : {}) });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
    await ctx.route(/google\.com|paypal\./, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>esterno</title>' }));
    const p = await ctx.newPage(); const err = [];
    p.on('pageerror', (e) => err.push(String(e).slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text().slice(0, 200)); });
    await p.goto(BASE); await p.waitForTimeout(800);
    return { ctx, p, err };
  };
  // dove sono la barra, la prima scheda e i «prossimi livelli» rispetto allo schermo
  const vedi = (p) => p.evaluate(() => {
    const r = (e) => { if (!e || e.hidden) return null; const q = e.getBoundingClientRect(); return { top: Math.round(q.top), bottom: Math.round(q.bottom) }; };
    const barra = r(document.querySelector('.bar')), prima = r(document.querySelector('#cards .card')), elenco = r(document.querySelector('#cards'));
    return { y: Math.round(scrollY), vh: innerHeight, barra, prima, elenco, titolo: document.querySelector('#titolo-ris').textContent, schede: document.querySelectorAll('.card').length,
      prossimi: [...document.querySelectorAll('#next-lv .level')].map((e) => e.dataset.livello), prossimiInVista: (() => { const q = r(document.querySelector('#next-lv')); return !!q && q.top < innerHeight && q.bottom > 0; })(),
      primoNome: (document.querySelector('#cards .card h4') || {}).textContent, indietro: !document.querySelector('#indietro').hidden };
  });
  // la prima scheda è subito sotto la barra, e la barra è in cima allo schermo
  const daCapo = (v) => v.barra && v.prima && v.barra.top >= 0 && v.barra.top <= 60 && v.prima.top >= v.barra.bottom - 2 && v.prima.top <= v.barra.bottom + 160;   // tra la barra e la prima scheda può esserci il suggerimento del gettone
  const inFondo = async (p) => { await p.evaluate(() => document.querySelector('#next-lv').scrollIntoView({ block: 'center' })); await p.waitForTimeout(400); };

  for (const [nome, opz, attesa] of [['telefono', {}, 600], ['telefono con le animazioni', { fermo: false }, 2200], ['computer', { dispositivo: { viewport: { width: 1366, height: 800 } } }, 600]]) {
    const { ctx, p, err } = await nuovo(opz);
    await p.evaluate(() => document.querySelector('#livelli [data-livello="Trastevere"]').click()); await p.waitForTimeout(attesa);
    let v = await vedi(p);
    check(nome + ': scelto Trastevere dall’elenco dei livelli, i posti partono dall’inizio', v.titolo === 'Trastevere' && daCapo(v), { barra: v.barra, prima: v.prima });
    const yInizio = v.y;
    await inFondo(p);
    v = await vedi(p);
    check(nome + ': in fondo all’elenco ci sono i «prossimi livelli»', v.prossimi.length === 3 && v.prossimiInVista && v.y > yInizio + 500, { prossimi: v.prossimi, y: v.y, yInizio });
    const yFondo = v.y, scelto = v.prossimi[0];
    await p.screenshot({ path: out + '/prossimo-' + nome.replace(/ .*/, '') + (opz.fermo === false ? '-anim' : '') + '-1-fondo.png' });
    await p.locator(`#next-lv [data-livello="${scelto}"]`).click(); await p.waitForTimeout(attesa);
    v = await vedi(p);
    check(nome + ': toccato «' + scelto + '»: si apre quel livello', v.titolo === scelto && v.schede > 0, { titolo: v.titolo, schede: v.schede });
    check(nome + ': …e la pagina riparte dall’inizio dell’elenco dei posti', daCapo(v) && v.y < yFondo - 300, { y: v.y, yFondo, barra: v.barra, prima: v.prima });
    await p.screenshot({ path: out + '/prossimo-' + nome.replace(/ .*/, '') + (opz.fermo === false ? '-anim' : '') + '-2-dopo.png' });
    // di nuovo, due volte di fila
    await inFondo(p);
    const v2 = await vedi(p);
    if (v2.prossimi.length) {
      await p.locator(`#next-lv [data-livello="${v2.prossimi[0]}"]`).click(); await p.waitForTimeout(attesa);
      v = await vedi(p);
      check(nome + ': anche la seconda volta (' + v2.prossimi[0] + ') riparte dall’inizio', v.titolo === v2.prossimi[0] && daCapo(v), { titolo: v.titolo, barra: v.barra, prima: v.prima });
    }
    // INDIETRO torna al livello di prima, in fondo dov'eri
    await p.click('#indietro'); await p.waitForTimeout(Math.max(attesa, 900));
    v = await vedi(p);
    check(nome + ': INDIETRO torna al livello di prima, all’altezza dei «prossimi livelli»', v.titolo === scelto && v.prossimiInVista, { titolo: v.titolo, y: v.y, inVista: v.prossimiInVista });
    check(nome + ': nessun errore', err.length === 0, err);
    await ctx.close();
  }

  // ===== le altre scelte che portano ai posti partono anche loro dall'inizio, da qualunque punto della pagina =====
  const { ctx, p, err } = await nuovo();
  await p.evaluate(() => document.querySelector('#livelli [data-livello="Trastevere"]').click()); await p.waitForTimeout(500);
  await p.evaluate(() => scrollBy(0, 2500)); await p.waitForTimeout(300);
  // un power-up scelto da tastiera/codice mentre sei in fondo (per esempio tornando su con il dito e toccando): qui lo si tocca via codice
  await p.evaluate(() => { const e = [...document.querySelectorAll('#powerups .pw:not([disabled])')].find((x) => x.dataset.voglia); e.click(); }); await p.waitForTimeout(600);
  let v = await vedi(p);
  check('power-up scelto con il livello già scelto: i posti ripartono dall’inizio', v.titolo === 'Trastevere' && daCapo(v), { barra: v.barra, prima: v.prima });
  check('altre scelte: nessun errore', err.length === 0, err);
  await ctx.close();

  await b.close();
  console.log(ok.length + ' ok, ' + ko.length + ' falliti'); ko.forEach((x) => console.log('FALLITO: ' + x.slice(0, 420)));
})();
