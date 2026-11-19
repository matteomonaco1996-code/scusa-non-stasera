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
  // L'entrata in scena e il lampeggio: Gaia entra da sinistra e parla, poi entri tu da destra, poi Ristomat chiede
  // «Da dove partiamo?» e i due tasti (che hanno sempre la cornice d'oro) lampeggiano. In tutto meno di cinque secondi.
  {
    const guarda = (p) => p.evaluate(() => {
      // «in campo»: sul telefono il bordo è quello dello schermo, sul computer quello della scena, che taglia ciò che sporge
      const el = (q) => document.querySelector(q), sc = el('.scena').getBoundingClientRect(), taglia = getComputedStyle(el('.scena')).overflowX === 'clip';
      const sx = taglia ? sc.left : 0, dx = taglia ? sc.right : innerWidth;
      const vede = (q) => { const e = el(q), r = e.getBoundingClientRect(), c = getComputedStyle(e); return c.opacity !== '0' && r.width > 20 && r.right > sx + 1 && r.left < dx - 1; };
      const c = getComputedStyle(el('#m-start')), z = getComputedStyle(el('#m-livelli')), par = el('.partenza');
      return { gaia: vede('.battuta.lei .figura'), fGaia: vede('.battuta.lei .voce-di'), tu: vede('.battuta.io .figura'), fTu: vede('.battuta.io .voce-di'), moneta: vede('.battuta.gioco .figura'), fRisto: vede('.battuta.gioco .voce-di'),
        xGaia: Math.round(el('.battuta.lei .figura').getBoundingClientRect().left), xTu: Math.round(el('.battuta.io .figura').getBoundingClientRect().left), sx: Math.round(sx), dx: Math.round(dx),
        lampeggia: par.classList.contains('lampeggia'), breve: par.classList.contains('breve'), anim: c.animationName, durata: parseFloat(c.animationDuration) * parseFloat(c.animationIterationCount),
        cornice: c.outlineStyle + ' ' + c.outlineWidth + ' ' + c.outlineColor, uguali: c.outlineStyle === z.outlineStyle && c.outlineWidth === z.outlineWidth && c.animationName === z.animationName,
        scorre: document.documentElement.scrollWidth > innerWidth + 1, movimento: document.getAnimations().filter((a) => a.playState === 'running' || a.pending).length };
    });
    const ORO = 'solid 4px rgb(242, 182, 50)';
    // un filmato: una fotografia ogni 150 ms per sei secondi
    const filma = async (p, quanto = 6000) => { const t0 = Date.now(), f = []; while (Date.now() - t0 < quanto) { const s = await guarda(p).catch(() => null); if (s) f.push({ t: Date.now() - t0, ...s }); await p.waitForTimeout(150); } return f; };
    const primo = (f, cosa) => { const x = f.find(cosa); return x ? x.t : Infinity; };
    for (const [nome, disp] of [['telefono', devices['iPhone 13']], ['computer', { viewport: { width: 1280, height: 800 } }]]) {
      const ctx = await b.newContext({ ...disp });
      await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
      const p = await ctx.newPage(); const err = []; p.on('pageerror', (e) => err.push(String(e)));
      await p.goto('http://localhost:8765/index.html', { waitUntil: 'commit' });
      await p.waitForSelector('.battuta.gioco .voce-di', { state: 'attached' });   // «attached»: all'inizio il fumetto c'è ma è ancora chiuso
      const f = await filma(p);
      const tG = primo(f, (x) => x.gaia), tFG = primo(f, (x) => x.fGaia), tT = primo(f, (x) => x.tu), tFT = primo(f, (x) => x.fTu), tM = primo(f, (x) => x.moneta), tFR = primo(f, (x) => x.fRisto), tL = primo(f, (x) => x.lampeggia);
      dico(nome + ': entrata in scena: all’inizio il palco è vuoto, Gaia arriva da fuori a sinistra e tu da fuori a destra', !f[0].gaia && !f[0].tu && !f[0].fGaia && !f[0].fTu && !f[0].fRisto && f[0].xGaia < f[0].sx && f[0].xTu >= f[0].dx - 1 && f[f.length - 1].gaia && f[f.length - 1].tu && f[f.length - 1].xGaia >= f[0].sx && f[f.length - 1].xTu < f[0].dx - 60, { inizio: f[0], fine: f[f.length - 1] });
      dico(nome + ': …nell’ordine: Gaia, il suo fumetto, tu, il tuo fumetto, Ristomat con la domanda', tG <= tFG && tFG < tT && tT <= tFT && tFT < tFR && tM <= tFR && tFR < 3200, { tG, tFG, tT, tFT, tM, tFR });
      dico(nome + ': …poi lampeggiano i due tasti, insieme, e per poco', tL >= tFR && tL < 3600 && f.filter((x) => x.lampeggia).every((x) => x.breve && x.uguali) && f.find((x) => x.lampeggia).anim === 'chiama' && Math.abs(f.find((x) => x.lampeggia).durata - 2.1) < 0.01, { tFR, tL, es: f.find((x) => x.lampeggia) });
      dico(nome + ': …mentre i personaggi entrano la pagina non si allarga di lato', f.every((x) => !x.scorre), f.filter((x) => x.scorre).map((x) => x.t));
      const fermo = primo(f, (x) => x.t > tL && x.movimento === 0);
      dico(nome + ': …e tutto il movimento finisce entro cinque secondi; la cornice d’oro resta accesa su tutti e due', fermo < 5000 && f[f.length - 1].movimento === 0 && f[f.length - 1].cornice === ORO && f[f.length - 1].uguali && f[f.length - 1].fGaia && f[f.length - 1].fTu && f[f.length - 1].fRisto, { fermo, fine: f[f.length - 1] });
      if (nome === 'telefono') {
        // scelto un livello e tornati su con RESTART: la scena rientra e i tasti lampeggiano di nuovo
        await p.evaluate(() => document.querySelector('#livelli [data-livello="Trastevere"]').click()); await p.waitForTimeout(700);
        dico('lampeggio: dopo aver scelto un livello non lampeggiano', !(await guarda(p)).lampeggia);
        await p.click('.bar [data-restart]');
        const r = await filma(p, 5000);
        dico('RESTART: tornati all’inizio la scena rientra (il tuo fumetto sparisce e riappare) e poi i tasti lampeggiano', r.some((x) => !x.fTu) && r[r.length - 1].fTu && r.some((x) => x.lampeggia) && await p.evaluate(() => scrollY < 5), { senza: r.filter((x) => !x.fTu).length, lamp: r.filter((x) => x.lampeggia).length });
      }
      dico(nome + ': entrata in scena: nessun errore', err.length === 0, err);
      await ctx.close();
    }
    // i due tasti si toccano subito, anche mentre i personaggi stanno entrando
    let ctx = await b.newContext({ ...devices['iPhone 13'] });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
    let p = await ctx.newPage(); await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(250);
    const durante = await guarda(p);
    await p.click('#m-livelli'); await p.waitForTimeout(900);
    dico('i due tasti si toccano subito: «Scelgo la zona» a entrata appena cominciata porta alla scelta del mondo', !durante.fRisto && Math.abs(await p.evaluate(() => document.querySelector('#sez-mondi').getBoundingClientRect().top)) < 80, durante);
    await ctx.close();
    // prima visita: con i termini sopra i tasti non lampeggiano; accettati i termini non si apre nient'altro,
    // la scena entra da capo (stavolta la si vede) e poi i tasti lampeggiano
    ctx = await b.newContext({ ...devices['iPhone 13'] });
    p = await ctx.newPage(); await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(3200);
    let s = await guarda(p);
    dico('prima visita: con i termini sopra i tasti non lampeggiano', await p.evaluate(() => document.querySelector('#dlg-termini').open) && !s.lampeggia, s);
    await p.click('#termini-ok');
    const dopo = await filma(p, 4600);
    dico('prima visita: accettati i termini non si apre nessun’altra finestra', await p.evaluate(() => document.querySelectorAll('dialog[open]').length === 0));
    dico('prima visita: …la scena entra da capo e poi i tasti lampeggiano', dopo.some((x) => !x.fGaia) && dopo[dopo.length - 1].fRisto && primo(dopo, (x) => x.lampeggia) > primo(dopo, (x) => !x.fGaia) && dopo.some((x) => x.lampeggia), { senza: dopo.filter((x) => !x.fGaia).length, lamp: dopo.filter((x) => x.lampeggia).length });
    await ctx.close();
    // chi ha chiesto meno movimento: tutto già al suo posto, la cornice c'è ma non lampeggia
    ctx = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
    p = await ctx.newPage(); await p.goto('http://localhost:8765/index.html', { waitUntil: 'commit' }); await p.waitForSelector('.battuta.gioco .voce-di', { state: 'attached' });   // «attached»: all'inizio il fumetto c'è ma è ancora chiuso
    const fermi = await filma(p, 1500);
    dico('«riduci movimento»: personaggi e fumetti sono al loro posto dal primo istante, niente si muove, la cornice c’è', fermi.every((x) => x.gaia && x.fGaia && x.tu && x.fTu && x.fRisto && x.movimento === 0 && x.anim === 'none') && fermi[fermi.length - 1].cornice === ORO, fermi[0]);
    await ctx.close();
  }
  // Chi arriva la prima volta (termini già accettati in un'altra occasione, nient'altro nel browser): nessuna finestra,
  // la domanda «Da dove partiamo?» la fanno i due tasti della pagina
  for (const scelta of ['m-start', 'm-livelli']) {
    const ctx = await b.newContext({ ...devices['iPhone 13'], geolocation: { latitude: 41.8893, longitude: 12.4707 }, permissions: ['geolocation'], reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); } catch (e) {} });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', (e) => err.push(String(e)));
    await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(900);
    if (scelta === 'm-start') dico('prima visita: nessuna finestra si apre da sola; i due tasti sono nella prima schermata', await p.evaluate(() => document.querySelectorAll('dialog[open]').length === 0 && ['#m-start', '#m-livelli'].every((q) => { const r = document.querySelector(q).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })));
    await p.click('#' + scelta); await p.waitForTimeout(1300);
    const s = await p.evaluate(() => ({ aperte: document.querySelectorAll('dialog[open]').length, tit: document.querySelector('#titolo-ris').textContent, top: Math.round(document.querySelector('#sez-mondi').getBoundingClientRect().top) }));
    if (scelta === 'm-start') dico('prima visita: Vicino a me → posti vicini', !s.aperte && s.tit === 'Vicino a te', s);
    else dico('prima visita: Scelgo la zona → porta alla scelta del mondo', !s.aperte && Math.abs(s.top) < 80, s);
    dico('prima visita (' + scelta + '): nessun errore', err.length === 0, err);
    await ctx.close();
  }
  await b.close(); console.log(male ? male + ' falliti' : 'tutti giusti');
})();
