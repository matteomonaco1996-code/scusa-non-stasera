// Tivoli è il primo livello di Fuori porta: oggi, e anche se un'altra località avesse più posti.   node primo.js [indirizzo]
const { chromium, devices } = require('playwright');
const U = process.argv[2] || 'http://localhost:8765/index.html', LOCALE = /localhost/.test(U);
(async () => {
  const b = await chromium.launch(); let ok = 0, ko = 0; const dico = (m, c, x) => { c ? ok++ : ko++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (c ? '' : ' → ' + JSON.stringify(x).slice(0, 500))); };
  for (const caso of LOCALE ? ['oggi', 'Tivoli con pochi posti', 'Toscana più grande del Lazio'] : ['oggi']) {
    const ctx = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', (e) => err.push(String(e)));
    if (caso !== 'oggi') await p.route('**/locali.js', async (route) => { const r = await route.fetch(); let t = await r.text();
      if (caso === 'Tivoli con pochi posti') { let n = 0; t = t.split('\n').filter((l) => !(/"c":"Tivoli"/.test(l) && ++n > 4)).join('\n'); }      // restano 4 posti a Tivoli, meno di Fregene e Gaeta
      else t = t.split('\n').map((l) => (/"c":"(Roma|Tivoli)"/.test(l) ? l : l.replace('"r":"Lazio"', '"r":"Toscana"'))).join('\n');   // fuori Roma e Tivoli tutto il Lazio passa alla Toscana, che diventa l'area più grande
      await route.fulfill({ response: r, body: t }); });
    await p.goto(U); await p.waitForTimeout(800);
    await p.click('[data-mondo="fuori"]'); await p.waitForTimeout(500);
    const r = await p.evaluate(() => ({ aree: [...document.querySelectorAll('#livelli .area h3')].map((x) => x.textContent), primi: [...document.querySelectorAll('#livelli .level')].slice(1, 4).map((x) => x.querySelector('.cod').textContent + ' ' + x.querySelector('.nm').textContent + ' ' + x.querySelector('.ct').textContent.trim()) }));
    dico(`${caso}: la prima località è «${r.primi[0]}» (poi ${r.primi.slice(1).map((x) => x.replace(/LOCALITÀ /, '')).join(', ')}); prima area: ${r.aree[0]}`, /^LOCALITÀ Tivoli/.test(r.primi[0]) && /LAZIO/i.test(r.aree[0]) && err.length === 0, { r, err });
    if (caso === 'oggi') { await p.evaluate(() => document.querySelector('button[data-livello="Tivoli"]').click()); await p.waitForTimeout(500); const t = await p.evaluate(() => document.querySelector('#lv').textContent + ' · ' + document.querySelector('#titolo-ris').textContent + ' · ' + document.querySelectorAll('.card').length + ' schede'); dico('toccandolo: ' + t, /^FUORI PORTA · LAZIO · Tivoli · \d+ schede$/.test(t), t); }
    await ctx.close();
  }
  await b.close(); console.log(`\n${ok} ok · ${ko} KO`); process.exitCode = ko ? 1 : 0;
})();
