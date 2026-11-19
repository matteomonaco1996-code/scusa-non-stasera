// La pagina di monitoraggio: stati (spento, esempio, accesso, riservata, numeri veri) e grafici.
const { chromium, devices } = require('playwright');
const out = process.argv[2];
const ok = [], ko = [];
const check = (n, c, x) => (c ? ok : ko).push(n + (x !== undefined ? ' → ' + JSON.stringify(x) : ''));
const U = 'http://localhost:8765/statistiche.html';
(async () => {
  const b = await chromium.launch();
  const apri = async (opz, url, prepara) => {
    const ctx = await b.newContext({ ...opz, reducedMotion: 'reduce' });
    const p = await ctx.newPage(); const err = [];
    p.on('pageerror', (e) => err.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text()); });
    if (prepara) await prepara(p, ctx);
    await p.goto(url); await p.waitForTimeout(500);
    return { ctx, p, err };
  };

  // 1) Senza database (config.js con l'indirizzo vuoto): contatore spento
  const senzaDb = async (p, ctx) => { await ctx.route('**/config.js', async (route) => { const r = await route.fetch({ url: 'http://localhost:8765/config.js' }); await route.fulfill({ response: r, body: (await r.text()).replace(/supabaseUrl: "[^"]*"/, 'supabaseUrl: ""') }); }); };
  let { ctx, p, err } = await apri({ ...devices['iPhone 13'] }, U, senzaDb);
  let s = await p.evaluate(() => ({ stato: document.querySelector('#stato').innerText, cruscotto: document.querySelector('#cruscotto').hidden, robots: document.querySelector('meta[name=robots]').content }));
  check('spento: dice solo che non è attiva, niente esempio né dettagli', /Non ancora attiva/.test(s.stato) && s.cruscotto && /noindex/.test(s.robots) && await p.evaluate(() => !document.querySelector('#stato a') && !/Supabase|contator/i.test(document.querySelector('main').innerText)), s);
  await p.screenshot({ path: out + '/mon-0-spento.png' });
  // sul sito vero (non localhost) l'esempio non esiste
  await ctx.route('https://finta.test/**', async (route) => { const u = new URL(route.request().url()); if (u.pathname === '/config.js') return route.fallback(); const r = await route.fetch({ url: 'http://localhost:8765' + u.pathname }); await route.fulfill({ response: r }); });
  await p.goto('https://finta.test/statistiche.html?esempio'); await p.waitForTimeout(500);
  check('sul sito pubblicato ?esempio non mostra nulla', await p.evaluate(() => document.querySelector('#cruscotto').hidden && /Non ancora attiva/.test(document.querySelector('#stato').innerText)));
  check('nessun errore (spento)', err.length === 0, err);
  await ctx.close();

  // 2) Esempio su telefono
  ({ ctx, p, err } = await apri({ ...devices['iPhone 13'] }, U + '?esempio'));
  s = await p.evaluate(() => ({
    numeri: [...document.querySelectorAll('.mon-numero')].map((n) => [n.querySelector('.eti').textContent, n.querySelector('.val').textContent, n.querySelector('.delta').textContent]),
    periodo: document.querySelector('#periodo').textContent, righeTab: document.querySelectorAll('#tab-visite tbody tr').length,
    comitive: { visibile: !document.querySelector('#s-comitive').hidden, numeri: [...document.querySelectorAll('#c-totali dd')].map((x) => x.textContent), nomi: [...document.querySelectorAll('#c-elenco li b')].map((x) => x.textContent), barre: document.querySelectorAll('#b-comitive .mon-barra').length, cancella: document.querySelectorAll('#c-elenco button').length },
    inviti: [...document.querySelectorAll('#b-inviti .mon-barra')].map((r) => [r.querySelector('.nome').textContent, r.querySelector('.val').textContent]),
    azioni: [...document.querySelectorAll('#b-azioni .mon-barra')].map((r) => [r.querySelector('.nome').textContent, r.querySelector('.val').textContent, r.querySelector('.pieno').style.width]),
    posizione: [...document.querySelectorAll('#b-posizione .mon-barra')].map((r) => [r.querySelector('.nome').textContent, r.querySelector('.val').textContent]),
    app: [...document.querySelectorAll('#b-app .mon-barra')].map((r) => [r.querySelector('.nome').textContent, r.querySelector('.val').textContent]),
    fonti: [...document.querySelectorAll('#b-fonti .mon-barra')].map((r) => [r.querySelector('.nome').textContent, r.querySelector('.val').textContent]),
    monete: document.querySelectorAll('#b-monete .mon-barra').length, mesi: document.querySelectorAll('#b-mesi .mon-barra').length, elenco: document.querySelectorAll('#elenco li').length,
    eroe: { eti: document.querySelector('#e-eti').textContent, val: document.querySelector('#e-val').textContent, delta: document.querySelector('#e-delta').textContent, px: parseFloat(getComputedStyle(document.querySelector('#e-val')).fontSize), fam: getComputedStyle(document.querySelector('#e-val')).fontFamily },
    totali: [...document.querySelectorAll('#totali div')].map((d) => d.innerText.replace(/\n/g, ': ')),
    ordine: [...document.querySelectorAll('#cruscotto h2')].map((h) => h.textContent),
    scorreOrizz: document.documentElement.scrollWidth > innerWidth + 1, svgW: document.querySelector('#g-visite svg').getBoundingClientRect().width, boxW: document.querySelector('#g-visite').clientWidth,
  }));
  check('donazioni per prime, con la cifra del periodo scritta grande', s.ordine[0] === 'Donazioni' && s.ordine[1] === 'Visite' && /€/.test(s.eroe.val) && s.eroe.px >= 48 && /Figtree/.test(s.eroe.fam) && /30 giorni/.test(s.eroe.eti) && /▲|▼|=|Nessun/.test(s.eroe.delta), [s.ordine, s.eroe]);
  check('quattro totali: anno, in tutto, numero di donazioni, tocchi', s.totali.length === 4 && /Nel \d{4}/.test(s.totali[0]) && /In tutto/.test(s.totali[1]), s.totali);
  check('quattro numeri sulle visite con confronto', s.numeri.length === 4 && s.numeri.every((n) => n[1] && /▲|▼|=|Nessun/.test(n[2])), s.numeri);
  check('30 giorni: 30 righe in tabella, periodo scritto', s.righeTab === 30 && /^Dal .+ al .+/.test(s.periodo), [s.righeTab, s.periodo]);
  check('azioni: 10 barre, la più lunga al 100%', s.azioni.length === 10 && s.azioni.every((a) => a[1] !== '0') && s.azioni.some((a) => a[2] === '100%'), s.azioni);
  check('posizione: trovata, non arrivata e i tre perché, con la quota sui tentativi', s.posizione.length === 5 && s.posizione[0][0] === 'Trovata' && s.posizione[1][0] === 'Non arrivata' && s.posizione.every((a) => /\d/.test(a[1]) && /%/.test(a[1])), s.posizione);
  check('dentro un’app: aperture e com’è andata la posizione', s.app.length === 3 && s.app[0][0] === 'Aperture' && s.app.every((a) => /\d/.test(a[1])), s.app);
  check('comitive (esempio): 4 numeri, 6 barre, 3 nomi ognuno con «Cancella»', s.comitive.visibile && s.comitive.numeri.join() === '7,3,4,2' && s.comitive.barre === 6 && s.comitive.nomi.length === 3 && s.comitive.cancella === 3 && s.comitive.nomi[0] === 'I Supplì Volanti', s.comitive);
  check('inviti: 7 barre con i numeri (' + s.inviti.map((a) => a[0]).slice(0, 3).join(', ') + '…)', s.inviti.length === 7 && s.inviti[0][0] === '“Proponilo” aperto' && s.inviti.every((a) => /\d/.test(a[1])), s.inviti);
  check('fonti in ordine dal più grande, con la quota', s.fonti.length >= 3 && s.fonti.every((f) => /%/.test(f[1])), s.fonti);
  check('monete, mesi ed elenco donazioni', s.monete === 5 && s.mesi === 6 && s.elenco > 0, [s.monete, s.mesi, s.elenco]);
  check('telefono: niente scorrimento orizzontale, grafico largo quanto la scheda', !s.scorreOrizz && Math.abs(s.svgW - s.boxW) < 2, [s.scorreOrizz, s.svgW, s.boxW]);
  await p.screenshot({ path: out + '/mon-1-telefono.png', fullPage: true });
  // periodo 7 e 90
  await p.click('[data-giorni="7"]'); await p.waitForTimeout(200);
  check('7 giorni: tutto si aggiorna insieme', await p.evaluate(() => document.querySelectorAll('#tab-visite tbody tr').length === 7 && document.querySelector('[data-giorni="7"]').getAttribute('aria-pressed') === 'true' && /7 giorni prima/.test(document.querySelector('.mon-numero .delta').textContent)));
  await p.click('[data-giorni="90"]'); await p.waitForTimeout(200);
  check('90 giorni', await p.evaluate(() => document.querySelectorAll('#tab-visite tbody tr').length === 90));
  // etichetta sul grafico: dito e tastiera
  await p.locator('#g-visite').scrollIntoViewIfNeeded(); await p.waitForTimeout(150);
  const g = await p.locator('#g-visite').boundingBox();
  await p.mouse.move(g.x + g.width * 0.5, g.y + g.height * 0.5); await p.waitForTimeout(150);
  let t = await p.evaluate(() => ({ nascosta: document.querySelector('#tip').hidden, testo: document.querySelector('#tip').innerText, mirino: document.querySelector('#g-visite .mirino').getAttribute('visibility') }));
  check('sul grafico compare l’etichetta con valore e giorno', !t.nascosta && /visit[ae] ·/.test(t.testo) && t.mirino === 'visible', t);
  await p.mouse.move(5, 5); await p.waitForTimeout(100);
  await p.focus('#g-visite'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(150);
  t = await p.evaluate(() => ({ nascosta: document.querySelector('#tip').hidden, testo: document.querySelector('#tip').innerText }));
  check('anche con le frecce della tastiera', !t.nascosta && /visit[ae] ·/.test(t.testo), t);
  await p.keyboard.press('Escape');
  // segno una donazione nell'esempio
  await p.click('[data-giorni="30"]');
  const prima = await p.evaluate(() => document.querySelector('#e-val').textContent);
  await p.fill('#d-euro', '2,50'); await p.click('#f-dona button[type=submit]'); await p.waitForTimeout(200);
  const dopo = await p.evaluate(() => ({ tot: document.querySelector('#e-val').textContent, primo: document.querySelector('#elenco li b').textContent, err: document.querySelector('#d-err').hidden }));
  check('segno 2,50 €: totale ed elenco si aggiornano', dopo.tot !== prima && /2,50/.test(dopo.primo) && dopo.err, [prima, dopo]);
  await p.fill('#d-euro', 'abc'); await p.click('#f-dona button[type=submit]'); await p.waitForTimeout(150);
  check('importo non valido: messaggio chiaro', await p.evaluate(() => !document.querySelector('#d-err').hidden && /importo/.test(document.querySelector('#d-err').textContent)));
  p.once('dialog', (d) => d.accept());
  await p.click('#elenco li button'); await p.waitForTimeout(200);
  check('tolgo la donazione: il totale torna com’era', await p.evaluate(() => document.querySelector('#e-val').textContent) === prima);
  check('nessun errore (esempio)', err.length === 0, err);
  await ctx.close();

  // 3) Esempio su computer
  ({ ctx, p, err } = await apri({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 }, U + '?esempio'));
  await p.screenshot({ path: out + '/mon-2-computer.png', fullPage: true });
  await p.hover('#b-azioni .mon-barra:nth-child(7)'); await p.waitForTimeout(150);
  check('computer: etichetta sulle barre', await p.evaluate(() => !document.querySelector('#tip').hidden && /delle aperture/.test(document.querySelector('#tip').innerText)));
  await p.screenshot({ path: out + '/mon-3-computer-barra.png' });
  await ctx.close();

  // 4) Database acceso (finto): accesso, pagina riservata, numeri veri
  const finto = (ruolo) => async (p) => {
    await p.route('**/config.js', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace(/supabaseUrl: "[^"]*"/, 'supabaseUrl: "https://finto.supabase.co"').replace(/supabaseKey: "[^"]*"/, 'supabaseKey: "sb_publishable_finta"') }); });
    await p.route('**/vendor/supabase/supabase.js', (route) => route.fulfill({ contentType: 'text/javascript', body: `
      window.__chiamate = [];
      window.supabase = { createClient: () => {
        let sessione = ${ruolo === 'nessuno' ? 'null' : '{ user: { id: "u1" } }'}, ascolta = () => {};
        let don = [{ id: 2, g: new Date().toISOString().slice(0, 10), euro: 5 }];
        return {
          auth: {
            onAuthStateChange: (f) => { ascolta = f; setTimeout(() => f('INITIAL_SESSION', sessione), 0); },
            signInWithPassword: async (a) => { window.__chiamate.push(['entra', a.email, a.password.length]);
              if (a.email === 'nonconfermato@example.org') return { error: { code: 'email_not_confirmed', message: 'Email not confirmed', status: 400 } };
              if (a.password !== 'parola-giusta-123') return { error: { code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 } };
              sessione = { user: { id: 'u1' } }; ascolta('SIGNED_IN', sessione); return { error: null }; },
            signUp: async (a) => { window.__chiamate.push(['crea', a.email, a.password.length, a.options.emailRedirectTo]);
              if (a.email === 'estraneo@example.org') return { data: { user: null, session: null }, error: { code: 'unexpected_failure', message: 'Database error saving new user', status: 500 } };
              if (a.email === 'fuori@example.org') return { data: { user: null, session: null }, error: { code: 'email_address_not_authorized', message: 'Email address not authorized', status: 400 } };
              if (a.email === 'esiste@example.org') return { data: { user: { id: 'x', identities: [] }, session: null }, error: null };
              return { data: { user: { id: 'u1', identities: [{}] }, session: null }, error: null }; },
            resend: async (a) => { window.__chiamate.push(['rimanda', a.type, a.email]); return { error: null }; },
            signOut: async () => { sessione = null; ascolta('SIGNED_OUT', null); },
          },
          rpc: async (nome, arg) => {
            window.__chiamate.push([nome, arg]);
            if (nome === 'sono_admin') return { data: ${ruolo !== 'ospite'}, error: null };
            if (nome === 'statistiche') { const g = new Date().toISOString().slice(0, 10); return { data: { oggi: g, contatori: [{ g, e: 'visita', n: 12 }, { g, e: 'da_instagram', n: 9 }, { g, e: 'da_diretto', n: 3 }, { g, e: 'vai', n: 4 }, { g, e: 'dona_2', n: 1 }, { g, e: '<img src=x onerror=alert(1)>', n: 5 }], livelli: [{ g, l: 'Trastevere', n: 7 }, { g, l: 'Tivoli', n: 2 }, { g, l: 'Tutta Roma', n: 7 }, { g, l: '<img src=x onerror=alert(2)>', n: 1 }, { g: '2020-01-01', l: 'Vecchio', n: 50 }], donazioni: don }, error: null }; }
            if (nome === 'registra_donazione') { don = [{ id: 3, g: arg.p_giorno, euro: arg.p_euro }, ...don]; return { data: 3, error: null }; }
            if (nome === 'elimina_donazione') { don = don.filter((d) => d.id !== arg.p_id); return { data: null, error: null }; }
            return { data: null, error: { message: 'sconosciuta' } };
          },
        };
      } };` }));
  };
  ({ ctx, p, err } = await apri({ ...devices['iPhone 13'] }, U, finto('nessuno')));
  check('senza accesso: chiede l’email, nessun numero', await p.evaluate(() => /Entra/.test(document.querySelector('#stato h2').textContent) && document.querySelector('#cruscotto').hidden && !window.__chiamate.some((c) => c[0] === 'statistiche')));
  await p.screenshot({ path: out + '/mon-4-accesso.png' });
  const testo = (sel) => p.evaluate((q) => { const e = document.querySelector(q); return e && !e.hidden ? e.textContent : ''; }, sel);
  check('accesso: email e password, con i suggerimenti giusti per il portachiavi del telefono', await p.evaluate(() => { const e = document.querySelector('#a-email'), w = document.querySelector('#a-password'); return e.type === 'email' && e.autocomplete === 'username' && w.type === 'password' && w.autocomplete === 'current-password' && !document.querySelector('#a-codice'); }));
  // password sbagliata
  await p.fill('#a-email', 'capo@example.org'); await p.fill('#a-password', 'sbagliata'); await p.click('#f-entra button[type=submit]'); await p.waitForTimeout(250);
  check('password sbagliata: lo dice, senza dire quale dei due è sbagliato', /Email o password non corrette/.test(await testo('#a-err')) && await p.evaluate(() => document.querySelector('#cruscotto').hidden), await testo('#a-err'));
  await p.fill('#a-email', 'nonconfermato@example.org'); await p.fill('#a-password', 'parola-giusta-123'); await p.click('#f-entra button[type=submit]'); await p.waitForTimeout(250);
  check('email non confermata: dice di aprire il messaggio', /non è ancora confermata/.test(await testo('#a-err')), await testo('#a-err'));
  // la prima volta
  await p.click('#a-crea'); await p.waitForTimeout(200);
  check('«È la prima volta» apre «Crea l’accesso», con l’email già scritta', await p.evaluate(() => /Crea l’accesso/.test(document.querySelector('#stato h2').textContent) && document.querySelector('#n-email').value === 'nonconfermato@example.org' && document.querySelector('#n-password').autocomplete === 'new-password'));
  await p.screenshot({ path: out + '/mon-5-crea.png' });
  await p.fill('#n-email', 'capo@example.org'); await p.fill('#n-password', 'corta'); await p.fill('#n-ripeti', 'corta');
  await p.evaluate(() => document.querySelector('#f-crea').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))); await p.waitForTimeout(200);
  check('password corta: rifiutata prima di chiamare il database', /almeno 10 caratteri/.test(await testo('#n-err')) && await p.evaluate(() => !window.__chiamate.some((c) => c[0] === 'crea')), await testo('#n-err'));
  await p.fill('#n-password', 'parola-giusta-123'); await p.fill('#n-ripeti', 'parola-diversa-123'); await p.click('#f-crea button[type=submit]'); await p.waitForTimeout(200);
  check('password ripetuta diversa: lo dice', /non sono uguali/.test(await testo('#n-err')) && await p.evaluate(() => !window.__chiamate.some((c) => c[0] === 'crea')), await testo('#n-err'));
  for (const [email, atteso, nome] of [['estraneo@example.org', /riservata a chi gestisce il sito/, 'email che non è di chi gestisce il sito: rifiutata con una frase chiara'], ['fuori@example.org', /usa quella del tuo account Supabase/, 'email a cui il database non può scrivere: lo spiega'], ['esiste@example.org', /esiste già/, 'accesso che esiste già: lo dice']]) {
    await p.fill('#n-email', email); await p.fill('#n-password', 'parola-giusta-123'); await p.fill('#n-ripeti', 'parola-giusta-123'); await p.click('#f-crea button[type=submit]'); await p.waitForTimeout(250);
    check(nome, atteso.test(await testo('#n-err')) && await p.evaluate(() => /Crea l’accesso/.test(document.querySelector('#stato h2').textContent)), await testo('#n-err'));
  }
  check('nessun messaggio tecnico in inglese mostrato a schermo', !/Database error|not authorized|Invalid login/.test(await p.evaluate(() => document.querySelector('#stato').innerText)));
  await p.fill('#n-email', 'capo@example.org'); await p.click('#f-crea button[type=submit]'); await p.waitForTimeout(250);
  check('accesso creato: dice di controllare la posta e di toccare il link', await p.evaluate(() => /Controlla la posta/.test(document.querySelector('#stato h2').textContent) && /capo@example\.org/.test(document.querySelector('#c-testo').textContent) && /non si carica è normale/.test(document.querySelector('#stato').innerText)));
  check('…e la chiamata porta email, password (non scritta da nessuna parte in pagina) e l’indirizzo di ritorno', await p.evaluate(() => { const c = window.__chiamate.filter((x) => x[0] === 'crea').pop(); return c[1] === 'capo@example.org' && c[2] === 17 && /statistiche\.html$/.test(c[3]) && !/parola-giusta/.test(document.body.innerText); }));
  await p.screenshot({ path: out + '/mon-6-posta.png' });
  await p.click('#c-rimanda'); await p.waitForTimeout(200);
  check('«Rimanda l’email» la richiede di nuovo e lo conferma', /controlla di nuovo la posta/.test(await testo('#c-err')) && await p.evaluate(() => window.__chiamate.some((c) => c[0] === 'rimanda' && c[1] === 'signup' && c[2] === 'capo@example.org')));
  await p.click('#c-entra'); await p.waitForTimeout(200);
  check('«Ho confermato: entra» torna all’accesso con l’email già scritta', await p.evaluate(() => /Entra/.test(document.querySelector('#stato h2').textContent) && document.querySelector('#a-email').value === 'capo@example.org'));
  // password giusta
  await p.fill('#a-password', 'parola-giusta-123'); await p.click('#f-entra button[type=submit]'); await p.waitForTimeout(500);
  s = await p.evaluate(() => ({ cruscotto: !document.querySelector('#cruscotto').hidden, esempio: document.querySelector('#esempio').hidden, visite: document.querySelector('.mon-numero .val').textContent, delta: document.querySelector('.mon-numero .delta').textContent, fonti: [...document.querySelectorAll('#b-fonti .nome')].map((n) => n.textContent), img: document.querySelectorAll('.mon img').length, esci: !document.querySelector('#esci').hidden, tot: document.querySelector('#e-val').textContent, chiamate: window.__chiamate.map((c) => c[0]) }));
  check('password giusta: numeri veri, senza la scritta «esempio»', s.cruscotto && s.esempio && s.visite === '12' && /partito da poco/.test(s.delta) && s.esci, s);
  const zone = await p.evaluate(() => [...document.querySelectorAll('#b-zone .mon-barra')].map((r) => [r.querySelector('.nome').textContent, r.querySelector('.val').textContent.replace(/\s+/g, ' ')]));
  check('quartieri scelti: in ordine dal più scelto, con la quota; fuori periodo esclusi; un nome strano resta testo', zone.length === 4 && zone[0][0] === 'Trastevere' && /^7 41%/.test(zone[0][1]) && zone[1][0] === 'Tutta Roma' && zone[2][0] === 'Tivoli' && zone[3][0] === '<img src=x onerror=alert(2)>' && !zone.some((z) => z[0] === 'Vecchio'), zone);
  check('fonti vere in ordine; un nome sconosciuto dal database non entra in pagina', JSON.stringify(s.fonti) === JSON.stringify(['Instagram', 'Link diretto']) && s.img === 0, s.fonti);
  await p.fill('#d-euro', '3'); await p.click('#f-dona button[type=submit]'); await p.waitForTimeout(300);
  s = await p.evaluate(() => ({ tot: document.querySelector('#e-val').textContent, ch: window.__chiamate.filter((c) => c[0] === 'registra_donazione') }));
  check('segna una donazione nel database', /8,00/.test(s.tot) && s.ch.length === 1 && s.ch[0][1].p_euro === 3, s);
  await p.click('#esci'); await p.waitForTimeout(300);
  check('Esci: i numeri spariscono, torna l’accesso', await p.evaluate(() => document.querySelector('#cruscotto').hidden && /Entra/.test(document.querySelector('#stato h2').textContent)));
  check('nessun errore (database finto)', err.length === 0, err);
  await ctx.close();
  ({ ctx, p, err } = await apri({ ...devices['iPhone 13'] }, U, finto('ospite')));
  check('entrato ma non amministratore: pagina riservata, nessuna richiesta dei numeri', await p.evaluate(() => /riservata/i.test(document.querySelector('#stato h2').textContent) && document.querySelector('#cruscotto').hidden && !window.__chiamate.some((c) => c[0] === 'statistiche')));
  await ctx.close();

  await b.close();
  console.log(ok.length + ' ok, ' + ko.length + ' falliti'); ko.forEach((x) => console.log('FALLITO: ' + x));
})();
