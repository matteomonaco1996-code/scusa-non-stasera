// Strumenti comuni: porta la pagina nelle schermate che contano e misura il contrasto di ogni testo visibile.
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/index.html';
async function apri(b, tema, opz = {}) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce', geolocation: { latitude: 41.8893, longitude: 12.4707 }, permissions: ['geolocation'], ...opz });
  await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
  await ctx.addInitScript(() => { Math.random = () => 0.42; });   // il gettone pesca sempre lo stesso posto, così le foto si confrontano
  await ctx.route(/google\.com|paypal\./, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'x' }));
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date('2026-11-12T20:30:00') });
  await p.goto(U); await p.waitForTimeout(700);
  return { ctx, p };
}
// Le schermate: ognuna porta la pagina in uno stato e dice dove guardare
const SCHERMATE = [
  ['inizio', async (p) => { await p.evaluate(() => scrollTo(0, 0)); }],
  ['zone', async (p) => { await p.evaluate(() => document.querySelector('#sez-mondi').scrollIntoView()); }],
  ['lista', async (p) => { await p.evaluate(() => document.querySelector('button[data-livello="Trastevere"]').click()); await p.waitForTimeout(500); await p.evaluate(() => { const b = document.querySelector('.bar'); scrollTo(0, b.getBoundingClientRect().top + scrollY); }); }],
  ['gettone', async (p) => { await p.click('#gettone'); await p.waitForTimeout(500); }],
  ['prima', async (p) => { await p.click('#dlg-gettone [data-chiudi]'); await p.waitForTimeout(500); await p.locator('.card a[href^="https://www.google.com/maps/dir/"]').first().click(); await p.waitForTimeout(400); }],
  ['mappa', async (p) => { await p.click('#dlg-vai [data-chiudi]'); await p.waitForTimeout(500); await p.click('#gettone'); await p.waitForTimeout(500); await p.click('[data-get=mappa]'); await p.waitForTimeout(1500); }],
  ['fondo', async (p) => { await p.evaluate(() => { document.querySelector('[data-view=lista]').click(); }); await p.waitForTimeout(400); await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); }],
];
// Contrasto di ogni testo visibile nella finestra corrente
const MISURA = () => {
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const leggi = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[, /]+/).map(Number); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; };
  const sopra = (a, b) => [0, 1, 2].map((i) => a[i] * a[3] + b[i] * (1 - a[3]));
  const fondoDi = (el) => { const strati = []; for (let e = el; e; e = e.parentElement) { const c = leggi(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) { strati.push(c); if (c[3] >= 1) break; } } let base = [255, 255, 255]; for (const c of strati.reverse()) base = sopra(c, base); return base; };
  const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const out = [], visti = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const aperte = [...document.querySelectorAll('dialog[open]')];
  for (let n; (n = w.nextNode());) {
    const t = n.textContent.trim(); if (t.length < 2) continue;
    const el = n.parentElement; if (!el || visti.has(el)) continue;
    if (aperte.length && !aperte[aperte.length - 1].contains(el)) continue;      // con una finestra aperta conta solo quella in primo piano
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0 || el.closest('.sr')) continue;
    visti.add(el);
    const disegno = el instanceof SVGElement;                                   // nei disegni il colore del testo è il riempimento
    const col = leggi(disegno ? cs.fill : cs.color); if (!col) continue;
    let bg = fondoDi(el);
    if (disegno) { const q = el.parentElement && el.parentElement.querySelector('rect:not(.ow-hit)'); const f = q && leggi(getComputedStyle(q).fill); if (f && f[3] > 0) bg = sopra(f, bg); }   // testo dentro un riquadro disegnato
    const fg = sopra(col, bg);
    const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize), grande = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 600);
    out.push({ testo: t.slice(0, 36), fg: hex(fg), bg: hex(bg), ratio: Math.round(ratio * 100) / 100, px: Math.round(px), font: cs.fontFamily.split(',')[0].replace(/"/g, ''), grande, soglia: grande ? 3 : 4.5, cls: (el.className && String(el.className).slice(0, 24)) || el.tagName.toLowerCase() });
  }
  return out;
};
module.exports = { chromium, devices, apri, SCHERMATE, MISURA, U };
