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

-- limite di campi per utente: impedisce di riempire il database (piano gratuito 500 MB)
create or replace function public.limite_campi() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.campi where user_id = new.user_id) >= 500 then
    raise exception 'limite di 500 campi per utente raggiunto';
  end if;
  return new;
end; $$;
drop trigger if exists campi_limite on public.campi;
create trigger campi_limite before insert on public.campi for each row execute function public.limite_campi();
revoke all on function public.limite_campi() from public, anon, authenticated;

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

-- =====================================================================================================
-- Mappe pubbliche: utenti con permessi speciali ("editori") caricano mappe visibili a tutti.
-- Gli editori si aggiungono SOLO dal pannello di Supabase (Table editor → editori → user_id dell'utente):
-- nessuna regola permette agli utenti di scrivere nella tabella editori.
-- =====================================================================================================
create table if not exists public.editori (
  user_id uuid primary key references auth.users on delete cascade,
  nota    text,
  creato  timestamptz not null default now()
);
alter table public.editori enable row level security;
drop policy if exists "editori: vedo solo me" on public.editori;
create policy "editori: vedo solo me" on public.editori for select to authenticated using (user_id = (select auth.uid()));

-- vero se l'utente collegato è un editore (usata dalle regole qui sotto e dal sito)
create or replace function public.sono_editore() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.editori where user_id = (select auth.uid()));
$$;
revoke all on function public.sono_editore() from public, anon;
grant execute on function public.sono_editore() to authenticated;

create table if not exists public.mappe_pubbliche (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  titolo      text not null check (char_length(titolo) between 1 and 120),
  descrizione text check (char_length(descrizione) <= 2000),
  fonte       text check (char_length(fonte) <= 300),
  licenza     text not null check (licenza in ('CC BY 4.0', 'CC BY-NC 4.0', 'CC BY-SA 4.0', 'CC0 1.0')),
  percorso    text not null unique check (percorso ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'),
  tipo        text not null check (tipo in ('geotiff', 'geojson', 'kml')),
  bbox        double precision[] check (bbox is null or array_length(bbox, 1) = 4),
  creato      timestamptz not null default now()
);
alter table public.mappe_pubbliche enable row level security;
drop policy if exists "mappe: tutti leggono" on public.mappe_pubbliche;
create policy "mappe: tutti leggono" on public.mappe_pubbliche for select to anon, authenticated using (true);
drop policy if exists "mappe: editori pubblicano" on public.mappe_pubbliche;
create policy "mappe: editori pubblicano" on public.mappe_pubbliche for insert to authenticated
  with check (user_id = (select auth.uid()) and public.sono_editore() and split_part(percorso, '/', 1) = (select auth.uid())::text);
drop policy if exists "mappe: editori modificano le proprie" on public.mappe_pubbliche;
create policy "mappe: editori modificano le proprie" on public.mappe_pubbliche for update to authenticated
  using (user_id = (select auth.uid()) and public.sono_editore()) with check (user_id = (select auth.uid()));
drop policy if exists "mappe: editori cancellano le proprie" on public.mappe_pubbliche;
create policy "mappe: editori cancellano le proprie" on public.mappe_pubbliche for delete to authenticated
  using (user_id = (select auth.uid()) and public.sono_editore());

-- file delle mappe: bucket pubblico in lettura (50 MB per file); scrittura solo editori, nella cartella col proprio id
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mappe', 'mappe', true, 52428800, array['image/tiff', 'application/geo+json', 'application/json', 'application/vnd.google-earth.kml+xml'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "mappe: editori caricano" on storage.objects;
create policy "mappe: editori caricano" on storage.objects for insert to authenticated
  with check (bucket_id = 'mappe' and public.sono_editore() and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "mappe: editori cancellano" on storage.objects;
create policy "mappe: editori cancellano" on storage.objects for delete to authenticated
  using (bucket_id = 'mappe' and owner_id = (select auth.uid())::text and public.sono_editore());
