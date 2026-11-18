// Tivoli: le note di Matteo, l'indirizzo corretto, le righe nuove.   node tivoli.js [indirizzo]
const { chromium, devices } = require('playwright');
const FOTO = process.env.PROVE_FOTO || require('os').tmpdir();   // dove finiscono le schermate
const U = process.argv[2] || 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch(); let ok = 0, ko = 0; const dico = (m, c, x) => { c ? ok++ : ko++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (c ? '' : ' → ' + JSON.stringify(x).slice(0, 600))); };
  const ctx = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
  await ctx.route(/google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'x' }));
  const p = await ctx.newPage(); const err = []; p.on('pageerror', (e) => err.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text()); });
  await p.goto(U); await p.waitForTimeout(800);
  await p.click('[data-mondo="fuori"]'); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('button[data-livello="Tivoli"]').click()); await p.waitForTimeout(700);
  const c = await p.evaluate(() => ({ titolo: document.querySelector('#titolo-ris').textContent, conta: document.querySelector('#conteggio').textContent, schede: [...document.querySelectorAll('.card')].map((k) => ({ nome: k.querySelector('h4').textContent.trim(), tipo: k.querySelector('.tipo').textContent.trim(), ind: (k.querySelector('.addr') || {}).textContent || '', riga: (k.querySelector('.say') || {}).textContent || '', firma: (k.querySelector('.say b') || {}).textContent || '', vai: decodeURIComponent(k.querySelector('a.vai').href) })) }));
  const di = (n) => c.schede.find((s) => s.nome.includes(n)) || {};
  const attesi = await p.evaluate(() => window.RISTOMAT.filter((x) => x.c === 'Tivoli').length);
  dico('Tivoli: ' + c.schede.length + ' schede (' + c.conta.trim() + ')', c.titolo === 'Tivoli' && c.schede.length === attesi && new RegExp('× ' + attesi + ' ').test(c.conta + ' '), [c.conta, attesi]);
  dico('in cima le due note di Matteo: ' + c.schede.slice(0, 2).map((s) => s.nome).join(' · '), c.schede.slice(0, 2).every((s) => s.firma === 'MATTEO') && c.schede.slice(2).every((s) => s.firma !== 'MATTEO'), c.schede.slice(0, 3).map((s) => s.nome + ':' + s.firma));
  dico('Cavallino Rosso: «' + di('Cavallino').riga.replace('MATTEO', '') + '»', di('Cavallino').riga === 'MATTEOQui si viene per due cose: il pesce e la pizza napoletana.', di('Cavallino'));
  dico('Da Sandrina: «' + di('Sandrina').riga.replace('MATTEO', '') + '»', di('Sandrina').riga === 'MATTEOLa numero 1 per la pizza romana: niente da invidiare a Roma.', di('Sandrina'));
  const som = di('Li Somari');
  dico('Li Somari: indirizzo «' + som.ind + '», e «Portami lì» porta lì', som.ind === 'Piazza Rivarola, 21' && /Li Somari Trattoria Fuori Porta, Piazza Rivarola, 21, 00019 Tivoli RM/.test(som.vai) && !/Erbe/.test(som.vai + som.riga) && !/guide la danno/.test(som.riga) && /piazza Rivarola/.test(som.riga), som);
  const brevi = c.schede.filter((s) => s.firma === 'IN BREVE');
  dico(brevi.length + ' righe IN BREVE riscritte o nuove, nessuna da «elenco telefonico» (che comincia con «Ristorante di Tivoli» e simili)', brevi.length === 8 && !brevi.some((s) => /^IN BREVE(Ristorante|Trattoria|Enoteca|Pizzeria) (di|a|in) /.test(s.riga)) && brevi.every((s) => s.riga.length - 8 <= 150), brevi.map((s) => s.riga));
  const senza = c.schede.filter((s) => !s.riga).map((s) => s.nome);
  dico('posti di Tivoli senza riga (niente di affidabile in rete): ' + (senza.join(', ') || 'nessuno'), senza.length <= 5, senza);
  dico('Geppo Night Beer non è più «Da scoprire»: ' + di('Geppo').tipo, di('Geppo').tipo === 'Due drink', di('Geppo'));
  dico('nessun errore', err.length === 0, err);
  await p.evaluate(() => { const b = document.querySelector('.bar'); scrollTo(0, b.getBoundingClientRect().top + scrollY); }); await p.waitForTimeout(300);
  await p.screenshot({ path: FOTO + '/tivoli-1.png' });
  await p.evaluate(() => { const k = [...document.querySelectorAll('.card')].find((x) => /Li Somari/.test(x.textContent)); scrollTo(0, k.getBoundingClientRect().top + scrollY - 190); }); await p.waitForTimeout(300);
  await p.screenshot({ path: FOTO + '/tivoli-2.png' });
  await b.close(); console.log(`\n${ok} ok · ${ko} KO`); process.exitCode = ko ? 1 : 0;
})();
