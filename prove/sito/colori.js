// La tavolozza definitiva: cornice bordeaux, carta chiara dove si legge.  node colori.js [indirizzo]
const { chromium, devices } = require('playwright');
const BASE = (process.argv[2] || 'http://localhost:8765/').replace(/index\.html$/, '');
let ok = 0, ko = 0; const dico = (m, c, x) => { c ? ok++ : ko++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (c ? '' : ' → ' + JSON.stringify(x))); };
const lum = (s) => { const v = s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return Math.round((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) * 10) / 10; };
(async () => {
  const b = await chromium.launch();
  for (const [dove, opz, coda] of [['telefono', { ...devices['iPhone 13'] }, ''], ['computer', { viewport: { width: 1280, height: 800 } }, ''], ['vecchio link di prova', { ...devices['iPhone 13'] }, '?tema=notte&da=amici']]) {
    const ctx = await b.newContext({ ...opz, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} Math.random = () => 0.42; });
    const carto = []; await ctx.route(/cartocdn\.com/, (r) => { carto.push(r.request().url()); r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }); });
    await ctx.route(/google\.com|paypal\./, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'x' }));
    const p = await ctx.newPage(); const errori = [];
    p.on('console', (m) => { if (m.type() === 'error') errori.push(m.text().slice(0, 140)); }); p.on('pageerror', (e) => errori.push(String(e).slice(0, 140)));
    await p.goto(BASE + coda); await p.waitForTimeout(900);
    const k = (sel, prop, ps) => p.evaluate(([s, pr, pseudo]) => { const e = document.querySelector(s); return e ? getComputedStyle(e, pseudo || undefined)[pr] : null; }, [sel, prop, ps]);
    const s = { attr: await p.evaluate(() => document.documentElement.getAttribute('data-tema')), bg: await k('body', 'backgroundColor'), righe: await k('body', 'backgroundImage'), sopra: await k('body', 'content', '::after'), barra: await p.evaluate(() => document.querySelector('meta[name="theme-color"]').content), fumetto: await k('.fumetto', 'backgroundColor') };
    dico(dove + ': pagina bordeaux, righe solo sul fondo e niente più sopra i testi', s.attr === null && s.bg === 'rgb(105, 20, 33)' && /repeating-linear-gradient/.test(s.righe) && (s.sopra === 'none' || s.sopra === 'normal') && s.barra === '#691421', s);
    // zone: tessere di carta, quella scelta d'oro
    const z = await p.evaluate(() => { const g = (e) => { const c = getComputedStyle(e); return [c.backgroundColor, c.color]; }; return { scelta: g(document.querySelector('.tab[aria-pressed="true"]')), altra: g(document.querySelector('.tab[aria-pressed="false"]')), livello: g(document.querySelector('.level[aria-pressed="false"]')), mondo: getComputedStyle(document.querySelector('.overworld')).backgroundColor }; });
    dico(dove + ': tessere delle zone su carta, quella scelta resta d’oro', z.scelta[0] === 'rgb(242, 182, 50)' && z.altra[0] === 'rgb(249, 239, 216)' && z.livello[0] === 'rgb(249, 239, 216)' && z.mondo === 'rgb(249, 239, 216)' && cr(z.scelta[0], z.scelta[1]) >= 7 && cr(z.altra[0], z.altra[1]) >= 7, z);
    await p.evaluate(() => document.querySelector('button[data-livello="Trastevere"]').click()); await p.waitForTimeout(700);
    const l = await p.evaluate(() => { const c = document.querySelector('.card'), t = c.querySelector('.tipo'), k = (e) => getComputedStyle(e); return { fondo: k(c).backgroundColor, titolo: k(c.querySelector('h4')).color, ind: k(c.querySelector('.addr')).color, tipo: k(t).color, tipoH: Math.round(t.getBoundingClientRect().height), breve: c.querySelector('.say') ? [k(c.querySelector('.say')).backgroundColor, k(c.querySelector('.say')).color] : null, vai: k(c.querySelector('.acts a.vai')).color, maps: k(c.querySelector('.acts a:not(.vai)')).color, n: document.querySelectorAll('.card').length }; });
    dico(dove + ': schede di carta con inchiostro scuro (contrasto titolo ' + cr(l.fondo, l.titolo) + ', indirizzo ' + cr(l.fondo, l.ind) + ', link ' + cr(l.fondo, l.vai) + ' e ' + cr(l.fondo, l.maps) + ')', l.fondo === 'rgb(249, 239, 216)' && cr(l.fondo, l.titolo) >= 12 && cr(l.fondo, l.ind) >= 4.5 && cr(l.fondo, l.vai) >= 4.5 && cr(l.fondo, l.maps) >= 4.5 && cr(l.fondo, l.tipo) >= 4.5 && l.n > 5, l);
    dico(dove + ': l’etichetta del tipo di locale sta su una riga (' + l.tipoH + ' px)', l.tipoH < 30, l);
    // finestra: carta, cornice d'oro, pulsante principale bordeaux con scritta crema
    await p.locator('.card a[href^="https://www.google.com/maps/dir/"]').first().click(); await p.waitForTimeout(500);
    const d = await p.evaluate(() => { const f = document.querySelector('#dlg-vai'), k = (e) => getComputedStyle(e), v = f.querySelector('#vai-ora'), m = f.querySelector('.moneta-importo'); return { aperta: f.open, fondo: k(f).backgroundColor, cornice: k(f).boxShadow, testo: k(f).color, tasto: [k(v).backgroundColor, k(v).color], moneta: [k(m).backgroundColor, k(m).color], titolo: k(f.querySelector('h2')).color, testa: k(f.querySelector('.testa')).backgroundColor }; });
    dico(dove + ': finestra «Prima di andare» su carta con cornice d’oro; «Vai al posto» bordeaux con scritta crema', d.aperta && d.fondo === 'rgb(249, 239, 216)' && /242, 182, 50/.test(d.cornice) && d.tasto[0] === 'rgb(130, 24, 40)' && cr(d.tasto[0], d.tasto[1]) >= 7 && cr(d.fondo, d.testo) >= 12 && cr(d.moneta[0], d.moneta[1]) >= 4.5 && cr(d.testa, d.titolo) >= 4.5, d);
    await p.click('#dlg-vai [data-chiudi]'); await p.waitForTimeout(500);
    // mappa: chiara, segnaposto scuri, nomi delle vie dallo sfondo chiaro
    if (dove !== 'computer') { await p.click('[data-view=mappa]'); } await p.waitForTimeout(1900);
    const m = await p.evaluate(() => { const el = document.querySelector('#mappa'), cs = getComputedStyle(el), pin = el.querySelector('.pin.breve') || el.querySelector('.pin'); return { fondo: cs.backgroundColor, via: cs.getPropertyValue('--via-grande').trim(), fiume: cs.getPropertyValue('--fiume').trim(), tela: !!el.querySelector('canvas'), pin: document.querySelectorAll('.pin').length, colorePin: getComputedStyle(pin).backgroundColor, nomi: getComputedStyle(el.querySelector('.base-quartiere') || el).color }; });
    dico(dove + ': mappa chiara disegnata (' + m.pin + ' segnaposto, contrasto segnaposto ' + cr(m.fondo, m.colorePin) + ')', m.fondo === 'rgb(243, 235, 215)' && m.tela && m.pin > 5 && m.via === '#A86F66' && m.fiume === '#82B1D3' && cr(m.fondo, m.colorePin) >= 4.5, m);
    await p.click('[data-sfondo]'); await p.waitForTimeout(1200);
    dico(dove + ': i nomi delle vie arrivano dallo sfondo chiaro (' + carto.length + ' tasselli)', carto.length > 0 && carto.every((u) => u.includes('/light_all/')), carto.slice(0, 2));
    const st = await p.evaluate(() => Object.keys(localStorage).sort().join(','));
    dico(dove + ': nessun errore, nessun blocco di sicurezza', errori.length === 0, errori);
    await ctx.close();
  }
  // pagine di testo su carta, monitoraggio scuro; i file della prova non ci sono più
  const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage();
  for (const [pag, atteso] of [['privacy.html', 'rgb(249, 239, 216)'], ['termini.html', 'rgb(249, 239, 216)'], ['statistiche.html', 'rgb(56, 12, 18)']]) {
    await p.goto(BASE + pag); await p.waitForTimeout(600);
    const r = await p.evaluate(() => { const k = (e) => getComputedStyle(e); const h = document.querySelector('h1'), a = document.querySelector('main a'), par = document.querySelector('main p:nth-of-type(2)') || document.querySelector('main p'); return { fondo: k(document.body).backgroundColor, h1: k(h).color, link: k(a).color, testo: k(par).color, barra: document.querySelector('meta[name="theme-color"]').content }; });
    dico(pag + ': ' + (pag === 'statistiche.html' ? 'resta scura' : 'tutta su carta') + ' (contrasto testo ' + cr(r.fondo, r.testo) + ', titolo ' + cr(r.fondo, r.h1) + ', link ' + cr(r.fondo, r.link) + ')', r.fondo === atteso && cr(r.fondo, r.testo) >= 7 && cr(r.fondo, r.h1) >= 4.5 && cr(r.fondo, r.link) >= 4.5 && r.barra === '#691421', r);
  }
  const via = await p.evaluate(async (base) => { const out = {}; for (const f of ['css/temi.css', 'js/tema.js']) { try { const r = await fetch(base + f, { cache: 'no-store' }); out[f] = r.status; } catch (e) { out[f] = 'errore'; } } return out; }, BASE);
  dico('i file della prova (temi.css, tema.js) non sono più pubblicati', Object.values(via).every((x) => x !== 200), via);
  const man = await p.evaluate(async (base) => (await (await fetch(base + 'manifest.webmanifest', { cache: 'no-store' })).json()), BASE);
  dico('icona sulla schermata Home: colore di fondo aggiornato', man.theme_color === '#691421' && man.background_color === '#691421', man);
  await b.close(); console.log(`\n${ok} ok · ${ko} KO`); process.exitCode = ko ? 1 : 0;
})();
