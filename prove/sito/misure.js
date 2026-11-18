// Schermi di ogni misura: niente scorrimento di lato, niente pezzi fuori dallo schermo, finestre che ci stanno,
// pulsanti abbastanza grandi da toccare (almeno 24 punti), testi non tagliati.
const { chromium } = require('playwright');
const BASE = 'http://localhost:8765/';
const LARGHEZZE = [320, 360, 390, 430, 600, 768, 1024, 1366, 1920];
const TAVOLA = { nome: 'Gli Irriducibili del Giovedì Sera', chiave: 'chiave-di-prova-000000000', creata: '2026-11-10', io: 1, capo: 1,
  posti: ['Massimiliano Maria', 'Gaia la Gricia Doc', 'Sor Supplì al Telefono', 'Miss Maritozzo 2000', 'WWWWWWWWWWWWWWWWWWWW', 'Ale', 'Francesca Romana 🍝', 'Zio'].map((nome, i) => ({ n: i + 1, nome, faccia: i % 6 })),
  luoghi: ['3935991939893424995', '1327815495698668467', '3299677369094428047', '11144216186837032494', '6626598468491966039', '13564577393826486634'].map((id, i) => ({ id, da: 1 + i % 3, aggiunto: '2026-11-1' + i, fatto: i > 3 ? '2026-11-11' : null, voti: i === 0 ? [1, 2, 3, 4, 5, 6, 7, 8] : i === 1 ? [] : [] })) };
const CONTROLLA = () => {
  const W = innerWidth, out = { scorre: document.documentElement.scrollWidth - W, fuori: [], piccoli: [], tagliati: [], finestra: null };
  const d = [...document.querySelectorAll('dialog[open]')].pop();
  const radice = d || document.body;
  if (d) { const r = d.getBoundingClientRect(); out.finestra = { larga: Math.round(r.width), sborda: r.left < -1 || r.right > W + 1, scorreDiLato: d.scrollWidth - d.clientWidth }; }
  const visibile = (e) => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && +c.opacity > 0 && !e.closest('.sr') && !e.closest('[hidden]'); };
  const scorrevole = (e) => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const o = getComputedStyle(x).overflowX; if ((o === 'auto' || o === 'scroll' || o === 'hidden') && x.scrollWidth > x.clientWidth) return true; } return false; };
  for (const e of radice.querySelectorAll('*')) {
    if (!visibile(e) || e.closest('.leaflet-container') || e.closest('svg')) continue;
    const r = e.getBoundingClientRect();
    if ((r.right > W + 1 || r.left < -1) && !scorrevole(e)) out.fuori.push((e.id ? '#' + e.id : e.className ? '.' + String(e.className).split(' ')[0] : e.tagName.toLowerCase()) + ' ' + Math.round(r.right - W));
    if (e.matches('button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button]') && !e.disabled) {
      const inRiga = e.matches('a') && getComputedStyle(e).display === 'inline' && e.parentElement && e.parentElement.textContent.trim().length > e.textContent.trim().length + 10;   // link dentro una frase: ammesso
      const etichetta = e.matches('input') && e.closest('label');   // casella dentro la sua etichetta: si tocca l'etichetta
      const b = etichetta ? e.closest('label').getBoundingClientRect() : r;
      if (!inRiga && (b.width < 24 || b.height < 24) && r.bottom > 0 && r.top < innerHeight) out.piccoli.push((e.id ? '#' + e.id : e.className ? '.' + String(e.className).split(' ')[0] : e.tagName.toLowerCase()) + ` «${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 18)}» ${Math.round(b.width)}×${Math.round(b.height)}`);
    }
    const c = getComputedStyle(e);
    if (e.children.length === 0 && e.textContent.trim() && (c.overflowX === 'hidden' || c.overflow === 'hidden') && e.scrollWidth > e.clientWidth + 1 && c.textOverflow !== 'ellipsis') out.tagliati.push((e.className ? '.' + String(e.className).split(' ')[0] : e.tagName.toLowerCase()) + ` «${e.textContent.trim().slice(0, 20)}»`);
  }
  out.fuori = [...new Set(out.fuori)].slice(0, 6); out.piccoli = [...new Set(out.piccoli)].slice(0, 8); out.tagliati = [...new Set(out.tagliati)].slice(0, 5);
  return out;
};
(async () => {
  const b = await chromium.launch(); const guai = [], piccoli = new Map(); let schermate = 0;
  for (const w of LARGHEZZE) {
    const ctx = await b.newContext({ viewport: { width: w, height: w < 700 ? 700 : 900 }, deviceScaleFactor: 1, hasTouch: w < 800, isMobile: w < 800, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} Math.random = () => 0.42; navigator.share = async () => {}; });
    await ctx.route('https://finto.supabase.co/**', (r) => { const fn = r.request().url().split('/rpc/')[1]; if (fn === 'conta') return r.fulfill({ status: 204, body: '' }); if (fn === 'comitiva_anteprima') return r.fulfill({ json: { nome: TAVOLA.nome, seduti: 8, liberi: 0, mia: false } }); r.fulfill({ json: TAVOLA }); });
    await ctx.route(/google\.com|paypal\.|wa\.me|cartocdn/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'x' }));
    const p = await ctx.newPage();
    await p.route('**/config.js', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace(/supabaseUrl: "[^"]*"/, 'supabaseUrl: "https://finto.supabase.co/"').replace(/supabaseKey: "[^"]*"/, 'supabaseKey: "sb_publishable_finta"').replace('conto: true', 'conto: false').replace('comitive: false', 'comitive: true') }); });
    await p.clock.install({ time: new Date('2026-11-12T20:30:00') });
    const guarda = async (nome) => { await p.waitForTimeout(250); schermate++; const r = await p.evaluate(CONTROLLA); const male = r.scorre > 1 || r.fuori.length || r.tagliati.length || (r.finestra && (r.finestra.sborda || r.finestra.scorreDiLato > 1)); if (male) guai.push({ w, nome, scorre: r.scorre, fuori: r.fuori, tagliati: r.tagliati, finestra: r.finestra }); for (const x of r.piccoli) piccoli.set(x.replace(/ \d+×\d+$/, ''), (piccoli.get(x.replace(/ \d+×\d+$/, '')) || new Set()).add(w + ':' + x.match(/\d+×\d+$/)[0])); };
    const chiudi = async () => { await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); await p.waitForTimeout(250); };
    await p.addInitScript(() => localStorage.setItem('sns-comitiva', 'segreto-di-prova-0000000'));
    await p.goto(BASE + 'index.html'); await p.waitForTimeout(900);
    await guarda('inizio');
    await p.evaluate(() => document.querySelector('#sez-mondi').scrollIntoView()); await guarda('zone');
    await p.evaluate(() => document.querySelector('#livelli').scrollIntoView()); await guarda('livelli');
    await p.evaluate(() => document.querySelector('#t-pw').scrollIntoView()); await guarda('filtri');
    await p.click('#m-comitiva').catch(() => {}); await guarda('comitiva: tavola piena, nomi lunghi');
    await p.click('.gestisci summary').catch(() => {}); await p.evaluate(() => document.querySelector('#dlg-comitiva').scrollTo(0, 99999)); await guarda('comitiva: gestisci');
    await p.evaluate(() => document.querySelector('#dlg-comitiva').scrollTo(0, 0)); await p.click('[data-com=gettone]').catch(() => {}); await guarda('comitiva: gettone');
    await chiudi();
    await p.evaluate(() => document.querySelector('button[data-livello="Trastevere"]').click()); await p.waitForTimeout(500);
    await p.evaluate(() => { const b = document.querySelector('.bar'); scrollTo(0, b.getBoundingClientRect().top + scrollY); }); await guarda('lista');
    await p.click('#gettone'); await p.waitForTimeout(400); await guarda('gettone');
    await p.click('[data-get=invita]'); await guarda('proponilo');
    await chiudi();
    await p.locator('.card a[href^="https://www.google.com/maps/dir/"]').first().click(); await guarda('prima di andare');
    await chiudi(); await p.evaluate(() => document.querySelector('[data-moneta]').click()); await guarda('moneta');
    await chiudi();
    if (w <= 960) { await p.click('[data-view=mappa]'); await p.waitForTimeout(1200); await guarda('mappa'); await p.click('[data-view=lista]'); }
    await p.fill('#q', 'zzzqqq'); await p.waitForTimeout(400); await guarda('nessun risultato'); await p.fill('#q', ''); await p.waitForTimeout(300);
    await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await guarda('fondo pagina');
    for (const pag of ['privacy.html', 'termini.html', 'statistiche.html?esempio']) { await p.goto(BASE + pag); await p.waitForTimeout(700); await guarda(pag.split('.')[0]); await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight / 2)); await guarda(pag.split('.')[0] + ' (metà)'); }
    await ctx.close();
    // prima visita: termini, poi domanda sulla posizione
    const c2 = await b.newContext({ viewport: { width: w, height: 700 }, reducedMotion: 'reduce' }); const q = await c2.newPage();
    const g2 = async (nome) => { await q.waitForTimeout(300); schermate++; const r = await q.evaluate(CONTROLLA); if (r.scorre > 1 || r.fuori.length || (r.finestra && (r.finestra.sborda || r.finestra.scorreDiLato > 1))) guai.push({ w, nome, scorre: r.scorre, fuori: r.fuori, finestra: r.finestra }); };
    await q.goto(BASE + 'index.html'); await q.waitForTimeout(700); await g2('termini (prima visita)');
    await q.click('#termini-ok'); await q.waitForTimeout(600); await g2('posizione (prima visita)');
    await c2.close();
  }
  await b.close();
  console.log(`schermate guardate: ${schermate} (su ${LARGHEZZE.length} larghezze, da ${LARGHEZZE[0]} a ${LARGHEZZE[LARGHEZZE.length - 1]} punti)`);
  console.log(guai.length ? `✗ ${guai.length} schermate con qualcosa fuori posto:` : '✓ nessuna schermata scorre di lato, sborda o taglia un testo');
  for (const g of guai.slice(0, 25)) console.log('   ' + JSON.stringify(g).slice(0, 330));
  console.log(piccoli.size ? `! ${piccoli.size} comandi più piccoli di 24 punti in almeno una misura:` : '✓ tutti i comandi sono abbastanza grandi da toccare');
  for (const [k, v] of [...piccoli].slice(0, 25)) console.log('   ' + k + '  →  ' + [...v].slice(0, 5).join('  '));
  process.exitCode = guai.length ? 1 : 0;
})();
