// Il gettone e l'ora del giorno: se in zona ci sono posti adatti si pesca tra quelli (anche pochi); se non ce ne sono lo dice.
const { chromium, devices } = require('playwright');
const FOTO = process.env.PROVE_FOTO || require('os').tmpdir();   // dove finiscono le schermate
(async () => {
  const b = await chromium.launch(); let ok = 0, ko = 0; const dico = (m, c, x) => { c ? ok++ : ko++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (c ? '' : ' → ' + JSON.stringify(x).slice(0, 500))); };
  const ctx = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', (e) => err.push(String(e)));
  await p.clock.install({ time: new Date('2026-11-12T08:15:00') }); await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(600);
  const zone = await p.evaluate(() => { const C = ['dolce', 'bottega'], per = {}; for (const x of window.RISTOMAT.filter((x) => x.c === 'Roma' && x.q && x.q !== 'Periferia')) { per[x.q] = per[x.q] || { tot: 0, ad: 0 }; per[x.q].tot++; if (C.includes(x.t)) per[x.q].ad++; } return per; });
  const pochi = Object.entries(zone).find(([, v]) => v.ad >= 1 && v.ad <= 2 && v.tot > 6), nessuno = Object.entries(zone).find(([, v]) => v.ad === 0 && v.tot > 4), tanti = Object.entries(zone).find(([, v]) => v.ad >= 3);
  for (const [caso, [q, v]] of [['pochi posti da colazione', pochi], ['nessun posto da colazione', nessuno], ['tanti posti da colazione', tanti]]) {
    await p.evaluate(() => { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); }); await p.waitForTimeout(250);
    await p.evaluate((q) => document.querySelector(`button[data-livello="${q}"]`).click(), q); await p.waitForTimeout(400);
    const usciti = new Set(), tipi = new Set(); let info = '', altro = null, link = '';
    await p.click('#gettone'); await p.waitForTimeout(400);
    for (let i = 0; i < 6; i++) { const r = await p.evaluate(() => ({ nome: document.querySelector('#rullo').textContent, tipo: document.querySelector('#get-esito .tipo').textContent, info: document.querySelector('.get-info').textContent.replace(/\s+/g, ' ').trim(), spento: document.querySelector('[data-get=ancora]').disabled, link: [...document.querySelectorAll('.get-info .link')].map((l) => l.textContent).join() })); usciti.add(r.nome); tipi.add(r.tipo); info = r.info; altro = r.spento; link = r.link; if (r.spento) break; await p.click('[data-get=ancora]'); await p.waitForTimeout(300); }
    const soloColazione = [...tipi].every((t) => /Dolce|Spesa/.test(t));
    if (caso.startsWith('nessun')) dico(`${q} alle 8 (${v.ad} adatti su ${v.tot}): pesca tra tutti e lo dice — «${info.slice(0, 110)}»`, !soloColazione && /non ne ho di adatti all’ora \(colazione\)/.test(info), { info, tipi: [...tipi] });
    else dico(`${q} alle 8 (${v.ad} adatti su ${v.tot}): escono solo posti da colazione (${[...usciti].join(', ')})${link ? ' · con il link «' + link + '»' : ''}`, soloColazione && usciti.size === Math.min(v.ad, 6) && /adatt[oi] all’ora \(colazione\)/.test(info) && /Vanno bene tutti i tipi/.test(link), { info, tipi: [...tipi], usciti: [...usciti], altro });
  }
  // «Vanno bene tutti i tipi» allarga davvero
  await p.click('.get-info .link'); await p.waitForTimeout(400);
  const largo = await p.evaluate(() => document.querySelector('.get-info').textContent.replace(/\s+/g, ' ').trim());
  dico('«Vanno bene tutti i tipi» allarga la pesca: «' + largo.slice(0, 70) + '»', /di ogni tipo/.test(largo) && /Solo quelli adatti all’ora/.test(largo), largo);
  dico('nessun errore', err.length === 0, err);
  // la schermata quando la lista non arriva
  const c2 = await b.newContext({ ...devices['iPhone 13'] }); await c2.route('**/locali.js', (r) => r.abort()); const q = await c2.newPage(); const e2 = []; q.on('pageerror', (e) => e2.push(String(e)));
  await q.goto('http://localhost:8765/index.html'); await q.waitForTimeout(700); await q.screenshot({ path: FOTO + '/senza-lista.png' });
  const s = await q.evaluate(() => ({ testo: document.querySelector('.battuta.gioco .fumetto').textContent.replace(/\s+/g, ' ').trim(), bottone: !!document.querySelector('.battuta.gioco .fumetto button'), tessere: getComputedStyle(document.querySelector('.partenza')).display, termini: document.querySelector('#dlg-termini').open }));
  dico('se la lista non arriva: «' + s.testo + '», senza pulsanti morti', /Non riesco a caricare la lista dei posti/.test(s.testo) && s.bottone && s.tessere === 'none' && !s.termini && e2.length === 0, { s, e2 });
  await b.close(); console.log(`\n${ok} ok · ${ko} KO`); process.exitCode = ko ? 1 : 0;
})();
