// La finestra "Attiva la posizione": quando compare, che cosa fa, che cosa ricorda. E le spiegazioni del gettone.
const { chromium, devices } = require('playwright');
const out = process.argv[2];
const ok = [], ko = [];
const check = (n, c, x) => (c ? ok : ko).push(n + (x !== undefined ? ' → ' + JSON.stringify(x) : ''));
const ROMA = { latitude: 41.8893, longitude: 12.4707 };   // Trastevere
(async () => {
  const b = await chromium.launch();
  // opzioni: permesso = 'granted' | 'prompt' (concesso al clic) | 'denied'; termini già accettati o no
  const nuovo = async ({ device = 'iPhone 13', permesso = 'denied', termini = true, ua, ricordato = false } = {}) => {
    const ctx = await b.newContext({ ...devices[device], reducedMotion: 'reduce', ...(ua ? { userAgent: ua } : {}), ...(permesso !== 'denied' ? { geolocation: ROMA, permissions: ['geolocation'] } : {}) });
    await ctx.addInitScript(([termini, permesso, ricordato]) => {
      try { if (termini) localStorage.setItem('sns-termini', '1.1'); if (ricordato) localStorage.setItem('sns-posizione', 'no'); } catch (e) {}
      // "prompt": il browser non ha ancora deciso (nel test il permesso c'è già, ma la pagina non lo sa)
      if (permesso === 'prompt') navigator.permissions.query = async () => ({ state: 'prompt' });
    }, [termini, permesso, ricordato]);
    const p = await ctx.newPage(); const err = [];
    p.on('pageerror', (e) => err.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text()); });
    await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(600);
    return { ctx, p, err };
  };
  const st = (p) => p.evaluate(() => ({ pos: document.querySelector('#dlg-posizione').open, ter: document.querySelector('#dlg-termini').open, testo: document.querySelector('#pos-corpo').innerText.replace(/\s+/g, ' ').slice(0, 400), passi: [...document.querySelectorAll('#pos-corpo .passi li')].map((l) => l.innerText), bottoni: [...document.querySelectorAll('#pos-corpo button')].map((x) => x.innerText.trim()), ricordo: localStorage.getItem('sns-posizione'), titolo: document.querySelector('#titolo-ris').textContent }));

  // 1) Prima visita: prima i termini, poi la posizione (mai due finestre insieme)
  let { ctx, p, err } = await nuovo({ permesso: 'prompt', termini: false });
  let s = await st(p);
  check('prima visita: solo i termini', s.ter && !s.pos, s);
  await p.click('#termini-ok'); await p.waitForTimeout(400);
  s = await st(p);
  check('dopo i termini compare la posizione', !s.ter && s.pos && /Vicino a me/.test(s.testo) && /Scelgo la zona/.test(s.testo), s);
  check('due scelte chiare', JSON.stringify(s.bottoni) === JSON.stringify(['▶ ATTIVA LA POSIZIONE', 'NON ORA: SCELGO IO LA ZONA']) || s.bottoni.length === 2, s.bottoni);
  const r = await p.evaluate(() => { const d = document.querySelector('#dlg-posizione').getBoundingClientRect(); return { top: d.top, bottom: d.bottom, vh: innerHeight, fuoco: document.activeElement.textContent.trim() }; });
  check('finestra dentro lo schermo', r.top >= 0 && r.bottom <= r.vh, r);
  await p.screenshot({ path: out + '/pos-1-chiedi.png' });
  // 2) Attiva: il permesso arriva, la finestra si chiude e si vedono i posti vicini
  await p.click('#pos-corpo [data-pos=attiva]'); await p.waitForTimeout(900);
  s = await st(p);
  check('attiva: trovato, finestra chiusa, posti vicini', !s.pos && s.titolo === 'Vicino a te' && s.ricordo === null, s);
  check('nessun errore (prima visita)', err.length === 0, err);
  await ctx.close();

  // 3) Permesso già dato: nessuna finestra
  ({ ctx, p, err } = await nuovo({ permesso: 'granted' }));
  check('permesso già dato: non chiede nulla', !(await st(p)).pos);
  await ctx.close();

  // 4) Posizione bloccata su iPhone: istruzioni per iPhone, poi "scelgo io" viene ricordato
  ({ ctx, p, err } = await nuovo({ permesso: 'denied' }));
  s = await st(p);
  check('bloccata: la finestra compare comunque una volta', s.pos, s);
  await p.click('#pos-corpo [data-pos=attiva]'); await p.waitForTimeout(900);
  s = await st(p);
  check('bloccata su iPhone: tre passi per iPhone', s.pos && s.passi.length === 3 && /Impostazioni/.test(s.passi[0]) && /Safari/.test(s.passi[1]) && /Riprova/i.test(s.bottoni.join()), s);
  await p.screenshot({ path: out + '/pos-2-bloccata-iphone.png' });
  const rr = await p.evaluate(() => { const d = document.querySelector('#dlg-posizione').getBoundingClientRect(); return { top: d.top, bottom: d.bottom, vh: innerHeight }; });
  check('istruzioni dentro lo schermo', rr.top >= 0 && rr.bottom <= rr.vh, rr);
  await p.click('#pos-corpo [data-pos=no]'); await p.waitForTimeout(500);
  s = await st(p);
  const top = await p.evaluate(() => Math.round(document.querySelector('#sez-mondi').getBoundingClientRect().top));
  check('scelgo io: chiusa, ricordato, porta ai quartieri', !s.pos && s.ricordo === 'no' && Math.abs(top) < 60, { s: s.ricordo, top });
  await p.reload(); await p.waitForTimeout(600);
  check('alla visita dopo non la ripropone', !(await st(p)).pos);
  // ma PREMI START la riapre con le istruzioni
  await p.click('#m-start'); await p.waitForTimeout(900);
  s = await st(p);
  check('PREMI START con posizione bloccata: istruzioni', s.pos && s.passi.length === 3, s);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  check('Esc chiude', !(await st(p)).pos);
  check('nessun errore (bloccata)', err.length === 0, err);
  await ctx.close();

  // 5) Android: istruzioni per Android
  ({ ctx, p, err } = await nuovo({ device: 'Pixel 7', permesso: 'denied' }));
  await p.click('#pos-corpo [data-pos=attiva]'); await p.waitForTimeout(900);
  s = await st(p);
  check('bloccata su Android: passi per Android', s.passi.length === 3 && /menu rapido/.test(s.passi[0]) && /Autorizzazioni/.test(s.passi[1]), s.passi);
  await p.screenshot({ path: out + '/pos-3-bloccata-android.png' });
  await ctx.close();

  // 6) Computer
  let cd = await b.newContext({ viewport: { width: 1366, height: 800 } });
  await cd.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); } catch (e) {} });
  let pd = await cd.newPage(); await pd.goto('http://localhost:8765/index.html'); await pd.waitForTimeout(600);
  await pd.click('#pos-corpo [data-pos=attiva]'); await pd.waitForTimeout(900);
  s = await st(pd);
  check('bloccata su computer: passi per computer', s.passi.length === 3 && /Clicca/.test(s.passi[0]), s.passi);
  await pd.screenshot({ path: out + '/pos-4-computer.png' });
  await cd.close();

  // 7) Dentro Instagram: avviso di aprire nel browser
  ({ ctx, p, err } = await nuovo({ permesso: 'denied', ua: devices['iPhone 13'].userAgent + ' Instagram 300.0.0.0' }));
  await p.click('#pos-corpo [data-pos=attiva]'); await p.waitForTimeout(900);
  s = await st(p);
  check('dentro un’altra app: dice di aprire nel browser', /Apri nel browser/.test(s.testo), s.testo);
  await ctx.close();

  // 8) Gettone: spiegazioni, e dal gettone la guida per la posizione
  ({ ctx, p, err } = await nuovo({ permesso: 'denied', ricordato: true }));
  check('menu: il gettone si spiega', /a caso/.test(await p.textContent('#m-gettone small')) && /gratis/i.test(await p.textContent('#m-gettone small')), await p.textContent('#m-gettone small'));
  check('sopra la lista c’è il suggerimento', await p.evaluate(() => { const h = document.querySelector('#hint-gettone'); return !h.hidden && /a caso/.test(h.textContent) && h.getBoundingClientRect().height > 0; }));
  await p.click('#m-gettone'); await p.waitForTimeout(300);
  check('gettone: spiega che pesca a caso ed è gratis', await p.evaluate(() => /un posto a caso/.test(document.querySelector('#get-corpo .get-cosa').textContent) && /gratis/.test(document.querySelector('#get-corpo .get-cosa').textContent)));
  await p.screenshot({ path: out + '/get-1-dove.png' });
  await p.click('[data-get=vicino]'); await p.waitForTimeout(300);
  if (await p.locator('[data-get=vicino-ok]').count()) await p.click('[data-get=vicino-ok]');   // l'avviso prima della richiesta
  await p.waitForTimeout(900);
  check('gettone, vicino a me con posizione bloccata: «Come si attiva?»', await p.locator('#get-corpo [data-get=guida]').count() === 1);
  await p.click('#get-corpo [data-get=guida]'); await p.waitForTimeout(300);
  s = await st(p);
  check('la guida si apre sopra il gettone', s.pos && s.passi.length === 3 && await p.evaluate(() => document.querySelector('#dlg-gettone').open), s);
  await p.click('#pos-corpo [data-pos=no]'); await p.waitForTimeout(300);
  check('chiusa la guida, il gettone resta', await p.evaluate(() => document.querySelector('#dlg-gettone').open && !document.querySelector('#dlg-posizione').open));
  await p.click('[data-get=ovunque]'); await p.waitForTimeout(500);
  s = await p.evaluate(() => ({ eti: document.querySelector('#get-corpo .eti').textContent, hint: document.querySelector('#hint-gettone').hidden, h: document.querySelector('#dlg-gettone').getBoundingClientRect().bottom, vh: innerHeight }));
  check('risultato: «uno a caso tra N posti», suggerimento sparito', /UNO A CASO TRA \d+ POSTI/.test(s.eti) && s.hint && s.h <= s.vh, s);
  await p.screenshot({ path: out + '/get-2-esito.png' });
  check('nessun errore (gettone)', err.length === 0, err);
  await ctx.close();

  // 9) Dal gettone con permesso che arriva: dopo "Attiva" pesca vicino a te
  ({ ctx, p, err } = await nuovo({ permesso: 'prompt', ricordato: true }));
  await p.click('#m-gettone'); await p.waitForTimeout(300); await p.click('[data-get=vicino]'); await p.waitForTimeout(300);
  check('gettone vicino a me: prima l’avviso sulla posizione', await p.locator('#get-corpo .avviso').count() === 1);
  await p.click('[data-get=vicino-ok]'); await p.waitForTimeout(1200);
  s = await p.evaluate(() => ({ info: document.querySelector('.get-info')?.textContent || '', quanto: !!document.querySelector('#get-esito .quanto') }));
  check('gettone vicino a me con permesso: pesca a pochi minuti', /minuti a piedi|più vicini/.test(s.info) && s.quanto, s);
  await ctx.close();

  // 10) Telefono piccolo: le istruzioni non escono dallo schermo
  const cs = await b.newContext({ viewport: { width: 360, height: 640 }, userAgent: devices['iPhone 13'].userAgent, isMobile: true, hasTouch: true });
  await cs.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); } catch (e) {} });
  const ps = await cs.newPage(); await ps.goto('http://localhost:8765/index.html'); await ps.waitForTimeout(600);
  await ps.click('#pos-corpo [data-pos=attiva]'); await ps.waitForTimeout(900);
  const q = await ps.evaluate(() => { const d = document.querySelector('#dlg-posizione'); const r = d.getBoundingClientRect(); const bt = document.querySelector('#pos-corpo [data-pos=no]').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: innerHeight, scorre: d.scrollHeight > d.clientHeight + 1 || document.querySelector('#pos-corpo').scrollHeight > document.querySelector('#pos-corpo').clientHeight + 1, btBottom: bt.bottom }; });
  check('360x640: finestra dentro lo schermo (o scorrevole)', q.top >= 0 && q.bottom <= q.vh, q);
  await ps.screenshot({ path: out + '/pos-5-piccolo.png' });
  await cs.close();

  await b.close();
  console.log(ok.length + ' ok, ' + ko.length + ' falliti'); ko.forEach((x) => console.log('FALLITO: ' + x));
})();
