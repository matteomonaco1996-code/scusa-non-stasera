// Chi può crearsi un accesso alla pagina di monitoraggio (supabase/accesso_monitoraggio.sql), su un database di prova.
//   node test_accesso.mjs <statistiche.sql> <accesso_monitoraggio.sql>
import { PGlite } from "./_pglite.mjs";
import fs from "node:fs";
const db = new PGlite();
let falliti = 0;
const ok = (m) => console.log("  ✓", m), ko = (m) => { console.log("  ✗", m); falliti++; };
const check = (c, m, x) => (c ? ok(m) : ko(m + " → " + JSON.stringify(x)));
const q = async (s) => (await db.query(s)).rows;
async function deveFallire(sql, m) { try { await db.exec(sql); ko(m + " (doveva fallire)"); } catch (e) { ok(m + " → " + e.message.split("\n")[0].slice(0, 80)); } }
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role supabase_auth_admin nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text unique, email_confirmed_at timestamptz, encrypted_password text, created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated, supabase_auth_admin;
  grant all on auth.users to supabase_auth_admin;
  grant execute on function auth.uid() to anon, authenticated;
`);
await db.exec(fs.readFileSync(process.argv[2], "utf8")); ok("statistiche.sql eseguito");
const sql = fs.readFileSync(process.argv[3], "utf8");
await db.exec(sql); ok("accesso_monitoraggio.sql eseguito");
await db.exec(sql); ok("accesso_monitoraggio.sql rieseguibile");
const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222", C = "33333333-3333-3333-3333-333333333333", D = "44444444-4444-4444-4444-444444444444";
const come = async (uid, ruolo) => db.exec(`reset role; select set_config('test.uid', '${uid}', false); set role ${ruolo};`);
const admin = async () => { await come("", "postgres"); return (await q(`select email from public.amministratori order by 1`)).map((r) => r.email); };

console.log("Prima che esista un amministratore");
await come("", "supabase_auth_admin");   // è il servizio di accesso a scrivere in auth.users, non l'utente
await db.exec(`insert into auth.users (id, email) values ('${A}', 'Uno@Example.org')`);
await db.exec(`insert into auth.users (id, email) values ('${B}', 'due@example.org')`);
check((await admin()).length === 0, "due registrazioni non confermate: nessuno è ancora amministratore", await admin());
await come(A, "authenticated");
check((await q(`select public.sono_admin() as s`))[0].s === false, "chi non ha confermato l'email non è amministratore");
await deveFallire(`select public.statistiche(30)`, "…e non legge i numeri");

console.log("La prima conferma");
await come("", "supabase_auth_admin");
await db.exec(`update auth.users set email_confirmed_at = now() where id = '${B}'`);
check(JSON.stringify(await admin()) === JSON.stringify(["due@example.org"]), "chi conferma per primo diventa l'amministratore", await admin());
await come("", "supabase_auth_admin");
await db.exec(`update auth.users set email_confirmed_at = now() where id = '${A}'`);
check(JSON.stringify(await admin()) === JSON.stringify(["due@example.org"]), "chi conferma dopo NON diventa amministratore", await admin());
await come(B, "authenticated");
check((await q(`select public.sono_admin() as s`))[0].s === true, "l'amministratore è riconosciuto");
check(!!(await q(`select public.statistiche(30) as j`))[0].j, "…e legge i numeri");
await come(A, "authenticated");
check((await q(`select public.sono_admin() as s`))[0].s === false, "l'altro, anche se confermato, resta fuori");
await deveFallire(`select public.statistiche(30)`, "…e non legge i numeri");

console.log("Dopo: registrazioni chiuse");
await come("", "supabase_auth_admin");
await deveFallire(`insert into auth.users (id, email) values ('${C}', 'tre@example.org')`, "un'altra email non può più registrarsi");
await deveFallire(`insert into auth.users (id, email, email_confirmed_at) values ('${D}', 'quattro@example.org', now())`, "nemmeno arrivando già confermata");
check((await q(`select count(*)::int as n from auth.users`))[0].n === 2, "in auth.users restano solo i due di prima");
await come("", "postgres");
await db.exec(`insert into public.amministratori (email) values ('tre@example.org')`);
await come("", "supabase_auth_admin");
await db.exec(`insert into auth.users (id, email) values ('${C}', 'Tre@Example.org')`);
ok("un'email aggiunta a mano all'elenco può registrarsi (anche scritta con le maiuscole)");
check(JSON.stringify(await admin()) === JSON.stringify(["due@example.org", "tre@example.org"]), "l'elenco è quello atteso", await admin());

console.log("Dal browser");
await come("", "anon");
await deveFallire(`select public.solo_amministratori()`, "le funzioni interne non si chiamano dal browser");
await deveFallire(`select * from public.amministratori`, "l'elenco degli amministratori non si legge");
await deveFallire(`insert into public.amministratori (email) values ('io@example.org')`, "…e non ci si aggiunge da soli");
await come(A, "authenticated");
await deveFallire(`insert into public.amministratori (email) values ('uno@example.org')`, "nemmeno da utente registrato");
console.log(falliti ? `\n${falliti} controlli falliti` : "\nTutto a posto");
process.exitCode = falliti ? 1 : 0;
