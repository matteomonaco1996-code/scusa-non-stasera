// Comitive: prova dall'inizio alla fine con due telefoni e il database vero (le funzioni di supabase/comitive.sql
// eseguite da PGlite, al posto di Supabase).   node comitiva.js
const { chromium, devices } = require('playwright');
const fs = require('fs');
const REPO = require('path').resolve(__dirname, '..', '..'), BASE = 'http://localhost:8765/index.html';
const PG = '@electric-sql/pglite';
let ok = 0, ko = 0; const dico = (m, c, x) => { c ? ok++ : ko++; console.log((c ? '  ✓ ' : '  ✗ ') + m + (c ? '' : ' → ' + JSON.stringify(x))); };
const CORSI = '3935991939893424995';
(async () => {
  // ---------- Il database ----------
  const { PGlite } = await import(PG);
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, created_at timestamptz default now(), last_sign_in_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`);
  for (const f of ['schema.sql', 'statistiche.sql', 'luoghi.sql', 'comitive.sql']) await db.exec(fs.readFileSync(`${REPO}/supabase/${f}`, 'utf8'));
  let coda = Promise.resolve(); const chiamate = [];
  const chiama = (fn, args) => (coda = coda.then(async () => {      // una alla volta, come utente senza account
    const k = Object.keys(args);
    await db.exec('set role anon');
    try { const r = await db.query(`select public.${fn.replace(/[^a-z_]/g, '')}(${k.map((n, i) => `${n.replace(/[^a-z_]/g, '')} => $${i + 1}`).join(', ')}) as r`, k.map((n) => args[n])); return { ok: true, r: r.rows[0].r }; }
    catch (e) { return { ok: false, code: e.code, message: e.message }; }
    finally { await db.exec('reset role'); }
  }));
  const sql = async (s) => (coda = coda.then(() => db.query(s))).then((r) => r.rows);

  const b = await chromium.launch();
  const telefono = async ({ termini = true, acceso = true, comitive = true, dispositivo = devices['iPhone 13'] } = {}) => {
    const ctx = await b.newContext({ ...dispositivo, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
    await ctx.addInitScript(([t]) => { try { if (t) { localStorage.setItem('sns-termini', '1.1'); localStorage.setItem('sns-posizione', 'no'); } } catch (e) {} Math.random = () => 0.42; window.__condivisi = []; Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: async (d) => { window.__condivisi.push(d); } }); }, [termini]);
    const richieste = [], eventi = [];
    await ctx.route('https://finto.supabase.co/**', async (route) => {
      const q = route.request(), fn = q.url().split('/rpc/')[1], args = JSON.parse(q.postData() || '{}');
      richieste.push({ fn, args, testa: q.headers() });
      if (fn === 'conta') { eventi.push(...(args.p_eventi || [])); return route.fulfill({ status: 204, body: '' }); }
      chiamate.push(fn);
      const r = await chiama(fn, args);
      if (r.ok) return route.fulfill({ status: r.r === null ? 204 : 200, contentType: 'application/json', body: r.r === null ? '' : JSON.stringify(r.r) });
      route.fulfill({ status: r.code === '42501' ? 403 : 400, contentType: 'application/json', body: JSON.stringify({ code: r.code, message: r.message, details: null, hint: null }) });
    });
    await ctx.route(/google\.com|paypal\.|wa\.me/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'x' }));
    const p = await ctx.newPage(); const err = [], file = [];
    p.on('pageerror', (e) => err.push(String(e).slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text().slice(0, 200)); });
    p.on('request', (r) => { if (/\/js\//.test(r.url())) file.push(r.url().split('/').pop()); });
    await p.route('**/config.js', async (route) => {
      const r = await route.fetch(); let t = await r.text();
      if (acceso) t = t.replace(/supabaseUrl: "[^"]*"/, 'supabaseUrl: "https://finto.supabase.co/"').replace(/supabaseKey: "[^"]*"/, 'supabaseKey: "sb_publishable_finta"').replace('conto: true', 'conto: false');
      else t = t.replace(/supabaseUrl: "[^"]*"/, 'supabaseUrl: ""');   // database spento: senza indirizzo
      if (comitive) t = t.replace('comitive: false', 'comitive: true');
      await route.fulfill({ response: r, body: t });
    });
    await p.clock.install({ time: new Date('2026-11-12T20:30:00') });
    return { ctx, p, err, richieste, eventi, file };
  };
  const vai = async (p, url) => { await p.goto(url); await p.waitForTimeout(900); };
  const com = (p) => p.evaluate(() => { const d = document.querySelector('#dlg-comitiva'), c = d.querySelector('#com-corpo'); return { aperta: d.open, titolo: d.querySelector('#com-t').textContent, schermo: c.dataset.schermo, eti: (c.querySelector('.eti') || {}).textContent || '', nome: (c.querySelector('.rullo') || {}).textContent || '', posti: [...c.querySelectorAll('.tavola .posto:not(.libero)')].map((x) => x.querySelector('span').textContent + (x.classList.contains('io') ? '*' : '')), righe: [...c.querySelectorAll('.righe li')].map((li) => li.querySelector('.nome').textContent + ' | ' + li.querySelector('.dove').textContent + ' | ' + [...li.querySelectorAll('.tasto')].map((t) => t.textContent.trim()).join(',') + ' | facce ' + li.querySelectorAll('.mini').length), err: (c.querySelector('#com-err') && !c.querySelector('#com-err').hidden && c.querySelector('#com-err').textContent) || '', testo: c.textContent.replace(/\s+/g, ' ').trim() }; });
  const foto = (p, n) => p.screenshot({ path: `${process.env.PROVE_FOTO || 'out'}/com-${n}.png` });   // nella cartella delle schermate del giro di prove, non nel repository

  // ---------- A crea la comitiva ----------
  console.log('Chi crea la comitiva');
  const A = await telefono(); let p = A.p;
  await vai(p, BASE);
  const menu = await p.evaluate(() => ({ visibile: !document.querySelector('#m-comitiva').hidden, testo: document.querySelector('#m-comitiva').textContent.replace(/\s+/g, ' ').trim(), schede: document.querySelectorAll('[data-comitiva]').length }));
  dico('nel menu compare «COMITIVA»; sulle schede ancora niente', menu.visibile && /^COMITIVA\s*Un tavolo di amici/.test(menu.testo) && menu.schede === 0 && A.file.includes('comitiva.js'), menu);
  await p.click('#m-comitiva'); await p.waitForTimeout(300);
  let s = await com(p);
  dico('si apre «crea una comitiva»: nome a testo libero, il tuo nome, sei facce', s.aperta && s.schermo === 'crea' && await p.evaluate(() => document.querySelectorAll('.facce input').length === 6 && document.querySelector('#com-nome').maxLength === 30 && document.querySelector('#com-mio').maxLength === 20), s);
  await p.click('[data-com=pesca-nome]');
  const pescato = await p.inputValue('#com-nome');
  dico('«Pescane uno» propone un nome già pronto (' + pescato + '), che si può cambiare', pescato.length > 3);
  await foto(p, '1-crea');
  // un nome non ammesso viene rifiutato dal database, con la spiegazione
  await p.fill('#com-nome', 'Scrivimi su www.esempio.it'); await p.fill('#com-mio', 'Matteo'); await p.click('#com-form [type=submit]'); await p.waitForTimeout(400);
  s = await com(p);
  dico('un nome con un link viene rifiutato: «' + s.err + '»', s.schermo === 'crea' && /niente link/.test(s.err), s);
  await p.fill('#com-nome', 'I Mangioni di Via Po'); await p.click('.facce label:nth-child(1)'); await p.click('#com-form [type=submit]'); await p.waitForTimeout(500);
  s = await com(p);
  dico('con un nome scritto a mano la comitiva nasce: «' + s.nome + '», ' + s.eti, s.schermo === 'tavola' && s.nome === 'I Mangioni di Via Po' && s.eti === '1 A TAVOLA · 7 POSTI LIBERI' && s.posti.join() === 'Matteo*', s);
  const mem = await p.evaluate(() => ({ chiavi: Object.keys(localStorage).sort().join(), segreto: localStorage.getItem('sns-comitiva') }));
  const riga = (await sql(`select k.chiave, k.nome, p.impronta, p.nome as mio from public.comitive k join public.comitiva_posti p on p.comitiva = k.id`))[0];
  dico('sul telefono resta solo il segreto del posto; nel database c’è la sua impronta, non il segreto', mem.chiavi === 'sns-comitiva,sns-termini' && /^[\w-]{22}$/.test(mem.segreto) && /^[0-9a-f]{64}$/.test(riga.impronta) && riga.impronta !== mem.segreto && riga.chiave !== mem.segreto && /^[\w-]{22}$/.test(riga.chiave), { mem, riga });
  await p.click('#dlg-comitiva [data-chiudi]'); await p.waitForTimeout(400);
  // aggiungere posti: dalla scheda e dal gettone
  await p.evaluate(() => document.querySelector('button[data-livello="Pantheon"]').click()); await p.waitForTimeout(600);
  const bott = await p.evaluate(() => ({ n: document.querySelectorAll('.card [data-comitiva]').length, schede: document.querySelectorAll('.card').length, testo: document.querySelector('.card [data-comitiva]').textContent, menu: document.querySelector('#m-comitiva .voce').textContent }));
  dico('ora ogni scheda ha «+ Comitiva», e il menu dice «' + bott.menu + '»', bott.n === bott.schede && bott.testo === '+ Comitiva' && bott.menu === 'COMITIVA · I MANGIONI DI VIA PO', bott);
  await p.locator('.card [data-comitiva]').first().click(); await p.waitForTimeout(500);
  const dopo = await p.evaluate(() => ({ testo: document.querySelector('.card [data-comitiva]').textContent, spento: document.querySelector('.card [data-comitiva]').disabled, toast: !document.querySelector('#toast').hidden && document.querySelector('#toast').textContent }));
  dico('un tocco e il posto è in lista: «' + dopo.toast + '»', dopo.testo === 'In comitiva ✓' && dopo.spento && /Enoteca Corsi è tra i posti da provare di «I Mangioni di Via Po»/.test(dopo.toast), dopo);
  await p.click('#gettone'); await p.waitForTimeout(700);
  const get = await p.evaluate(() => ({ nome: document.querySelector('#rullo').textContent, b: (document.querySelector('#get-esito [data-comitiva]') || {}).textContent }));
  await p.click('#get-esito [data-comitiva]'); await p.waitForTimeout(500);
  dico('anche dopo il gettone: «' + get.b + '» mette in lista ' + get.nome, get.b === '+ Comitiva' && await p.evaluate(() => document.querySelector('#get-esito [data-comitiva]').textContent === 'In comitiva ✓'), get);
  await p.click('#dlg-gettone [data-chiudi]'); await p.waitForTimeout(400);
  await p.evaluate(() => scrollTo(0, 0)); await p.click('#m-comitiva'); await p.waitForTimeout(600);
  s = await com(p);
  dico('la tavola mostra i due posti da provare: ' + s.righe.map((r) => r.split(' | ')[0]).join(', '), s.righe.length === 2 && s.righe.some((r) => /^Enoteca Corsi \| Come a casa · Pantheon \| Voto,Fatto!,×/.test(r)) && s.righe.some((r) => r.startsWith(get.nome)), s.righe);
  // invitare
  await p.click('.posto.libero'); await p.waitForTimeout(400);
  const inv = await p.evaluate(() => ({ aperta: document.querySelector('#dlg-invito').open, titolo: document.querySelector('#inv-t').textContent, testo: document.querySelector('#inv-testo').textContent, nota: document.querySelector('#inv-corpo .get-info').textContent }));
  const link = inv.testo.split('\n').pop(), u = new URL(link);
  dico('«+ Invita» prepara il messaggio con il link: «' + inv.testo.split('\n')[0] + '»', inv.aperta && inv.titolo === 'INVITA' && inv.testo.startsWith('Entra nella comitiva «I Mangioni di Via Po» su Ristomat') && [...u.searchParams.keys()].join() === 'comitiva,da' && u.searchParams.get('comitiva') === riga.chiave && !link.includes(mem.segreto), inv);
  await p.click('[data-inv=condividi]'); await p.waitForTimeout(200);
  dico('il messaggio parte dalla condivisione del telefono', (await p.evaluate(() => window.__condivisi)).some((c) => c.text === inv.testo));
  await p.click('#dlg-invito [data-chiudi]'); await p.waitForTimeout(400);

  // ---------- B riceve il link ----------
  console.log('Chi riceve il link');
  const B = await telefono({ termini: false }); let q = B.p;
  await vai(q, link);
  let t = await q.evaluate(() => ({ termini: document.querySelector('#dlg-termini').open, avviso: document.querySelector('#ter-invito').textContent, nascosto: document.querySelector('#ter-invito').hidden, com: document.querySelector('#dlg-comitiva').open }));
  dico('prima visita: i termini, con «' + t.avviso + '»', t.termini && !t.nascosto && /Ti hanno invitato in una comitiva/.test(t.avviso) && !t.com, t);
  await q.click('#termini-ok'); await q.waitForTimeout(900);
  s = await com(q);
  dico('poi l’invito: «' + s.nome + '» · ' + s.eti + ', senza i nomi di chi c’è', s.aperta && s.schermo === 'entra' && s.titolo === 'TI HANNO INVITATO' && s.nome === 'I Mangioni di Via Po' && s.eti === 'COMITIVA · 1 A TAVOLA' && !/Matteo/.test(s.testo) && !/Enoteca/.test(s.testo) && /Niente account e niente email/.test(s.testo), s);
  dico('l’indirizzo torna pulito: la chiave della comitiva non resta nella barra', await q.evaluate(() => location.search === '?da=amici'));
  await foto(q, '2-entra');
  await q.fill('#com-mio', 'chiamami 3331234567'); await q.click('#com-form [type=submit]'); await q.waitForTimeout(400);
  s = await com(q);
  dico('un numero di telefono al posto del nome: rifiutato', s.schermo === 'entra' && /numeri di telefono/.test(s.err), s.err);
  await q.fill('#com-mio', 'Gaia la Gricia'); await q.click('.facce label:nth-child(4)'); await q.click('#com-form [type=submit]'); await q.waitForTimeout(600);
  s = await com(q);
  dico('con il suo nome si siede: a tavola ' + s.posti.join(' e '), s.schermo === 'tavola' && s.posti.join() === 'Matteo,Gaia la Gricia*' && s.eti === '2 A TAVOLA · 6 POSTI LIBERI' && s.righe.length === 2, s);
  await q.locator('.righe li', { hasText: 'Enoteca Corsi' }).locator('[data-com=voto]').click(); await q.waitForTimeout(500);
  s = await com(q);
  dico('vota Enoteca Corsi: ' + s.righe.find((r) => r.startsWith('Enoteca')), /Votato · 1,Fatto! \| facce 1$/.test(s.righe.find((r) => r.startsWith('Enoteca')) || '') && s.righe[0].startsWith('Enoteca Corsi'), s.righe);

  // ---------- A vede, vota, segna fatto ----------
  console.log('Insieme');
  await p.click('#dlg-comitiva [data-chiudi]'); await p.waitForTimeout(400); await p.evaluate(() => scrollTo(0, 0)); await p.click('#m-comitiva'); await p.waitForTimeout(700);
  s = await com(p);
  dico('chi ha creato la comitiva vede il nuovo arrivato e il suo voto', s.posti.join() === 'Matteo*,Gaia la Gricia' && /^Enoteca Corsi .* Voto · 1,Fatto!,× \| facce 1$/.test(s.righe[0]), s);
  await p.locator('.righe li', { hasText: 'Enoteca Corsi' }).locator('[data-com=voto]').click(); await p.waitForTimeout(500);
  s = await com(p);
  dico('vota anche lui: due voti, e spunta «' + (s.testo.match(/Manda nel gruppo il più votato: [^.]*?(?= Gettone| Non)/) || [''])[0] + '»', /Votato · 2/.test(s.righe[0]) && /facce 2$/.test(s.righe[0]) && /Manda nel gruppo il più votato: Enoteca Corsi/.test(s.testo), s.righe);
  await foto(p, '3-tavola');
  await p.click('[data-com=proponi]'); await p.waitForTimeout(400);
  const pr = await p.evaluate(() => ({ aperta: document.querySelector('#dlg-invito').open, t: document.querySelector('#inv-testo').textContent }));
  dico('il più votato si manda nel gruppo con «Proponilo»: «' + pr.t.split('\n')[0] + '»', pr.aperta && pr.t.startsWith('Stasera qui? Enoteca Corsi, Pantheon. Ci stai?'), pr);
  await p.click('#dlg-invito [data-chiudi]'); await p.waitForTimeout(400);
  // spostare il voto
  const altro = s.righe.find((r) => !r.startsWith('Enoteca')).split(' | ')[0];
  await p.locator('.righe li', { hasText: altro }).locator('[data-com=voto]').click(); await p.waitForTimeout(500);
  s = await com(p);
  dico('un voto a testa: votando ' + altro + ' il voto si sposta', /Voto · 1/.test(s.righe.find((r) => r.startsWith('Enoteca'))) && /Votato · 1/.test(s.righe.find((r) => r.startsWith(altro))), s.righe);
  await p.locator('.righe li', { hasText: 'Enoteca Corsi' }).locator('[data-com=fatto]').click(); await p.waitForTimeout(500);
  s = await com(p);
  dico('«Fatto!» sposta Enoteca Corsi tra i fatti, con la data di oggi', s.righe.some((r) => /^Enoteca Corsi \| Come a casa · Pantheon · \S+ \d+ \S+ \| Da rifare/.test(r)) && /Fatti\s*1 posto/.test(s.testo), s.righe);
  // gettone di comitiva
  await p.click('[data-com=gettone]'); await p.waitForTimeout(300);
  s = await com(p);
  const nuovo = s.nome;
  dico('il gettone di comitiva pesca un posto che non è in lista: ' + nuovo + ' (' + s.eti + ')', s.schermo === 'pescato' && nuovo && nuovo !== 'Enoteca Corsi' && nuovo !== altro && /POSTI NUOVI PER VOI · PANTHEON/.test(s.eti), s);
  await foto(p, '4-gettone');
  await p.click('[data-com=tieni]'); await p.waitForTimeout(500);
  s = await com(p);
  dico('e lo mette tra quelli da provare', s.schermo === 'tavola' && s.righe.some((r) => r.startsWith(nuovo + ' |')), s.righe);
  // B aggiorna da solo dopo mezzo minuto
  await q.clock.runFor(31000); await q.waitForTimeout(700);
  s = await com(q);
  dico('sull’altro telefono, con la finestra aperta, le novità arrivano da sole entro mezzo minuto', s.righe.some((r) => r.startsWith(nuovo + ' |')) && s.righe.some((r) => /^Enoteca Corsi .*Da rifare/.test(r)), s.righe);
  await foto(q, '5-altro-telefono');

  // ---------- Chi ha creato la comitiva ----------
  console.log('Chi comanda, chi esce');
  await p.click('.gestisci summary'); await p.waitForTimeout(200);
  await p.fill('#com-nome', 'Carbonara Club'); await p.click('#com-form [type=submit]'); await p.waitForTimeout(500);
  s = await com(p);
  dico('rinomina la comitiva: «' + s.nome + '»', s.nome === 'Carbonara Club', s.nome);
  dico('chi non l’ha creata non ha quei comandi', await q.evaluate(() => !document.querySelector('#dlg-comitiva [data-com=libera]') && !document.querySelector('#dlg-comitiva #com-nome') && !!document.querySelector('#dlg-comitiva [data-com=esci]')));
  await p.click('.gestisci summary'); await p.waitForTimeout(200);
  await p.click('[data-com=libera]'); await p.waitForTimeout(200);
  const primoTocco = await com(p);
  await p.click('[data-com=libera]'); await p.waitForTimeout(500);
  s = await com(p);
  dico('libera un posto, ma solo al secondo tocco', primoTocco.posti.length === 2 && /Sicuro\? Tocca ancora/.test(primoTocco.testo) && s.posti.join() === 'Matteo*', { prima: primoTocco.posti, dopo: s.posti });
  await q.clock.runFor(31000); await q.waitForTimeout(700);
  s = await com(q);
  const memB = await q.evaluate(() => ({ chiave: localStorage.getItem('sns-comitiva'), bott: document.querySelectorAll('[data-comitiva]').length, menu: document.querySelector('#m-comitiva .voce').textContent }));
  dico('chi è stato tolto lo scopre: «' + s.err + '»', s.schermo === 'crea' && /Non sei più seduto/.test(s.err) && memB.chiave === null && memB.menu === 'COMITIVA', { s: s.err, memB });
  // nomi con del codice: rifiutati; e se anche finissero nel database, sulla pagina restano testo
  await p.click('.gestisci summary'); await p.waitForTimeout(200);
  await p.fill('#com-nome', '<img src=x onerror=window.__bucato=1>'); await p.click('#com-form [type=submit]'); await p.waitForTimeout(400);
  s = await com(p);
  dico('un nome con del codice è rifiutato dal database', /simboli come < e >/.test(s.err) && s.nome === 'Carbonara Club', s.err);
  await sql(`alter table public.comitive drop constraint if exists comitive_nome_check`);
  await sql(`update public.comitive set nome = '"><img src=x onerror=window.__bucato=1>'`);
  await sql(`update public.comitiva_posti set nome = '<b id=x>M</b>'`);
  await p.click('#dlg-comitiva [data-chiudi]'); await p.waitForTimeout(300); await p.evaluate(() => scrollTo(0, 0)); await p.click('#m-comitiva'); await p.waitForTimeout(700);
  const xss = await p.evaluate(() => ({ bucato: !!window.__bucato, img: document.querySelectorAll('img[src="x"]').length, b: document.querySelectorAll('#com-corpo .posto b').length, nome: document.querySelector('#com-corpo .rullo').textContent, menu: document.querySelector('#m-comitiva .voce').textContent }));
  dico('anche forzando il database, un nome con del codice resta testo sulla pagina', !xss.bucato && xss.img === 0 && xss.b === 0 && xss.nome === '"><img src=x onerror=window.__bucato=1>', xss);
  // alzarsi: l'ultimo chiude la comitiva
  await p.click('.gestisci summary'); await p.waitForTimeout(200);
  await p.click('[data-com=esci]'); await p.waitForTimeout(200); await p.click('[data-com=esci]'); await p.waitForTimeout(600);
  const fine = await p.evaluate(() => ({ aperta: document.querySelector('#dlg-comitiva').open, chiave: localStorage.getItem('sns-comitiva'), bott: document.querySelectorAll('[data-comitiva]').length, toast: document.querySelector('#toast').textContent }));
  const resto = (await sql(`select (select count(*)::int from public.comitive) k, (select count(*)::int from public.comitiva_posti) p, (select count(*)::int from public.comitiva_luoghi) l, (select count(*)::int from public.comitiva_voti) v`))[0];
  dico('l’ultimo che si alza chiude la comitiva: nel database non resta niente', !fine.aperta && fine.chiave === null && fine.bott === 0 && resto.k + resto.p + resto.l + resto.v === 0, { fine, resto });
  await vai(q, link);
  const scaduto = await q.evaluate(() => ({ com: document.querySelector('#dlg-comitiva').open, toast: !document.querySelector('#toast').hidden && document.querySelector('#toast').textContent }));
  dico('il vecchio link non porta più da nessuna parte: «' + scaduto.toast + '»', !scaduto.com && /non vale più/.test(scaduto.toast || ''), scaduto);

  // ---------- Che cosa esce dal telefono ----------
  console.log('Riservatezza e interruttori');
  const tutte = [...A.richieste, ...B.richieste];
  const campi = [...new Set(tutte.filter((r) => r.fn !== 'conta').flatMap((r) => Object.keys(r.args)))].sort();
  dico('al database arrivano solo: ' + campi.join(', '), campi.join() === 'p_chiave,p_cosa,p_faccia,p_fatto,p_livello,p_luogo,p_mio_nome,p_nome,p_segreto,p_valore' && tutte.every((r) => !('authorization' in r.testa) && !r.testa.cookie), campi);
  const ev = [...A.eventi, ...B.eventi].filter((e) => /^comitiva/.test(e));
  dico('contatori anonimi: ' + [...new Set(ev)].sort().join(' '), ['comitiva_crea', 'comitiva_entra', 'comitiva_aggiungi', 'comitiva_voto', 'comitiva_fatto', 'comitiva_invita'].every((e) => ev.includes(e)), ev);
  dico('nessun errore sui due telefoni (a parte i rifiuti del database, che sono voluti)', [...A.err, ...B.err].filter((e) => !/status of 400/.test(e)).length === 0, { A: A.err, B: B.err });
  await A.ctx.close(); await B.ctx.close();
  for (const [nome, opz] of [['database acceso ma «comitive: false» (com’è nel sito)', { comitive: false }], ['database spento', { acceso: false, comitive: true }]]) {
    const C = await telefono(opz); await vai(C.p, BASE + '?comitiva=' + riga.chiave + '&da=amici');
    await C.p.evaluate(() => document.querySelector('button[data-livello="Pantheon"]').click()); await C.p.waitForTimeout(500);
    const r = await C.p.evaluate(() => ({ menu: document.querySelector('#m-comitiva').hidden, com: document.querySelector('#dlg-comitiva').open, bott: document.querySelectorAll('[data-comitiva]').length, schede: document.querySelectorAll('.card').length }));
    dico(nome + ': niente voce nel menu, niente pulsanti, il file delle comitive non viene nemmeno scaricato', r.menu && !r.com && r.bott === 0 && r.schede > 5 && !C.file.includes('comitiva.js') && !C.richieste.some((x) => /comitiva/.test(x.fn)) && C.err.length === 0, { r, file: C.file, err: C.err });
    await C.ctx.close();
  }
  await b.close(); console.log(`\n${ok} ok · ${ko} KO`); process.exitCode = ko ? 1 : 0;
})().catch((e) => { console.error('ERRORE DEL TEST', e); process.exit(2); });
