// I tre passi in ordine: mondo → power-up → livello → posti. A ogni scelta la pagina scende al passo dopo.
//   node passi.js <cartella foto> [indirizzo]
const { chromium, devices } = require('playwright');
const out = process.argv[2];
const BASE = process.argv[3] || 'http://localhost:8765/index.html';
const ok = [], ko = [];
const check = (n, c, x) => (c ? ok : ko).push(n + (x !== undefined ? ' → ' + JSON.stringify(x) : ''));
(async () => {
  const b = await chromium.launch();
  const nuovo = async ({ dispositivo = devices['iPhone 13'], fermo = true } = {}) => {
    const ctx = await b.newContext({ ...dispositivo, ...(fermo ? { reducedMotion: 'reduce' } : {}) });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
    await ctx.route(/google\.com|paypal\./, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>esterno</title>' }));
    const p = await ctx.newPage(); const err = [];
    p.on('pageerror', (e) => err.push(String(e).slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text().slice(0, 200)); });
    await p.goto(BASE); await p.waitForTimeout(700);
    return { ctx, p, err };
  };
  const vedi = (p) => p.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e || e.hidden) return null; const q = e.getBoundingClientRect(); return { top: Math.round(q.top), bottom: Math.round(q.bottom) }; };
    const inVista = (e) => { const t = e.getBoundingClientRect(); return t.top >= 0 && t.bottom <= innerHeight; };
    const livelli = [...document.querySelectorAll('#livelli .level')];
    const num = (e) => +((e.querySelector('.ct') || {}).textContent || '').replace(/\D/g, '');
    const sez = [...document.querySelectorAll('section.zona')].map((s) => s.id);
    return { y: Math.round(scrollY), vh: innerHeight, ordine: sez, titoli: [...document.querySelectorAll('section.zona h2')].map((h) => h.textContent),
      mondi: r('#sez-mondi'), pw: r('#sez-pw'), sezLivelli: r('#sez-livelli'), livelli: r('#livelli'), mappa: r('#overworld'), didascalia: r('#ow-info'), barra: r('.bar'),
      pwInVista: [...document.querySelectorAll('#powerups .pw')].filter(inVista).length, lvInVista: livelli.filter(inVista).length,
      voglia: (document.querySelector('#powerups [aria-pressed=true]') || {}).dataset ? document.querySelector('#powerups [aria-pressed=true]').dataset.voglia : null,
      mondo: (document.querySelector('#mondi [aria-pressed=true] .nm') || {}).textContent, titolo: document.querySelector('#titolo-ris').textContent, conteggio: document.querySelector('#conteggio').textContent,
      tutto: livelli[0] ? num(livelli[0]) : null, somma: livelli.slice(1).reduce((s, e) => s + num(e), 0), spenti: livelli.filter((e) => e.disabled).length, zeri: livelli.filter((e) => num(e) === 0).length, quantiLivelli: livelli.length,
      nota: (document.querySelector('#livelli .conta-solo') || {}).textContent || '', sotto: (document.querySelector('#sott-livelli') || {}).textContent,
      mappaSpente: document.querySelectorAll('#ow-svg .ow-nodo.vuoto').length, schede: document.querySelectorAll('.card').length, vuoto: !!document.querySelector('#cards .empty'),
      toast: (() => { const t = document.querySelector('#toast'); return t && !t.hidden ? t.textContent : ''; })(), indietro: !document.querySelector('#indietro').hidden,
      largo: document.documentElement.scrollWidth - innerWidth };
  });
  const tocca = async (p, sel, attesa = 500) => { await p.locator(sel).first().click(); await p.waitForTimeout(attesa); };
  const inCima = (r) => r && r.top >= 0 && r.top <= 90;

  // ===== telefono: Roma → Pizza → Trastevere =====
  let { ctx, p, err } = await nuovo();
  let v = await vedi(p);
  check('la pagina è in quest’ordine: mondo, power-up, livello', JSON.stringify(v.ordine.slice(0, 3)) === JSON.stringify(['sez-mondi', 'sez-pw', 'sez-livelli']), v.ordine);
  check('i titoli: SELEZIONA IL MONDO, SCEGLI IL POWER-UP, SCEGLI IL LIVELLO', JSON.stringify(v.titoli.slice(0, 3)) === JSON.stringify(['SELEZIONA IL MONDO', 'SCEGLI IL POWER-UP', 'SCEGLI IL LIVELLO']), v.titoli);
  check('all’inizio i numeri dei livelli sono quelli di sempre (Tutta Roma = somma dei quartieri, nessuno spento)', v.tutto > 400 && v.tutto === v.somma && v.spenti === 0 && !v.nota, { tutto: v.tutto, somma: v.somma, spenti: v.spenti });
  const totale = v.tutto;
  await tocca(p, '#m-livelli');
  v = await vedi(p);
  check('SCELGO LA ZONA porta al primo passo, i mondi', inCima(v.mondi), v.mondi);
  await p.screenshot({ path: out + '/passi-0-mondi.png' });
  // 1) il mondo → power-up
  await tocca(p, '#mondi [data-mondo="roma"]');
  v = await vedi(p);
  check('1 · scelto Roma: la pagina scende al power-up', inCima(v.pw) && v.pwInVista >= 6, { pw: v.pw, inVista: v.pwInVista });
  check('1 · il livello non è ancora in cima', !inCima(v.livelli), v.livelli);
  await p.screenshot({ path: out + '/passi-1-powerup.png' });
  // 2) il power-up → livello
  await tocca(p, '#powerups [data-voglia="pizza"]');
  v = await vedi(p);
  check('2 · scelto «Pizza»: la pagina scende all’elenco dei livelli', v.voglia === 'pizza' && v.livelli.top >= 0 && v.livelli.top <= 120 && v.lvInVista >= 4, { livelli: v.livelli, inVista: v.lvInVista });
  check('2 · in cima resta la didascalia della mappa dei quartieri, la mappa è sopra', v.didascalia && v.didascalia.bottom > 0 && v.didascalia.bottom <= v.livelli.top && v.mappa.top < 0, { didascalia: v.didascalia, mappa: v.mappa });
  check('2 · i numeri dei livelli contano solo le pizzerie, e lo dice', v.tutto < totale && v.tutto > 0 && v.tutto === v.somma && /contano solo «Pizza/.test(v.nota), { tutto: v.tutto, somma: v.somma, nota: v.nota });
  check('2 · i livelli senza pizzerie sono spenti (× 0), anche sulla mappa', v.zeri > 0 && v.spenti === v.zeri && v.mappaSpente > 0, { zeri: v.zeri, spenti: v.spenti, mappa: v.mappaSpente });
  await p.screenshot({ path: out + '/passi-2-livelli.png' });
  // una casella spenta sulla mappa non apre un livello vuoto
  const spenta = await p.evaluate(() => (document.querySelector('#ow-svg .ow-nodo.vuoto') || {}).dataset.livello);
  await p.evaluate(() => document.querySelector('#ow-svg .ow-nodo.vuoto').dispatchEvent(new MouseEvent('click', { bubbles: true }))); await p.waitForTimeout(300);
  v = await vedi(p);
  check('2 · toccare sulla mappa un quartiere senza pizzerie non apre un livello vuoto, e lo dice', !new RegExp(spenta).test(v.titolo) && /non ce n’è/.test(v.toast), { spenta, titolo: v.titolo, toast: v.toast });
  // 3) il livello → posti
  const lv = await p.evaluate(() => { const e = [...document.querySelectorAll('#livelli .level[data-livello]:not([disabled])')].find((x) => x.dataset.livello); return { nome: e.dataset.livello, n: +e.querySelector('.ct').textContent.replace(/\D/g, '') }; });
  await tocca(p, `#livelli [data-livello="${lv.nome}"]`);
  v = await vedi(p);
  check('3 · scelto il livello: la pagina scende ai posti', inCima(v.barra) && v.titolo === lv.nome, { barra: v.barra, titolo: v.titolo });
  check('3 · i posti sono quanti diceva il livello, tutti pizzerie', v.schede === Math.min(lv.n, 30) && new RegExp('× ' + lv.n + ' ').test(v.conteggio + ' ') && await p.evaluate(() => [...document.querySelectorAll('.card .tipo')].every((t) => /Pizz/i.test(t.textContent))), { schede: v.schede, attesi: lv.n, conteggio: v.conteggio });
  await p.screenshot({ path: out + '/passi-3-posti.png' });
  // INDIETRO ripercorre i passi al contrario
  await tocca(p, '#indietro', 700); v = await vedi(p);
  check('INDIETRO 1: torna alla scelta del livello (Pizza ancora accesa, nessun livello)', v.voglia === 'pizza' && v.titolo === 'Tutta Roma' && v.livelli.top < v.vh, { voglia: v.voglia, titolo: v.titolo, livelli: v.livelli });
  await tocca(p, '#indietro', 700); v = await vedi(p);
  check('INDIETRO 2: torna al power-up (nessuno scelto)', v.voglia === '' && v.pw.top < v.vh && v.pw.bottom > 0, { voglia: v.voglia, pw: v.pw });
  check('telefono, primo giro: nessun errore', err.length === 0, err);

  // ===== cambiare power-up con il livello già scelto → dritti ai posti =====
  await tocca(p, '#powerups [data-voglia=""]');           // «Tutto» è una scelta: porta avanti
  v = await vedi(p);
  check('«Tutto» porta avanti all’elenco dei livelli, con i numeri pieni', v.voglia === '' && v.livelli.top >= 0 && v.livelli.top <= 120 && v.tutto === totale && !v.nota, { livelli: v.livelli, tutto: v.tutto });
  await tocca(p, '#livelli [data-livello="Trastevere"]');
  await p.evaluate(() => document.querySelector('#sez-pw').scrollIntoView()); await p.waitForTimeout(200);
  const tipo = await p.evaluate(() => { const e = [...document.querySelectorAll('#powerups .pw:not([disabled])')].find((x) => x.dataset.voglia); return e.dataset.voglia; });
  await tocca(p, `#powerups [data-voglia="${tipo}"]`);
  v = await vedi(p);
  check('livello già scelto: cambiando power-up si va dritti ai posti', v.voglia === tipo && v.titolo === 'Trastevere' && inCima(v.barra) && v.schede > 0, { voglia: v.voglia, titolo: v.titolo, barra: v.barra });
  // ritoccare il power-up acceso lo spegne e non sposta la pagina
  await p.evaluate(() => document.querySelector('#sez-pw').scrollIntoView()); await p.waitForTimeout(200);
  const yPrima = (await vedi(p)).y;
  await tocca(p, `#powerups [data-voglia="${tipo}"]`);
  v = await vedi(p);
  check('ritoccare il power-up acceso lo spegne e la pagina resta dov’è', v.voglia === '' && Math.abs(v.y - yPrima) <= 4, { voglia: v.voglia, prima: yPrima, dopo: v.y });
  await ctx.close();

  // ===== Fuori porta (località) e Firenze (un livello solo) =====
  ({ ctx, p, err } = await nuovo());
  await tocca(p, '#m-livelli'); await tocca(p, '#mondi [data-mondo="fuori"]');
  v = await vedi(p);
  check('Fuori porta: dopo il mondo, il power-up', v.mondo === 'Fuori porta' && inCima(v.pw), { mondo: v.mondo, pw: v.pw });
  await tocca(p, '#powerups [data-voglia=""]');
  v = await vedi(p);
  check('Fuori porta: dopo il power-up, le località (senza mappa dei quartieri, con il titolo in cima)', inCima(v.sezLivelli) && !v.mappa && v.lvInVista >= 3 && /località/.test(v.sotto), { sez: v.sezLivelli, inVista: v.lvInVista, sotto: v.sotto });
  await p.screenshot({ path: out + '/passi-4-fuori.png' });
  await tocca(p, '#livelli [data-livello="Tivoli"]');
  v = await vedi(p);
  check('Fuori porta: scelta Tivoli, i posti', v.titolo === 'Tivoli' && inCima(v.barra) && v.schede >= 10, { titolo: v.titolo, schede: v.schede });
  await p.evaluate(() => document.querySelector('#sez-mondi').scrollIntoView()); await p.waitForTimeout(200);
  await tocca(p, '#mondi [data-mondo="firenze"]');
  v = await vedi(p);
  check('Firenze: dopo il mondo, il power-up', v.mondo === 'Firenze' && inCima(v.pw), { mondo: v.mondo, pw: v.pw });
  await tocca(p, '#powerups [data-voglia=""]');
  v = await vedi(p);
  check('Firenze (un livello solo): dopo il power-up si va dritti ai posti', /Firenze/.test(v.titolo) && inCima(v.barra) && v.schede > 0, { titolo: v.titolo, barra: v.barra });
  check('Fuori porta e Firenze: nessun errore', err.length === 0, err);
  await ctx.close();

  // ===== la ricerca conta anche lei nei numeri dei livelli =====
  ({ ctx, p, err } = await nuovo());
  await p.fill('#q', 'carbonara'); await p.waitForTimeout(500);
  v = await vedi(p);
  check('ricerca «carbonara»: i numeri dei livelli contano solo quei posti, e lo dice', v.tutto > 0 && v.tutto < totale && v.tutto === v.somma && /la tua ricerca/.test(v.nota), { tutto: v.tutto, somma: v.somma, nota: v.nota });
  await p.fill('#q', ''); await p.waitForTimeout(500);
  v = await vedi(p);
  check('tolta la ricerca tornano i numeri pieni', v.tutto === totale && !v.nota && v.spenti === 0, { tutto: v.tutto, spenti: v.spenti });
  await ctx.close();

  // ===== gettone: «Scelgo il quartiere» porta all'elenco dei livelli =====
  ({ ctx, p, err } = await nuovo());
  await tocca(p, '#m-gettone', 400);
  if (await p.locator('[data-get=livello]').count()) {
    await tocca(p, '[data-get=livello]', 600);
    v = await vedi(p);
    check('gettone → «Scelgo il quartiere»: arriva all’elenco dei livelli', v.livelli.top >= 0 && v.livelli.top <= 120 && v.lvInVista >= 4 && /quartiere/.test(v.toast), { livelli: v.livelli, toast: v.toast });
  } else check('gettone: c’è «Scelgo il quartiere»', false);
  await ctx.close();

  // ===== animazioni accese, telefono stretto, computer =====
  ({ ctx, p, err } = await nuovo({ fermo: false }));
  await tocca(p, '#m-livelli', 1200); await tocca(p, '#mondi [data-mondo="roma"]', 1600);
  v = await vedi(p);
  check('con le animazioni: dopo il mondo arriva al power-up', inCima(v.pw), v.pw);
  await tocca(p, '#powerups [data-voglia="pizza"]', 1800);
  v = await vedi(p);
  check('con le animazioni: dopo il power-up arriva ai livelli', v.livelli.top >= 0 && v.livelli.top <= 120, v.livelli);
  await ctx.close();

  ({ ctx, p, err } = await nuovo({ dispositivo: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent } }));
  await tocca(p, '#m-livelli'); await tocca(p, '#mondi [data-mondo="roma"]');
  v = await vedi(p);
  check('320 px: power-up in cima, niente scorrimento laterale', inCima(v.pw) && v.largo <= 0, { pw: v.pw, largo: v.largo });
  await tocca(p, '#powerups [data-voglia="pizza"]');
  v = await vedi(p);
  check('320 px: livelli in cima, la nota sui numeri si legge, niente scorrimento laterale', v.livelli.top >= 0 && v.livelli.top <= 140 && v.lvInVista >= 2 && v.largo <= 0, { livelli: v.livelli, inVista: v.lvInVista, largo: v.largo });
  await p.screenshot({ path: out + '/passi-5-stretto.png' });
  await ctx.close();

  ({ ctx, p, err } = await nuovo({ dispositivo: { viewport: { width: 1366, height: 800 } } }));
  await p.evaluate(() => document.querySelector('#sez-mondi').scrollIntoView()); await p.waitForTimeout(200);
  await tocca(p, '#mondi [data-mondo="roma"]');
  v = await vedi(p);
  check('computer: dopo il mondo, il power-up', inCima(v.pw), v.pw);
  await tocca(p, '#powerups [data-voglia="pizza"]');
  v = await vedi(p);
  check('computer: dopo il power-up, i livelli', v.livelli.top >= 0 && v.livelli.top <= 120 && v.lvInVista >= 6, { livelli: v.livelli, inVista: v.lvInVista });
  await p.screenshot({ path: out + '/passi-6-computer.png' });
  check('computer: nessun errore', err.length === 0, err);
  await ctx.close();

  await b.close();
  console.log(ok.length + ' ok, ' + ko.length + ' falliti'); ko.forEach((x) => console.log('FALLITO: ' + x));
})();
