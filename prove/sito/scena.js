const { chromium, devices } = require('playwright');
const out = process.argv[2];
const U = process.argv[3] || 'http://localhost:8765/index.html';
(async () => {
  const b = await chromium.launch(); let male = 0; const dico = (n, c, x) => { if (!c) male++; console.log((c ? 'ok ' : 'NO ') + n + (c ? '' : ' → ' + JSON.stringify(x))); };
  for (const [nome, opz, ora] of [['telefono', { ...devices['iPhone 13'] }, '16:30'], ['piccolo', { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, '20:30'], ['computer', { viewport: { width: 1280, height: 800 } }, '12:40']]) {
    const ctx = await b.newContext({ ...opz, reducedMotion: 'reduce', geolocation: { latitude: 41.8893, longitude: 12.4707 }, permissions: ['geolocation'] });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
    const p = await ctx.newPage(); const err = [], rotte = []; p.on('pageerror', (e) => err.push(String(e))); p.on('response', (r) => { if (r.status() >= 400) rotte.push(r.url()); });
    await p.clock.install({ time: new Date('2026-11-12T' + ora + ':00') });
    await p.goto(U); await p.waitForTimeout(700);
    const s = await p.evaluate(() => {
      const r = (e) => { const x = e.getBoundingClientRect(); return { l: Math.round(x.left), r: Math.round(x.right), t: Math.round(x.top), b: Math.round(x.bottom) }; };
      const B = [...document.querySelectorAll('.scena .battuta')].map((x) => ({ cls: x.className.replace('battuta ', ''), nome: x.querySelector('.nome').textContent, tipo: r(x.querySelector('.figura')), img: x.querySelector('.figura').getAttribute('src'), caricata: x.querySelector('.figura').naturalWidth > 0, fum: r(x.querySelector('.fumetto')), testo: x.querySelector('.fumetto').innerText.replace(/\s+/g, ' ') }));
      const cs = getComputedStyle(document.querySelector('.fumetto'));
      return { vw: innerWidth, vh: innerHeight, B, fondo: cs.backgroundColor, frase: (document.body.innerText.match(/Scusa, non (stasera|oggi|stamattina)/g) || []).length, vecchio: !!document.querySelector('.chat, .msg, .lede, .insegna, .faccia'), scelte: r(document.querySelector('.partenza-scelte')), scorre: document.documentElement.scrollWidth > innerWidth + 1, h1: document.querySelector('h1').innerText.trim() };
    });
    const [g, io, r] = s.B;
    dico(nome + ': tre battute: Gaia, tu, Ristomat', s.B.length === 3 && g.nome === 'GAIA' && io.nome === 'TU' && r.nome === 'RISTOMAT' && g.fum.t < io.fum.t && io.fum.t < r.fum.t, s.B.map((x) => x.nome));
    dico(nome + ': i personaggetti ci sono: lei a sinistra, tu a destra', g.caricata && io.caricata && r.caricata && /gaia\.svg/.test(g.img) && /tu\.svg/.test(io.img) && g.tipo.r <= g.fum.l && io.fum.r <= io.tipo.l && g.tipo.l < 40 && (nome === 'computer' || io.tipo.r > s.vw - 40), { g: g.tipo, io: io.tipo, vw: s.vw });
    dico(nome + ': dalla conversazione si capisce che cosa fa il sito', /cosa c’è di buono/.test(r.testo) && /vicino a te/.test(r.testo) && /zona/.test(r.testo) && /Da dove partiamo\?$/.test(r.testo), r.testo);
    dico(nome + ': niente più chat né testo doppio sopra; la battuta c’è una volta sola', !s.vecchio && s.frase === 1 && s.fondo === 'rgb(255, 243, 214)' && /^RISTOMAT/i.test(s.h1), [s.vecchio, s.frase, s.fondo]);
    dico(nome + ': niente scorrimento orizzontale' + (nome !== 'computer' ? ', le due scelte nella prima schermata' : ''), !s.scorre && (nome === 'computer' || s.scelte.b <= s.vh), { scelte: s.scelte, vh: s.vh });
    console.log('   ' + nome, ora, '→', g.testo, '|', io.testo, '|', r.testo);
    await p.screenshot({ path: `${out}/scena-${nome}.png` });
    await p.click('#bolla'); await p.waitForTimeout(300);
    dico(nome + ': toccando «Portami fuori» non si apre una finestra: si fanno notare i due tasti «Da dove partiamo?»', await p.evaluate(() => !document.querySelector('dialog[open]') && document.querySelector('.partenza').classList.contains('chiama')));
    await p.click('#m-start'); await p.waitForTimeout(1300);
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
    const dopo = await p.evaluate(() => ({ testo: document.querySelector('#bolla').textContent, scorre: document.documentElement.scrollWidth > innerWidth + 1 }));
    dico(nome + ': dopo la ricerca il tuo fumetto dà il consiglio', /^Anzi sì: .+ Ci vediamo lì\?$/.test(dopo.testo) && !dopo.scorre, dopo);
    if (nome === 'telefono') await p.screenshot({ path: `${out}/scena-consiglio.png` });
    dico(nome + ': nessun errore, nessun file mancante', err.length === 0 && rotte.length === 0, { err, rotte });
    await ctx.close();
  }
  await b.close(); console.log(male ? male + ' falliti' : 'tutti giusti');
})();
