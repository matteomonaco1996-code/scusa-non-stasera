-- =====================================================================
-- Scusa, non stasera — database su Supabase (regione UE)
-- Come usarlo: Supabase → SQL Editor → incolla tutto → Run.
-- Poi esegui supabase/luoghi.sql (i posti della lista).
--
-- Principi:
--  * dati minimi: email (gestita da Supabase Auth), nickname, visite (posto + giorno),
--    recensioni, segnalazioni. Nessuna coordinata GPS viene salvata.
--  * il browser NON scrive mai punti o visite: passa solo dalle funzioni qui sotto,
--    che controllano posizione, limiti e regole.
--  * Row Level Security su tutte le tabelle: ognuno vede solo i propri dati;
--    in pubblico escono solo recensioni pubblicate, medie dei voti e la classifica
--    di chi ha scelto di comparire.
-- =====================================================================

-- ---------- Tabelle ----------

create table if not exists public.luoghi (
  id          text primary key,              -- identificativo stabile (CID di Google Maps)
  nome        text not null,
  lat         double precision not null,
  lon         double precision not null,
  quartiere   text,                          -- solo per Roma
  citta       text,
  aggiornato  timestamptz not null default now()
);

create table if not exists public.profili (
  id               uuid primary key references auth.users (id) on delete cascade,
  nickname         text not null unique check (nickname ~ '^[A-Za-z0-9_.-]{3,20}$'),
  in_classifica    boolean not null default false,   -- consenso alla classifica pubblica
  eta_confermata   boolean not null check (eta_confermata),  -- almeno 14 anni
  termini_versione text not null,
  privacy_versione text not null,
  creato           timestamptz not null default now(),
  ultimo_accesso   date not null default current_date
);

create table if not exists public.visite (
  id      bigint generated always as identity primary key,
  utente  uuid not null references public.profili (id) on delete cascade,
  luogo   text not null references public.luoghi (id) on delete cascade,
  giorno  date not null default current_date,      -- solo il giorno, niente ora né posizione
  unique (utente, luogo, giorno)
);
create index if not exists visite_utente on public.visite (utente);

create table if not exists public.recensioni (
  id          bigint generated always as identity primary key,
  utente      uuid not null references public.profili (id) on delete cascade,
  luogo       text not null references public.luoghi (id) on delete cascade,
  voto        smallint not null check (voto between 1 and 5),
  testo       text not null default '' check (char_length(testo) <= 600),
  stato       text not null default 'pubblicata' check (stato in ('pubblicata', 'nascosta')),
  creata      timestamptz not null default now(),
  modificata  timestamptz,
  unique (utente, luogo)
);
create index if not exists recensioni_luogo on public.recensioni (luogo) where stato = 'pubblicata';

-- Segnalazioni di recensioni (Digital Services Act: meccanismo di notifica e azione)
create table if not exists public.segnalazioni (
  id                bigint generated always as identity primary key,
  recensione        bigint not null references public.recensioni (id) on delete cascade,
  segnalante        uuid references public.profili (id) on delete set null,
  motivo            text not null check (motivo in ('falsa', 'offensiva', 'dati_personali', 'spam', 'illegale', 'altro')),
  dettagli          text check (char_length(dettagli) <= 500),
  creata            timestamptz not null default now(),
  gestita           timestamptz,
  esito             text check (esito in ('rimossa', 'mantenuta')),
  motivazione_esito text,
  unique (recensione, segnalante)
);

-- ---------- Accessi: si parte da zero e si apre solo il necessario ----------

alter table public.luoghi       enable row level security;
alter table public.profili      enable row level security;
alter table public.visite       enable row level security;
alter table public.recensioni   enable row level security;
alter table public.segnalazioni enable row level security;

revoke all on public.luoghi, public.profili, public.visite, public.recensioni, public.segnalazioni from anon, authenticated;

grant select on public.luoghi to anon, authenticated;
grant select, insert on public.profili to authenticated;
grant update (nickname, in_classifica, ultimo_accesso) on public.profili to authenticated;
grant select on public.visite to authenticated;
grant select, delete on public.recensioni to authenticated;
grant insert (recensione, segnalante, motivo, dettagli) on public.segnalazioni to authenticated;

drop policy if exists "luoghi pubblici" on public.luoghi;
create policy "luoghi pubblici" on public.luoghi for select using (true);

drop policy if exists "profilo: lettura propria" on public.profili;
create policy "profilo: lettura propria" on public.profili for select to authenticated using (id = auth.uid());
drop policy if exists "profilo: creazione propria" on public.profili;
create policy "profilo: creazione propria" on public.profili for insert to authenticated with check (id = auth.uid());
drop policy if exists "profilo: modifica propria" on public.profili;
create policy "profilo: modifica propria" on public.profili for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "visite: lettura propria" on public.visite;
create policy "visite: lettura propria" on public.visite for select to authenticated using (utente = auth.uid());

drop policy if exists "recensioni: lettura propria" on public.recensioni;
create policy "recensioni: lettura propria" on public.recensioni for select to authenticated using (utente = auth.uid());
drop policy if exists "recensioni: eliminazione propria" on public.recensioni;
create policy "recensioni: eliminazione propria" on public.recensioni for delete to authenticated using (utente = auth.uid());

drop policy if exists "segnalazioni: invio" on public.segnalazioni;
create policy "segnalazioni: invio" on public.segnalazioni for insert to authenticated with check (segnalante = auth.uid());

-- ---------- Viste pubbliche (solo ciò che è pensato per essere pubblico) ----------

create or replace view public.recensioni_pubbliche as
  select r.id, r.luogo, r.voto, r.testo, r.creata, p.nickname
  from public.recensioni r join public.profili p on p.id = r.utente
  where r.stato = 'pubblicata';

create or replace view public.valutazioni as
  select luogo, count(*)::int as n, round(avg(voto)::numeric, 1) as media
  from public.recensioni where stato = 'pubblicata' group by luogo;

revoke all on public.recensioni_pubbliche, public.valutazioni from anon, authenticated;
grant select on public.recensioni_pubbliche, public.valutazioni to anon, authenticated;

-- ---------- Punti: calcolati solo qui ----------
-- +10 primo check-in in un posto · +2 check-in ripetuto (altro giorno, max 5 per posto)
-- +20 primo posto in un nuovo quartiere (o località) · +5 recensione · +10 se il testo ha almeno 80 caratteri
-- Livello: uno ogni 100 punti.

create or replace function public.calcola_punti(u uuid)
returns integer language sql stable security definer set search_path = public as $$
  select (
    coalesce((select sum(10 + 2 * least(n - 1, 5)) from (
      select count(*) as n from public.visite where utente = u group by luogo) v), 0)
  + coalesce((select 20 * count(distinct coalesce(l.quartiere, l.citta))
      from public.visite v join public.luoghi l on l.id = v.luogo where v.utente = u), 0)
  + coalesce((select sum(5 + case when char_length(testo) >= 80 then 10 else 0 end)
      from public.recensioni where utente = u and stato = 'pubblicata'), 0)
  )::int
$$;

create or replace function public.mio_punteggio()
returns json language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid(); p int;
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  p := public.calcola_punti(u);
  return json_build_object(
    'punti', p,
    'livello', 1 + p / 100,
    'visite', coalesce((select json_agg(json_build_object('luogo', luogo, 'giorno', giorno) order by giorno desc)
                        from public.visite where utente = u), '[]'::json),
    'recensioni', coalesce((select json_agg(luogo) from public.recensioni where utente = u), '[]'::json)
  );
end $$;

create or replace function public.classifica()
returns table (nickname text, punti int, livello int) language sql stable security definer set search_path = public as $$
  select p.nickname, public.calcola_punti(p.id), 1 + public.calcola_punti(p.id) / 100
  from public.profili p where p.in_classifica
  order by 2 desc, p.creato asc limit 50
$$;

-- ---------- Azioni di gioco ----------

-- Check-in: il browser manda la posizione del momento; il server controlla la distanza
-- dal posto e la scarta subito. Si salvano solo posto e giorno.
create or replace function public.fai_checkin(p_luogo text, p_lat double precision, p_lon double precision)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  l public.luoghi%rowtype;
  metri double precision;
  nuovo boolean;
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  if not exists (select 1 from public.profili where id = u) then raise exception 'Completa il profilo'; end if;
  if p_lat is null or p_lon is null or abs(p_lat) > 90 or abs(p_lon) > 180 then raise exception 'Posizione non valida'; end if;
  if (select count(*) from public.visite where utente = u and giorno = current_date) >= 15 then
    raise exception 'Hai già fatto 15 check-in oggi: riprova domani';
  end if;
  select * into l from public.luoghi where id = p_luogo;
  if not found then raise exception 'Posto sconosciuto'; end if;
  metri := 2 * 6371000 * asin(sqrt(
    power(sin(radians(p_lat - l.lat) / 2), 2) +
    cos(radians(l.lat)) * cos(radians(p_lat)) * power(sin(radians(p_lon - l.lon) / 2), 2)));
  if metri > 150 then
    return json_build_object('ok', false, 'metri', round(metri));
  end if;
  insert into public.visite (utente, luogo, giorno) values (u, p_luogo, current_date)
    on conflict do nothing;
  get diagnostics nuovo = row_count;
  update public.profili set ultimo_accesso = current_date where id = u;
  return json_build_object('ok', true, 'nuovo', nuovo, 'punti', public.calcola_punti(u));
end $$;

-- Recensione: solo dopo almeno un check-in nel posto (recensioni verificate).
create or replace function public.scrivi_recensione(p_luogo text, p_voto int, p_testo text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare u uuid := auth.uid(); t text := btrim(coalesce(p_testo, ''));
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  if not exists (select 1 from public.visite where utente = u and luogo = p_luogo) then
    raise exception 'Prima fai check-in in questo posto';
  end if;
  if p_voto is null or p_voto not between 1 and 5 then raise exception 'Il voto va da 1 a 5'; end if;
  if char_length(t) > 600 then raise exception 'Massimo 600 caratteri'; end if;
  if (select count(*) from public.recensioni where utente = u and creata > now() - interval '1 day') >= 10 then
    raise exception 'Massimo 10 recensioni al giorno';
  end if;
  insert into public.recensioni (utente, luogo, voto, testo) values (u, p_luogo, p_voto, t)
  on conflict (utente, luogo) do update set voto = excluded.voto, testo = excluded.testo, modificata = now();
  return json_build_object('ok', true, 'punti', public.calcola_punti(u));
end $$;

-- ---------- Diritti GDPR self-service ----------

-- Portabilità/accesso (art. 15 e 20): tutti i dati dell'utente in JSON.
create or replace function public.esporta_dati()
returns json language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  return json_build_object(
    'esportato', now(),
    'account', (select json_build_object('id', id, 'email', email, 'creato', created_at, 'ultimo_login', last_sign_in_at)
                from auth.users where id = u),
    'profilo', (select row_to_json(p) from public.profili p where p.id = u),
    'visite', coalesce((select json_agg(json_build_object('luogo', v.luogo, 'nome', l.nome, 'giorno', v.giorno) order by v.giorno)
                        from public.visite v join public.luoghi l on l.id = v.luogo where v.utente = u), '[]'::json),
    'recensioni', coalesce((select json_agg(json_build_object('luogo', r.luogo, 'voto', r.voto, 'testo', r.testo,
                        'stato', r.stato, 'creata', r.creata, 'modificata', r.modificata))
                        from public.recensioni r where r.utente = u), '[]'::json),
    'segnalazioni_inviate', coalesce((select json_agg(json_build_object('recensione', s.recensione, 'motivo', s.motivo,
                        'creata', s.creata, 'esito', s.esito)) from public.segnalazioni s where s.segnalante = u), '[]'::json),
    'punti', public.calcola_punti(u)
  );
end $$;

-- Cancellazione (art. 17): elimina l'account e, a cascata, profilo, visite e recensioni.
create or replace function public.elimina_account()
returns void language plpgsql volatile security definer set search_path = public, auth as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Accesso richiesto'; end if;
  delete from auth.users where id = u;
end $$;

-- Le funzioni non sono eseguibili da chiunque per default: si apre solo il necessario.
revoke execute on function public.calcola_punti(uuid) from public, anon, authenticated;
revoke execute on function public.mio_punteggio(), public.fai_checkin(text, double precision, double precision),
  public.scrivi_recensione(text, int, text), public.esporta_dati(), public.elimina_account(), public.classifica()
  from public, anon;
grant execute on function public.mio_punteggio(), public.fai_checkin(text, double precision, double precision),
  public.scrivi_recensione(text, int, text), public.esporta_dati(), public.elimina_account() to authenticated;
grant execute on function public.classifica() to anon, authenticated;

-- ---------- Conservazione (attiva pg_cron in Database → Extensions, poi togli i commenti) ----------
-- Account inattivi da 24 mesi e iscrizioni mai completate da 30 giorni vengono eliminati.
-- select cron.schedule('pulizia-account', '17 4 * * 1', $$
--   delete from auth.users u where
--     exists (select 1 from public.profili p where p.id = u.id and p.ultimo_accesso < current_date - interval '24 months')
--     or (not exists (select 1 from public.profili p where p.id = u.id) and u.created_at < now() - interval '30 days');
--   delete from public.segnalazioni where gestita < now() - interval '12 months';
-- $$);
