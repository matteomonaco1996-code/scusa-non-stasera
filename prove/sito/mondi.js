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
  // Un quartiere è un luogo, non una difficoltà: la parola «livello» non si mostra più a chi sceglie dove andare
  await p.evaluate(() => document.querySelector('#livelli [data-livello="Monti"]').click()); await p.waitForTimeout(600);
  const q = await p.evaluate(() => { const vis = (e) => e && e.offsetParent !== null; const testo = [...document.querySelectorAll('#sez-livelli, .bar, main.main')].filter(vis).map((e) => e.innerText).join(' ');
    return { livello: (testo.match(/livell\w*/gi) || []).slice(0, 5), titolo: document.querySelector('#t-livelli').textContent, lv: document.querySelector('#lv').textContent, cod: document.querySelector('#livelli [data-livello="Monti"] .cod').textContent,
      vicini: (document.querySelector('#next-lv h3') || {}).textContent, codVicini: [...document.querySelectorAll('#next-lv .cod')].map((x) => x.textContent), nodo: document.querySelector('.ow-nodo[data-livello="Monti"]').getAttribute('aria-label'), info: document.querySelector('#ow-info').textContent }; });
  dico('Roma, scelto Monti: «' + q.lv + '», tessera «' + q.cod + '», in fondo «' + q.vicini + '»: la parola «livello» non compare', q.livello.length === 0 && q.titolo === 'SCEGLI IL QUARTIERE' && /^ROMA · /.test(q.lv) && /^QUARTIERE \d+$/.test(q.cod) && /^Quartieri vicini/.test(q.vicini) && q.codVicini.length === 3 && q.codVicini.every((c) => /^QUARTIERE \d+$/.test(c)) && /^Quartiere \d+: Monti, \d+ posti$/.test(q.nodo) && /^Quartiere \d+: Monti · \d+ posti/.test(q.info), q);
  dico('il numero sulla tessera è quello che si legge sulla mappa', await p.evaluate(() => document.querySelector('#livelli [data-livello="Monti"] .cod').textContent.replace('QUARTIERE ', '') === String(+document.querySelector('.ow-nodo[data-livello="Monti"] text').textContent)));
  await p.evaluate(() => { document.querySelector('[data-restart]').click(); }); await p.waitForTimeout(700);
  await p.click('[data-mondo="fuori"]'); await p.waitForTimeout(600);
  const f = await p.evaluate(() => ({ sotto: document.querySelector('#sott-livelli').textContent, sopra: document.querySelector('#t-livelli').textContent, premuto: document.querySelector('[data-mondo="fuori"]').getAttribute('aria-pressed'), codici: [...document.querySelectorAll('#livelli .level .cod')].slice(0, 4).map((x) => x.textContent), livelli: document.querySelectorAll('#livelli .level').length, lv: document.querySelector('#lv').textContent, titolo: document.querySelector('#titolo-ris').textContent, schede: document.querySelectorAll('.card').length, mappaRoma: !document.querySelector('#overworld').hidden }));
  dico('«Fuori porta» si apre: ' + f.livelli + ' località, codici ' + f.codici.slice(1, 3).join(', ') + ', «' + f.lv + ' · ' + f.titolo + '»', f.premuto === 'true' && f.sopra === 'SCEGLI LA LOCALITÀ' && /Gite, mare e borghi/.test(f.sotto) && !/livell/i.test(f.sopra + f.sotto) && f.livelli > 5 && f.codici.slice(1).every((c) => c === 'LOCALITÀ') && f.lv === 'MONDO 2' && f.titolo === 'Fuori porta' && f.schede > 5 && !f.mappaRoma, f);
  await p.locator('#livelli .level').nth(1).click(); await p.waitForTimeout(500);
  const l = await p.evaluate(() => ({ lv: document.querySelector('#lv').textContent, titolo: document.querySelector('#titolo-ris').textContent, schede: document.querySelectorAll('.card').length }));
  dico('scegliendo una località: «' + l.lv + ' · ' + l.titolo + '», ' + l.schede + ' schede', l.lv === 'FUORI PORTA · LAZIO' && l.schede > 0, l);   // sopra il nome della località c'è dove si trova, non più «LIVELLO 2-01»
  await p.click('#gettone'); await p.waitForTimeout(700);
  dico('il gettone pesca lì: ' + await p.evaluate(() => document.querySelector('#rullo').textContent + ' (' + (document.querySelector('#get-esito .quart') || {}).textContent + ')'), await p.evaluate(() => !!document.querySelector('#get-esito .quart')));
  await p.evaluate(() => document.querySelector('#dlg-gettone').close()); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-mondo="firenze"]').click()); await p.waitForTimeout(500);
  const fi = await p.evaluate(() => ({ lv: document.querySelector('#lv').textContent, titolo: document.querySelector('#titolo-ris').textContent, schede: document.querySelectorAll('.card').length }));
  dico('Firenze ora è «' + fi.lv + '» e funziona (' + fi.schede + ' schede)', fi.lv === 'MONDO 3' && fi.titolo === 'Firenze' && fi.schede > 5, fi);
  dico('nessun errore', err.length === 0, err);
  await b.close(); console.log(`\n${ok} ok · ${ko} KO`); process.exitCode = ko ? 1 : 0;
})();
