// Test dei contatori anonimi e della pagina di monitoraggio (supabase/statistiche.sql).
// Usa PGlite (Postgres in WebAssembly) con un finto schema "auth" di Supabase.
// Come lanciarlo, dalla cartella del sito:
//   npm install --no-save @electric-sql/pglite@0.5.16
//   node strumenti/test_statistiche.mjs supabase/schema.sql supabase/statistiche.sql

import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
const db = new PGlite();
const ok = (m) => console.log("  ✓", m), ko = (m) => { console.log("  ✗", m); process.exitCode = 1; };
const check = (cond, m, extra) => (cond ? ok(m) : ko(m + " → " + JSON.stringify(extra)));
async function expectFail(sql, msg) { try { await db.exec(sql); ko(msg + " (doveva fallire)"); } catch (e) { ok(msg + " → " + e.message.split("\n")[0].slice(0, 70)); } }
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, created_at timestamptz default now(), last_sign_in_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
await db.exec(fs.readFileSync(process.argv[2], "utf8")); ok("schema.sql eseguito");
const sql = fs.readFileSync(process.argv[3], "utf8");
await db.exec(sql); ok("statistiche.sql eseguito");
await db.exec(sql); ok("statistiche.sql rieseguibile");

const CAPO = "11111111-1111-1111-1111-111111111111", ALTRO = "22222222-2222-2222-2222-222222222222", FINTO = "33333333-3333-3333-3333-333333333333";
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values
  ('${CAPO}', 'Capo@Example.org', now()), ('${ALTRO}', 'altro@example.org', now()), ('${FINTO}', 'capo2@example.org', null);
  insert into public.amministratori (email) values ('capo@example.org'), ('capo2@example.org');`);
const as = async (uid, role = "authenticated") => db.exec(`reset role; select set_config('test.uid', '${uid}', false); set role ${role};`);
const q = async (s) => (await db.query(s)).rows;
const totale = async () => { await as("", "postgres"); return q(`select evento, n from public.contatori order by evento`); };

console.log("Visitatore anonimo");
await as("", "anon");
await db.exec(`select public.conta(array['visita', 'da_instagram'])`);
await db.exec(`select public.conta(array['visita'])`);
await db.exec(`select public.conta(array['visita', 'visita', 'visita'])`);
await db.exec(`select public.conta(array['inventato', 'visita''; drop table contatori; --'])`);
await db.exec(`select public.conta(array['a','b','c','d','e','f','visita'])`);   // più di 6: scartato tutto
await db.exec(`select public.conta(null)`);
await expectFail(`select * from public.contatori`, "non legge i contatori");
await expectFail(`insert into public.contatori values (current_date, 'visita', 99999)`, "non scrive nei contatori a mano");
await expectFail(`update public.contatori set n = 0`, "non azzera i contatori");
await expectFail(`select public.statistiche(30)`, "non legge le statistiche");
await expectFail(`select public.registra_donazione(current_date, 5)`, "non registra donazioni");
await expectFail(`select * from public.amministratori`, "non vede chi gestisce il sito");
await expectFail(`select * from public.donazioni_ricevute`, "non vede le donazioni");
let r = await totale();
check(r.length === 2 && r.find((x) => x.evento === "visita").n === 3 && r.find((x) => x.evento === "da_instagram").n === 1,
  "conta solo gli eventi ammessi, uno per chiamata anche se ripetuto", r);
r = await q(`select count(*)::int n from information_schema.columns where table_schema = 'public' and table_name = 'contatori'`);
check(r[0].n === 3, "la tabella dei contatori ha solo giorno, evento e numero: niente su chi ha visitato", r);

console.log("Utente qualunque (con accesso, non amministratore)");
await as(ALTRO);
await db.exec(`select public.conta(array['gettone'])`); ok("può contare come tutti");
r = await q(`select public.sono_admin() a`); check(r[0].a === false, "non è amministratore", r);
await expectFail(`select public.statistiche(30)`, "non legge le statistiche");
await expectFail(`select public.registra_donazione(current_date, 5)`, "non registra donazioni");
await expectFail(`select public.elimina_donazione(1)`, "non elimina donazioni");
await expectFail(`insert into public.amministratori values ('altro@example.org')`, "non può farsi amministratore");

console.log("Email da amministratore ma mai confermata");
await as(FINTO);
r = await q(`select public.sono_admin() a`); check(r[0].a === false, "non basta avere l'email giusta: va confermata", r);
await expectFail(`select public.statistiche(30)`, "non legge le statistiche");

console.log("Chi gestisce il sito");
await as(CAPO);
r = await q(`select public.sono_admin() a`); check(r[0].a === true, "riconosciuto (anche se l'email ha maiuscole diverse)", r);
r = (await q(`select public.statistiche(30) j`))[0].j;
check(r.contatori.length === 3 && r.contatori.every((c) => c.g && c.e && c.n > 0) && Array.isArray(r.donazioni) && r.donazioni.length === 0 && /^\d{4}-\d\d-\d\d$/.test(r.oggi),
  "legge i contatori: " + JSON.stringify(r.contatori), r);
const id = (await q(`select public.registra_donazione(current_date, 5.005) id`))[0].id;
await db.exec(`select public.registra_donazione(current_date - 1, 2)`);
await expectFail(`select public.registra_donazione(current_date, -1)`, "importo negativo rifiutato");
await expectFail(`select public.registra_donazione(current_date, 20000)`, "importo assurdo rifiutato");
await expectFail(`select public.registra_donazione(current_date + 10, 5)`, "data nel futuro rifiutata");
r = (await q(`select public.statistiche(30) j`))[0].j;
check(r.donazioni.length === 2 && Number(r.donazioni[0].euro) === 5.01 && Number(r.donazioni[1].euro) === 2, "donazioni registrate, la più recente per prima, arrotondate al centesimo", r.donazioni);
await db.exec(`select public.elimina_donazione(${id})`);
r = (await q(`select public.statistiche(30) j`))[0].j;
check(r.donazioni.length === 1, "donazione eliminata", r.donazioni);
r = await q(`select count(*)::int n from information_schema.columns where table_schema = 'public' and table_name = 'donazioni_ricevute' and column_name not in ('id', 'giorno', 'euro', 'creato')`);
check(r[0].n === 0, "delle donazioni si salvano solo giorno e importo: nessun nome", r);

console.log(process.exitCode ? "\nQUALCOSA NON VA" : "\nTutto a posto");
