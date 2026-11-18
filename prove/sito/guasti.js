// Guasti simulati: un file che non arriva, la memoria del telefono bloccata, funzioni del browser che mancano.
// Per ognuno: il sito si apre? si può scegliere una zona, pescare un gettone, aprire la mappa? ci sono errori non gestiti?
const { chromium, devices } = require('playwright');
const U = 'http://localhost:8765/index.html';
let ok = 0, ko = 0; const dico = (m, c, x) => { c ? ok++ : ko++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (c ? '' : ' → ' + JSON.stringify(x).slice(0, 700))); };
(async () => {
  const b = await chromium.launch();
  const prova = async (nome, { blocca, prima, termini = true, atteso = 'tutto' }) => {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    if (termini) await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
    if (prima) await ctx.addInitScript(prima);
    if (blocca) await ctx.route(blocca, (r) => r.abort());
    await ctx.route(/google\.com|paypal\.|wa\.me|cartocdn/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'x' }));
    const p = await ctx.newPage(); const err = [];
    p.on('pageerror', (e) => err.push(String(e).slice(0, 160)));
    await p.goto(U).catch((e) => err.push('goto: ' + String(e).slice(0, 80))); await p.waitForTimeout(900);
    const r = { err };
    r.inizio = await p.evaluate(() => ({ titolo: !!document.querySelector('.marchio h1'), domanda: (document.querySelector('#domanda') || {}).textContent || '', livelli: document.querySelectorAll('.level').length, termini: document.querySelector('#dlg-termini') ? document.querySelector('#dlg-termini').open : null })).catch((e) => ({ rotto: String(e).slice(0, 80) }));
    if (r.inizio.termini) { await p.click('#termini-ok').catch(() => {}); await p.waitForTimeout(500); await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
    try {
      await p.evaluate(() => { const d = document.querySelector('dialog[open]'); if (d && d.id !== 'dlg-termini') d.close(); });
      await p.evaluate(() => document.querySelector('button[data-livello="Trastevere"]').click()); await p.waitForTimeout(600);
      r.schede = await p.evaluate(() => document.querySelectorAll('.card').length);
      await p.click('#gettone', { timeout: 4000 }); await p.waitForTimeout(1200);
      r.gettone = await p.evaluate(() => (document.querySelector('#rullo') || {}).textContent || '');
      await p.evaluate(() => document.querySelector('#dlg-gettone').close()); await p.waitForTimeout(300);
      await p.click('[data-view=mappa]', { timeout: 4000 }); await p.waitForTimeout(1500);
      r.mappa = await p.evaluate(() => ({ pin: document.querySelectorAll('#mappa .pin').length, avviso: (document.querySelector('#mappa .map-gate') || {}).textContent || '', tela: !!document.querySelector('#mappa canvas') }));
      await p.click('[data-view=lista]', { timeout: 4000 }); await p.waitForTimeout(300);
      await p.locator('.card .proponi').first().click({ timeout: 4000 }); await p.waitForTimeout(400);
      r.proponi = await p.evaluate(() => (document.querySelector('#inv-testo') || {}).textContent || '');
    } catch (e) { r.fermo = String(e).split('\n')[0].slice(0, 120); }
    await ctx.close();
    const usabile = r.schede > 5 && r.gettone && r.proponi && !r.fermo;
    if (atteso === 'tutto') dico(nome + ': il sito funziona lo stesso' + (r.mappa && r.mappa.avviso ? ' (mappa: «' + r.mappa.avviso.trim().slice(0, 40) + '»)' : ''), usabile && err.length === 0, r);
    else if (atteso === 'fermo') dico(nome + ': il gioco non parte, ma senza errori a schermo', !usabile, r);
    return r;
  };
  console.log('Un file che non arriva');
  await prova('senza i disegni e le icone (cartella img)', { blocca: '**/img/**' });
  await prova('senza i caratteri (cartella fonts)', { blocca: '**/fonts/**' });
  await prova('senza il programma della mappa (Leaflet)', { blocca: '**/vendor/leaflet/**' });
  await prova('senza le strade di Roma (mappa/roma.js)', { blocca: '**/mappa/roma.js' });
  await prova('senza le strade sotto i quartieri (mappa/quartieri.js)', { blocca: '**/mappa/quartieri.js' });
  await prova('senza il file degli account (conto.js)', { blocca: '**/js/conto.js' });
  await prova('senza le impostazioni (config.js)', { blocca: '**/config.js' });
  const senzaLista = await prova('senza la lista dei posti (locali.js)', { blocca: '**/locali.js', atteso: 'fermo' });
  console.log('     → che cosa vede chi capita in questo caso:', JSON.stringify({ err: senzaLista.err, inizio: senzaLista.inizio }).slice(0, 300));
  const senzaStile = await prova('senza il foglio di stile (stile.css)', { blocca: '**/css/stile.css' });
  console.log('Il telefono che dice di no');
  await prova('memoria del browser bloccata (navigazione privata severa)', { termini: false, prima: () => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('negato', 'SecurityError'); } }); Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw new DOMException('negato', 'SecurityError'); } }); } });
  await prova('cronologia non scrivibile', { prima: () => { history.pushState = () => { throw new Error('no'); }; history.replaceState = () => { throw new Error('no'); }; } });
  await prova('telefono senza posizione', { prima: () => { try { delete Navigator.prototype.geolocation; } catch (e) {} } });
  await prova('browser senza «richiedi quando sei libero» (Safari)', { prima: () => { delete window.requestIdleCallback; } });
  await prova('browser senza osservatore delle misure (vecchi)', { prima: () => { delete window.ResizeObserver; } });
  await prova('browser senza condivisione e senza appunti', { prima: () => { try { delete Navigator.prototype.share; delete Navigator.prototype.clipboard; } catch (e) {} } });
  await prova('orologio del telefono sbagliato (anno 2001)', { prima: () => { const D = Date; const sfasa = D.now() - new D('2001-01-01T03:00:00').getTime(); window.Date = class extends D { constructor(...a) { if (a.length) super(...a); else super(D.now() - sfasa); } static now() { return D.now() - sfasa; } }; } });
  await b.close(); console.log(`\n${ok} ok · ${ko} KO`); process.exitCode = ko ? 1 : 0;
})();
