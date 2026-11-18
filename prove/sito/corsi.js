// Enoteca Corsi: c'è, è nel Centro (Pantheon), ha la nota di Matteo ed è la prima che si vede.  node corsi.js [indirizzo]
const { chromium, devices } = require('playwright');
const FOTO = process.env.PROVE_FOTO || require('os').tmpdir();   // dove finiscono le schermate
const BASE = process.argv[2] || 'http://localhost:8765/';
let ok = 0, ko = 0; const dico = (m, c, x) => { c ? ok++ : ko++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (c ? '' : ' → ' + JSON.stringify(x))); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } catch (e) {} });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', (e) => err.push(String(e).slice(0, 120))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text().slice(0, 120)); });
  await p.goto(BASE); await p.waitForTimeout(900);
  const tot = await p.evaluate(() => ({ n: window.RISTOMAT.length, corsi: window.RISTOMAT.filter((x) => /Enoteca Corsi/.test(x.n)), chiesa: window.RISTOMAT.filter((x) => /chiesa/i.test(x.n)).length, calisto: window.RISTOMAT.filter((x) => /San Calisto/.test(x.n)).map((x) => x.t + '|' + (x.dr || '')), agg: window.RISTOMAT_META.aggiornato, altro: window.RISTOMAT.filter((x) => ['Il Vinaietto', 'Nakai', 'Il Focolare', 'ViVi - Le Serre'].includes(x.n)).map((x) => x.n + ':' + x.t) }));
  dico('la lista ha ' + tot.n + ' posti e dentro c’è Enoteca Corsi, nel quartiere Pantheon', tot.n >= 670 && tot.corsi.length === 1 && tot.corsi[0].q === 'Pantheon' && tot.corsi[0].t === 'trattoria', tot);
  dico('Enoteca Corsi ha la nota di Matteo', tot.corsi[0] && /^Il mio indirizzo in centro\.\nOsteria-enoteca di una volta, a due passi dal Pantheon\.\nIn tavola i primi romani: carbonara, gricia, amatriciana\.$/.test(tot.corsi[0].nt), tot.corsi[0]);
  dico('niente chiese nella lista; il Bar San Calisto c’è, con tipo e descrizione', tot.chiesa === 0 && tot.calisto.length === 1 && /^bar\|Bar storico/.test(tot.calisto[0]), tot.calisto);
  dico('i posti nuovi hanno il tipo giusto', tot.altro.sort().join() === 'Il Focolare:ristorante,Il Vinaietto:vino,Nakai:mondo,ViVi - Le Serre:ristorante', tot.altro);
  for (const [liv, sel] of [['Pantheon', 'button[data-livello="Pantheon"]'], ['Tutta Roma', '.level']]) {
    await p.evaluate((s) => document.querySelector(s).click(), sel); await p.waitForTimeout(700);
    const c = await p.evaluate(() => { const k = document.querySelector('.card'); return { nome: k.querySelector('h4').textContent.trim(), tipo: k.querySelector('.tipo').textContent.trim(), zona: k.querySelector('.quart').textContent.trim(), nota: k.querySelector('.say') ? k.querySelector('.say').textContent.trim() : '', righe: k.querySelector('.say') ? Math.round((k.querySelector('.say').getBoundingClientRect().height - 16) / (16 * 1.35)) : 0, titolo: document.querySelector('#titolo-ris').textContent }; });
    dico(liv + ': la prima scheda è Enoteca Corsi, con la nota su ' + c.righe + ' righe', c.nome === 'Enoteca Corsi' && /^MATTEO\s*Il mio indirizzo in centro\.\s+Osteria-enoteca di una volta, a due passi dal Pantheon\.\s+In tavola i primi romani: carbonara, gricia, amatriciana\.$/.test(c.nota) && c.righe >= 3 && c.tipo === 'Come a casa' && c.zona === 'Pantheon', c);
    if (liv === 'Pantheon') await p.locator('.card').first().screenshot({ path: FOTO + '/corsi-scheda.png' });
    await p.evaluate(() => document.querySelector('.restart, [data-restart], #restart')?.click()); await p.waitForTimeout(500);
  }
  // sulla mappa: segnaposto d'oro (nota di Matteo)
  await p.evaluate(() => document.querySelector('button[data-livello="Pantheon"]').click()); await p.waitForTimeout(600);
  await p.click('[data-view=mappa]'); await p.waitForTimeout(1800);
  const m = await p.evaluate(() => ({ oro: document.querySelectorAll('#mappa .pin.nota').length, tutti: document.querySelectorAll('#mappa .pin').length, titoli: [...document.querySelectorAll('#mappa .leaflet-marker-icon')].filter((e) => e.querySelector('.pin.nota')).map((e) => e.getAttribute('title')) }));
  dico('sulla mappa del Pantheon Enoteca Corsi ha il segnaposto d’oro (' + m.oro + ' d’oro su ' + m.tutti + ')', m.titoli.includes('Enoteca Corsi'), m);
  dico('nessun errore', err.length === 0, err);
  await b.close(); console.log(`\n${ok} ok · ${ko} KO`); process.exitCode = ko ? 1 : 0;
})();
