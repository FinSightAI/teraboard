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
drop policy if exists "bookings_anyone_insert" on public.bookings;
create policy "bookings_anyone_insert"
  on public.bookings for insert
  with check (true);

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
-- Seed data — the 12 sample therapists from the prototype
-- (idempotent: only inserts if the table is empty)
-- ============================================================
insert into public.therapists
  (name, speciality, category, area, online, price, exp, initial, badge, verified, rating, reviews_count)
select * from (values
  ('ד״ר נועה לוי',     'פסיכולוגית קלינית',        'psy',       'תל אביב', true,  450, 12, 'נ', 'מומלץ', true, 4.9, 142),
  ('יואב כהן',         'מטפל זוגי וקבוצתי',         'couple',    'ירושלים', true,  380,  8, 'י', null,    true, 4.8,  89),
  ('ד״ר שירה אברהם',   'CBT והפרעות חרדה',          'cbt',       'תל אביב', false, 500, 15, 'ש', 'חדש',   true, 5.0,  56),
  ('מיכל ברק',         'מטפלת באמנות',              'art',       'חיפה',    true,  320,  6, 'מ', null,    true, 4.7,  78),
  ('אסף רוזן',         'פסיכותרפיה דינמית',         'psy',       'שרון',    false, 420, 18, 'א', 'מומלץ', true, 4.9, 203),
  ('תמר ויסמן',        'מטפלת רגשית לילדים',        'kids',      'תל אביב', true,  360,  9, 'ת', null,    true, 4.8,  95),
  ('ד״ר רונן שטרן',    'התמכרויות וסמים',           'addiction', 'ירושלים', true,  480, 14, 'ר', null,    true, 4.6,  67),
  ('יעל גולדמן',       'יוגה תרפיה וגוף-נפש',       'body',      'אונליין', true,  280,  7, 'י', null,    true, 4.9, 124),
  ('דנה אלון',         'CBT לנוער',                 'cbt',       'חיפה',    true,  350,  5, 'ד', null,    true, 4.7,  41),
  ('אורי פרידמן',      'טיפול זוגי IMAGO',          'couple',    'תל אביב', false, 550, 11, 'א', 'חדש',   true, 5.0,  38),
  ('נטע ברגר',         'אמנות וטראומה',             'art',       'שרון',    true,  340, 10, 'נ', null,    true, 4.8,  72),
  ('ד״ר עומר נחום',    'פסיכואנליזה יונגיאנית',     'psy',       'ירושלים', false, 520, 20, 'ע', 'מומלץ', true, 4.9, 108)
) as seed(name, speciality, category, area, online, price, exp, initial, badge, verified, rating, reviews_count)
where not exists (select 1 from public.therapists);

-- Demo links on a couple of seed profiles (so clients can see the feature).
update public.therapists set website_url = 'https://noa-levi.co.il',  instagram = 'noa.levi.psy'    where name = 'ד״ר נועה לוי';
update public.therapists set website_url = 'https://yael-yoga.co.il',  instagram = 'yael.bodymind'   where name = 'יעל גולדמן';
