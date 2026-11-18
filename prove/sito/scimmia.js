// La scimmia: tocca a caso, tante volte, e si guarda se qualcosa si rompe. Animazioni accese (come sui telefoni veri).
//   node scimmia.js [quanti giri] [quanti tocchi per giro]
const { chromium, devices } = require('playwright');
const BASE = 'http://localhost:8765/index.html', GIRI = +process.argv[2] || 6, TOCCHI = +process.argv[3] || 160;
const TAVOLA = { nome: 'I Mangioni di Via Po', chiave: 'chiave-di-prova-000000000', creata: '2026-11-10', io: 1, capo: 1, posti: [{ n: 1, nome: 'Matteo', faccia: 0 }, { n: 2, nome: 'Gaia la Gricia', faccia: 3 }],
  luoghi: [{ id: '3935991939893424995', da: 1, aggiunto: '2026-11-10', fatto: null, voti: [1, 2] }, { id: '1327815495698668467', da: 2, aggiunto: '2026-11-11', fatto: null, voti: [] }] };
(async () => {
  const b = await chromium.launch(); let guai = 0; const riassunto = [];
  for (let giro = 0; giro < GIRI; giro++) {
    const telefono = giro % 2 === 0, conComitive = giro % 3 === 0, conPosizione = giro % 3 === 1, ora = ['08:10', '12:45', '16:30', '20:30', '23:40', '03:15'][giro % 6];
    let seme = 1234567 + giro * 7919; const caso = () => { seme = (seme * 1103515245 + 12345) & 0x7fffffff; return seme / 0x7fffffff; };
    const ctx = await b.newContext({ ...(telefono ? devices['Pixel 7'] : { viewport: { width: 1280, height: 800 } }), ...(conPosizione ? { geolocation: { latitude: 41.8893, longitude: 12.4707 }, permissions: ['geolocation'] } : {}) });
    await ctx.addInitScript(([c]) => { try { localStorage.setItem('sns-termini', '1.1'); if (c) localStorage.setItem('sns-comitiva', 'segreto-di-prova-0000000'); } catch (e) {} navigator.share = async () => {}; window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective)); }, [conComitive]);
    await ctx.route('https://finto.supabase.co/**', (r) => { const fn = r.request().url().split('/rpc/')[1]; if (fn === 'conta') return r.fulfill({ status: 204, body: '' }); if (fn === 'comitiva_anteprima') return r.fulfill({ json: { nome: TAVOLA.nome, seduti: 2, liberi: 6, mia: true } }); if (fn === 'comitiva_alzati') return r.fulfill({ status: 204, body: '' }); r.fulfill({ json: TAVOLA }); });
    await ctx.route(/google\.com|paypal\.|wa\.me|cartocdn/, (r) => r.fulfill({ status: 200, contentType: /cartocdn/.test(r.request().url()) ? 'image/png' : 'text/html', body: 'x' }));
    let p = null; ctx.on('page', (pg) => { if (p && pg !== p) pg.close().catch(() => {}); });
    p = await ctx.newPage(); const err = [];
    p.on('pageerror', (e) => err.push('ERRORE ' + String(e).slice(0, 170))); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::|status of 4/.test(m.text())) err.push('console ' + m.text().slice(0, 170)); });
    p.on('dialog', (d) => d.accept().catch(() => {}));
    if (conComitive) await p.route('**/config.js', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace(/supabaseUrl: "[^"]*"/, 'supabaseUrl: "https://finto.supabase.co/"').replace(/supabaseKey: "[^"]*"/, 'supabaseKey: "sb_publishable_finta"').replace('conto: true', 'conto: false').replace('comitive: false', 'comitive: true') }); });
    await p.clock.install({ time: new Date('2026-11-12T' + ora + ':00') });
    await p.goto(BASE); await p.waitForTimeout(800);
    const storia = []; let fatti = 0;
    for (let t = 0; t < TOCCHI; t++) {
      if (!p.url().startsWith('http://localhost:8765/index.html')) { await p.goto(BASE).catch(() => {}); await p.waitForTimeout(500); storia.push('torna al sito'); continue; }   // era uscito su una pagina legale
      const r = caso();
      try {
        if (r < 0.06) { await p.keyboard.press('Escape'); storia.push('Esc'); }
        else if (r < 0.12) { await p.goBack({ timeout: 2500 }).catch(() => {}); storia.push('indietro'); }
        else if (r < 0.15) { await p.goForward({ timeout: 2500 }).catch(() => {}); storia.push('avanti'); }
        else if (r < 0.2) { await p.mouse.wheel(0, (caso() - 0.4) * 1800); storia.push('scorre'); }
        else if (r < 0.24) { const parole = ['carbonara', 'zzz', 'pizza trastevere', '', 'è', '<b>', 'vino  ']; const w = parole[Math.floor(caso() * parole.length)]; await p.evaluate((w) => { const d = document.querySelector('dialog[open]'); if (d) return; const q = document.querySelector('#q'); q.value = w; q.dispatchEvent(new Event('input', { bubbles: true })); }, w); storia.push('cerca «' + w + '»'); }
        else if (r < 0.26) { await p.reload(); await p.waitForTimeout(500); storia.push('ricarica'); }
        else if (r < 0.28 && !telefono) { await p.setViewportSize({ width: [700, 1000, 1280, 1500][Math.floor(caso() * 4)], height: 800 }); storia.push('ridimensiona'); }
        else {
          const scelto = await p.evaluate((k) => {
            const d = [...document.querySelectorAll('dialog[open]')].pop(), radice = d || document;
            const tutti = [...radice.querySelectorAll('button, a[href], summary, input[type=radio], g[tabindex], [data-moneta]')].filter((e) => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 2 && r.height > 2 && c.visibility !== 'hidden' && !e.disabled && !e.closest('[hidden]') && !(e.matches('a') && /^(mailto:|https:\/\/www\.openstreetmap|https:\/\/carto)/.test(e.getAttribute('href') || '')); });
            if (!tutti.length) return null;
            const e = tutti[Math.floor(k * tutti.length)];
            e.scrollIntoView({ block: 'center' }); e.dataset.scimmia = '1';
            return (e.id ? '#' + e.id : (e.getAttribute('class') || e.tagName).toString().split(' ')[0]) + ' «' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 20) + '»';
          }, caso());
          if (scelto) { await p.locator('[data-scimmia="1"]').first().click({ timeout: 1500, force: true }).catch(() => {}); await p.evaluate(() => document.querySelectorAll('[data-scimmia]').forEach((e) => e.removeAttribute('data-scimmia'))).catch(() => {}); storia.push(scelto); fatti++; }
        }
      } catch (e) { storia.push('(azione non riuscita)'); }
      await p.waitForTimeout(telefono ? 90 : 60);
      if (err.length) break;
    }
    // alla fine: il sito è ancora vivo e in ordine?
    let fine = {};
    try {
      if (!p.url().startsWith('http://localhost:8765/index.html')) { await p.goto(BASE); await p.waitForTimeout(600); }
      await p.waitForTimeout(600);
      fine = await p.evaluate(() => ({ aperte: [...document.querySelectorAll('dialog[open]')].map((d) => d.id), scorre: document.documentElement.scrollWidth - innerWidth, strano: (document.body.innerText.match(/undefined|NaN|\[object|null posti/g) || []).slice(0, 3), schede: document.querySelectorAll('.card').length, csp: window.__csp }));
      await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); await p.waitForTimeout(300);
      await p.evaluate(() => { const b = document.querySelector('[data-restart]:not([hidden])'); if (b) b.click(); }); await p.waitForTimeout(500);
      await p.evaluate(() => document.querySelector('button[data-livello="Trastevere"]').click()); await p.waitForTimeout(500);
      fine.vivo = await p.evaluate(() => document.querySelectorAll('.card').length);
    } catch (e) { fine.rotto = String(e).slice(0, 120); }
    const male = err.length || fine.rotto || fine.scorre > 1 || (fine.strano || []).length || (fine.csp || []).length || !(fine.vivo > 5);
    if (male) guai++;
    riassunto.push(`${male ? '✗' : '✓'} giro ${giro + 1} (${telefono ? 'telefono' : 'computer'}, ore ${ora}${conComitive ? ', comitive accese' : ''}${conPosizione ? ', con la posizione' : ''}): ${fatti} tocchi su ${storia.length} azioni · alla fine ${fine.vivo} schede a Trastevere` + (male ? ' → ' + JSON.stringify({ err: err.slice(0, 3), fine, ultime: storia.slice(-8) }).slice(0, 900) : ''));
    await ctx.close();
  }
  await b.close();
  for (const r of riassunto) console.log(r);
  console.log(`\n${GIRI - guai} giri puliti su ${GIRI}`); process.exitCode = guai ? 1 : 0;
})();
