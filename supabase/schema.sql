-- Campi Aperti — schema del database utenti (Supabase / PostgreSQL)
-- Da eseguire una volta in Supabase: SQL Editor -> New query -> incolla tutto -> Run.
-- Le password NON sono qui: le gestisce Supabase Auth (salvate solo come hash bcrypt).
-- Ogni tabella ha la Row Level Security attiva: ciascun utente vede e modifica solo le proprie righe.

-- campi disegnati e salvati dagli utenti
create table if not exists public.campi (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text check (char_length(nome) <= 120),
  proprieta jsonb not null default '{}'::jsonb,          -- coltura, filari, piante, resa, irrigazione...
  geometria jsonb not null,                              -- GeoJSON Polygon/MultiPolygon (WGS84)
  condividi boolean not null default false,              -- consenso a usarlo (anonimo) per addestrare i modelli
  creato timestamptz not null default now(),
  aggiornato timestamptz not null default now(),
  constraint geometria_valida check (geometria ->> 'type' in ('Polygon', 'MultiPolygon')),
  constraint dimensione check (pg_column_size(geometria) < 200000 and pg_column_size(proprieta) < 20000)
);
create index if not exists campi_user_idx on public.campi (user_id);

alter table public.campi enable row level security;
drop policy if exists "leggo i miei campi" on public.campi;
drop policy if exists "inserisco i miei campi" on public.campi;
drop policy if exists "modifico i miei campi" on public.campi;
drop policy if exists "cancello i miei campi" on public.campi;
create policy "leggo i miei campi" on public.campi for select to authenticated using ((select auth.uid()) = user_id);
create policy "inserisco i miei campi" on public.campi for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "modifico i miei campi" on public.campi for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "cancello i miei campi" on public.campi for delete to authenticated using ((select auth.uid()) = user_id);

-- aggiorna la data di modifica
create or replace function public.tocca_aggiornato() returns trigger language plpgsql set search_path = '' as $$
begin new.aggiornato = now(); return new; end; $$;
drop trigger if exists campi_aggiornato on public.campi;
create trigger campi_aggiornato before update on public.campi for each row execute function public.tocca_aggiornato();

-- l'utente può cancellare il proprio account (e, a cascata, i suoi campi): diritto all'oblio GDPR
create or replace function public.elimina_il_mio_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'non autenticato'; end if;
  delete from auth.users where id = auth.uid();
end; $$;
revoke all on function public.elimina_il_mio_account() from public, anon;
grant execute on function public.elimina_il_mio_account() to authenticated;

-- campi condivisi per l'addestramento: senza user_id né nome, leggibili solo con la chiave di servizio (GitHub Actions)
create or replace view public.campi_condivisi with (security_invoker = true) as
  select id, proprieta, geometria, creato from public.campi where condividi;
revoke all on public.campi_condivisi from anon, authenticated;
