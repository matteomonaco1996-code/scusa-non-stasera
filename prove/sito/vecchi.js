// Browser un po' vecchi: quelli che non capiscono la regola ":has()" dei fogli di stile (Chrome prima del 2022,
// Safari prima del 2022, Firefox prima del 2024). Qui la si toglie a mano e si guarda che cosa resta leggibile.
const { chromium, devices } = require('playwright');
const FOTO = process.env.PROVE_FOTO || require('os').tmpdir();   // dove finiscono le schermate
const { MISURA } = require('./_misura.js');
let ok = 0, ko = 0; const dico = (m, c, x) => { c ? ok++ : ko++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (c ? '' : ' → ' + JSON.stringify(x).slice(0, 600))); };
const TOGLI = () => { let n = 0; const giro = (regole, padre) => { for (let i = regole.length - 1; i >= 0; i--) { const r = regole[i]; if (r.selectorText) { if (r.selectorText.includes(':has(')) { padre.deleteRule(i); n++; } } else if (r.cssRules) giro(r.cssRules, r); } }; for (const f of document.styleSheets) { try { giro(f.cssRules, f); } catch (e) {} } return n; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
  await ctx.route('https://finto.supabase.co/**', (r) => r.fulfill({ status: 204, body: '' }));
  const p = await ctx.newPage();
  await p.route('**/config.js', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace(/supabaseUrl: "[^"]*"/, 'supabaseUrl: "https://finto.supabase.co/"').replace(/supabaseKey: "[^"]*"/, 'supabaseKey: "sb_publishable_finta"').replace('conto: true', 'conto: false').replace('comitive: false', 'comitive: true') }); });
  for (const [nome, url] of [['Privacy', 'privacy.html'], ['Termini', 'termini.html'], ['Monitoraggio', 'statistiche.html?esempio']]) {
    await p.goto('http://localhost:8765/' + url); await p.waitForTimeout(700);
    const tolte = await p.evaluate(TOGLI); const esiti = [];
    const alto = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < alto; y += 600) { await p.evaluate((yy) => scrollTo(0, yy), y); await p.waitForTimeout(80); esiti.push(...await p.evaluate(MISURA)); }
    const sotto = esiti.filter((m) => m.ratio < m.soglia);
    dico(`${nome} su un browser senza «:has» (${tolte} regole tolte): ${esiti.length} testi, il meno leggibile ha contrasto ${Math.min(...esiti.map((m) => m.ratio))}`, sotto.length === 0, { sotto: sotto.length, esempio: sotto.slice(0, 2).map((m) => `«${m.testo}» ${m.fg} su ${m.bg} = ${m.ratio}`) });
    if (nome === 'Privacy') await p.screenshot({ path: FOTO + '/vecchi-privacy.png' });
  }
  // la scelta della faccia quando si crea una comitiva: si deve vedere quale è scelta
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(900); await p.evaluate(TOGLI);
  await p.click('#m-comitiva'); await p.waitForTimeout(300);
  const f = await p.evaluate(() => { const k = (e) => { const c = getComputedStyle(e), i = getComputedStyle(e.querySelector('img')); return c.boxShadow + '|' + c.outlineStyle + '|' + c.backgroundColor + '|' + i.outlineStyle + '|' + i.boxShadow; }; const l = [...document.querySelectorAll('.facce label')]; return { scelta: k(l[0]), altra: k(l[1]) }; });
  dico('senza «:has» si vede comunque quale faccia è scelta', f.scelta !== f.altra, f);
  await b.close(); console.log(`\n${ok} ok · ${ko} KO`); process.exitCode = ko ? 1 : 0;
})();
