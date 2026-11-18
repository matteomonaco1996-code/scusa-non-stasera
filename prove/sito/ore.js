// Tutte le ore del giorno, le posizioni più diverse, le animazioni accese, lo schermo ad alto contrasto.
const { chromium, devices } = require('playwright');
const FOTO = process.env.PROVE_FOTO || require('os').tmpdir();   // dove finiscono le schermate
const BASE = 'http://localhost:8765/index.html';
let ok = 0, ko = 0; const dico = (m, c, x) => { c ? ok++ : ko++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (c ? '' : ' → ' + JSON.stringify(x).slice(0, 700))); };
(async () => {
  const b = await chromium.launch();
  const apri = async ({ ora = '2026-11-12T20:30:00', pos, opz = {}, fuso } = {}) => {
    const ctx = await b.newContext({ ...devices['iPhone 13'], ...(pos ? { geolocation: { latitude: pos[0], longitude: pos[1], accuracy: pos[2] || 20 }, permissions: ['geolocation'] } : {}), ...(fuso ? { timezoneId: fuso } : {}), ...opz });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} navigator.share = async () => {}; });
    await ctx.route(/google\.com|paypal\.|wa\.me|cartocdn/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'x' }));
    const p = await ctx.newPage(); const err = []; p.on('pageerror', (e) => err.push(String(e).slice(0, 150))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text().slice(0, 150)); });
    await p.clock.install({ time: new Date(ora) }); await p.goto(BASE); await p.waitForTimeout(500);
    return { ctx, p, err };
  };
  // ---------- 24 ore ----------
  console.log('Ogni ora del giorno');
  const righe = [], guai = [];
  for (let h = 0; h < 24; h++) {
    const { ctx, p, err } = await apri({ ora: `2026-11-12T${String(h).padStart(2, '0')}:20:00` });
    await p.evaluate(() => document.querySelector('button[data-livello="Trastevere"]').click()); await p.waitForTimeout(250);
    await p.click('#gettone'); await p.waitForTimeout(900);
    const r = await p.evaluate(() => ({ domanda: document.querySelector('#domanda').textContent, no: document.querySelector('#risposta').textContent, pescato: (document.querySelector('#rullo') || {}).textContent, info: (document.querySelector('.get-info') || {}).textContent.replace(/\s+/g, ' ').trim(), proponi: (document.querySelector('[data-get=invita]') || {}).textContent, tipo: (document.querySelector('#get-esito .tipo') || {}).textContent }));
    await p.click('[data-get=invita]'); await p.waitForTimeout(250);
    r.msg = await p.evaluate(() => document.querySelector('#inv-testo').textContent.split(' ').slice(0, 2).join(' ')); r.scelto = await p.evaluate(() => (document.querySelector('.quando [aria-pressed=true]') || {}).textContent);
    righe.push(`${String(h).padStart(2, '0')}: ${r.domanda} / ${r.no} / ${r.proponi} / ${r.scelto}`);
    if (err.length || !r.domanda || !r.no || !r.pescato || /undefined|NaN/.test(JSON.stringify(r)) || !/^Proponilo: .+\?$/.test(r.proponi || '') || !/adatt[oi] all’ora \(/.test(r.info)) guai.push({ h, r, err });
    await ctx.close();
  }
  const diverse = [...new Set(righe.map((r) => r.slice(4)))];
  dico('a ogni ora c’è una domanda, un «no» a tono, un gettone adatto e una proposta (' + diverse.length + ' momenti diversi nella giornata)', guai.length === 0 && diverse.length === 5, guai.slice(0, 3));
  for (const d of diverse) console.log('       ' + righe.filter((r) => r.slice(4) === d).map((r) => r.slice(0, 2)).join(' ') + ' → ' + d);
  // fuso orario diverso: vale l'ora del telefono
  { const { ctx, p } = await apri({ ora: '2026-11-12T20:30:00+01:00', fuso: 'America/New_York' }); const q = await p.evaluate(() => document.querySelector('#domanda').textContent); dico('con il telefono su un altro fuso (New York, lì sono le 14:30) la domanda segue l’ora del telefono: «' + q + '»', q === 'Pranziamo insieme?', q); await ctx.close(); }
  // ---------- posizioni ----------
  console.log('Posizioni diverse («Vicino a me»)');
  for (const [nome, pos, atteso] of [
    ['in centro (Pantheon)', [41.8986, 12.4769], { vicini: true }], ['a Trastevere', [41.8893, 12.4707], { vicini: true }],
    ['in periferia (Tor Bella Monaca)', [41.8667, 12.6333], {}], ['a Firenze', [43.7696, 11.2558], { vicini: true }], ['a Venezia', [45.4371, 12.3326], { vicini: true }],
    ['a Milano', [45.4642, 9.19], { vicini: true }], ['a Tivoli', [41.9634, 12.7958], {}], ['a Londra', [51.5072, -0.1276], { lontano: true }], ['all’equatore, in mare', [0, 0], { lontano: true }],
    ['in centro ma con posizione molto imprecisa (3 km)', [41.8986, 12.4769, 3000], {}],
  ]) {
    const { ctx, p, err } = await apri({ pos });
    await p.click('#m-start'); await p.waitForTimeout(2500);
    const r = await p.evaluate(() => { const c = [...document.querySelectorAll('.card')]; return { titolo: document.querySelector('#titolo-ris').textContent, lv: document.querySelector('#lv').textContent, n: c.length, primi: c.slice(0, 3).map((k) => k.querySelector('h4').textContent.trim() + ' ' + ((k.querySelector('.dist') || {}).textContent || '').replace(/\s+/g, ' ').trim()), fasce: [...document.querySelectorAll('.band h3')].map((x) => x.textContent), finestra: [...document.querySelectorAll('dialog[open]')].map((d) => d.id + ': ' + d.querySelector('h2').textContent), strano: (document.body.innerText.match(/undefined|NaN|Infinity/g) || []).length, bolla: document.querySelector('#bolla').textContent }; });
    await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); await p.click('#gettone').catch(() => {}); await p.waitForTimeout(1000);
    r.gettone = await p.evaluate(() => ((document.querySelector('#rullo') || {}).textContent || '') + ' · ' + (((document.querySelector('#get-esito .quanto') || {}).textContent) || ''));
    const dist = r.primi.map((x) => { const m = x.match(/(\d+)\s*min/); const k = x.match(/([\d.,]+)\s*km/); return m ? +m[1] : k ? parseFloat(k[1].replace('.', '').replace(',', '.')) * 12 : null; });
    const ordinati = dist.every((d, i) => i === 0 || d === null || dist[i - 1] === null || d >= dist[i - 1]);
    dico(`${nome}: ${r.n} schede, prima «${r.primi[0] || '—'}»${r.fasce.length ? ' · fasce: ' + r.fasce.slice(0, 2).join(', ') : ''}${r.finestra.length ? ' · finestra: ' + r.finestra[0] : ''}`, err.length === 0 && r.strano === 0 && (r.n > 0 || r.finestra.length > 0) && ordinati && (!atteso.vicini || /min/.test(r.primi[0] || '')), { r, err });
    await ctx.close();
  }
  // ---------- animazioni accese ----------
  console.log('Animazioni accese (come su un telefono normale)');
  { const { ctx, p, err } = await apri({});
    await p.evaluate(() => document.querySelector('button[data-livello="Trastevere"]').click()); await p.waitForTimeout(400);
    await p.click('#gettone'); await p.waitForTimeout(150);
    const durante = await p.evaluate(() => ({ gira: document.querySelector('#rullo').classList.contains('gira'), esito: document.querySelector('#get-esito').children.length }));
    await p.waitForTimeout(1200);
    const dopo = await p.evaluate(() => ({ gira: document.querySelector('#rullo').classList.contains('gira'), nome: document.querySelector('#rullo').textContent, esito: document.querySelector('#get-esito').children.length }));
    dico('il gettone gira (nomi che scorrono) e poi si ferma su un posto: ' + dopo.nome, durante.gira && durante.esito === 0 && !dopo.gira && dopo.esito > 3 && err.length === 0, { durante, dopo, err });
    // gettoni a raffica: l'ultimo vince, nessun timer rimasto appeso
    for (let i = 0; i < 6; i++) { await p.click('[data-get=ancora]').catch(() => {}); await p.waitForTimeout(40); }
    await p.waitForTimeout(1300);
    const raffica = await p.evaluate(() => ({ gira: document.querySelector('#rullo').classList.contains('gira'), nome: document.querySelector('#rullo').textContent, sr: (document.querySelector('#get-esito .sr') || {}).textContent }));
    dico('sei gettoni toccati a raffica: resta un solo risultato coerente', !raffica.gira && raffica.sr === 'È uscito ' + raffica.nome + '.' && err.length === 0, { raffica, err });
    await p.evaluate(() => document.querySelector('#dlg-gettone').close()); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('[data-moneta]').click()); await p.waitForTimeout(1500);
    dico('la finestra della moneta con i saltelli: nessun errore', await p.evaluate(() => document.querySelector('#dlg-moneta').open) && err.length === 0, err);
    await ctx.close(); }
  // ---------- alto contrasto (Windows) ----------
  console.log('Schermo ad alto contrasto');
  { const { ctx, p, err } = await apri({ opz: { forcedColors: 'active', viewport: { width: 1280, height: 800 } } });
    await p.evaluate(() => document.querySelector('button[data-livello="Trastevere"]').click()); await p.waitForTimeout(500);
    const r = await p.evaluate(() => { const invisibili = []; for (const e of document.querySelectorAll('.btn, .level, .tab, .pw, .card, .seg button, .partenza-scelte button')) { const r = e.getBoundingClientRect(); if (!r.width) continue; const c = getComputedStyle(e), p = getComputedStyle(e.parentElement); const bordo = c.borderTopStyle !== 'none' && parseFloat(c.borderTopWidth) > 0 || c.outlineStyle !== 'none'; if (!bordo && c.backgroundColor === p.backgroundColor) invisibili.push((e.id ? '#' + e.id : '.' + String(e.className).split(' ')[0])); } return { n: document.querySelectorAll('.card').length, invisibili: [...new Set(invisibili)] }; });
    await p.screenshot({ path: FOTO + '/alto-contrasto.png' });
    if (r.invisibili.length) console.log('  ! con l’alto contrasto di Windows questi riquadri perdono il contorno (il testo resta leggibile): ' + r.invisibili.join(', '));
    dico('con l’alto contrasto il sito funziona e non dà errori (' + r.n + ' schede)', r.n > 5 && err.length === 0, { r, err });
    await ctx.close(); }
  await b.close(); console.log(`\n${ok} ok · ${ko} KO`); process.exitCode = ko ? 1 : 0;
})();
