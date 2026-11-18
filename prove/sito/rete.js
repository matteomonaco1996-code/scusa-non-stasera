// Riservatezza e sicurezza, misurate: a chi parla il sito, che cosa lascia sul telefono, se la regola di sicurezza
// della pagina (CSP) blocca qualcosa, che cosa c'è scritto nel codice delle pagine.
const { chromium, devices } = require('playwright'); const fs = require('fs');
const BASE = process.argv[2] || 'http://localhost:8765/', CASA = new URL(BASE).host, R = require('path').resolve(__dirname, '..', '..') + '/';
let ok = 0, ko = 0; const dico = (m, c, x) => { c ? ok++ : ko++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (c ? '' : ' → ' + JSON.stringify(x).slice(0, 700))); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ← ' + (e.blockedURI || 'in pagina').slice(0, 60))); });
  const fuori = [], nuove = [], contatori = [];
  const CONTATORI = /^https:\/\/swjaorxphkfigqwgonqq\.supabase\.co\/rest\/v1\/rpc\/conta(_livello)?$/;   // le uniche chiamate ammesse verso il database
  await ctx.route((u) => u.host !== CASA, (r) => { const u = r.request().url(); if (CONTATORI.test(u) && r.request().method() === 'POST') { contatori.push(u); return r.fulfill({ status: 204, body: '' }); } fuori.push(u.slice(0, 70)); r.fulfill({ status: 200, contentType: 'text/html', body: '<title>esterno</title>' }); });
  ctx.on('page', (pg) => nuove.push(pg));
  const p = await ctx.newPage(); const err = [], csp = [];
  p.on('pageerror', (e) => err.push(String(e).slice(0, 150))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text().slice(0, 150)); });
  const raccogli = async () => { csp.push(...await p.evaluate(() => window.__csp.splice(0))); };
  // ---------- un giro completo senza toccare niente che porti fuori ----------
  await p.goto(BASE); await p.waitForTimeout(900);
  await p.click('#termini-ok'); await p.waitForTimeout(600);
  await p.click('[data-pos=no]').catch(() => {}); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('button[data-livello="Trastevere"]').click()); await p.waitForTimeout(600);
  await p.click('#gettone'); await p.waitForTimeout(1200);
  await p.click('[data-get=invita]'); await p.waitForTimeout(400); await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-moneta]').click()); await p.waitForTimeout(400); await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); await p.waitForTimeout(300);
  await p.click('[data-view=mappa]'); await p.waitForTimeout(1800);
  await p.evaluate(() => { const m = document.querySelector('.pin-area'); if (m) m.click(); }); await p.waitForTimeout(500);
  await p.click('[data-view=lista]'); await p.waitForTimeout(300);
  await p.fill('#q', 'carbonara'); await p.waitForTimeout(500); await raccogli();
  for (const pag of ['privacy.html', 'termini.html', 'statistiche.html']) { await p.goto(BASE + pag); await p.waitForTimeout(700); await raccogli(); }
  await p.goto(BASE + '?posto=3935991939893424995&m=s&da=amici'); await p.waitForTimeout(900); await p.click('[data-inv=si]'); await p.waitForTimeout(300); await raccogli();
  dico('in un giro completo (termini, zona, gettone, mappa, ricerca, invito, pagine legali, monitoraggio) il sito non contatta nessun altro server, a parte i propri contatori', fuori.length === 0 && contatori.length > 0, fuori);
  dico('la regola di sicurezza delle pagine non ha dovuto bloccare nulla', csp.length === 0, csp);
  dico('nessun errore', err.length === 0, err);
  const lascia = await p.evaluate(async () => ({ chiavi: Object.keys(localStorage).sort(), sess: sessionStorage.length, cookie: document.cookie, db: (indexedDB.databases ? (await indexedDB.databases()).length : 0), cache: (window.caches ? (await caches.keys()).length : 0), sw: (navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0), stato: JSON.stringify(history.state) }));
  dico('sul telefono restano solo due note (termini accettati, scelta sulla posizione): niente cookie, niente altro', lascia.chiavi.join() === 'sns-posizione,sns-termini' && lascia.sess === 0 && lascia.cookie === '' && lascia.db === 0 && lascia.cache === 0 && lascia.sw === 0, lascia);
  dico('nella cronologia della scheda non ci sono coordinate', !/\d\d\.\d{3,}/.test(lascia.stato), lascia.stato);
  // ---------- quello che porta fuori lo fa solo se lo tocchi ----------
  await p.goto(BASE); await p.waitForTimeout(700); await p.evaluate(() => document.querySelector('button[data-livello="Trastevere"]').click()); await p.waitForTimeout(500);
  await p.click('[data-view=mappa]'); await p.waitForTimeout(1500); const prima = fuori.length;
  await p.click('[data-sfondo]'); await p.waitForTimeout(1200);
  const carto = fuori.slice(prima);
  dico('i nomi delle vie (CARTO) partono solo dopo il tocco sul pulsante (' + carto.length + ' richieste, tutte a CARTO)', carto.length > 0 && carto.every((u) => /basemaps\.cartocdn\.com/.test(u)), carto.slice(0, 3));
  await p.click('[data-view=lista]'); await p.waitForTimeout(300); const p2 = fuori.length;
  await p.locator('.card a[href^="https://www.google.com/maps/dir/"]').first().click(); await p.waitForTimeout(500);
  dico('«Portami lì» apre prima la finestra del sito: Google Maps non viene contattato finché non tocchi «Vai al posto»', fuori.length === p2 && await p.evaluate(() => document.querySelector('#dlg-vai').open), fuori.slice(p2));
  const [maps] = await Promise.all([ctx.waitForEvent('page'), p.click('#vai-ora')]); await maps.waitForLoadState().catch(() => {});
  dico('«Vai al posto» apre Google Maps in un’altra scheda, senza dire da che pagina arrivi', /google\.com\/maps\/dir/.test(maps.url()) && await p.evaluate(() => { const a = document.querySelector('#vai-ora'); return a.target === '_blank' && /noopener/.test(a.rel) && /noreferrer/.test(a.rel); }), maps.url());
  await maps.close();
  // ---------- il codice delle pagine ----------
  console.log('Il codice delle pagine');
  for (const f of ['index.html', 'privacy.html', 'termini.html', 'statistiche.html']) {
    const h = fs.readFileSync(R + f, 'utf8');
    const csp1 = (h.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
    const inriga = (h.match(/<[^>]+\son[a-z]+\s*=/gi) || []).length + (h.match(/<[^>]+\sstyle\s*=/gi) || []).length + (h.match(/<script(?![^>]*\ssrc=)[^>]*>/gi) || []).length + (h.match(/<style/gi) || []).length + (h.match(/javascript:/gi) || []).length;
    const esterni = [...h.matchAll(/<a\s[^>]*href="(https?:[^"]+)"[^>]*>/g)].filter((m) => !/rel="[^"]*noopener/.test(m[0])).map((m) => m[1]);
    const risorse = [...h.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].filter((m) => /<(script|link|img|iframe)/.test(h.slice(Math.max(0, m.index - 80), m.index)) && !/rel="canonical"|property="og:/.test(h.slice(Math.max(0, m.index - 120), m.index))).map((m) => m[1]);
    dico(f + ': regola di sicurezza completa, niente codice dentro la pagina, niente file presi da altri siti', /default-src 'self'/.test(csp1) && /script-src '(self|none)'(;|$)/.test(csp1) && /object-src 'none'/.test(csp1) && /base-uri 'self'/.test(csp1) && !/unsafe-inline|unsafe-eval|\*\s|\s\*;/.test(csp1.replace(/https:\/\/\*\.[a-z.]+/g, '')) && inriga === 0 && risorse.length === 0 && /name="referrer" content="no-referrer"/.test(h), { csp1: csp1.slice(0, 200), inriga, risorse });
    dico(f + ': i link verso altri siti si aprono senza dare accesso alla pagina (' + [...h.matchAll(/<a\s[^>]*href="https?:/g)].length + ' link)', esterni.length === 0, esterni);
  }
  const js = ['js/app.js', 'js/conto.js', 'js/comitiva.js', 'js/statistiche.js'].map((f) => [f, fs.readFileSync(R + f, 'utf8')]);
  const pericoli = js.flatMap(([f, t]) => [...t.matchAll(/\beval\(|new Function\(|document\.write\(|\.outerHTML\s*=|insertAdjacentHTML|setTimeout\(\s*["'`]|srcdoc|\.innerHTML\s*\+=/g)].map((m) => f + ': ' + t.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\s+/g, ' ')));
  dico('nel codice non ci sono le costruzioni più rischiose (eval e simili)', pericoli.filter((x) => !/s\.outerHTML = svg\(/.test(x)).length === 0, pericoli);
  const segreti = [];
  const cammina = (d) => { for (const n of fs.readdirSync(d, { withFileTypes: true })) { if (['.git', 'node_modules', 'vendor', 'fonts', 'img', 'mappa', 'prove'].includes(n.name)) continue; const q = d + '/' + n.name; if (n.isDirectory()) cammina(q); else if (/\.(js|json|html|md|py|sql|yml|css|txt|webmanifest)$/.test(n.name) && n.name !== 'locali.js') { const t = fs.readFileSync(q, 'utf8'); for (const m of t.matchAll(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_-]{10,}|sbp_[a-f0-9]{20,}|service_role["'\s:=]+[A-Za-z0-9._-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|(password|passwd|secret|token)\s*[:=]\s*["'][^"'\s]{8,}["']/gi)) segreti.push(q.replace(R, '') + ': ' + m[0].slice(0, 40)); } } };
  cammina(R.replace(/\/$/, ''));
  dico('nei file del sito non ci sono chiavi, password o token dimenticati', segreti.length === 0, segreti);
  await b.close(); console.log(`\n${ok} ok · ${ko} KO`); process.exitCode = ko ? 1 : 0;
})();
