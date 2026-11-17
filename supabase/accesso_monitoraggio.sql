-- =====================================================================
-- Scusa, non stasera — chi può crearsi un accesso alla pagina di monitoraggio
-- Come usarlo: dopo statistiche.sql. Vale FINCHÉ GLI ACCOUNT DEL SITO SONO SPENTI (config.js: conto: false).
--
-- La pagina di monitoraggio si apre con email e password. Qui si decide chi può registrarsi:
--  * finché l'elenco "amministratori" è vuoto, la prima persona che conferma la propria email diventa
--    l'amministratore (succede una volta sola, quando chi gestisce il sito crea il suo accesso);
--  * da quel momento può registrarsi soltanto chi è già in elenco: per chiunque altro la registrazione fallisce.
-- Per aggiungere un secondo amministratore:  insert into public.amministratori (email) values ('altra@email.it');
--
-- IMPORTANTE: il giorno in cui si accendono gli account del sito (schema.sql, conto: true) la prima regola va
-- tolta, altrimenti nessun utente potrà iscriversi:
--     drop trigger solo_amministratori on auth.users;
-- =====================================================================

create or replace function public.solo_amministratori() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.amministratori)
     and not exists (select 1 from public.amministratori a where a.email = lower(coalesce(new.email, ''))) then
    raise exception 'registrazione riservata a chi gestisce il sito' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.primo_amministratore() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null and new.email_confirmed_at is not null
     and (tg_op = 'INSERT' or old.email_confirmed_at is null) then
    perform pg_advisory_xact_lock(hashtext('primo_amministratore'));   -- due conferme insieme: ne passa una sola
    if not exists (select 1 from public.amministratori) then
      insert into public.amministratori (email) values (lower(new.email)) on conflict do nothing;
    end if;
  end if;
  return new;
end $$;

-- Sono funzioni interne: nessuno le chiama dal browser.
revoke execute on function public.solo_amministratori(), public.primo_amministratore() from public, anon, authenticated;

create or replace trigger solo_amministratori before insert on auth.users
  for each row execute function public.solo_amministratori();
create or replace trigger primo_amministratore after insert or update of email_confirmed_at on auth.users
  for each row execute function public.primo_amministratore();
