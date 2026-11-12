// Test delle comitive (supabase/comitive.sql) con PGlite (Postgres in WebAssembly) e un finto schema "auth" di Supabase.
// Come lanciarlo, dalla cartella del sito:
//   npm install --no-save @electric-sql/pglite@0.5.16
//   node strumenti/test_comitive.mjs supabase/schema.sql supabase/statistiche.sql supabase/comitive.sql

import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
const db = new PGlite();
const ok = (m) => console.log("  ✓", m), ko = (m) => { console.log("  ✗", m); process.exitCode = 1; };
const check = (cond, m, extra) => (cond ? ok(m) : ko(m + " → " + JSON.stringify(extra)));
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, created_at timestamptz default now(), last_sign_in_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
for (const f of process.argv.slice(2, 4)) await db.exec(fs.readFileSync(f, "utf8"));
const sql = fs.readFileSync(process.argv[4], "utf8");
await db.exec(sql); ok("comitive.sql eseguito");
await db.exec(sql); ok("comitive.sql rieseguibile");
await db.exec(`insert into public.luoghi (id, nome, lat, lon, quartiere, citta, tipo) values
  ('L1', 'Enoteca Corsi', 41.897, 12.479, 'Pantheon', 'Roma', 'trattoria'), ('L2', 'Bar San Calisto', 41.889, 12.47, 'Trastevere', 'Roma', 'bar'),
  ('L3', 'Nakai', 41.899, 12.455, 'Borgo', 'Roma', 'mondo');`);
const CAPO = "11111111-1111-1111-1111-111111111111", ALTRO = "22222222-2222-2222-2222-222222222222";
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values ('${CAPO}', 'capo@example.org', now()), ('${ALTRO}', 'altro@example.org', now());
  insert into public.amministratori (email) values ('capo@example.org');`);
const come = async (ruolo, uid = "") => db.exec(`reset role; select set_config('test.uid', '${uid}', false); set role ${ruolo};`);
const q = async (s, v) => (await db.query(s, v)).rows;
const f = async (nome, ...v) => (await q(`select public.${nome}(${v.map((_, i) => "$" + (i + 1)).join(", ")}) as r`, v))[0].r;
const fallisce = async (cosa, nome, ...v) => { try { await f(nome, ...v); ko(cosa + " (doveva fallire)"); return ""; } catch (e) { ok(cosa + " → «" + e.message.split("\n")[0].slice(0, 80) + "»"); return e.message; } };
const K = "chiave-della-comitiva-0001", K2 = "chiave-nuova-della-comitiva-2", S = (n) => "segreto-del-posto-numero-" + String(n).padStart(2, "0");

console.log("Chi usa il sito (senza account)");
await come("anon");
let s = await f("comitiva_crea", K, "  I  Supplì   Volanti ", "Matteo", 2, S(1));
check(s.nome === "I Supplì Volanti" && s.io === 1 && s.capo === 1 && s.posti.length === 1 && s.posti[0].nome === "Matteo" && s.posti[0].faccia === 2 && s.chiave === K && s.luoghi.length === 0, "crea la comitiva: nome ripulito dagli spazi, chi crea è seduto al posto 1", s);
for (const [nome, perche] of [["", "vuoto"], ["A", "troppo corto"], ["x".repeat(31), "troppo lungo"], ["Vieni su www.truffa.it", "con un link"], ["scrivimi a tizio@posta.it", "con un’email"], ["chiama 3331234567", "con un telefono"], ["<img src=x onerror=alert(1)>", "con del codice"]])
  await fallisce("nome della comitiva " + perche + ": rifiutato", "comitiva_crea", K + "x" + perche.length, nome, "Tizio", 0, S(90 + perche.length));
await fallisce("chiave troppo corta: rifiutata", "comitiva_crea", "corta", "Nome", "Tizio", 0, S(80));
await fallisce("la stessa chiave non si può riusare", "comitiva_crea", K, "Altra", "Tizio", 0, S(81));
await fallisce("chi è già seduto non può creare un’altra comitiva", "comitiva_crea", K + "bis", "Altra", "Matteo", 0, S(1));
// chi ha solo il link
let a = await f("comitiva_anteprima", K, null);
check(a.nome === "I Supplì Volanti" && a.seduti === 1 && a.liberi === 7 && a.mia === false && Object.keys(a).sort().join() === "liberi,mia,nome,seduti", "chi ha solo il link vede il nome e quanti sono: non i nomi, non i posti, non i voti", a);
await fallisce("un link sbagliato non mostra niente", "comitiva_anteprima", "chiave-che-non-esiste-00000", null);
await fallisce("senza essere seduti non si vede la tavola", "comitiva_vedi", "segreto-inventato-000000000");
await fallisce("senza essere seduti non si aggiunge un posto", "comitiva_aggiungi", "segreto-inventato-000000000", "L1");
// sedersi
s = await f("comitiva_siediti", K, "Gaia", 1, S(2));
check(s.io === 2 && s.posti.map((p) => p.nome).join() === "Matteo,Gaia" && s.capo === 1, "il secondo si siede al posto 2 e vede tutta la tavola", s);
await fallisce("nome a tavola troppo lungo: rifiutato", "comitiva_siediti", K, "x".repeat(21), 0, S(3));
s = await f("comitiva_siediti", K, "Gaia la Gricia", 3, S(2));
check(s.io === 2 && s.posti.length === 2 && s.posti[1].nome === "Gaia la Gricia" && s.posti[1].faccia === 3, "chi è già seduto e si risiede cambia solo nome e faccia", s.posti);
for (let n = 3; n <= 8; n++) await f("comitiva_siediti", K, "Amico " + n, 99, S(n));
s = await f("comitiva_vedi", S(8));
check(s.posti.length === 8 && s.io === 8 && s.posti.every((p) => p.faccia >= 0 && p.faccia <= 5), "si arriva a otto a tavola; una faccia fuori elenco viene riportata tra quelle che esistono", s.posti);
await fallisce("il nono non trova posto", "comitiva_siediti", K, "Nono", 0, S(9));
a = await f("comitiva_anteprima", K, S(4));
check(a.seduti === 8 && a.liberi === 0 && a.mia === true, "l’anteprima dice se quella tavola è già la tua", a);
// lista, voti, fatto
await f("comitiva_aggiungi", S(1), "L1"); await f("comitiva_aggiungi", S(2), "L2"); s = await f("comitiva_aggiungi", S(2), "L2");
check(s.luoghi.length === 2 && s.luoghi.find((l) => l.id === "L2").da === 2, "si aggiungono posti alla lista; aggiungerne uno due volte non lo raddoppia", s.luoghi);
await fallisce("un posto che non è nella lista del sito: rifiutato", "comitiva_aggiungi", S(1), "INVENTATO");
await f("comitiva_vota", S(1), "L1"); await f("comitiva_vota", S(2), "L1"); await f("comitiva_vota", S(3), "L2");
s = await f("comitiva_vota", S(3), "L1");
check(s.luoghi.find((l) => l.id === "L1").voti.join() === "1,2,3" && s.luoghi.find((l) => l.id === "L2").voti.length === 0, "un voto a testa: votare un altro posto sposta il voto", s.luoghi);
s = await f("comitiva_vota", S(3), "");
check(s.luoghi.find((l) => l.id === "L1").voti.join() === "1,2", "il voto si può ritirare", s.luoghi);
await fallisce("non si vota un posto che non è in lista", "comitiva_vota", S(1), "L3");
s = await f("comitiva_fatto", S(4), "L1", true);
check(s.luoghi.find((l) => l.id === "L1").fatto !== null && s.luoghi.find((l) => l.id === "L1").voti.length === 0, "«Fatto!» segna il giorno e azzera i voti su quel posto", s.luoghi);
await fallisce("un posto già fatto non si vota più", "comitiva_vota", S(1), "L1");
s = await f("comitiva_fatto", S(4), "L1", false);
check(s.luoghi.find((l) => l.id === "L1").fatto === null, "«Fatto!» si può annullare", s.luoghi);
await fallisce("togliere un posto aggiunto da un altro: no", "comitiva_togli", S(5), "L2");
s = await f("comitiva_togli", S(2), "L2");
check(s.luoghi.length === 1, "chi l’ha aggiunto lo può togliere", s.luoghi);
await f("comitiva_aggiungi", S(5), "L3"); s = await f("comitiva_togli", S(1), "L3");
check(s.luoghi.length === 1, "chi ha creato la comitiva può togliere qualsiasi posto", s.luoghi);
// chi comanda
await fallisce("solo chi ha creato la comitiva la rinomina", "comitiva_capo", S(2), "rinomina", "Presa io");
s = await f("comitiva_capo", S(1), "rinomina", "Carbonara Club");
check(s.nome === "Carbonara Club", "chi l’ha creata la rinomina", s.nome);
await fallisce("anche il nuovo nome viene controllato", "comitiva_capo", S(1), "rinomina", "visita http://x.y");
s = await f("comitiva_capo", S(1), "togli", "8");
check(s.posti.length === 7 && !s.posti.some((p) => p.n === 8), "chi l’ha creata libera un posto", s.posti.map((p) => p.n));
await fallisce("chi è stato tolto non vede più la tavola", "comitiva_vedi", S(8));
await fallisce("non può togliere sé stesso così", "comitiva_capo", S(1), "togli", "1");
s = await f("comitiva_capo", S(1), "chiave", K2);
check(s.chiave === K2, "cambia il link di invito", s.chiave);
await fallisce("il link vecchio non vale più", "comitiva_anteprima", K, null);
s = await f("comitiva_vedi", S(2));
check(s.chiave === K2 && s.io === 2, "chi era già seduto resta seduto e vede il link nuovo", s.chiave);
// alzarsi
await f("comitiva_alzati", S(1));
s = await f("comitiva_vedi", S(2));
check(s.capo === 2 && s.posti.length === 6, "se chi l’ha creata si alza, comanda chi ha il numero più basso", { capo: s.capo, n: s.posti.length });
s = await f("comitiva_siediti", K2, "Rientro", 0, S(1));
check(s.io === 1 && s.capo === 1, "chi rientra prende il primo posto libero", { io: s.io, capo: s.capo });
// tabelle chiuse
for (const t of ["comitive", "comitiva_posti", "comitiva_luoghi", "comitiva_voti"]) { try { await db.exec(`select * from public.${t}`); ko(t + ": leggibile dal browser"); } catch (e) { ok(t + ": dal browser non si legge"); } }
try { await db.exec(`insert into public.comitive (chiave, nome) values ('chiave-messa-a-mano-00000', 'A mano')`); ko("scrittura diretta riuscita"); } catch (e) { ok("dal browser non si scrive direttamente"); }
await fallisce("le funzioni interne non sono chiamabili (impronta)", "impronta", "x");
await fallisce("chi non gestisce il sito non vede l’elenco delle comitive", "comitive_elenco");

console.log("Chi gestisce il sito");
await come("authenticated", ALTRO);
await fallisce("un utente qualunque con account non vede l’elenco", "comitive_elenco");
await come("authenticated", CAPO);
let e = await f("comitive_elenco");
check(e.totale === 1 && e.da_tre === 1 && e.elenco[0].nome === "Carbonara Club" && e.elenco[0].posti.length === 7 && !JSON.stringify(e).includes(K2) && !JSON.stringify(e).includes("segreto") && !("chiave" in e.elenco[0]), "vede nomi e numeri, non i link di invito né i segreti", e);
await come("anon"); await f("comitiva_crea", "chiave-di-una-seconda-comitiva", "Seconda", "Uno", 0, S(40));
await come("authenticated", CAPO);
const id2 = (await f("comitive_elenco")).elenco.find((k) => k.nome === "Seconda").id;
await f("comitiva_cancella", id2);
e = await f("comitive_elenco");
check(e.totale === 1 && !e.elenco.some((k) => k.nome === "Seconda"), "può cancellare una comitiva", e.elenco.map((k) => k.nome));
await come("anon");
await fallisce("chi era seduto alla comitiva cancellata non la trova più", "comitiva_vedi", S(40));

console.log("Pulizia e limiti");
await come("postgres");
await db.exec(`update public.comitive set usata = current_date - 200 where nome = 'Carbonara Club'`);
await come("anon"); await f("comitiva_crea", "chiave-di-una-terza-comitiva-0", "Terza", "Uno", 0, S(41));
await come("postgres");
let r = await q(`select nome from public.comitive order by id`);
check(r.length === 1 && r[0].nome === "Terza", "una comitiva ferma da più di sei mesi viene cancellata", r);
r = await q(`select (select count(*)::int from public.comitiva_posti) p, (select count(*)::int from public.comitiva_luoghi) l, (select count(*)::int from public.comitiva_voti) v`);
check(r[0].p === 1 && r[0].l === 0 && r[0].v === 0, "e con lei spariscono posti a tavola, lista e voti", r[0]);
await db.exec(`insert into public.comitive (chiave, nome) select 'chiave-riempitiva-numero-' || lpad(g::text, 4, '0'), 'Piena ' || g from generate_series(1, 299) g`);
await come("anon");
await fallisce("più di 300 comitive nuove in un giorno: si ferma", "comitiva_crea", "chiave-oltre-il-limite-00001", "Troppe", "Uno", 0, S(42));
await come("postgres");
r = await q(`select column_name from information_schema.columns where table_schema = 'public' and table_name like 'comitiv%' order by 1`);
check(!r.some((c) => /email|ip|lat|lon|utente|telefono/.test(c.column_name)), "nelle tabelle non c’è niente che identifichi una persona (email, indirizzo, posizione, account)", r.map((c) => c.column_name));
r = await q(`select impronta from public.comitiva_posti limit 1`);
check(/^[0-9a-f]{64}$/.test(r[0].impronta) && !r[0].impronta.includes("segreto"), "del segreto di chi è seduto c’è solo l’impronta", r[0]);

console.log(process.exitCode ? "\nQUALCOSA NON VA" : "\nTutto a posto");
