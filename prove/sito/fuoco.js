const { chromium } = require('playwright');
const FOTO = process.env.PROVE_FOTO || require('os').tmpdir();   // dove finiscono le schermate
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await p.addInitScript(() => { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); });
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(900);
  await p.focus('.ow-nodo'); await p.keyboard.press('Tab'); await p.waitForTimeout(200);
  const r = await p.evaluate(() => { const g = document.activeElement, h = g.querySelector('.ow-hit'), c = getComputedStyle(h), altro = getComputedStyle(document.querySelectorAll('.ow-nodo')[5].querySelector('.ow-hit')); return { chi: g.getAttribute('aria-label'), tratto: c.stroke, spessore: c.strokeWidth, trattini: c.strokeDasharray, altroTratto: altro.stroke }; });
  await p.locator('#overworld').screenshot({ path: FOTO + '/fuoco-quartieri.png' });
  console.log((r.tratto !== 'none' && r.altroTratto === 'none' ? '✓' : '✗') + ' mappa dei quartieri con la tastiera: intorno alla casella scelta c’è un tratteggio', JSON.stringify(r));
  for (const pag of ['privacy.html', 'statistiche.html?esempio']) { await p.setViewportSize({ width: 390, height: 800 }); await p.goto('http://localhost:8765/' + pag); await p.waitForTimeout(500); const a = await p.evaluate(() => { const l = document.querySelector('main a'); const r = l.getBoundingClientRect(); return l.textContent + ' ' + Math.round(r.width) + '×' + Math.round(r.height); }); console.log((/×(2[4-9]|[3-9]\d)$/.test(a) ? '✓ ' : '✗ ') + pag + ': ' + a); }
  await b.close(); })();
