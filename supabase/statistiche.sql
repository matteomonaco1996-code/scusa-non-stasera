-- =====================================================================
-- Scusa, non stasera — contatori anonimi e pagina di monitoraggio
-- Come usarlo: dopo schema.sql. Supabase → SQL Editor → incolla tutto → Run.
-- Poi, UNA volta, dì al database chi può leggere i numeri (l'email con cui entri nel sito):
--     insert into public.amministratori (email) values ('la-tua-email@esempio.it');
--
-- Principi:
--  * si salva solo un numero per giorno e per tipo di evento ("oggi 42 visite"):
--    niente indirizzi IP, niente identificativi, niente cookie, nessun legame con gli account;
--  * il browser può solo AGGIUNGERE uno a un contatore tra quelli ammessi qui sotto;
--  * i numeri li legge solo chi è in "amministratori", dopo l'accesso;
--  * i soldi non passano dal sito: le donazioni ricevute le annota a mano chi gestisce il sito,
--    copiandole da PayPal (solo giorno e importo, mai il nome di chi ha donato).
-- =====================================================================

create table if not exists public.contatori (
  giorno  date    not null,
  evento  text    not null,
  n       integer not null default 0 check (n >= 0),
  primary key (giorno, evento)
);

create table if not exists public.amministratori (
  email text primary key check (email = lower(email) and position('@' in email) > 1)
);

create table if not exists public.donazioni_ricevute (
  id      bigint generated always as identity primary key,
  giorno  date not null check (giorno >= date '2026-01-01' and giorno <= current_date + 1),
  euro    numeric(8,2) not null check (euro > 0 and euro <= 10000),
  creato  timestamptz not null default now()
);

alter table public.contatori          enable row level security;
alter table public.amministratori     enable row level security;
alter table public.donazioni_ricevute enable row level security;
-- Nessuna regola di accesso e nessun permesso: dal browser queste tabelle non si leggono né si scrivono.
-- Si passa solo dalle funzioni qui sotto.
revoke all on public.contatori, public.amministratori, public.donazioni_ricevute from anon, authenticated;

-- ---------- Contare (chiunque, senza accesso) ----------
-- Gli eventi ammessi. Qualsiasi altro nome viene ignorato in silenzio.
create or replace function public.eventi_ammessi() returns text[]
language sql immutable as $$
  select array[
    'visita', 'termini_ok',
    'da_diretto', 'da_google', 'da_instagram', 'da_facebook', 'da_whatsapp', 'da_tiktok', 'da_telegram',
    'da_qr', 'da_volantino', 'da_amici', 'da_altro',
    'start', 'posizione_si', 'posizione_no', 'livello', 'gettone',
    'portami', 'vai', 'maps',
    'dona_apri', 'dona_1', 'dona_2', 'dona_5', 'dona_altro'
  ]
$$;

create or replace function public.conta(p_eventi text[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  e text;
  oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if p_eventi is null or coalesce(array_length(p_eventi, 1), 0) > 6 then return; end if;
  for e in select distinct x from unnest(p_eventi) x where x = any (public.eventi_ammessi()) loop
    insert into public.contatori (giorno, evento, n) values (oggi, e, 1)
    on conflict (giorno, evento) do update set n = public.contatori.n + 1 where public.contatori.n < 1000000;
  end loop;
end $$;

-- ---------- Leggere (solo chi gestisce il sito) ----------
create or replace function public.sono_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from auth.users u join public.amministratori a on a.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
  )
$$;

create or replace function public.statistiche(p_giorni int default 180) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  oggi date := (now() at time zone 'Europe/Rome')::date;
  dal  date := oggi - least(greatest(coalesce(p_giorni, 180), 1), 400);
begin
  if not public.sono_admin() then raise exception 'riservato a chi gestisce il sito' using errcode = '42501'; end if;
  return json_build_object(
    'oggi', oggi,
    'contatori', (select coalesce(json_agg(json_build_object('g', giorno, 'e', evento, 'n', n) order by giorno, evento), '[]'::json)
                  from public.contatori where giorno >= dal),
    'donazioni', (select coalesce(json_agg(json_build_object('id', id, 'g', giorno, 'euro', euro) order by giorno desc, id desc), '[]'::json)
                  from public.donazioni_ricevute)
  );
end $$;

create or replace function public.registra_donazione(p_giorno date, p_euro numeric) returns bigint
language plpgsql security definer set search_path = public as $$
declare nuovo bigint;
begin
  if not public.sono_admin() then raise exception 'riservato a chi gestisce il sito' using errcode = '42501'; end if;
  insert into public.donazioni_ricevute (giorno, euro) values (p_giorno, round(p_euro, 2)) returning id into nuovo;
  return nuovo;
end $$;

create or replace function public.elimina_donazione(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.sono_admin() then raise exception 'riservato a chi gestisce il sito' using errcode = '42501'; end if;
  delete from public.donazioni_ricevute where id = p_id;
end $$;

-- Le funzioni non sono eseguibili da chiunque per default: si apre solo il necessario.
revoke execute on function public.eventi_ammessi(), public.conta(text[]), public.sono_admin(), public.statistiche(int),
  public.registra_donazione(date, numeric), public.elimina_donazione(bigint) from public, anon, authenticated;
grant execute on function public.conta(text[]) to anon, authenticated;
grant execute on function public.sono_admin(), public.statistiche(int),
  public.registra_donazione(date, numeric), public.elimina_donazione(bigint) to authenticated;

-- ---------- Conservazione ----------
-- I contatori sono numeri e non riguardano nessuno: si possono tenere. Se vuoi comunque sfoltire quelli
-- più vecchi di due anni, con pg_cron attivo:
-- select cron.schedule('pulizia-contatori', '27 4 1 * *', $$ delete from public.contatori where giorno < current_date - interval '24 months' $$);
