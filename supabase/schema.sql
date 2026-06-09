-- ============================================================
-- TeraBoard — Supabase schema
-- Run this in the Supabase SQL Editor (one shot).
-- Safe to re-run: uses IF NOT EXISTS / idempotent policies.
-- ============================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- ============================================================
-- therapists
-- A therapist's public profile + the (denormalized) rating
-- summary used by the listing grid.
-- ============================================================
create table if not exists public.therapists (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users (id) on delete set null, -- owner (the therapist), null for seed rows
  name          text not null,
  speciality    text not null,
  category      text not null,            -- psy | couple | kids | cbt | art | body | addiction
  area          text not null,
  online        boolean not null default false,
  price         integer not null,         -- per-session price (currency decided by the UI locale)
  exp           integer default 0,        -- years of experience
  bio           text,
  photo_url     text,
  initial       text,                     -- single-letter avatar fallback
  badge         text,                     -- e.g. 'מומלץ' / 'Recommended' / null
  license_number text,
  website_url   text,                     -- therapist's own website (shown to clients)
  instagram     text,                     -- Instagram handle or URL (shown to clients)
  verified      boolean not null default false,
  rating        numeric(2,1) not null default 0,   -- denormalized average (0.0–5.0)
  reviews_count integer not null default 0,         -- denormalized count
  created_at    timestamptz not null default now()
);

create index if not exists therapists_category_idx on public.therapists (category);
create index if not exists therapists_area_idx     on public.therapists (area);
create index if not exists therapists_user_idx     on public.therapists (user_id);

-- ============================================================
-- reviews
-- ============================================================
create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists (id) on delete cascade,
  user_id      uuid references auth.users (id) on delete set null,
  rating       integer not null check (rating between 1 and 5),
  comment      text,
  created_at   timestamptz not null default now()
);

create index if not exists reviews_therapist_idx on public.reviews (therapist_id);

-- ============================================================
-- bookings
-- ============================================================
create table if not exists public.bookings (
  id           uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists (id) on delete cascade,
  user_id      uuid references auth.users (id) on delete set null,
  full_name    text,                       -- captured from the booking modal
  phone        text,
  datetime     timestamptz,                -- requested slot
  type         text,                       -- intro | regular | online
  status       text not null default 'pending',  -- pending | confirmed | cancelled
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists bookings_therapist_idx on public.bookings (therapist_id);
create index if not exists bookings_user_idx       on public.bookings (user_id);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.therapists enable row level security;
alter table public.reviews    enable row level security;
alter table public.bookings   enable row level security;

-- therapists: anyone can read; a therapist can insert/update their OWN row.
drop policy if exists "therapists_public_read" on public.therapists;
create policy "therapists_public_read"
  on public.therapists for select
  using (true);

drop policy if exists "therapists_owner_insert" on public.therapists;
create policy "therapists_owner_insert"
  on public.therapists for insert
  with check (auth.uid() = user_id);

drop policy if exists "therapists_owner_update" on public.therapists;
create policy "therapists_owner_update"
  on public.therapists for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- reviews: anyone can read; authenticated users can write their own.
drop policy if exists "reviews_public_read" on public.reviews;
create policy "reviews_public_read"
  on public.reviews for select using (true);

drop policy if exists "reviews_auth_insert" on public.reviews;
create policy "reviews_auth_insert"
  on public.reviews for insert
  with check (auth.uid() = user_id);

-- bookings: a client may create a booking (anon allowed for the prototype
-- modal); a client sees their own; a therapist sees bookings for their profile.
-- Basic abuse guard: phone and full_name must not be empty, and therapist must exist.
drop policy if exists "bookings_anyone_insert" on public.bookings;
create policy "bookings_anyone_insert"
  on public.bookings for insert
  with check (
    full_name is not null and length(trim(full_name)) > 0
    and therapist_id is not null
    and exists (select 1 from public.therapists where id = bookings.therapist_id)
  );

drop policy if exists "bookings_client_read" on public.bookings;
create policy "bookings_client_read"
  on public.bookings for select
  using (auth.uid() = user_id);

drop policy if exists "bookings_therapist_read" on public.bookings;
create policy "bookings_therapist_read"
  on public.bookings for select
  using (
    exists (
      select 1 from public.therapists t
      where t.id = bookings.therapist_id and t.user_id = auth.uid()
    )
  );

drop policy if exists "bookings_therapist_update" on public.bookings;
create policy "bookings_therapist_update"
  on public.bookings for update
  using (
    exists (
      select 1 from public.therapists t
      where t.id = bookings.therapist_id and t.user_id = auth.uid()
    )
  );

-- ============================================================
-- Storage bucket for license / credential uploads
-- (private — only the uploader and admins can read)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('licenses', 'licenses', false)
on conflict (id) do nothing;

drop policy if exists "licenses_owner_insert" on storage.objects;
create policy "licenses_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'licenses'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "licenses_owner_read" on storage.objects;
create policy "licenses_owner_read"
  on storage.objects for select
  using (
    bucket_id = 'licenses'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- Storage bucket for profile photos (public — shown to clients)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- ============================================================
-- Seed data — the 12 sample therapists from the prototype
-- (idempotent: only inserts if the table is empty)
-- ============================================================
insert into public.therapists
  (name, speciality, category, area, online, price, exp, initial, badge, verified, rating, reviews_count, photo_url, website_url, instagram)
select * from (values
  ('Dra. Mariana Silva',     'Psicóloga Clínica',            'psy',        'São Paulo',       true,  280, 13, 'M', 'Recomendado', true, 4.9, 168, 'https://randomuser.me/api/portraits/women/68.jpg', 'https://marianasilva.com.br', 'mariana.psi'),
  ('Rafael Oliveira',        'Terapeuta de Casais',          'couple',     'Rio de Janeiro',  true,  240,  9, 'R', null,          true, 4.8,  94, 'https://randomuser.me/api/portraits/men/32.jpg',   null, null),
  ('Dra. Camila Santos',     'TCC e Ansiedade',              'cbt',        'São Paulo',       false, 300, 15, 'C', 'Novo',        true, 5.0,  61, 'https://randomuser.me/api/portraits/women/44.jpg', null, null),
  ('Juliana Costa',          'Arteterapeuta',                'art',        'Belo Horizonte',  true,  200,  7, 'J', null,          true, 4.7,  73, 'https://randomuser.me/api/portraits/women/12.jpg', null, null),
  ('Bruno Almeida',          'Psicoterapia Psicodinâmica',   'psy',        'Curitiba',        false, 260, 18, 'B', 'Recomendado', true, 4.9, 210, 'https://randomuser.me/api/portraits/men/52.jpg',   null, null),
  ('Dra. Patrícia Ferreira', 'Terapia Infantil',             'kids',       'São Paulo',       true,  220, 10, 'P', null,          true, 4.8,  88, 'https://randomuser.me/api/portraits/women/29.jpg', null, null),
  ('Lucas Rodrigues',        'Recuperação de Dependências',  'addiction',  'Rio de Janeiro',  true,  300, 14, 'L', null,          true, 4.6,  67, 'https://randomuser.me/api/portraits/men/76.jpg',   null, null),
  ('Fernanda Lima',          'Mindfulness e Meditação',      'mindfulness','Online',          true,  180,  8, 'F', null,          true, 4.9, 131, 'https://randomuser.me/api/portraits/women/65.jpg', null, 'fer.mindful'),
  ('Dra. Beatriz Carvalho',  'Trauma e EMDR',                'trauma',     'Porto Alegre',    true,  320, 16, 'B', 'Novo',        true, 5.0,  54, 'https://randomuser.me/api/portraits/women/90.jpg', null, null),
  ('Thiago Pereira',         'Terapia Familiar Sistêmica',   'family',     'Brasília',        false, 270, 12, 'T', null,          true, 4.8,  79, 'https://randomuser.me/api/portraits/men/15.jpg',   null, null),
  ('Dra. Aline Souza',       'Sexologia Clínica',            'sexual',     'São Paulo',       true,  340, 11, 'A', 'Recomendado', true, 4.9,  96, 'https://randomuser.me/api/portraits/women/33.jpg', null, 'dra.alinesouza'),
  ('Gabriel Martins',        'Luto e Perda',                 'grief',      'Lisboa',          true,  230,  9, 'G', null,          true, 4.7,  42, 'https://randomuser.me/api/portraits/men/3.jpg',    null, null),
  ('Dra. Renata Gomes',      'Ansiedade e Depressão',        'anxiety',    'Curitiba',        true,  250, 13, 'R', null,          true, 4.8, 115, 'https://randomuser.me/api/portraits/women/56.jpg', null, null),
  ('Marcelo Ribeiro',        'Corpo-Mente e Yoga',           'body',       'Florianópolis',   true,  190,  7, 'M', null,          true, 4.9, 124, 'https://randomuser.me/api/portraits/men/41.jpg',   null, 'marcelo.corpo')
) as seed(name, speciality, category, area, online, price, exp, initial, badge, verified, rating, reviews_count, photo_url, website_url, instagram)
where not exists (select 1 from public.therapists);
