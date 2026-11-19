const { chromium, devices } = require('playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch(); let male = 0; const dico = (n, c, x) => { if (!c) male++; console.log((c ? 'ok ' : 'NO ') + n + (c ? '' : ' → ' + JSON.stringify(x))); };
  for (const [nome, opz] of [['telefono', { ...devices['iPhone 13'] }], ['computer', { viewport: { width: 1280, height: 800 } }], ['piccolo', { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true }]]) {
    const ctx = await b.newContext({ ...opz, geolocation: { latitude: 41.8893, longitude: 12.4707 }, permissions: ['geolocation'], reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', (e) => err.push(String(e)));
    await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(400);
    let s = await p.evaluate(() => { const a = document.querySelector('#m-start'), z = document.querySelector('#m-livelli'), ra = a.getBoundingClientRect(), rz = z.getBoundingClientRect(); return { titolo: document.querySelector('.partenza').getAttribute('aria-label'), a: a.innerText.replace(/\s+/g, ' '), z: z.innerText.replace(/\s+/g, ' '), icone: document.querySelectorAll('.partenza-scelte svg path').length, affiancate: Math.abs(ra.top - rz.top) < 4, hA: Math.round(ra.height), hZ: Math.round(rz.height), scorre: document.documentElement.scrollWidth > innerWidth + 1, fondi: [getComputedStyle(a).backgroundColor, getComputedStyle(z).backgroundColor], menu: [...document.querySelectorAll('.menu button')].filter((x) => x.offsetHeight > 0).map((x) => x.querySelector('.voce').textContent.trim()), punti: getComputedStyle(document.querySelector('.scena .solo-conto')).display }; });
    dico(nome + ': due scelte con titolo, icone e spiegazione', s.titolo === 'Da dove partiamo?' && /^VICINO A ME I posti a pochi minuti a piedi\. Ti chiedo la posizione$/.test(s.a) && /^SCELGO LA ZONA Quartiere, altra città o fuori porta\. Senza posizione$/.test(s.z) && s.affiancate && s.icone === 2 && !s.scorre && s.hA >= 60 && s.hZ >= 60, s);
    dico(nome + ': i due tasti hanno lo stesso peso (stesso fondo, nessuno già «acceso»)', s.fondi[0] === s.fondi[1] && s.fondi[0] === 'rgb(249, 239, 216)', s.fondi);
    dico(nome + ': sotto restano gettone e donazione; la frase sui punti è nascosta finché non ci sono gli account', JSON.stringify(s.menu) === JSON.stringify(['INSERISCI GETTONE', 'DONA UNA MONETA']) && s.punti === 'none', [s.menu, s.punti]);
    const prima = await p.evaluate(() => { const z = document.querySelector('#m-livelli').getBoundingClientRect(), v = document.querySelector('#m-livelli .voce'); return { zonaDentroPrimaSchermata: z.bottom <= innerHeight, taglio: v.scrollWidth > v.clientWidth + 1, righeVoce: Math.round(v.getBoundingClientRect().height / parseFloat(getComputedStyle(v).lineHeight)) }; });
    console.log('   ' + nome + ' prima schermata:', JSON.stringify(prima));
    await p.screenshot({ path: `${out}/partenza-${nome}.png` });
    // la battuta non apre più una finestra con le stesse due scelte: porta ai due tasti e li fa notare
    await p.evaluate(() => scrollTo(0, 0)); await p.click('#bolla'); await p.waitForTimeout(150);
    s = await p.evaluate(() => { const q = (x) => { const e = document.querySelector(x), r = e.getBoundingClientRect(), c = getComputedStyle(e); return { dentro: r.top >= 0 && r.bottom <= innerHeight + 1, cornice: c.outlineStyle + ' ' + c.outlineWidth + ' ' + c.outlineColor }; };
      return { finestre: document.querySelectorAll('dialog[open]').length, chiama: document.querySelector('.partenza').classList.contains('chiama'), a: q('#m-start'), z: q('#m-livelli'), fuoco: document.activeElement.className }; });
    dico(nome + ': «Portami fuori» non apre finestre: porta ai due tasti e li incornicia tutti e due', s.finestre === 0 && s.chiama && s.a.dentro && s.z.dentro && s.a.cornice === s.z.cornice && /^solid 4px rgb\(242, 182, 50\)$/.test(s.a.cornice) && /partenza/.test(s.fuoco), s);
    if (nome === 'telefono') await p.screenshot({ path: `${out}/partenza-chiama.png` });
    await p.waitForTimeout(1700);
    s = await p.evaluate(() => ({ chiama: document.querySelector('.partenza').classList.contains('chiama'), cornice: getComputedStyle(document.querySelector('#m-start')).outlineStyle }));
    dico(nome + ': …e dopo un momento smette di lampeggiare; la cornice d’oro resta accesa', !s.chiama && s.cornice === 'solid', s);
    // i due pulsanti in pagina
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200);
    await p.click('#m-livelli'); await p.waitForTimeout(600);
    dico(nome + ': pulsante SCELGO LA ZONA porta ai quartieri', Math.abs(await p.evaluate(() => document.querySelector('#sez-mondi').getBoundingClientRect().top)) < 80);
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200);
    await p.click('#m-start'); await p.waitForTimeout(1200);
    dico(nome + ': pulsante VICINO A ME trova i posti vicini', await p.evaluate(() => document.querySelector('#titolo-ris').textContent === 'Vicino a te' && document.querySelector('#m-start .voce').textContent === 'VICINO A ME'));
    dico(nome + ': nessun errore', err.length === 0, err);
    await ctx.close();
  }
  // I due tasti si fanno notare: cornice d'oro sempre, che lampeggia per meno di cinque secondi quando la schermata è libera
  {
    const stato = (p) => p.evaluate(() => { const c = getComputedStyle(document.querySelector('#m-start')), z = getComputedStyle(document.querySelector('#m-livelli')); return { lampeggia: document.querySelector('.partenza').classList.contains('lampeggia'),
      cornice: c.outlineStyle + ' ' + c.outlineWidth, uguali: c.outlineStyle === z.outlineStyle && c.outlineWidth === z.outlineWidth && c.animationName === z.animationName, anim: c.animationName, durata: parseFloat(c.animationDuration) * parseFloat(c.animationIterationCount) }; });
    let ctx = await b.newContext({ ...devices['iPhone 13'] });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
    let p = await ctx.newPage(); const err = []; p.on('pageerror', (e) => err.push(String(e)));
    await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(1300);
    let s = await stato(p);
    dico('lampeggio: all’arrivo i due tasti lampeggiano insieme, per meno di cinque secondi', s.lampeggia && s.anim === 'chiama' && s.uguali && s.durata > 3 && s.durata < 5 && s.cornice === 'solid 4px', s);
    await p.waitForTimeout(5200);
    s = await stato(p);
    dico('lampeggio: poi si ferma e la cornice d’oro resta accesa su tutti e due', !s.lampeggia && s.anim === 'none' && s.cornice === 'solid 4px' && s.uguali && await p.evaluate(() => getComputedStyle(document.querySelector('#m-start')).outlineColor === 'rgb(242, 182, 50)'), s);
    // scelto un livello e tornati su con RESTART: lampeggiano di nuovo
    await p.evaluate(() => document.querySelector('#livelli [data-livello="Trastevere"]').click()); await p.waitForTimeout(700);
    dico('lampeggio: dopo aver scelto un livello non lampeggiano', !(await stato(p)).lampeggia);
    await p.click('.bar [data-restart]'); await p.waitForTimeout(2200);
    s = await stato(p);
    dico('lampeggio: dopo RESTART, tornati all’inizio, lampeggiano di nuovo', s.lampeggia && await p.evaluate(() => scrollY < 5), s);
    dico('lampeggio: nessun errore', err.length === 0, err);
    await ctx.close();
    // con una finestra sopra non parte: comincia quando la finestra si chiude
    ctx = await b.newContext({ ...devices['iPhone 13'] });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); } catch (e) {} });
    p = await ctx.newPage(); await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(1500);
    s = await stato(p);
    dico('lampeggio: con la finestra «Da dove partiamo?» sopra non parte', await p.evaluate(() => document.querySelector('#dlg-posizione').open) && !s.lampeggia, s);
    await p.click('#dlg-posizione [data-chiudi]'); await p.waitForTimeout(900);
    s = await stato(p);
    dico('lampeggio: chiusa la finestra senza scegliere, i due tasti lampeggiano', s.lampeggia && s.anim === 'chiama', s);
    await ctx.close();
    // chi ha chiesto meno movimento: cornice sì, lampeggio no
    ctx = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
    p = await ctx.newPage(); await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(1300);
    s = await stato(p);
    dico('lampeggio: con «riduci movimento» la cornice c’è ma non lampeggia', s.anim === 'none' && s.cornice === 'solid 4px', s);
    await ctx.close();
  }
  // Chi arriva la prima volta: dopo i termini la finestra «Da dove partiamo?» c'è ancora, con le due scelte di pari peso
  for (const scelta of ['attiva', 'no']) {
    const ctx = await b.newContext({ ...devices['iPhone 13'], geolocation: { latitude: 41.8893, longitude: 12.4707 }, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); } catch (e) {} });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', (e) => err.push(String(e)));
    await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(900);
    let s = await p.evaluate(() => { const d = document.querySelector('#dlg-posizione'), r = d.getBoundingClientRect(), bb = [...document.querySelectorAll('#pos-corpo .get-scelte button')]; return { aperta: d.open, titolo: document.querySelector('#pos-t').textContent,
      scelte: bb.map((x) => x.querySelector('b').textContent), testi: bb.map((x) => x.querySelector('small').textContent), fondi: bb.map((x) => getComputedStyle(x).backgroundColor), cornici: bb.map((x) => getComputedStyle(x).outlineStyle),
      fuoco: document.activeElement.className, dentro: r.top >= 0 && r.bottom <= innerHeight + 1 }; });
    if (scelta === 'attiva') {
      dico('prima visita: si apre «Da dove partiamo?» con le due scelte', s.aperta && s.titolo === 'DA DOVE PARTIAMO?' && JSON.stringify(s.scelte) === JSON.stringify(['Vicino a me', 'Scelgo la zona']) && s.dentro, s);
      dico('prima visita: le due scelte pesano uguale (stesso fondo, nessuna con la cornice del fuoco)', s.fondi[0] === s.fondi[1] && s.cornici.every((c) => c === 'none') && s.fuoco === 'get-scelte', s);
      dico('prima visita: «Vicino a me» dice prima che cosa ottieni e poi che cosa ti viene chiesto', /^I posti a pochi minuti a piedi\. Il telefono ti chiede il permesso alla posizione: scegli «Consenti»\.$/.test(s.testi[0]) && /Senza usare la posizione\.$/.test(s.testi[1]), s.testi);
      await p.screenshot({ path: `${out}/partenza-finestra.png` });
      await ctx.grantPermissions(['geolocation']);
    }
    await p.click(`#pos-corpo [data-pos=${scelta}]`); await p.waitForTimeout(1300);
    s = await p.evaluate(() => ({ aperta: document.querySelector('#dlg-posizione').open, tit: document.querySelector('#titolo-ris').textContent, top: Math.round(document.querySelector('#sez-mondi').getBoundingClientRect().top) }));
    if (scelta === 'attiva') dico('prima visita: Vicino a me → posti vicini', !s.aperta && s.tit === 'Vicino a te', s);
    else dico('prima visita: Scelgo la zona → porta alla scelta del mondo', !s.aperta && Math.abs(s.top) < 80, s);
    dico('prima visita (' + scelta + '): nessun errore', err.length === 0, err);
    await ctx.close();
  }
  await b.close(); console.log(male ? male + ' falliti' : 'tutti giusti');
})();
