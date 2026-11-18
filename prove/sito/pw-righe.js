// I power-up su più righe: si vedono tutti, anche sul telefono.   node pw-righe.js <cartella foto> [indirizzo]
const { chromium, devices } = require('playwright');
const out = process.argv[2], BASE = process.argv[3] || 'http://localhost:8765/index.html';
const ok = [], ko = [];
const check = (n, c, x) => (c ? ok : ko).push(n + (x !== undefined ? ' → ' + JSON.stringify(x) : ''));
(async () => {
  const b = await chromium.launch();
  const casi = [['telefono', devices['iPhone 13']], ['stretto', { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent }],
    ['grande', devices['iPhone 14 Pro Max']], ['tablet', { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2 }], ['computer', { viewport: { width: 1366, height: 800 } }]];
  for (const [nome, disp] of casi) {
    const ctx = await b.newContext({ ...disp, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
    const p = await ctx.newPage(); const err = [];
    p.on('pageerror', (e) => err.push(String(e).slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text().slice(0, 200)); });
    await p.goto(BASE); await p.waitForTimeout(900);
    await p.evaluate(() => document.querySelector('#sez-mondi').scrollIntoView()); await p.waitForTimeout(200);
    await p.locator('#mondi [data-mondo="roma"]').click(); await p.waitForTimeout(500);
    const v = await p.evaluate(() => {
      const box = document.querySelector('#powerups'), pw = [...box.querySelectorAll('.pw')];
      const r = pw.map((e) => e.getBoundingClientRect());
      const sez = document.querySelector('#sez-pw').getBoundingClientRect(), cerca = document.querySelector('#q').getBoundingClientRect();
      return { quanti: pw.length, righe: new Set(r.map((q) => Math.round(q.top))).size, fuoriLato: r.filter((q) => q.left < 0 || q.right > innerWidth + 0.5).length,
        inVista: r.filter((q) => q.top >= 0 && q.bottom <= innerHeight && q.left >= 0 && q.right <= innerWidth + 0.5).length,
        piccoli: r.filter((q) => q.height < 38).length, minH: Math.round(Math.min(...r.map((q) => q.height))), tagliati: pw.filter((e) => e.scrollWidth > e.clientWidth + 1).length,
        scorreDiLato: box.scrollWidth > box.clientWidth + 1, pagina: document.documentElement.scrollWidth - innerWidth, sezTop: Math.round(sez.top), cercaInVista: cerca.bottom <= innerHeight, vh: innerHeight,
        sovrapposti: r.some((a, i) => r.some((c, j) => j > i && a.left < c.right - 1 && a.right > c.left + 1 && a.top < c.bottom - 1 && a.bottom > c.top + 1)) };
    });
    check(nome + ': dopo il mondo, i power-up si vedono tutti (' + v.inVista + ' su ' + v.quanti + ', su ' + v.righe + ' righe)', (nome === 'stretto' ? v.inVista >= 11 : v.inVista === v.quanti) && v.quanti >= 10, v);
    check(nome + ': nessuno esce di lato, la riga non scorre più, la pagina non scorre di lato', v.fuoriLato === 0 && !v.scorreDiLato && v.pagina <= 0, v);
    check(nome + ': pulsanti comodi da toccare (alti ' + v.minH + ' px), non tagliati, non sovrapposti', v.piccoli === 0 && v.tagliati === 0 && !v.sovrapposti, v);
    if (nome !== 'computer' && nome !== 'tablet') check(nome + ': su più righe davvero, e la ricerca si vede senza scorrere (tranne sul più stretto)', v.righe >= 3 && (nome === 'stretto' || v.cercaInVista), { righe: v.righe, cerca: v.cercaInVista });
    await p.screenshot({ path: out + '/pw-' + nome + '.png' });
    // un power-up acceso e uno spento si distinguono, e la scelta porta avanti come prima
    await p.locator('#powerups [data-voglia="pizza"]').click(); await p.waitForTimeout(500);
    const dopo = await p.evaluate(() => ({ voglia: (document.querySelector('#powerups [aria-pressed=true]') || {}).dataset.voglia, livelli: Math.round(document.querySelector('#livelli').getBoundingClientRect().top), spenti: document.querySelectorAll('#powerups .pw[disabled]').length }));
    check(nome + ': scelto «Pizza» si va ancora ai livelli', dopo.voglia === 'pizza' && dopo.livelli >= 0 && dopo.livelli <= 140, dopo);
    check(nome + ': nessun errore', err.length === 0, err);
    await ctx.close();
  }
  await b.close();
  console.log(ok.length + ' ok, ' + ko.length + ' falliti'); ko.forEach((x) => console.log('FALLITO: ' + x));
})();
