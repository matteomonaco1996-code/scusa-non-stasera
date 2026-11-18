// Con la configurazione VERA del sito: che cosa parte verso il database, e che cosa no. Le chiamate vengono
// fermate qui (rispondono 204): al database vero non arriva niente.   node conta-vero.js <cartella foto> [indirizzo]
const { chromium, devices } = require('playwright');
const out = process.argv[2], BASE = process.argv[3] || 'http://localhost:8765/index.html';
const DB = 'https://swjaorxphkfigqwgonqq.supabase.co', CHIAVE = 'sb_publishable_3EsKTwbvVzq_pFRbQ6WFdg_l8wpWMd9';
const ok = [], ko = [];
const check = (n, c, x) => (c ? ok : ko).push(n + (x !== undefined ? ' → ' + JSON.stringify(x) : ''));
(async () => {
  const b = await chromium.launch();
  const nuovo = async ({ termini = true, gpc = false, url = BASE } = {}) => {
    const ctx = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
    await ctx.addInitScript(([t, g]) => { try { if (t) localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} if (g) Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true }); }, [termini, gpc]);
    const chiamate = [];
    await ctx.route(/google\.com|paypal\./, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>esterno</title>' }));
    await ctx.route(/^https:\/\/[a-z0-9-]+\.supabase\.co\//, (r) => { const q = r.request(); let corpo = null; try { corpo = JSON.parse(q.postData() || 'null'); } catch (e) {} chiamate.push({ url: q.url(), metodo: q.method(), h: q.headers(), corpo }); r.fulfill({ status: 204, body: '' }); });
    const p = await ctx.newPage(); const err = [];
    p.on('pageerror', (e) => err.push(String(e).slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text().slice(0, 200)); });
    await p.goto(url); await p.waitForTimeout(900);
    const eventi = () => chiamate.filter((c) => /\/rpc\/conta$/.test(c.url)).flatMap((c) => (c.corpo && c.corpo.p_eventi) || []);
    const zone = () => chiamate.filter((c) => /\/rpc\/conta_livello$/.test(c.url)).map((c) => c.corpo && c.corpo.p_livello);
    return { ctx, p, err, chiamate, eventi, zone };
  };

  // ===== la pagina principale =====
  let { ctx, p, err, chiamate, eventi, zone } = await nuovo();
  const cfg = await p.evaluate(() => ({ url: window.SNS_CONFIG.supabaseUrl, key: window.SNS_CONFIG.supabaseKey, conto: window.SNS_CONFIG.conto, statistiche: window.SNS_CONFIG.statistiche, comitive: window.SNS_CONFIG.comitive }));
  check('configurazione: database vero, chiave pubblica, account e comitive spenti', cfg.url === DB && cfg.key === CHIAVE && cfg.conto === false && cfg.statistiche === true && cfg.comitive === false, cfg);
  check('la chiave nel sito è quella pubblica (non una chiave segreta)', /^sb_publishable_/.test(cfg.key) && !/secret|service_role/.test(cfg.key));
  check('all’apertura parte la visita con la provenienza', JSON.stringify(eventi()) === JSON.stringify(['visita', 'da_diretto']), eventi());
  const c0 = chiamate[0] || {};
  check('la chiamata va solo alla funzione che conta, del progetto giusto', chiamate.every((c) => c.url === DB + '/rest/v1/rpc/conta' && c.metodo === 'POST'), chiamate.map((c) => c.metodo + ' ' + c.url));
  check('all’apertura non parte nessun quartiere', zone().length === 0, zone());
  check('chiamata anonima: solo la chiave pubblica; niente cookie, niente accesso personale', c0.h && c0.h.apikey === CHIAVE && !c0.h.cookie && !c0.h.authorization, c0.h && { apikey: c0.h.apikey, cookie: c0.h.cookie, authorization: c0.h.authorization });
  check('nel corpo c’è solo l’elenco degli eventi', c0.corpo && Object.keys(c0.corpo).join() === 'p_eventi', c0.corpo);
  check('account spenti: niente PLAYER 1, niente ACCEDI, niente punti', await p.evaluate(() => document.body.classList.contains('senza-conto') && [...document.querySelectorAll('.solo-conto')].every((e) => getComputedStyle(e).display === 'none')));
  check('la libreria degli account non viene nemmeno scaricata', await p.evaluate(() => !window.supabase && ![...document.scripts].some((s) => /supabase/.test(s.src))));
  // i tocchi principali
  await p.evaluate(() => document.querySelector('#mondi [data-mondo="roma"]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#powerups [data-voglia="pizza"]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#livelli .level[data-livello]:not([disabled]):not([data-livello=""])').click()); await p.waitForTimeout(400);
  check('scelta del livello → «livello»', eventi().filter((e) => e === 'livello').length === 1, eventi());
  const scelto = await p.evaluate(() => document.querySelector('#titolo-ris').textContent);
  check('…e parte anche QUALE quartiere: «' + scelto + '», una volta sola', JSON.stringify(zone()) === JSON.stringify([scelto]), zone());
  const cz = chiamate.find((c) => /conta_livello$/.test(c.url)) || {};
  check('la chiamata del quartiere è anonima come le altre e porta solo il nome', cz.metodo === 'POST' && cz.h && cz.h.apikey === CHIAVE && !cz.h.cookie && !cz.h.authorization && Object.keys(cz.corpo || {}).join() === 'p_livello', cz.corpo);
  await p.click('#gettone'); await p.waitForTimeout(700);
  check('gettone → «gettone»', eventi().filter((e) => e === 'gettone').length === 1, eventi());
  await p.locator('#get-esito a[href^="https://www.google.com/maps/dir/"]').click(); await p.waitForTimeout(300);
  check('Portami lì → «portami» (non ancora «vai»)', eventi().includes('portami') && !eventi().includes('vai'), eventi());
  const [mp] = await Promise.all([ctx.waitForEvent('page'), p.click('#vai-ora')]); await mp.close(); await p.bringToFront(); await p.waitForTimeout(700);
  check('Vai al posto → «vai»', eventi().filter((e) => e === 'vai').length === 1, eventi());
  const ammessi = ['visita','termini_ok','da_diretto','da_google','da_instagram','da_facebook','da_whatsapp','da_tiktok','da_telegram','da_qr','da_volantino','da_amici','da_altro','start','posizione_si','posizione_no','livello','gettone','portami','vai','maps','dona_apri','dona_1','dona_2','dona_5','dona_altro','invito_apri','invito_manda','invito_arriva','invito_si','invito_no','invito_altro','invito_risposta'];
  check('ogni evento mandato è tra quelli che il database accetta', eventi().every((e) => ammessi.includes(e)), eventi().filter((e) => !ammessi.includes(e)));
  check('in tutto il giro nessuna chiamata diversa dai due contatori', chiamate.every((c) => /\/rest\/v1\/rpc\/conta(_livello)?$/.test(c.url)), chiamate.map((c) => c.url).filter((u) => !/rpc\/conta(_livello)?$/.test(u)));
  // «Tutta Roma», una città con un livello solo, una località fuori porta
  await p.click('#dlg-vai [data-chiudi]').catch(() => {}); await p.click('#dlg-gettone [data-chiudi]').catch(() => {}); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('#livelli .level[data-livello=""]').click()); await p.waitForTimeout(300);
  check('«Tutta Roma» conta come zona', zone().slice(-1)[0] === 'Tutta Roma', zone());
  await p.evaluate(() => document.querySelector('#mondi [data-mondo="firenze"]').click()); await p.waitForTimeout(300);
  check('Firenze (un livello solo): scegliere il mondo conta «Tutta Firenze»', zone().slice(-1)[0] === 'Tutta Firenze', zone());
  await p.evaluate(() => document.querySelector('#mondi [data-mondo="fuori"]').click()); await p.waitForTimeout(300);
  const nZone = zone().length;
  check('Fuori porta: scegliere il mondo non conta ancora nessuna zona', zone().length === nZone && zone().slice(-1)[0] === 'Tutta Firenze', zone());
  await p.evaluate(() => document.querySelector('#livelli [data-livello="Tivoli"]').click()); await p.waitForTimeout(300);
  check('…la località sì: «Tivoli»', zone().slice(-1)[0] === 'Tivoli', zone());
  check('pagina principale: nessun errore', err.length === 0, err);
  await ctx.close();

  // ===== provenienza e «non tracciare» =====
  ({ ctx, p, err, chiamate, eventi, zone } = await nuovo({ url: BASE + '?da=instagram' }));
  check('?da=instagram → «da_instagram»', JSON.stringify(eventi()) === JSON.stringify(['visita', 'da_instagram']), eventi());
  await ctx.close();
  ({ ctx, p, err, chiamate, eventi, zone } = await nuovo({ gpc: true }));
  await p.evaluate(() => document.querySelector('#livelli [data-livello="Trastevere"]').click()); await p.waitForTimeout(300);
  await p.click('#gettone').catch(() => {}); await p.waitForTimeout(400);
  check('chi ha acceso «non tracciare» non viene contato: nessuna chiamata', chiamate.length === 0, chiamate.length);
  await ctx.close();

  // ===== la pagina di monitoraggio =====
  ({ ctx, p, err, chiamate, eventi, zone } = await nuovo({ url: BASE.replace(/index\.html$/, '').replace(/\/?$/, '/') + 'statistiche.html' }));
  await p.waitForTimeout(800);
  const st = await p.evaluate(() => ({ titolo: (document.querySelector('#stato h2') || {}).textContent, email: !!document.querySelector('#a-email'), cruscotto: document.querySelector('#cruscotto') ? document.querySelector('#cruscotto').hidden : null, testo: document.querySelector('#stato') ? document.querySelector('#stato').innerText.slice(0, 160) : '' }));
  check('monitoraggio: non dice più «Non ancora attiva», chiede l’email per entrare', st.titolo === 'Entra' && st.email && st.cruscotto === true, st);
  check('monitoraggio: senza accesso non mostra nessun numero', !/\d{2,}/.test(st.testo), st.testo);
  check('monitoraggio: prima dell’accesso non conta nulla e non chiede dati al database', eventi().length === 0 && chiamate.every((c) => !/rpc\/statistiche/.test(c.url)), chiamate.map((c) => c.url));
  await p.screenshot({ path: out + '/monitoraggio-entra.png' });
  check('monitoraggio: nessun errore', err.length === 0, err);
  await ctx.close();

  await b.close();
  console.log(ok.length + ' ok, ' + ko.length + ' falliti'); ko.forEach((x) => console.log('FALLITO: ' + x.slice(0, 500)));
})();
