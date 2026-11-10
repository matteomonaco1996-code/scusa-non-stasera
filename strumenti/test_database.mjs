// Test di sicurezza del database (Row Level Security, punti, missioni, diritti GDPR).
// Usa PGlite (Postgres in WebAssembly) con un finto schema "auth" di Supabase.
// Come lanciarlo, dalla cartella ristomat/:
//   npm install --no-save @electric-sql/pglite@0.5.16
//   node strumenti/test_database.mjs supabase/schema.sql supabase/luoghi.sql

import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
const db = new PGlite();
const ok = (m) => console.log("  ✓", m), ko = (m) => { console.log("  ✗", m); process.exitCode = 1; };
async function expectFail(sql, msg) { try { await db.exec(sql); ko(msg + " (doveva fallire)"); } catch (e) { ok(msg + " → " + e.message.split("\n")[0].slice(0, 80)); } }
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, created_at timestamptz default now(), last_sign_in_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
await db.exec(fs.readFileSync(process.argv[2], "utf8"));
ok("schema.sql eseguito");
const seed = fs.readFileSync(process.argv[3], "utf8");
await db.exec(seed); ok("luoghi.sql eseguito: " + (await db.query("select count(*)::int n from public.luoghi")).rows[0].n + " posti");
await db.exec(seed); ok("luoghi.sql rieseguibile (upsert)");
const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222";
await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@example.org'), ('${B}', 'b@example.org');`);
const as = async (uid, role = "authenticated") => db.exec(`reset role; select set_config('test.uid', '${uid}', false); set role ${role};`);
const q = async (sql) => (await db.query(sql)).rows;

console.log("Utente A");
await as(A);
await expectFail(`insert into public.profili (id, nickname, eta_confermata, termini_versione, privacy_versione) values ('${B}', 'furbo', true, '1', '1')`, "non può creare il profilo di un altro");
await expectFail(`insert into public.profili (id, nickname, eta_confermata, termini_versione, privacy_versione) values ('${A}', 'matteo', false, '1', '1')`, "senza conferma dei 14 anni non si entra");
await expectFail(`insert into public.profili (id, nickname, eta_confermata, termini_versione, privacy_versione) values ('${A}', 'a b<script>', true, '1', '1')`, "nickname con caratteri non ammessi");
await db.exec(`insert into public.profili (id, nickname, eta_confermata, termini_versione, privacy_versione) values ('${A}', 'matteo', true, '1.0', '1.0')`); ok("profilo creato");
await expectFail(`update public.profili set eta_confermata = true, creato = now() where id = '${A}'`, "non può modificare campi protetti");
await db.exec(`update public.profili set in_classifica = true where id = '${A}'`); ok("può attivare la classifica");
await expectFail(`insert into public.visite (utente, luogo) values ('${A}', '1630696637701112352')`, "non può scriversi visite da solo");
let r = await q(`select public.fai_checkin('1630696637701112352', 41.9200, 12.4566) j`); // ~1 km da Cosetta
r[0].j.ok === false ? ok("check-in lontano rifiutato (" + r[0].j.metri + " m)") : ko("check-in lontano accettato");
r = await q(`select public.fai_checkin('1630696637701112352', 41.91110, 12.45670) j`);
r[0].j.ok && r[0].j.nuovo ? ok("check-in vicino accettato, punti " + r[0].j.punti) : ko("check-in vicino " + JSON.stringify(r[0].j));
r = await q(`select public.fai_checkin('1630696637701112352', 41.91110, 12.45670) j`);
r[0].j.ok && !r[0].j.nuovo ? ok("secondo check-in nello stesso giorno: nessun punto in più (" + r[0].j.punti + ")") : ko("doppio check-in " + JSON.stringify(r[0].j));
await expectFail(`select public.scrivi_recensione('17842119051975066523', 5, 'mai stato', '', '{}')`, "recensione senza check-in rifiutata");
r = await q(`select public.scrivi_recensione('1630696637701112352', 4, 'Un po'' radical, ma ci torni', 'Carbonara da prendere senza pensarci; il venerdì conviene prenotare perché è piccolo.', array['da prenotare','dopocena']) j`);
ok("recensione stile nota dopo check-in, punti " + r[0].j.punti + " (10+20+5+10 + missioni 15+15)");
await expectFail(`select public.scrivi_recensione('1630696637701112352', 9, 'x', '', '{}')`, "voto fuori scala");
await expectFail(`select public.scrivi_recensione('1630696637701112352', 4, 'x', '', array['inventata'])`, "etichetta non ammessa");
await expectFail(`select public.scrivi_recensione('1630696637701112352', 4, repeat('x', 121), '', '{}')`, "com'è troppo lungo");
r = (await q(`select public.mio_punteggio() j`))[0].j.missioni;
ok("missioni via mio_punteggio: " + r.filter(m => m.fatta).map(m => m.codice + "+" + m.bonus).join(", ") + " · da fare: " + r.filter(m => !m.fatta).length);
r = await q(`select public.mio_punteggio() j`); ok("mio_punteggio: " + JSON.stringify(r[0].j).slice(0, 120));
r = await q(`select * from public.recensioni_pubbliche`); r.length === 1 && r[0].nickname === "matteo" && !("utente" in r[0]) && r[0].dritta.startsWith("Carbonara") ? ok("recensione pubblica senza id utente, con com'è/dritta/etichette") : ko(JSON.stringify(r));
r = await q(`select public.fai_checkin('17842119051975066523', 41.86491, 12.47174) j`);
ok("secondo posto (altro quartiere) → punti " + r[0].j.punti);

console.log("Utente B");
await as(B);
r = await q(`select * from public.profili`); r.length === 0 ? ok("non vede il profilo di A") : ko("vede " + r.length + " profili");
r = await q(`select * from public.visite`); r.length === 0 ? ok("non vede le visite di A") : ko("vede visite");
r = await q(`select * from public.recensioni`); r.length === 0 ? ok("non vede le recensioni di A nella tabella privata") : ko("vede recensioni");
await expectFail(`select public.fai_checkin('1630696637701112352', 41.91110, 12.45670)`, "check-in senza profilo");
await db.exec(`insert into public.profili (id, nickname, eta_confermata, termini_versione, privacy_versione) values ('${B}', 'gaia', true, '1.0', '1.0')`);
const rid = (await q(`select id from public.recensioni_pubbliche`))[0].id;
await db.exec(`insert into public.segnalazioni (recensione, segnalante, motivo) values (${rid}, '${B}', 'offensiva')`); ok("può segnalare una recensione");
await expectFail(`insert into public.segnalazioni (recensione, segnalante, motivo) values (${rid}, '${A}', 'spam')`, "non può segnalare a nome di altri");
await expectFail(`select * from public.segnalazioni`, "non legge le segnalazioni");
r = await q(`select * from public.classifica()`); r.length === 1 && r[0].nickname === "matteo" ? ok("classifica mostra solo chi ha aderito: " + JSON.stringify(r[0])) : ko(JSON.stringify(r));

console.log("Visitatore anonimo");
await as("", "anon");
r = await q(`select count(*)::int n from public.luoghi`); ok("vede i luoghi: " + r[0].n);
r = await q(`select * from public.valutazioni`); ok("vede le medie: " + JSON.stringify(r));
await expectFail(`select * from public.profili`, "non vede i profili");
await expectFail(`select public.mio_punteggio()`, "non può chiamare funzioni da utente");
await expectFail(`select public.calcola_punti('${A}')`, "non può calcolare i punti di altri");
await expectFail(`select * from public.missioni('${A}')`, "non può leggere le missioni di altri");
r = await q(`select * from public.classifica()`); ok("vede la classifica pubblica");

console.log("Diritti GDPR (utente A)");
await as(A);
r = await q(`select public.esporta_dati() j`); const e = r[0].j;
e.account.email === "a@example.org" && e.visite.length === 2 && e.recensioni.length === 1 && e.recensioni[0].dritta ? ok("esporta_dati completo (" + JSON.stringify(e).length + " byte)") : ko(JSON.stringify(e));
await db.exec(`select public.elimina_account()`);
await as(A, "postgres");
r = await q(`select (select count(*) from auth.users where id='${A}')::int u, (select count(*) from public.profili where id='${A}')::int p, (select count(*) from public.visite where utente='${A}')::int v, (select count(*) from public.recensioni where utente='${A}')::int r, (select count(*) from public.segnalazioni)::int s`);
const c = r[0]; c.u + c.p + c.v + c.r === 0 && c.s === 0 ? ok("elimina_account: account, profilo, visite, recensioni (e relative segnalazioni) cancellati") : ko(JSON.stringify(c));
