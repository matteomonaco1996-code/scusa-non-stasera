#!/usr/bin/env node
// Lancia le prove automatiche del sito, una dopo l'altra, e dice quali passano.
//
//   node prove/tutte.js                 le prove di base, sulla copia del sito in questa cartella
//   node prove/tutte.js --lunghe        anche quelle lente (accessibilità, misure su tante larghezze, tocchi a caso)
//   node prove/tutte.js --vivo          le prove sul sito pubblicato (https://ristomat.click)
//   node prove/tutte.js passi moneta    solo quelle nominate
//
// Le chiamate al database vero non partono mai (vedi finto-db.js): le prove non gonfiano i contatori.
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RADICE = path.resolve(__dirname, '..');
const SITO = path.join(__dirname, 'sito');
const PORTA = 8765;
const LOCALE = `http://localhost:${PORTA}/`;
const VIVO = 'https://ristomat.click/';

// foto: la prova vuole per prima cosa la cartella delle schermate · url: la prova accetta anche un indirizzo
// (dopo la cartella delle schermate, se c'è), quindi si può lanciare sul sito pubblicato con --vivo
const PROVE = [
  { nome: 'prova', foto: true, cosa: 'giro generale: menu, gettone, mappa, restart' },
  { nome: 'bolla', foto: true, cosa: 'il fumetto e i pulsanti di partenza' },
  { nome: 'scena', foto: true, cosa: 'le battute a seconda dell’ora' },
  { nome: 'colori', url: 'primo', cosa: 'contrasto dei testi nella palette «Carta»' },
  { nome: 'mondo', url: 'primo', cosa: 'mappa dei quartieri con le strade' },
  { nome: 'mondi', url: 'pagina', cosa: 'ordine dei mondi' },
  { nome: 'primo', url: 'pagina', cosa: 'Tivoli primo livello di Fuori porta' },
  { nome: 'tivoli', url: 'pagina', cosa: 'le schede di Tivoli' },
  { nome: 'corsi', url: 'primo', cosa: 'Enoteca Corsi consigliata in centro' },
  { nome: 'passi', foto: true, url: 'dopo', cosa: 'mondo → power-up → livello → posti' },
  { nome: 'prossimo', foto: true, url: 'dopo', cosa: '«Prossimo livello» riparte dall’inizio dell’elenco' },
  { nome: 'pw-righe', foto: true, url: 'dopo', cosa: 'power-up su più righe' },
  { nome: 'filtri', foto: true, url: 'dopo', cosa: 'FILTRI nella barra sopra i posti: tipo e ricerca senza risalire la pagina' },
  { nome: 'percorso', foto: true, cosa: 'INDIETRO, ricarica, finestre' },
  { nome: 'posizione', foto: true, cosa: 'la finestra della posizione' },
  { nome: 'avviso-posizione', foto: true, url: 'dopo', cosa: 'l’avviso prima di «Vicino a me» nel gettone' },
  { nome: 'moneta', foto: true, cosa: 'la finestra «Prima di andare»' },
  { nome: 'dona-bottoni', foto: true, url: 'dopo', cosa: 'la donazione su Portami lì, Apri su Maps, Proponilo' },
  { nome: 'invito', url: 'pagina', cosa: '«Proponilo»: chi propone e chi riceve' },
  { nome: 'conteggi', cosa: 'che cosa parte verso i contatori (database finto)' },
  { nome: 'conta-vero', foto: true, url: 'dopo', cosa: 'che cosa parte con la configurazione vera' },
  { nome: 'cruscotto', foto: true, cosa: 'la pagina di monitoraggio e il suo accesso' },
  { nome: 'dati', cosa: 'i dati dei posti: doppioni, tipi, quartieri, descrizioni' },
  { nome: 'guasti', cosa: 'che cosa succede se manca un pezzo' },
  { nome: 'mattina', cosa: 'il gettone nelle ore in cui pochi posti sono adatti' },
  { nome: 'ore', cosa: 'ore strane, alto contrasto, animazioni' },
  { nome: 'vecchi', cosa: 'browser un po’ vecchi' },
  { nome: 'fuoco', cosa: 'tastiera e pulsanti delle pagine legali' },
  { nome: 'rete', url: 'primo', cosa: 'il sito non chiama altri server; niente chiavi dimenticate' },
  { nome: 'comitiva', cosa: 'le comitive dall’inizio alla fine (funzione spenta sul sito)' },
  { nome: 'accesso', gruppo: 'lunghe', cosa: 'accessibilità (axe-core) e uso con la sola tastiera' },
  { nome: 'scimmia', gruppo: 'lunghe', cosa: 'centinaia di tocchi a caso' },
  { nome: 'misure', gruppo: 'lunghe', minuti: 12, cosa: 'ogni schermata su tante larghezze' },
  { nome: 'vivo3', gruppo: 'vivo', foto: true, cosa: 'sito pubblicato: giro da visitatore nuovo' },
  { nome: 'percorso-vivo', gruppo: 'vivo', foto: true, cosa: 'sito pubblicato: INDIETRO e ricarica' },
  { nome: 'vivo-file', gruppo: 'vivo', cosa: 'sito pubblicato: ogni file citato esiste' },
];

const TIPI = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };

// Un piccolo server per la copia locale del sito (se sulla porta ce n'è già uno, si usa quello)
function risponde() {
  return new Promise((si) => { const r = http.get(LOCALE + 'index.html', (x) => { x.resume(); si(x.statusCode === 200); }); r.on('error', () => si(false)); r.setTimeout(2000, () => { r.destroy(); si(false); }); });
}
function accendi() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, LOCALE).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(RADICE, path.normalize(p));
    if (!file.startsWith(RADICE) || /(^|\/)\.git(\/|$)/.test(p)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (e, dati) => {
      if (e) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end('<title>404</title>Non trovato'); }
      res.writeHead(200, { 'Content-Type': TIPI[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(dati);
    });
  });
  return new Promise((si, no) => { server.on('error', no); server.listen(PORTA, '127.0.0.1', () => si(server)); });
}

function lancia(p, vivo, foto) {
  const arg = [];
  const indirizzo = vivo ? VIVO : null;
  if (p.foto) arg.push(foto);
  if (indirizzo && p.url) arg.push(indirizzo);
  return new Promise((fine) => {
    const figlio = spawn(process.execPath, ['-r', path.join(__dirname, 'finto-db.js'), path.join(SITO, p.nome + '.js'), ...arg],
      { cwd: SITO, env: { ...process.env, PROVE_FOTO: foto } });
    let testo = '';
    const tempo = setTimeout(() => { testo += '\nFALLITO: tempo scaduto'; figlio.kill('SIGKILL'); }, (p.minuti || 6) * 60000);
    figlio.stdout.on('data', (d) => { testo += d; });
    figlio.stderr.on('data', (d) => { testo += d; });
    figlio.on('close', (codice) => { clearTimeout(tempo); fine({ codice, testo }); });
  });
}

// Le prove sono nate in momenti diversi e parlano in modi diversi: qui si riconosce chi dice che qualcosa non va
function esito({ codice, testo }) {
  const righe = testo.split('\n');
  const male = righe.filter((r) => /^\s*(NO |✗|FALLITO)/.test(r) || /\b[1-9]\d* falliti\b/.test(r) || /\b[1-9]\d* KO\b/.test(r) || /\bKO [1-9]\d*\b/.test(r) || /QUALCOSA NON VA/.test(r) || /^\S*Error: /.test(r));
  const riga = [...righe].reverse().find((r) => /\d+ ok\b|OK \d+|tutti giusti|giri puliti|Tutto a posto|schermate guardate|schermate esaminate/.test(r)) || [...righe].reverse().find((r) => r.trim()) || '';
  return { passa: codice === 0 && !male.length, male, riga: riga.trim().slice(0, 110) };
}

(async () => {
  const arg = process.argv.slice(2);
  const vivo = arg.includes('--vivo'), lunghe = arg.includes('--lunghe');
  const nomi = arg.filter((a) => !a.startsWith('--'));
  const sconosciute = nomi.filter((n) => !PROVE.some((p) => p.nome === n));
  if (sconosciute.length) { console.error('Prove che non conosco: ' + sconosciute.join(', ') + '\nCi sono: ' + PROVE.map((p) => p.nome).join(', ')); process.exit(2); }
  const scelte = PROVE.filter((p) => nomi.length ? nomi.includes(p.nome)
    : vivo ? (p.gruppo === 'vivo' || p.url) : (!p.gruppo || (lunghe && p.gruppo === 'lunghe')));
  const foto = fs.mkdtempSync(path.join(os.tmpdir(), 'ristomat-prove-'));
  let server = null;
  if (!vivo || scelte.some((p) => !p.url && p.gruppo !== 'vivo')) { if (!(await risponde())) server = await accendi(); }
  console.log(`${scelte.length} prove ${vivo ? 'sul sito pubblicato' : 'sulla copia locale'} · schermate in ${foto}\n`);
  const fallite = [];
  const inizio = Date.now();
  for (const p of scelte) {
    const t0 = Date.now();
    const e = esito(await lancia(p, vivo && p.gruppo !== 'vivo' && !!p.url, foto));
    console.log(`${e.passa ? '✓' : '✗'} ${p.nome.padEnd(17)} ${String(Math.round((Date.now() - t0) / 1000)).padStart(3)} s  ${e.passa ? e.riga : p.cosa}`);
    if (!e.passa) { fallite.push(p.nome); for (const r of e.male.slice(0, 8)) console.log('    ' + r.trim().slice(0, 300)); }
  }
  if (server) server.close();
  console.log(`\n${scelte.length - fallite.length} su ${scelte.length} passano, in ${Math.round((Date.now() - inizio) / 60000)} minuti.` + (fallite.length ? ' Da guardare: ' + fallite.join(', ') : ''));
  process.exit(fallite.length ? 1 : 0);
})();
