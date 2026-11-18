// Strade sotto la mappa dei quartieri: arrivano dopo, stanno sotto fiume e caselle, e se mancano la mappa funziona lo stesso.
const { chromium, devices } = require('playwright');
const BASE = (process.argv[2] || 'http://localhost:8765/').replace(/index\.html$/, '');
let ok = 0, ko = 0; const dico = (m, c, x) => { c ? ok++ : ko++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (c ? '' : ' → ' + JSON.stringify(x))); };
(async () => {
  const b = await chromium.launch();
  for (const blocca of [false, true]) {
    const ctx = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
    const chieste = []; if (blocca) await ctx.route(/mappa\/quartieri\.js/, (r) => r.abort());
    const p = await ctx.newPage(); const err = [];
    p.on('pageerror', (e) => err.push(String(e).slice(0, 120))); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) err.push(m.text().slice(0, 120)); });
    p.on('request', (r) => { if (/mappa\//.test(r.url())) chieste.push(r.url().split('/').pop()); });
    await p.goto(BASE); await p.waitForTimeout(250);
    const subito = await p.evaluate(() => ({ nodi: document.querySelectorAll('#ow-svg .ow-nodo').length, vie: document.querySelectorAll('#ow-svg .ow-via').length }));
    await p.waitForTimeout(3500);
    const dopo = await p.evaluate(() => { const svg = document.querySelector('#ow-svg svg'), figli = [...svg.children].map((e) => e.getAttribute('class') || e.tagName); const v = svg.querySelector('.ow-via.grande'); const cs = v && getComputedStyle(v); return { nodi: svg.querySelectorAll('.ow-nodo').length, vie: svg.querySelectorAll('.ow-via').length, ordine: figli.slice(0, 4), tratto: cs && [cs.stroke, cs.fill, cs.pointerEvents], peso: (window.SNS_MAPPA && window.SNS_MAPPA.strade) ? JSON.stringify(window.SNS_MAPPA.strade).length : 0, roma: !!(window.SNS_MAPPA && window.SNS_MAPPA.roma) }; });
    const n = blocca ? 'senza il file delle strade' : 'con le strade';
    dico(n + ': le caselle ci sono subito (38), prima delle strade', subito.nodi === 38, subito);
    if (!blocca) {
      dico(n + ': le strade arrivano dopo e stanno sotto il fiume e le caselle', dopo.vie === 2 && dopo.ordine[0] === 'ow-via' && dopo.ordine[1] === 'ow-via grande' && dopo.ordine[2] === 'ow-fiume' && dopo.nodi === 38, dopo);
      dico(n + ': file leggero (' + Math.round(dopo.peso / 1024) + ' KB) e la mappa grande non viene scaricata all’apertura', dopo.peso > 5000 && dopo.peso < 60000 && !dopo.roma && !chieste.includes('roma.js'), { peso: dopo.peso, chieste });
      dico(n + ': strade chiare, senza riempimento', /^rgb\(211, 192, 160\)$/.test(dopo.tratto[0]) && dopo.tratto[1] === 'none', dopo.tratto);
    } else dico(n + ': la mappa dei quartieri resta com’era (nessuna strada, 38 caselle)', dopo.vie === 0 && dopo.nodi === 38, dopo);
    // toccare una casella funziona ancora, anche dove passa una strada
    await p.locator('#overworld').scrollIntoViewIfNeeded();
    await p.locator('.ow-nodo[data-livello="Garbatella"]').click(); await p.waitForTimeout(700);
    const s = await p.evaluate(() => ({ titolo: document.querySelector('#titolo-ris').textContent, schede: document.querySelectorAll('.card').length, on: document.querySelector('.ow-nodo.on')?.dataset.livello, vie: document.querySelectorAll('#ow-svg .ow-via').length, info: document.querySelector('#ow-info').textContent }));
    dico(n + ': toccando «Garbatella» si apre il livello (' + s.schede + ' schede) e la casella si accende', /Garbatella/.test(s.titolo) && s.schede > 3 && s.on === 'Garbatella' && s.vie === (blocca ? 0 : 2) && /Garbatella/.test(s.info), s);
    dico(n + ': nessun errore', err.length === 0, err);
    await ctx.close();
  }
  await b.close(); console.log(`\n${ok} ok · ${ko} KO`); process.exitCode = ko ? 1 : 0;
})();
