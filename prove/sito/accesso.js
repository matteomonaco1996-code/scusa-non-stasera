// Accessibilità: controllo automatico con axe-core (regole WCAG 2.2 A e AA e buone pratiche) su ogni schermata,
// più una prova con la sola tastiera.
const { chromium, devices } = require('playwright'); const fs = require('fs');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'), BASE = 'http://localhost:8765/';
const TAVOLA = { nome: 'I Mangioni di Via Po', chiave: 'chiave-di-prova-000000000', creata: '2026-11-10', io: 1, capo: 1, posti: [{ n: 1, nome: 'Matteo', faccia: 0 }, { n: 2, nome: 'Gaia la Gricia', faccia: 3 }],
  luoghi: [{ id: '3935991939893424995', da: 1, aggiunto: '2026-11-10', fatto: null, voti: [1, 2] }, { id: '1327815495698668467', da: 2, aggiunto: '2026-11-11', fatto: null, voti: [] }, { id: '3299677369094428047', da: 2, aggiunto: '2026-11-09', fatto: '2026-11-11', voti: [] }] };
(async () => {
  const b = await chromium.launch(); const trovati = new Map(); let schermate = 0;
  const nuovo = async (opz = {}, termini = true, seduto = false) => {
    const ctx = await b.newContext({ ...opz, reducedMotion: 'reduce' });
    await ctx.addInitScript(([t, s]) => { try { if (t) { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } if (s) localStorage.setItem('sns-comitiva', 'segreto-di-prova-0000000'); } catch (e) {} Math.random = () => 0.42; navigator.share = async () => {}; }, [termini, seduto]);
    await ctx.route('https://finto.supabase.co/**', (r) => { const fn = r.request().url().split('/rpc/')[1]; if (fn === 'conta') return r.fulfill({ status: 204, body: '' }); if (fn === 'comitiva_anteprima') return r.fulfill({ json: { nome: TAVOLA.nome, seduti: 2, liberi: 6, mia: false } }); r.fulfill({ json: TAVOLA }); });
    await ctx.route(/google\.com|paypal\.|wa\.me|cartocdn/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'x' }));
    const p = await ctx.newPage();
    await p.route('**/config.js', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace(/supabaseUrl: "[^"]*"/, 'supabaseUrl: "https://finto.supabase.co/"').replace(/supabaseKey: "[^"]*"/, 'supabaseKey: "sb_publishable_finta"').replace('conto: true', 'conto: false').replace('comitive: false', 'comitive: true') }); });
    await p.clock.install({ time: new Date('2026-11-12T20:30:00') });
    return p;
  };
  const esamina = async (p, dove) => {
    await p.waitForTimeout(300); schermate++;
    await p.evaluate(AXE);
    const r = await p.evaluate(async () => { const d = [...document.querySelectorAll('dialog[open]')].pop(); const x = await axe.run(d || document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }); return x.violations.map((v) => ({ id: v.id, peso: v.impact, aiuto: v.help, nodi: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 2).join(' ').trim().slice(0, 110)), n: v.nodes.length })); });
    for (const v of r) { const k = v.id; if (!trovati.has(k)) trovati.set(k, { ...v, dove: new Set(), tot: 0 }); const t = trovati.get(k); t.dove.add(dove); t.tot += v.n; }
  };
  const chiudi = async (p) => { await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); await p.waitForTimeout(250); };
  for (const [nome, opz] of [['telefono', devices['iPhone 13']], ['computer', { viewport: { width: 1280, height: 900 } }]]) {
    let p = await nuovo(opz, true, true);
    await p.goto(BASE + 'index.html'); await p.waitForTimeout(900); await esamina(p, nome + ': inizio');
    await p.click('#m-comitiva'); await esamina(p, nome + ': comitiva');
    await p.click('[data-com=gettone]'); await esamina(p, nome + ': gettone di comitiva'); await chiudi(p);
    await p.evaluate(() => document.querySelector('button[data-livello="Trastevere"]').click()); await p.waitForTimeout(500); await esamina(p, nome + ': lista');
    await p.click('#gettone'); await p.waitForTimeout(300); await esamina(p, nome + ': gettone');
    await p.click('[data-get=invita]'); await esamina(p, nome + ': proponilo'); await chiudi(p);
    await p.locator('.card a[href^="https://www.google.com/maps/dir/"]').first().click(); await esamina(p, nome + ': prima di andare'); await chiudi(p);
    await p.evaluate(() => document.querySelector('[data-moneta]').click()); await esamina(p, nome + ': moneta'); await chiudi(p);
    if (nome === 'telefono') { await p.click('[data-view=mappa]'); await p.waitForTimeout(1200); await esamina(p, nome + ': mappa'); }
    await p.goto(BASE + 'index.html?posto=3935991939893424995&m=s'); await p.waitForTimeout(800); await esamina(p, nome + ': invito ricevuto');
    await p.click('[data-inv=no]'); await esamina(p, nome + ': invito, no');
    for (const pag of ['privacy.html', 'termini.html', 'statistiche.html?esempio']) { await p.goto(BASE + pag); await p.waitForTimeout(700); await esamina(p, nome + ': ' + pag.split('.')[0]); }
    await p.context().close();
    p = await nuovo(opz, false, false); await p.goto(BASE + 'index.html'); await p.waitForTimeout(700); await esamina(p, nome + ': termini');
    await p.click('#termini-ok'); await p.waitForTimeout(600); await esamina(p, nome + ': posizione'); await chiudi(p);
    await p.click('#m-comitiva'); await esamina(p, nome + ': crea comitiva');
    await p.goto(BASE + 'index.html?comitiva=chiave-di-prova-000000000'); await p.waitForTimeout(900); await esamina(p, nome + ': entra in comitiva');
    await p.context().close();
  }
  console.log(`schermate esaminate: ${schermate}`);
  const lista = [...trovati.values()].sort((a, b) => ({ critical: 0, serious: 1, moderate: 2, minor: 3 }[a.peso] - { critical: 0, serious: 1, moderate: 2, minor: 3 }[b.peso]));
  console.log(lista.length ? `problemi segnalati: ${lista.length} tipi` : '✓ nessun problema segnalato');
  for (const v of lista) { console.log(`  [${v.peso}] ${v.id} — ${v.aiuto} (${v.tot} elementi, in ${v.dove.size} schermate: ${[...v.dove].slice(0, 4).join(', ')})`); for (const n of v.nodi.slice(0, 2)) console.log('       ' + n.slice(0, 230)); }

  // ---------- Solo tastiera ----------
  const p = await nuovo({ viewport: { width: 1280, height: 900 } });
  await p.goto(BASE + 'index.html'); await p.waitForTimeout(900);
  const visti = [], senzaSegno = [];
  for (let i = 0; i < 70; i++) {
    await p.keyboard.press('Tab');
    const f = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const c = getComputedStyle(e), r = e.getBoundingClientRect(); const segno = (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) >= 2) || c.boxShadow !== 'none' && /rgb/.test(c.boxShadow); return { chi: (e.id ? '#' + e.id : e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : e.tagName.toLowerCase()) + ' «' + (e.textContent || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 22) + '»', segno, visibile: r.width > 0 && r.height > 0 }; });
    if (!f) break; visti.push(f.chi); if (!f.segno || !f.visibile) senzaSegno.push(f.chi);
  }
  const unici = [...new Set(visti)];
  console.log(`\nSolo tastiera: con Tab si raggiungono ${unici.length} comandi diversi; senza segno visibile di dove sei: ${senzaSegno.length ? [...new Set(senzaSegno)].slice(0, 8).join(' | ') : 'nessuno'}`);
  const servono = ['#m-start', '#m-livelli', '#m-gettone', '#m-dona', '#bolla'];
  console.log('  raggiunti i comandi principali:', servono.map((s) => s + (visti.some((v) => v.startsWith(s)) ? ' ✓' : ' ✗')).join('  '));
  // finestra: il fuoco resta dentro, Esc la chiude, il fuoco torna al pulsante
  await p.focus('#m-gettone'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  const dentro = []; for (let i = 0; i < 12; i++) { await p.keyboard.press('Tab'); dentro.push(await p.evaluate(() => !!document.activeElement.closest('#dlg-gettone') || document.activeElement === document.body)); }
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  const dopo = await p.evaluate(() => ({ aperta: document.querySelector('#dlg-gettone').open, fuoco: document.activeElement.id }));
  console.log(`  finestra del gettone: il fuoco resta dentro ${dentro.every(Boolean) ? '✓' : '✗'} · Esc la chiude ${!dopo.aperta ? '✓' : '✗'} · il fuoco torna al pulsante che l’ha aperta ${dopo.fuoco === 'm-gettone' ? '✓' : '✗ (' + dopo.fuoco + ')'}`);
  await b.close();
})();
