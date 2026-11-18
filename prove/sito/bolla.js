const { chromium, devices } = require('playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch(); let male = 0; const dico = (n, c, x) => { if (!c) male++; console.log((c ? 'ok ' : 'NO ') + n + (c ? '' : ' → ' + JSON.stringify(x))); };
  for (const [nome, opz] of [['telefono', { ...devices['iPhone 13'] }], ['computer', { viewport: { width: 1280, height: 800 } }], ['piccolo', { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true }]]) {
    const ctx = await b.newContext({ ...opz, geolocation: { latitude: 41.8893, longitude: 12.4707 }, permissions: ['geolocation'], reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', (e) => err.push(String(e)));
    await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(400);
    let s = await p.evaluate(() => { const a = document.querySelector('#m-start'), z = document.querySelector('#m-livelli'), ra = a.getBoundingClientRect(), rz = z.getBoundingClientRect(); return { titolo: document.querySelector('.partenza').getAttribute('aria-label'), a: a.innerText.replace(/\s+/g, ' '), z: z.innerText.replace(/\s+/g, ' '), icone: document.querySelectorAll('.partenza-scelte svg path').length, affiancate: Math.abs(ra.top - rz.top) < 4, hA: Math.round(ra.height), hZ: Math.round(rz.height), scorre: document.documentElement.scrollWidth > innerWidth + 1, menu: [...document.querySelectorAll('.menu button')].filter((x) => x.offsetHeight > 0).map((x) => x.querySelector('.voce').textContent.trim()), punti: getComputedStyle(document.querySelector('.scena .solo-conto')).display }; });
    dico(nome + ': due scelte con titolo, icone e spiegazione', s.titolo === 'Da dove partiamo?' && /^VICINO A ME Uso la posizione/.test(s.a) && /^SCELGO LA ZONA Quartiere/.test(s.z) && s.affiancate && s.icone === 2 && !s.scorre && s.hA >= 60 && s.hZ >= 60, s);
    dico(nome + ': sotto restano gettone e donazione; la frase sui punti è nascosta finché non ci sono gli account', JSON.stringify(s.menu) === JSON.stringify(['INSERISCI GETTONE', 'DONA UNA MONETA']) && s.punti === 'none', [s.menu, s.punti]);
    const prima = await p.evaluate(() => { const z = document.querySelector('#m-livelli').getBoundingClientRect(), v = document.querySelector('#m-livelli .voce'); return { zonaDentroPrimaSchermata: z.bottom <= innerHeight, taglio: v.scrollWidth > v.clientWidth + 1, righeVoce: Math.round(v.getBoundingClientRect().height / parseFloat(getComputedStyle(v).lineHeight)) }; });
    console.log('   ' + nome + ' prima schermata:', JSON.stringify(prima));
    await p.screenshot({ path: `${out}/partenza-${nome}.png` });
    // la battuta apre la scelta
    await p.evaluate(() => scrollTo(0, 0)); await p.click('#bolla'); await p.waitForTimeout(300);
    s = await p.evaluate(() => { const d = document.querySelector('#dlg-posizione'), r = d.getBoundingClientRect(); return { aperta: d.open, titolo: document.querySelector('#pos-t').textContent, scelte: [...document.querySelectorAll('#pos-corpo .get-scelte button b')].map((x) => x.textContent), dentro: r.top >= 0 && r.bottom <= innerHeight + 1 }; });
    dico(nome + ': «Portami fuori» apre «Da dove partiamo?» con le due scelte', s.aperta && s.titolo === 'DA DOVE PARTIAMO?' && JSON.stringify(s.scelte) === JSON.stringify(['▶ Vicino a me', 'Scelgo la zona']) && s.dentro, s);
    if (nome === 'telefono') await p.screenshot({ path: `${out}/partenza-finestra.png` });
    await p.click('#pos-corpo [data-pos=attiva]'); await p.waitForTimeout(1200);
    s = await p.evaluate(() => ({ aperta: document.querySelector('#dlg-posizione').open, tit: document.querySelector('#titolo-ris').textContent }));
    dico(nome + ': Vicino a me → posti vicini', !s.aperta && s.tit === 'Vicino a te', s);
    await p.click('[data-restart]:visible'); await p.waitForTimeout(400);
    await p.click('#bolla'); await p.waitForTimeout(300); await p.click('#pos-corpo [data-pos=no]'); await p.waitForTimeout(600);
    s = await p.evaluate(() => ({ aperta: document.querySelector('#dlg-posizione').open, top: Math.round(document.querySelector('#sez-mondi').getBoundingClientRect().top) }));
    dico(nome + ': Scelgo la zona → porta ai quartieri', !s.aperta && Math.abs(s.top) < 80, s);
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
  await b.close(); console.log(male ? male + ' falliti' : 'tutti giusti');
})();
