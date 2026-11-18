// L'ordine dei mondi: Roma, poi Fuori porta, poi le altre città.   node mondi.js [indirizzo]
const { chromium, devices } = require('playwright');
const FOTO = process.env.PROVE_FOTO || require('os').tmpdir();   // dove finiscono le schermate
const U = process.argv[2] || 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, ko = 0; const dico = (m, c, x) => { c ? ok++ : ko++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (c ? '' : ' → ' + JSON.stringify(x).slice(0, 500))); };
  const ctx = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', (e) => err.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text()); });
  await p.goto(U); await p.waitForTimeout(800);
  const t = await p.evaluate(() => [...document.querySelectorAll('#mondi .tab')].map((x) => x.querySelector('.w').textContent + ' ' + x.querySelector('.nm').textContent + ' ' + x.querySelector('.ct').textContent.trim()));
  dico('ordine dei mondi: ' + t.map((x) => x.replace(/ × .*/, '')).join(' · '), t.length === 6 && /^MONDO 1 Roma/.test(t[0]) && /^MONDO 2 Fuori porta/.test(t[1]) && /^MONDO 3 Firenze/.test(t[2]) && /^MONDO 4 Venezia/.test(t[3]) && /^MONDO 5 Milano/.test(t[4]) && /^MONDO 6 Bologna/.test(t[5]), t);
  await p.evaluate(() => document.querySelector('#sez-mondi').scrollIntoView()); await p.waitForTimeout(200);
  const vis = await p.evaluate(() => { const r = document.querySelector('[data-mondo="fuori"]').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; });
  dico('sul telefono «Fuori porta» si vede subito accanto a Roma, senza scorrere', vis);
  await p.locator('#sez-mondi').screenshot({ path: FOTO + '/mondi.png' });
  await p.click('[data-mondo="fuori"]'); await p.waitForTimeout(600);
  const f = await p.evaluate(() => ({ sotto: document.querySelector('#sott-livelli').textContent, premuto: document.querySelector('[data-mondo="fuori"]').getAttribute('aria-pressed'), codici: [...document.querySelectorAll('#livelli .level .cod')].slice(0, 4).map((x) => x.textContent), livelli: document.querySelectorAll('#livelli .level').length, lv: document.querySelector('#lv').textContent, titolo: document.querySelector('#titolo-ris').textContent, schede: document.querySelectorAll('.card').length, mappaRoma: !document.querySelector('#overworld').hidden }));
  dico('«Fuori porta» si apre: ' + f.livelli + ' località, codici ' + f.codici.slice(1, 3).join(', ') + ', «' + f.lv + ' · ' + f.titolo + '»', f.premuto === 'true' && /Gite, mare e borghi/.test(f.sotto) && f.livelli > 5 && f.codici.slice(1).every((c) => /^LIVELLO 2-\d\d$/.test(c)) && f.lv === 'MONDO 2' && f.titolo === 'Fuori porta' && f.schede > 5 && !f.mappaRoma, f);
  await p.locator('#livelli .level').nth(1).click(); await p.waitForTimeout(500);
  const l = await p.evaluate(() => ({ lv: document.querySelector('#lv').textContent, titolo: document.querySelector('#titolo-ris').textContent, schede: document.querySelectorAll('.card').length }));
  dico('scegliendo una località: «' + l.lv + ' · ' + l.titolo + '», ' + l.schede + ' schede', /^LIVELLO 2-01$/.test(l.lv) && l.schede > 0, l);
  await p.click('#gettone'); await p.waitForTimeout(700);
  dico('il gettone pesca lì: ' + await p.evaluate(() => document.querySelector('#rullo').textContent + ' (' + (document.querySelector('#get-esito .quart') || {}).textContent + ')'), await p.evaluate(() => !!document.querySelector('#get-esito .quart')));
  await p.evaluate(() => document.querySelector('#dlg-gettone').close()); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-mondo="firenze"]').click()); await p.waitForTimeout(500);
  const fi = await p.evaluate(() => ({ lv: document.querySelector('#lv').textContent, titolo: document.querySelector('#titolo-ris').textContent, schede: document.querySelectorAll('.card').length }));
  dico('Firenze ora è «' + fi.lv + '» e funziona (' + fi.schede + ' schede)', fi.lv === 'MONDO 3' && fi.titolo === 'Firenze' && fi.schede > 5, fi);
  dico('nessun errore', err.length === 0, err);
  await b.close(); console.log(`\n${ok} ok · ${ko} KO`); process.exitCode = ko ? 1 : 0;
})();
