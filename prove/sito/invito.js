// "Proponilo" (Stasera qui?): chi propone, chi riceve, la risposta, la controproposta. E che cosa NON succede.
//   node invito.js [indirizzo]
const { chromium, devices } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8765/index.html';
const LOCALE = /localhost/.test(BASE);
let ok = 0, ko = 0; const dico = (m, c, x) => { c ? ok++ : ko++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (c ? '' : ' → ' + JSON.stringify(x))); };
const CORSI = '3935991939893424995';
(async () => {
  const b = await chromium.launch();
  // Un telefono nuovo. termini: già accettati o no · condividi: il telefono ha la condivisione di sistema · ora: che ore sono
  const nuovo = async ({ termini = true, condividi = true, ora = '2026-11-12T20:30:00', conta = LOCALE, config, dispositivo = devices['iPhone 13'] } = {}) => {
    const ctx = await b.newContext({ ...dispositivo, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
    await ctx.addInitScript(([t, c]) => {
      try { if (t) { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } } catch (e) {}
      Math.random = () => 0.42;
      window.__condivisi = [];
      if (c) Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: async (d) => { window.__condivisi.push(d); } });
      else { try { delete Navigator.prototype.share; } catch (e) {} }
    }, [termini, condividi]);
    const eventi = [], fuori = [];
    await ctx.route(/google\.com|paypal\.|wa\.me|whatsapp\.com/, (r) => { fuori.push(r.request().url()); r.fulfill({ status: 200, contentType: 'text/html', body: '<title>esterno</title>' }); });
    await ctx.route('https://finto.supabase.co/**', (r) => { const q = r.request(); if (/\/rpc\/conta$/.test(q.url())) eventi.push(...(JSON.parse(q.postData() || '{}').p_eventi || [])); r.fulfill({ status: 204, body: '' }); });
    const p = await ctx.newPage(); const err = [];
    p.on('pageerror', (e) => err.push(String(e).slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text().slice(0, 160)); });
    if (conta || config) await p.route('**/config.js', async (route) => {
      const r = await route.fetch(); let t = await r.text();
      if (conta) t = t.replace(/supabaseUrl: "[^"]*"/, 'supabaseUrl: "https://finto.supabase.co/"').replace(/supabaseKey: "[^"]*"/, 'supabaseKey: "sb_publishable_finta"').replace('conto: true', 'conto: false');
      if (config) t = config(t);
      await route.fulfill({ response: r, body: t });
    });
    await p.clock.install({ time: new Date(ora) });
    return { ctx, p, err, eventi, fuori };
  };
  const vai = async (p, url) => { await p.goto(url); await p.waitForTimeout(800); };
  const finestra = (p) => p.evaluate(() => { const d = document.querySelector('#dlg-invito'); return { aperta: d.open, titolo: d.querySelector('#inv-t').textContent, eti: (d.querySelector('.eti') || {}).textContent || '', nome: (d.querySelector('.rullo') || {}).textContent || '', testo: (d.querySelector('#inv-testo') || {}).textContent || '', wa: (d.querySelector('[data-inv=whatsapp]') || {}).href || '', corpo: d.querySelector('#inv-corpo').textContent.replace(/\s+/g, ' ').trim() }; });

  // ---------- 1) Chi propone: dalla scheda ----------
  console.log('Chi propone');
  let s = await nuovo(); let { p } = s;
  await vai(p, BASE);
  await p.evaluate(() => document.querySelector('button[data-livello="Pantheon"]').click()); await p.waitForTimeout(600);
  const prima = await p.evaluate(() => ({ nome: document.querySelector('.card h4').textContent.trim(), bott: document.querySelectorAll('.card .proponi').length, schede: document.querySelectorAll('.card').length, memoria: Object.keys(localStorage).sort().join(), url: location.search }));
  dico('ogni scheda ha «Proponilo» (' + prima.bott + ' su ' + prima.schede + ')', prima.bott === prima.schede && prima.schede > 5 && prima.nome === 'Enoteca Corsi', prima);
  await p.locator('.card .proponi').first().click(); await p.waitForTimeout(400);
  let f = await finestra(p);
  const link = f.testo.split('\n').pop(), u = new URL(link);
  dico('si apre la finestra con il messaggio pronto: «' + f.testo.split('\n')[0] + '»', f.aperta && f.titolo === 'PROPONILO' && f.nome === 'Enoteca Corsi' && f.testo.startsWith('Stasera qui? Enoteca Corsi, Pantheon. Ci stai?\n'), f);
  dico('nel link ci sono solo il numero del posto, il momento e «da amici»', u.origin + u.pathname === new URL(BASE).origin + new URL(BASE).pathname && [...u.searchParams.keys()].join() === 'posto,m,da' && u.searchParams.get('posto') === CORSI && u.searchParams.get('m') === 's' && u.searchParams.get('da') === 'amici' && !u.hash, link);
  dico('il pulsante WhatsApp porta lo stesso messaggio', f.wa === 'https://wa.me/?text=' + encodeURIComponent(f.testo), f.wa);
  // cambio di momento
  await p.click('.quando [data-k=p]'); await p.waitForTimeout(200);
  let g = await finestra(p);
  dico('scegliendo «Pranzo» il messaggio diventa «' + g.testo.split('\n')[0] + '»', g.testo.startsWith('Pranzo qui? Enoteca Corsi, Pantheon. Ci stai?\n') && /[?&]m=p(&|$)/.test(g.testo) && g.wa.includes(encodeURIComponent('Pranzo qui?')), g.testo);
  await p.click('.quando [data-k=s]'); await p.waitForTimeout(200);
  // invio con la condivisione del telefono
  await p.click('[data-inv=condividi]'); await p.waitForTimeout(300);
  const cond = await p.evaluate(() => window.__condivisi);
  dico('«Invia» passa il messaggio alla condivisione del telefono, e nient’altro', cond.length === 1 && Object.keys(cond[0]).join() === 'text' && cond[0].text === f.testo, cond);
  // copia
  await p.click('[data-inv=copia]'); await p.waitForTimeout(300);
  const app = await p.evaluate(async () => ({ t: await navigator.clipboard.readText(), b: document.querySelector('[data-inv=copia]').textContent }));
  dico('«Copia il messaggio» lo copia davvero e lo dice', app.t === f.testo && /Copiato/.test(app.b), app);
  const dopo = await p.evaluate(() => ({ memoria: Object.keys(localStorage).sort().join(), sess: sessionStorage.length, url: location.search }));
  dico('proporre non scrive nulla nel telefono e non cambia l’indirizzo della pagina', dopo.memoria === prima.memoria && dopo.sess === 0 && dopo.url === prima.url, dopo);
  // il tasto indietro chiude la finestra e basta
  await p.goBack(); await p.waitForTimeout(400);
  const ind = await p.evaluate(() => ({ aperta: document.querySelector('#dlg-invito').open, titolo: document.querySelector('#titolo-ris').textContent, schede: document.querySelectorAll('.card').length }));
  dico('il tasto Indietro chiude la finestra e resta la lista del Pantheon', !ind.aperta && /Pantheon/.test(ind.titolo) && ind.schede === prima.schede, ind);
  // dal gettone
  await p.click('#gettone'); await p.waitForTimeout(600);
  const get = await p.evaluate(() => ({ nome: document.querySelector('#rullo').textContent, bott: (document.querySelector('[data-get=invita]') || {}).textContent }));
  await p.click('[data-get=invita]'); await p.waitForTimeout(300);
  f = await finestra(p);
  dico('dopo il gettone c’è «' + get.bott + '», che propone il posto pescato (' + get.nome + ')', get.bott === 'Proponilo: Stasera qui?' && f.aperta && f.nome === get.nome && f.testo.startsWith('Stasera qui? ' + get.nome), { get, f });
  await p.click('#dlg-invito [data-chiudi]'); await p.waitForTimeout(400);
  const sotto = await p.evaluate(() => ({ gettone: document.querySelector('#dlg-gettone').open, invito: document.querySelector('#dlg-invito').open }));
  dico('chiudendo si torna al gettone, che è ancora aperto', sotto.gettone && !sotto.invito, sotto);
  if (LOCALE) dico('contatori di chi propone: ' + s.eventi.filter((e) => /^invito/.test(e)).join(' '), s.eventi.filter((e) => e === 'invito_apri').length === 2 && s.eventi.filter((e) => e === 'invito_manda').length === 2 && !s.eventi.some((e) => /invito_(arriva|si|no|altro|risposta)/.test(e)), s.eventi);
  dico('nessun errore', s.err.length === 0, s.err);
  await s.ctx.close();

  // senza la condivisione del telefono (computer, alcuni browser dentro le app)
  s = await nuovo({ condividi: false, dispositivo: { viewport: { width: 1280, height: 800 } } }); p = s.p;
  await vai(p, BASE); await p.evaluate(() => document.querySelector('button[data-livello="Pantheon"]').click()); await p.waitForTimeout(600);
  await p.locator('.card .proponi').first().click(); await p.waitForTimeout(400);
  const senza = await p.evaluate(() => ({ invia: !!document.querySelector('[data-inv=condividi]'), wa: document.querySelector('[data-inv=whatsapp]').className, target: document.querySelector('[data-inv=whatsapp]').target, rel: document.querySelector('[data-inv=whatsapp]').rel }));
  dico('senza condivisione di sistema: niente «Invia», WhatsApp diventa il pulsante principale e si apre in un’altra scheda', !senza.invia && senza.wa === 'btn' && senza.target === '_blank' && /noopener/.test(senza.rel) && /noreferrer/.test(senza.rel), senza);
  const [scheda] = await Promise.all([s.ctx.waitForEvent('page'), p.click('[data-inv=whatsapp]')]); await scheda.waitForLoadState().catch(() => {});
  dico('il tocco su WhatsApp apre wa.me con il messaggio', s.fuori.some((x) => x.startsWith('https://wa.me/?text=Stasera%20qui')), s.fuori);
  await s.ctx.close();

  // ---------- 2) Chi riceve: prima visita, deve accettare i termini ----------
  console.log('Chi riceve');
  s = await nuovo({ termini: false }); p = s.p;
  await vai(p, link);
  const t = await p.evaluate(() => ({ termini: document.querySelector('#dlg-termini').open, invito: document.querySelector('#dlg-invito').open, avviso: !document.querySelector('#ter-invito').hidden && document.querySelector('#ter-invito').textContent, url: location.search }));
  dico('prima visita: si vedono i termini, con la riga «' + t.avviso + '», e l’invito aspetta', t.termini && !t.invito && /Ti hanno proposto un posto/.test(t.avviso) && /posto=/.test(t.url), t);
  await p.click('#termini-ok'); await p.waitForTimeout(600);
  f = await finestra(p);
  const url = await p.evaluate(() => location.search);
  dico('accettati i termini compare l’invito: «' + f.titolo + '» · ' + f.nome, f.aperta && f.titolo === 'STASERA QUI?' && f.eti === 'TI HANNO PROPOSTO UN POSTO' && f.nome === 'Enoteca Corsi' && /LA DRITTA\s*Il mio indirizzo in centro/.test(f.corpo) && /Via del Gesù, 87\/88/.test(f.corpo) && /Ci sto!/.test(f.corpo) && /Scusa, non stasera…/.test(f.corpo), f);
  dico('l’indirizzo della pagina torna pulito (resta solo «da amici»)', url === '?da=amici', url);
  dico('non compare la domanda sulla posizione sopra l’invito', await p.evaluate(() => !document.querySelector('#dlg-posizione').open));
  // Ci sto!
  await p.click('[data-inv=si]'); await p.waitForTimeout(300);
  f = await finestra(p);
  dico('«Ci sto!» prepara la risposta: «' + f.testo + '»', f.titolo === 'CI STO!' && f.testo === 'Ci sto! Enoteca Corsi, Pantheon: ci vediamo lì.' && f.wa === 'https://wa.me/?text=' + encodeURIComponent(f.testo) && /Portami lì/.test(f.corpo), f);
  await p.click('[data-inv=condividi]'); await p.waitForTimeout(300);
  const risp = await p.evaluate(() => window.__condivisi);
  dico('la risposta parte dalla condivisione del telefono', risp.length === 1 && risp[0].text === f.testo, risp);
  // torna all'invito, poi dice di no
  await p.click('[data-inv=invito]'); await p.waitForTimeout(200);
  await p.click('[data-inv=no]'); await p.waitForTimeout(300);
  f = await finestra(p);
  dico('«Scusa, non stasera…» offre due strade: ' + (f.corpo.match(/Anzi sì: ne propongo un altro|No, stavolta passo/g) || []).join(' · '), f.titolo === 'ANZI SÌ?' && /Anzi sì: ne propongo un altro/.test(f.corpo) && /in zona Pantheon/.test(f.corpo) && /No, stavolta passo/.test(f.corpo), f);
  await p.click('[data-inv=passo]'); await p.waitForTimeout(300);
  f = await finestra(p);
  dico('«No, stavolta passo» prepara: «' + f.testo + '»', f.titolo === 'UN’ALTRA VOLTA' && f.testo === 'Scusa, non stasera… Facciamo un’altra volta?' && !/Portami lì/.test(f.corpo), f);
  // controproposta
  await p.click('[data-inv=invito]'); await p.waitForTimeout(200); await p.click('[data-inv=no]'); await p.waitForTimeout(200);
  await p.click('[data-inv=altro]'); await p.waitForTimeout(900);
  const contro = await p.evaluate(() => ({ invito: document.querySelector('#dlg-invito').open, gettone: document.querySelector('#dlg-gettone').open, nome: (document.querySelector('#rullo') || {}).textContent, zona: document.querySelector('#titolo-ris').textContent, bott: (document.querySelector('[data-get=invita]') || {}).textContent, quart: (document.querySelector('#get-esito .quart') || {}).textContent }));
  dico('«Ne propongo un altro» pesca un posto diverso nella stessa zona: ' + contro.nome + ' (' + contro.quart + ')', !contro.invito && contro.gettone && contro.nome && contro.nome !== 'Enoteca Corsi' && contro.quart === 'Pantheon' && /Pantheon/.test(contro.zona) && contro.bott === 'Proponilo: Meglio qui?', contro);
  await p.click('[data-get=invita]'); await p.waitForTimeout(300);
  f = await finestra(p);
  const link2 = f.testo.split('\n').pop(), u2 = new URL(link2);
  dico('la controproposta parte con «' + f.testo.split('\n')[0] + '»', f.titolo === 'PROPONILO' && f.eti === 'LA TUA CONTROPROPOSTA' && f.testo.startsWith('Meglio qui? ' + contro.nome + ', Pantheon. Ci stai?\n') && u2.searchParams.get('r') === '1' && u2.searchParams.get('m') === 's' && u2.searchParams.get('posto') !== CORSI && !/Colazione/.test(f.corpo), f);
  if (LOCALE) { const e = s.eventi; dico('contatori di chi riceve: ' + e.filter((x) => /^invito|^da_|^visita/.test(x)).join(' '), ['visita', 'da_amici', 'termini_ok', 'invito_arriva'].every((x) => e.filter((y) => y === x).length === 1) && e.filter((x) => x === 'invito_si').length === 1 && e.filter((x) => x === 'invito_no').length === 1 && e.filter((x) => x === 'invito_altro').length === 1 && e.filter((x) => x === 'invito_risposta').length === 1 && e.filter((x) => x === 'invito_apri').length === 1, e); }
  const mem = await p.evaluate(() => ({ chiavi: Object.keys(localStorage).sort().join(), sess: sessionStorage.length, stato: JSON.stringify(history.state) }));
  dico('nel telefono di chi riceve restano solo le solite due note (termini, posizione): niente sull’invito', mem.chiavi === 'sns-posizione,sns-termini' || mem.chiavi === 'sns-termini', mem);
  dico('nella cronologia della scheda non c’è né il posto proposto né chi l’ha mandato', !mem.stato.includes(CORSI) && !/posto|amici/.test(mem.stato), mem.stato);
  dico('nessun errore', s.err.length === 0, s.err);
  await s.ctx.close();

  // chi riceve la controproposta
  s = await nuovo(); p = s.p; await vai(p, link2);
  f = await finestra(p);
  dico('chi riceve la controproposta vede «' + f.titolo + '» · ' + f.nome, f.aperta && f.titolo === 'MEGLIO QUI?' && f.eti === 'TI RISPONDONO CON UN ALTRO POSTO' && f.nome === contro.nome, f);
  // ricarica e indietro: l'invito non si riapre da solo
  await p.click('#dlg-invito [data-chiudi]'); await p.waitForTimeout(400);
  await p.reload(); await p.waitForTimeout(800);
  const ric = await p.evaluate(() => ({ invito: document.querySelector('#dlg-invito').open, url: location.search }));
  dico('chiuso l’invito e ricaricata la pagina, non si riapre', !ric.invito && !/posto=/.test(ric.url), ric);
  await s.ctx.close();

  // «Vedi sulla mappa» e «Apri la scheda» dall'invito
  s = await nuovo(); p = s.p; await vai(p, link);
  await p.click('[data-inv=scheda]'); await p.waitForTimeout(800);
  const sch = await p.evaluate(() => ({ invito: document.querySelector('#dlg-invito').open, zona: document.querySelector('#titolo-ris').textContent, prima: document.querySelector('.card h4').textContent.trim(), visibile: (() => { const r = document.querySelector('.card').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })() }));
  dico('«Apri la scheda» porta alla scheda del posto, nella sua zona', !sch.invito && /Pantheon/.test(sch.zona) && sch.prima === 'Enoteca Corsi' && sch.visibile, sch);
  await s.ctx.close();
  s = await nuovo(); p = s.p; await vai(p, link);
  await p.click('[data-inv=mappa]'); await p.waitForTimeout(2200);
  const map = await p.evaluate(() => ({ vista: document.querySelector('.main').dataset.view, popup: (document.querySelector('.leaflet-popup-content strong') || {}).textContent, pin: document.querySelectorAll('#mappa .pin').length }));
  dico('«Vedi sulla mappa» apre la mappa sul posto', map.vista === 'mappa' && map.popup === 'Enoteca Corsi' && map.pin > 3, map);
  dico('nessun errore', s.err.length === 0, s.err);
  await s.ctx.close();

  // ---------- 3) Momenti, link strani, interruttore ----------
  console.log('Casi limite');
  s = await nuovo({ ora: '2026-11-12T12:40:00' }); p = s.p; await vai(p, BASE);
  await p.evaluate(() => document.querySelector('button[data-livello="Pantheon"]').click()); await p.waitForTimeout(500);
  await p.locator('.card .proponi').first().click(); await p.waitForTimeout(300);
  f = await finestra(p);
  dico('a pranzo il messaggio parte da «' + f.testo.split(' Enoteca')[0] + '»', f.testo.startsWith('Pranzo qui? Enoteca Corsi') && /[?&]m=p&/.test(f.testo), f.testo);
  await s.ctx.close();
  s = await nuovo({ ora: '2026-11-12T09:00:00' }); p = s.p; await vai(p, link.replace('m=s', 'm=p'));
  f = await finestra(p);
  dico('un invito «per pranzo» resta «' + f.titolo + '» anche se lo apri alle nove, e il no è «Scusa, non oggi…»', f.titolo === 'PRANZO QUI?' && /Scusa, non oggi…/.test(f.corpo), f);
  await s.ctx.close();
  for (const [nome, coda, atteso] of [
    ['un posto che non c’è più', '?posto=123456&m=s&da=amici', 'avviso'],
    ['un link manomesso', '?posto=' + encodeURIComponent('"><img src=x onerror=window.__bucato=1>') + '&m=' + encodeURIComponent('<script>window.__bucato=1</script>'), 'avviso'],
    ['un momento inventato', '?posto=' + CORSI + '&m=zzz', 'invito'],
  ]) {
    s = await nuovo(); p = s.p; await vai(p, BASE.split('?')[0] + coda);
    const r = await p.evaluate(() => ({ invito: document.querySelector('#dlg-invito').open, titolo: document.querySelector('#inv-t').textContent, toast: !document.querySelector('#toast').hidden && document.querySelector('#toast').textContent, bucato: !!window.__bucato, img: document.querySelectorAll('img[src="x"]').length, url: location.search }));
    if (atteso === 'avviso') dico(nome + ': niente finestra, un avviso («' + r.toast + '») e il sito normale', !r.invito && /non vale più/.test(r.toast || '') && !r.bucato && r.img === 0 && !/posto=/.test(r.url) && s.err.length === 0, { r, err: s.err });
    else dico(nome + ': l’invito si apre lo stesso, con la domanda dell’ora («' + r.titolo + '»)', r.invito && r.titolo === 'STASERA QUI?' && !r.bucato && s.err.length === 0, { r, err: s.err });
    await s.ctx.close();
  }
  if (LOCALE) {
    s = await nuovo({ conta: false, config: (t) => t.replace('inviti: true', 'inviti: false') }); p = s.p; await vai(p, link);
    await p.evaluate(() => document.querySelector('button[data-livello="Pantheon"]').click()); await p.waitForTimeout(500); await p.click('#gettone'); await p.waitForTimeout(600);
    const sp = await p.evaluate(() => ({ invito: document.querySelector('#dlg-invito').open, schede: document.querySelectorAll('.card .proponi').length, gettone: !!document.querySelector('[data-get=invita]'), esito: !!document.querySelector('#get-esito') }));
    dico('con «inviti: false» in config.js spariscono i pulsanti e il link apre il sito normale', !sp.invito && sp.schede === 0 && !sp.gettone && sp.esito && s.err.length === 0, { sp, err: s.err });
    await s.ctx.close();
  }
  await b.close(); console.log(`\n${ok} ok · ${ko} KO`); process.exitCode = ko ? 1 : 0;
})();
