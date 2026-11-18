// Sul sito vero: ogni file a cui le pagine fanno riferimento esiste davvero? E i reindirizzamenti, le pagine che non esistono, le intestazioni?
const SITO = 'https://ristomat.click/';
let ok = 0, ko = 0; const dico = (m, c, x) => { c ? ok++ : ko++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (c ? '' : ' → ' + JSON.stringify(x).slice(0, 600))); };
const { chromium } = require('playwright'); let pagina;
const prendi = async (u) => pagina.evaluate(async (u) => { for (let k = 0; k < 3; k++) { try { const r = await fetch(u, { cache: 'no-store' }); const t = await r.text(); return { stato: r.status, tipo: r.headers.get('content-type') || '', lung: t.length, testo: /\.(png|woff2)(\?|$)/.test(u) ? '' : t }; } catch (e) { if (k === 2) return { stato: 0, err: String(e).slice(0, 80) }; await new Promise((f) => setTimeout(f, 800)); } } }, u);
(async () => {
  const b = await chromium.launch(); pagina = await b.newPage(); await pagina.goto(SITO); await pagina.waitForTimeout(500);
  const visti = new Map(), coda = ['index.html', 'privacy.html', 'termini.html', 'statistiche.html', 'manifest.webmanifest', '.well-known/security.txt', 'js/comitiva.js', 'vendor/supabase/supabase.js', 'mappa/roma.js', 'mappa/quartieri.js', 'img/facce/0.svg', 'img/facce/1.svg', 'img/facce/2.svg', 'img/facce/3.svg', 'img/facce/4.svg', 'img/facce/5.svg', 'img/anteprima.png'];
  const aggiungi = (da, rif) => { if (!rif || /^(https?:|data:|mailto:|tel:|#|javascript:)/.test(rif)) return; const u = new URL(rif.split('#')[0], SITO + da); if (u.origin !== new URL(SITO).origin) return; const p = u.pathname.replace(/^\//, '') || 'index.html'; if (!visti.has(p) && !coda.includes(p)) coda.push(p); };
  while (coda.length) {
    const f = coda.shift(); if (visti.has(f)) continue;
    const r = await prendi(SITO + f + '?t=' + Date.now()); visti.set(f, r);
    if (r.stato !== 200) continue;
    if (/\.html$/.test(f)) { for (const m of r.testo.matchAll(/(?:src|href)="([^"]+)"/g)) aggiungi(f, m[1]); for (const m of r.testo.matchAll(/content="(https:\/\/ristomat\.click\/[^"]+)"/g)) aggiungi(f, m[1].replace('https://ristomat.click/', '/')); }
    if (/\.css$/.test(f)) for (const m of r.testo.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) aggiungi(f, m[1]);
    if (/\.webmanifest$/.test(f)) { try { for (const i of JSON.parse(r.testo).icons || []) aggiungi(f, i.src); } catch (e) {} }
    if (/\.js$/.test(f) && !/locali|roma|quartieri|leaflet|supabase/.test(f)) for (const m of r.testo.matchAll(/["'`]((?:img|js|css|mappa|vendor|fonts)\/[A-Za-z0-9_./-]+\.(?:js|css|svg|png|woff2|json))["'`]/g)) aggiungi('index.html', m[1]);
  }
  const rotti = [...visti].filter(([, r]) => r.stato !== 200), vuoti = [...visti].filter(([, r]) => r.stato === 200 && r.lung < 20);
  dico(`i ${visti.size} file a cui le pagine fanno riferimento ci sono tutti`, rotti.length === 0 && vuoti.length === 0, { rotti: rotti.map(([f, r]) => f + ' ' + r.stato), vuoti: vuoti.map(([f]) => f) });
  const TIPI = { html: /text\/html/, css: /text\/css/, js: /javascript/, svg: /image\/svg/, png: /image\/png/, woff2: /font\/woff2|octet-stream/, webmanifest: /json|manifest/, txt: /text\/plain/ };
  const tipiNo = [...visti].filter(([f, r]) => r.stato === 200 && TIPI[f.split('.').pop()] && !TIPI[f.split('.').pop()].test(r.tipo)).map(([f, r]) => f + ': ' + r.tipo);
  dico('ogni file arriva dichiarato per quello che è (pagina, stile, immagine, carattere…)', tipiNo.length === 0, tipiNo);
  const peso = (re) => [...visti].filter(([f]) => re.test(f)).reduce((s, [, r]) => s + r.lung, 0);
  console.log(`     pesi (non compressi): pagine ${Math.round(peso(/\.html$/) / 1024)} KB · stile ${Math.round(peso(/\.css$/) / 1024)} KB · programmi del sito ${Math.round(peso(/^js\//) / 1024)} KB · lista dei posti ${Math.round(peso(/^locali\.js$/) / 1024)} KB`);
  // ancore interne (#qualcosa) che devono esistere
  const anc = []; for (const [f, r] of visti) { if (!/\.html$/.test(f) || r.stato !== 200) continue; for (const m of r.testo.matchAll(/href="([a-z]+\.html)?#([A-Za-z0-9_-]+)"/g)) { const pag = m[1] || f, t = visti.get(pag); if (t && !new RegExp(`id="${m[2]}"`).test(t.testo)) anc.push(f + ' → ' + pag + '#' + m[2]); } }
  const js = (visti.get('js/app.js') || {}).testo + (visti.get('js/conto.js') || {}).testo + (visti.get('js/comitiva.js') || {}).testo;
  for (const m of js.matchAll(/(privacy|termini)\.html#([A-Za-z0-9_-]+)/g)) { const t = visti.get(m[1] + '.html'); if (t && !new RegExp(`id="${m[2]}"`).test(t.testo)) anc.push('programma → ' + m[0]); }
  dico('i rimandi interni (come «termini.html#segnalazioni») portano a un punto che esiste', anc.length === 0, [...new Set(anc)]);
  // reindirizzamenti e pagine che non esistono
  const no = await prendi(SITO + 'pagina-che-non-esiste-' + Date.now() + '.html');
  dico('una pagina che non esiste risponde «non trovata» (404), non una pagina vuota qualsiasi', no.stato === 404, no.stato);
  for (const f of ['correzioni.json', 'in_breve.json', 'strumenti/aggiorna_lista.py', 'supabase/schema.sql', 'README.md', '.github/workflows/pubblica.yml', '.git/config']) { const r = await prendi(SITO + f); if (r.stato === 200) dico('file di lavoro non pubblicato: ' + f, false, r.stato); }
  dico('i file di lavoro (correzioni, attrezzi, database, .git) non sono pubblicati sul sito', true);
  const i = visti.get('index.html'), sec = visti.get('.well-known/security.txt'), man = visti.get('manifest.webmanifest');
  dico('la pagina dei contatti per la sicurezza (security.txt) c’è e non è scaduta', sec && sec.stato === 200 && /Contact:/.test(sec.testo) && (() => { const m = sec.testo.match(/Expires:\s*(\S+)/); return m && new Date(m[1]) > new Date(); })(), sec && sec.testo.slice(0, 200));
  dico('il file per «Aggiungi a schermata Home» è valido', (() => { try { const m = JSON.parse(man.testo); return m.name && m.icons.length >= 2 && m.start_url !== undefined; } catch (e) { return false; } })(), man && man.testo.slice(0, 150));
  const st = visti.get('statistiche.html');
  dico('la pagina di monitoraggio chiede ai motori di ricerca di non comparire', /name="robots" content="noindex, nofollow"/.test(st.testo), '');
  dico('l’anteprima per i link condivisi punta a un’immagine che esiste', /property="og:image" content="https:\/\/ristomat\.click\/img\/anteprima\.png"/.test(i.testo) && (visti.get('img/anteprima.png') || {}).stato === 200, '');
  await b.close();
  console.log(`\n${ok} ok · ${ko} KO`); process.exitCode = ko ? 1 : 0;
})();
