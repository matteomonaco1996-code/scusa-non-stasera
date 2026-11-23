// LA CANZONE: la riga che sta sotto la dritta nei posti a cui Matteo associa una canzone.  node canzone.js [indirizzo]
// I dati veri possono non averne ancora: la prova ne mette tre finte nella lista (solo in questa pagina di prova)
// e guarda come vengono disegnate: con il link, senza link, con un link che non è di un servizio previsto.
const { chromium, devices } = require('playwright');
const FOTO = process.env.PROVE_FOTO || require('os').tmpdir();   // dove finiscono le schermate
const BASE = process.argv[2] || 'http://localhost:8765/';
let ok = 0, ko = 0; const dico = (m, c, x) => { c ? ok++ : ko++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (c ? '' : ' → ' + JSON.stringify(x))); };

const FINTE = `
;(function () {
  var d = window.RISTOMAT, liberi = d.filter(function (x) { return x.q === 'Pantheon' && !x.nt && x.dr; });
  var a = d.find(function (x) { return x.n === 'Enoteca Corsi'; });
  a.mu = 'Roma capoccia · Antonello Venditti'; a.ml = 'https://open.spotify.com/track/esempio';
  liberi[0].mu = 'Una canzone dal titolo abbastanza lungo da dover andare a capo · Un artista dal nome lungo';
  liberi[1].mu = 'Titolo · Artista'; liberi[1].ml = 'javascript:alert(1)';
  window.__prova = { senzaLink: liberi[0].n, linkCattivo: liberi[1].n };
})();`;

const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrasto = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

(async () => {
  const b = await chromium.launch(); const err = [];
  const apri = async (opz, finte) => {
    const ctx = await b.newContext({ ...opz, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
    if (finte) await ctx.route('**/locali.js', async (r) => { const v = await r.fetch(); await r.fulfill({ response: v, body: (await v.text()) + FINTE }); });
    const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(String(e).slice(0, 120))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text().slice(0, 120)); });
    await p.goto(BASE); await p.waitForTimeout(900);
    return p;
  };
  const scheda = (p, nome) => p.evaluate((nome) => {
    const k = [...document.querySelectorAll('.card')].find((c) => c.querySelector('h4').textContent.trim() === nome); if (!k) return null;
    const c = k.querySelector('.canzone'), r = c && c.getBoundingClientRect(), kr = k.getBoundingClientRect(), s = (e) => getComputedStyle(e);
    const dritta = k.querySelector('.say:not(.canzone)');
    return { righe: [...k.querySelectorAll('.say')].map((e) => e.querySelector('b').textContent), tag: c && c.tagName, testo: c && [c.querySelector('.titolo').textContent, (c.querySelector('.artista') || {}).textContent].join(' / '),
      href: c && c.getAttribute('href'), target: c && c.getAttribute('target'), rel: c && c.getAttribute('rel'), ascolta: !!(c && c.querySelector('.ascolta')),
      alta: r && Math.round(r.height), dentro: r && r.left >= kr.left && r.right <= kr.right + 0.5 && c.scrollWidth <= c.clientWidth + 1,
      colEti: c && s(c.querySelector('b')).color, colDritta: dritta && s(dritta.querySelector('b')).color, fondo: c && s(c).backgroundColor,
      colAscolta: c && c.querySelector('.ascolta') ? s(c.querySelector('.ascolta')).color : null };
  }, nome);

  for (const [nome, opz] of [['telefono', devices['iPhone 13']], ['telefono stretto', { viewport: { width: 320, height: 640 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }]]) {
    const p = await apri(opz, true);
    await p.evaluate(() => document.querySelector('button[data-livello="Pantheon"]').click()); await p.waitForTimeout(700);
    const pr = await p.evaluate(() => window.__prova);
    const c = await scheda(p, 'Enoteca Corsi');
    dico(nome + ': sotto LA DRITTA c’è LA CANZONE, con titolo e artista', c && c.righe.join('|') === 'LA DRITTA|LA CANZONE' && c.testo === 'Roma capoccia / Antonello Venditti', c);
    dico(nome + ': con il link la riga si tocca, apre il brano in un’altra scheda ed è alta almeno 44 punti (' + (c && c.alta) + ')', c && c.tag === 'A' && c.href === 'https://open.spotify.com/track/esempio' && c.target === '_blank' && /noopener/.test(c.rel) && /noreferrer/.test(c.rel) && c.ascolta && c.alta >= 44, c);
    dico(nome + ': l’etichetta ha un colore suo e si legge (contrasto ' + (c && contrasto(c.colEti, c.fondo).toFixed(1)) + ')', c && c.colEti !== c.colDritta && contrasto(c.colEti, c.fondo) >= 4.5 && contrasto(c.colAscolta, c.fondo) >= 4.5, c);
    const s = await scheda(p, pr.senzaLink);
    dico(nome + ': senza link è una riga da leggere, sotto IN BREVE, e un titolo lungo va a capo senza uscire dalla scheda', s && s.tag === 'DIV' && s.righe.join('|') === 'IN BREVE|LA CANZONE' && !s.ascolta && s.dentro && s.alta > 44, s);
    const x = await scheda(p, pr.linkCattivo);
    dico(nome + ': un link che non è di un servizio previsto non diventa un link', x && x.tag === 'DIV' && x.href === null && !x.ascolta && x.testo === 'Titolo / Artista', x);
    const t = await p.evaluate(() => ({ canzoni: document.querySelectorAll('.card .canzone').length, schede: document.querySelectorAll('.card').length, largo: document.documentElement.scrollWidth <= innerWidth + 1, js: [...document.querySelectorAll('a[href^="javascript"]')].length }));
    dico(nome + ': le altre schede non cambiano (' + t.canzoni + ' canzoni su ' + t.schede + ' schede) e la pagina non si allarga', t.canzoni === 3 && t.schede > 3 && t.largo && t.js === 0 && c.dentro, t);
    if (nome === 'telefono') {
      const k = p.locator('.card', { has: p.locator('h4', { hasText: /^Enoteca Corsi$/ }) }).first();
      await k.scrollIntoViewIfNeeded(); await k.screenshot({ path: FOTO + '/canzone-scheda.png' });
      // anche nel fumetto della mappa, dove la nota compare già
      await p.evaluate(() => document.querySelector('button[data-mappa]').click()); await p.waitForTimeout(1800);
      const m = await p.evaluate(() => { const f = document.querySelector('.leaflet-popup-content'); return { aperto: !!f, righe: f ? [...f.querySelectorAll('.say b')].map((e) => e.textContent) : [], dentro: f ? f.scrollWidth <= f.clientWidth + 1 : false }; });
      dico(nome + ': la canzone compare anche nel fumetto sulla mappa', m.aperto && m.righe.join('|') === 'LA DRITTA|LA CANZONE' && m.dentro, m);
    }
    await p.context().close();
  }

  // Con i dati veri: tante righe LA CANZONE quanti sono i posti che ne hanno una (anche nessuno)
  const p = await apri(devices['iPhone 13'], false);
  await p.evaluate(() => document.querySelector('button[data-livello="Pantheon"]').click()); await p.waitForTimeout(700);
  const v = await p.evaluate(() => ({ viste: document.querySelectorAll('.card .canzone').length, attese: window.RISTOMAT.filter((x) => x.q === 'Pantheon' && x.mu).length, inLista: window.RISTOMAT.filter((x) => x.mu).length, male: window.RISTOMAT.filter((x) => x.ml && !x.mu).map((x) => x.n) }));
  dico('dati veri: al Pantheon ' + v.viste + ' canzoni come nella lista (' + v.inLista + ' in tutto), nessun link senza canzone', v.viste === v.attese && v.male.length === 0, v);
  dico('nessun errore', err.length === 0, err);
  await b.close(); console.log(`\n${ok} ok · ${ko} KO`); process.exitCode = ko ? 1 : 0;
})();
