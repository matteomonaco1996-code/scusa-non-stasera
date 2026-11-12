-- =====================================================================
-- Scusa, non stasera — comitive: tavoli di amici, senza account
-- Come usarlo: dopo schema.sql e statistiche.sql. Supabase → SQL Editor → incolla tutto → Run.
-- Poi in config.js metti  comitive: true  (vedi LEGALE_E_SICUREZZA.md: prima vanno aggiornati privacy e termini).
--
-- Principi:
--  * una comitiva è un tavolo da 1 a 8 posti: un nome, chi è seduto, i posti da provare con i voti, i posti fatti;
--  * si entra con un link che contiene la chiave della comitiva: chi ha il link vede solo il nome e quanti
--    sono a tavola, e può sedersi se c'è un posto libero;
--  * chi si siede riceve un segreto che resta sul suo telefono: serve per vedere la tavola, votare, aggiungere
--    posti, alzarsi. Nel database del segreto c'è solo l'impronta (sha256);
--  * niente account, email, indirizzi IP, posizione;
--  * dal browser le tabelle non si leggono né si scrivono: si passa solo dalle funzioni qui sotto;
--  * il nome della comitiva e i nomi a tavola sono testo libero, scritto da chi usa il sito: corti, senza
--    link, email o numeri di telefono. Chi gestisce il sito li vede e può cancellare una comitiva.
-- =====================================================================

create table if not exists public.comitive (
  id      bigint generated always as identity primary key,
  chiave  text not null unique check (char_length(chiave) between 20 and 64),   -- sta nel link di invito
  nome    text not null check (char_length(nome) between 2 and 30),
  creata  date not null default current_date,
  usata   date not null default current_date      -- ultimo giorno d'uso: dopo 180 giorni ferma, la comitiva si cancella
);

create table if not exists public.comitiva_posti (
  comitiva  bigint not null references public.comitive (id) on delete cascade,
  n         smallint not null check (n between 1 and 8),
  nome      text not null check (char_length(nome) between 1 and 20),
  faccia    smallint not null default 0 check (faccia between 0 and 5),
  impronta  text not null unique,                 -- sha256 del segreto di chi è seduto
  primary key (comitiva, n)
);

create table if not exists public.comitiva_luoghi (
  comitiva  bigint not null references public.comitive (id) on delete cascade,
  luogo     text not null references public.luoghi (id) on delete cascade,
  da        smallint not null,                    -- il numero del posto di chi l'ha aggiunto
  aggiunto  date not null default current_date,
  fatto     date,                                 -- il giorno in cui è stato segnato "fatto"
  primary key (comitiva, luogo)
);

create table if not exists public.comitiva_voti (
  comitiva  bigint not null,
  n         smallint not null,
  luogo     text not null,
  primary key (comitiva, n),                      -- un voto a testa, che si può spostare
  foreign key (comitiva, n) references public.comitiva_posti (comitiva, n) on delete cascade,
  foreign key (comitiva, luogo) references public.comitiva_luoghi (comitiva, luogo) on delete cascade
);

alter table public.comitive        enable row level security;
alter table public.comitiva_posti  enable row level security;
alter table public.comitiva_luoghi enable row level security;
alter table public.comitiva_voti   enable row level security;
revoke all on public.comitive, public.comitiva_posti, public.comitiva_luoghi, public.comitiva_voti from anon, authenticated;

-- ---------- Attrezzi interni ----------
create or replace function public.impronta(t text) returns text
language sql immutable as $$ select encode(sha256(convert_to(coalesce(t, ''), 'UTF8')), 'hex') $$;

-- Ripulisce un nome scritto a mano e lo rifiuta se è vuoto, troppo lungo, o se contiene link, email o numeri lunghi.
create or replace function public.nome_comitiva(t text, minimo int, massimo int) returns text
language plpgsql immutable as $$
declare s text;
begin
  s := regexp_replace(coalesce(t, ''), '[[:cntrl:]]', ' ', 'g');
  s := btrim(regexp_replace(s, '\s+', ' ', 'g'));
  if char_length(s) < minimo then raise exception 'Scrivi un nome'; end if;
  if char_length(s) > massimo then raise exception 'Nome troppo lungo: al massimo % caratteri', massimo; end if;
  if s ~ '[<>]' or s ~* '(https?:|www\.|@|\.(it|com|net|org|me|io)([^a-z]|$))' or s ~ '[0-9]{5,}' then
    raise exception 'Nel nome niente link, email, numeri di telefono o simboli come < e >';
  end if;
  return s;
end $$;

-- Il posto di chi ha quel segreto: comitiva e numero. Errore se non è seduto da nessuna parte.
create or replace function public.posto_di(p_segreto text, out c bigint, out io smallint)
language plpgsql security definer set search_path = public as $$
begin
  select p.comitiva, p.n into c, io from public.comitiva_posti p where p.impronta = public.impronta(p_segreto);
  if c is null then raise exception 'Non sei più seduto a questa tavola' using errcode = 'P0002'; end if;
  update public.comitive set usata = current_date where id = c and usata <> current_date;
end $$;

-- Tutto quello che vede chi è seduto
create or replace function public.comitiva_stato(c bigint, io smallint) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'nome', k.nome, 'chiave', k.chiave, 'creata', k.creata, 'io', io,
    'capo', (select min(n) from public.comitiva_posti where comitiva = c),
    'posti', (select coalesce(json_agg(json_build_object('n', n, 'nome', nome, 'faccia', faccia) order by n), '[]'::json)
              from public.comitiva_posti where comitiva = c),
    'luoghi', (select coalesce(json_agg(json_build_object('id', l.luogo, 'da', l.da, 'aggiunto', l.aggiunto, 'fatto', l.fatto,
                 'voti', (select coalesce(json_agg(v.n order by v.n), '[]'::json) from public.comitiva_voti v where v.comitiva = c and v.luogo = l.luogo))
                 order by l.aggiunto, l.luogo), '[]'::json)
               from public.comitiva_luoghi l where l.comitiva = c)
  ) from public.comitive k where k.id = c
$$;

-- ---------- Per chi ha solo il link ----------
-- Che cosa vede: il nome e quanti sono a tavola. Non i nomi di chi c'è, non i posti, non i voti.
create or replace function public.comitiva_anteprima(p_chiave text, p_segreto text default null) returns json
language plpgsql stable security definer set search_path = public as $$
declare k public.comitive%rowtype; seduti int;
begin
  select * into k from public.comitive where chiave = p_chiave;
  if not found then raise exception 'Questo invito non vale più' using errcode = 'P0002'; end if;
  select count(*) into seduti from public.comitiva_posti where comitiva = k.id;
  return json_build_object('nome', k.nome, 'seduti', seduti, 'liberi', 8 - seduti,
    'mia', exists (select 1 from public.comitiva_posti where comitiva = k.id and impronta = public.impronta(p_segreto)));
end $$;

create or replace function public.comitiva_crea(p_chiave text, p_nome text, p_mio_nome text, p_faccia int, p_segreto text) returns json
language plpgsql security definer set search_path = public as $$
declare c bigint;
begin
  if char_length(coalesce(p_chiave, '')) not between 20 and 64 or char_length(coalesce(p_segreto, '')) not between 20 and 64 or p_chiave = p_segreto then
    raise exception 'Richiesta non valida';
  end if;
  if exists (select 1 from public.comitiva_posti where impronta = public.impronta(p_segreto)) then
    raise exception 'Sei già seduto a una tavola: alzati da quella prima di crearne un’altra';
  end if;
  delete from public.comitive where usata < current_date - 180;              -- pulizia: le comitive ferme da sei mesi
  if (select count(*) from public.comitive where creata = current_date) >= 300 then
    raise exception 'Oggi sono state create troppe comitive: riprova domani';
  end if;
  insert into public.comitive (chiave, nome) values (p_chiave, public.nome_comitiva(p_nome, 2, 30)) returning id into c;
  insert into public.comitiva_posti (comitiva, n, nome, faccia, impronta)
    values (c, 1, public.nome_comitiva(p_mio_nome, 1, 20), least(greatest(coalesce(p_faccia, 0), 0), 5), public.impronta(p_segreto));
  return public.comitiva_stato(c, 1::smallint);
end $$;

-- Sedersi: il primo posto libero. Chi è già seduto a questa tavola cambia solo nome e faccia.
create or replace function public.comitiva_siediti(p_chiave text, p_nome text, p_faccia int, p_segreto text) returns json
language plpgsql security definer set search_path = public as $$
declare c bigint; mio smallint; libero smallint; altrove bigint;
begin
  if char_length(coalesce(p_segreto, '')) not between 20 and 64 then raise exception 'Richiesta non valida'; end if;
  select id into c from public.comitive where chiave = p_chiave for update;
  if c is null then raise exception 'Questo invito non vale più' using errcode = 'P0002'; end if;
  select comitiva, n into altrove, mio from public.comitiva_posti where impronta = public.impronta(p_segreto);
  if altrove is not null and altrove <> c then raise exception 'Sei già seduto a un’altra tavola: alzati da quella, poi riapri l’invito'; end if;
  if mio is not null then
    update public.comitiva_posti set nome = public.nome_comitiva(p_nome, 1, 20), faccia = least(greatest(coalesce(p_faccia, 0), 0), 5) where comitiva = c and n = mio;
  else
    select g into libero from generate_series(1, 8) g where not exists (select 1 from public.comitiva_posti where comitiva = c and n = g) order by g limit 1;
    if libero is null then raise exception 'La tavola è al completo: otto posti, tutti occupati'; end if;
    mio := libero;
    insert into public.comitiva_posti (comitiva, n, nome, faccia, impronta)
      values (c, mio, public.nome_comitiva(p_nome, 1, 20), least(greatest(coalesce(p_faccia, 0), 0), 5), public.impronta(p_segreto));
  end if;
  update public.comitive set usata = current_date where id = c;
  return public.comitiva_stato(c, mio);
end $$;

-- ---------- Per chi è seduto ----------
create or replace function public.comitiva_vedi(p_segreto text) returns json
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.posto_di(p_segreto);
  return public.comitiva_stato(p.c, p.io);
end $$;

-- Alzarsi. Se era l'ultimo, la comitiva sparisce. Il "capo" è sempre chi ha il numero più basso tra i seduti.
create or replace function public.comitiva_alzati(p_segreto text) returns void
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.posto_di(p_segreto);
  delete from public.comitiva_posti where comitiva = p.c and n = p.io;
  if not exists (select 1 from public.comitiva_posti where comitiva = p.c) then delete from public.comitive where id = p.c; end if;
end $$;

create or replace function public.comitiva_aggiungi(p_segreto text, p_luogo text) returns json
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.posto_di(p_segreto);
  if not exists (select 1 from public.luoghi where id = p_luogo) then raise exception 'Posto sconosciuto'; end if;
  if (select count(*) from public.comitiva_luoghi where comitiva = p.c) >= 60 then raise exception 'La lista è piena: 60 posti. Toglietene qualcuno'; end if;
  insert into public.comitiva_luoghi (comitiva, luogo, da) values (p.c, p_luogo, p.io) on conflict do nothing;
  return public.comitiva_stato(p.c, p.io);
end $$;

-- Togliere un posto dalla lista: chi l'ha aggiunto, oppure il capo
create or replace function public.comitiva_togli(p_segreto text, p_luogo text) returns json
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.posto_di(p_segreto);
  delete from public.comitiva_luoghi where comitiva = p.c and luogo = p_luogo
    and (da = p.io or p.io = (select min(n) from public.comitiva_posti where comitiva = p.c));
  if not found then raise exception 'Può toglierlo solo chi l’ha aggiunto, o chi ha creato la comitiva'; end if;
  return public.comitiva_stato(p.c, p.io);
end $$;

-- Votare un posto da provare. Un voto a testa: votarne un altro lo sposta; p_luogo vuoto lo ritira.
create or replace function public.comitiva_vota(p_segreto text, p_luogo text) returns json
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.posto_di(p_segreto);
  if p_luogo is null or p_luogo = '' then
    delete from public.comitiva_voti where comitiva = p.c and n = p.io;
  else
    if not exists (select 1 from public.comitiva_luoghi where comitiva = p.c and luogo = p_luogo and fatto is null) then
      raise exception 'Quel posto non è tra quelli da provare';
    end if;
    insert into public.comitiva_voti (comitiva, n, luogo) values (p.c, p.io, p_luogo)
      on conflict (comitiva, n) do update set luogo = excluded.luogo;
  end if;
  return public.comitiva_stato(p.c, p.io);
end $$;

-- "Fatto!": ci siete stati (o, con p_fatto falso, torna tra quelli da provare). I voti su quel posto si azzerano.
create or replace function public.comitiva_fatto(p_segreto text, p_luogo text, p_fatto boolean default true) returns json
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.posto_di(p_segreto);
  update public.comitiva_luoghi set fatto = case when coalesce(p_fatto, true) then current_date end where comitiva = p.c and luogo = p_luogo;
  if not found then raise exception 'Quel posto non è nella lista della comitiva'; end if;
  delete from public.comitiva_voti where comitiva = p.c and luogo = p_luogo;
  return public.comitiva_stato(p.c, p.io);
end $$;

-- Solo per chi ha creato la comitiva (o, se si è alzato, per chi ha il numero più basso):
--   'rinomina' → nuovo nome · 'togli' → il numero del posto da liberare · 'chiave' → nuovo link di invito (quello vecchio smette di valere)
--   'elimina'  → cancella la comitiva
create or replace function public.comitiva_capo(p_segreto text, p_cosa text, p_valore text default null) returns json
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.posto_di(p_segreto);
  if p.io <> (select min(n) from public.comitiva_posti where comitiva = p.c) then raise exception 'Può farlo solo chi ha creato la comitiva'; end if;
  if p_cosa = 'rinomina' then
    update public.comitive set nome = public.nome_comitiva(p_valore, 2, 30) where id = p.c;
  elsif p_cosa = 'togli' then
    if p_valore !~ '^[1-8]$' or p_valore::smallint = p.io then raise exception 'Posto non valido'; end if;
    delete from public.comitiva_posti where comitiva = p.c and n = p_valore::smallint;
  elsif p_cosa = 'chiave' then
    if char_length(coalesce(p_valore, '')) not between 20 and 64 then raise exception 'Richiesta non valida'; end if;
    update public.comitive set chiave = p_valore where id = p.c;
  elsif p_cosa = 'elimina' then
    delete from public.comitive where id = p.c;
    return null;
  else
    raise exception 'Richiesta non valida';
  end if;
  return public.comitiva_stato(p.c, p.io);
end $$;

-- ---------- Per chi gestisce il sito (vedi statistiche.sql: tabella amministratori) ----------
-- I nomi sono testo libero: chi gestisce il sito deve poterli vedere e, se serve, cancellare la comitiva.
-- Non vede i link di invito, né quali posti sono in lista.
create or replace function public.comitive_elenco() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.sono_admin() then raise exception 'riservato a chi gestisce il sito' using errcode = '42501'; end if;
  return json_build_object(
    'totale', (select count(*) from public.comitive),
    'da_tre', (select count(*) from public.comitive k where (select count(*) from public.comitiva_posti where comitiva = k.id) >= 3),
    'con_voti', (select count(distinct comitiva) from public.comitiva_voti),
    'con_fatti', (select count(distinct comitiva) from public.comitiva_luoghi where fatto is not null),
    'elenco', (select coalesce(json_agg(json_build_object('id', k.id, 'nome', k.nome, 'creata', k.creata, 'usata', k.usata,
                 'posti', (select coalesce(json_agg(nome order by n), '[]'::json) from public.comitiva_posti where comitiva = k.id),
                 'luoghi', (select count(*) from public.comitiva_luoghi where comitiva = k.id)) order by k.usata desc, k.id desc), '[]'::json)
               from (select * from public.comitive order by usata desc, id desc limit 200) k)
  );
end $$;

create or replace function public.comitiva_cancella(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.sono_admin() then raise exception 'riservato a chi gestisce il sito' using errcode = '42501'; end if;
  delete from public.comitive where id = p_id;
end $$;

-- Le funzioni non sono eseguibili da chiunque per default: si apre solo il necessario.
revoke execute on function public.impronta(text), public.nome_comitiva(text, int, int), public.posto_di(text), public.comitiva_stato(bigint, smallint),
  public.comitiva_anteprima(text, text), public.comitiva_crea(text, text, text, int, text), public.comitiva_siediti(text, text, int, text),
  public.comitiva_vedi(text), public.comitiva_alzati(text), public.comitiva_aggiungi(text, text), public.comitiva_togli(text, text),
  public.comitiva_vota(text, text), public.comitiva_fatto(text, text, boolean), public.comitiva_capo(text, text, text),
  public.comitive_elenco(), public.comitiva_cancella(bigint) from public, anon, authenticated;
grant execute on function public.comitiva_anteprima(text, text), public.comitiva_crea(text, text, text, int, text), public.comitiva_siediti(text, text, int, text),
  public.comitiva_vedi(text), public.comitiva_alzati(text), public.comitiva_aggiungi(text, text), public.comitiva_togli(text, text),
  public.comitiva_vota(text, text), public.comitiva_fatto(text, text, boolean), public.comitiva_capo(text, text, text) to anon, authenticated;
grant execute on function public.comitive_elenco(), public.comitiva_cancella(bigint) to authenticated;
