-- OFENTSE-FINDS — initial schema
-- Safe to re-run: every object is created with IF NOT EXISTS / OR REPLACE and nothing is dropped
-- except policies this file itself owns (dropped and recreated so edits apply cleanly).
--
-- Security model
--   • anon/authenticated can READ towns, categories and non-suspended businesses.
--   • anon/authenticated can INSERT into business_submissions — always forced to status 'pending'.
--   • Nobody but admins (rows in public.admin_users) can read submissions or write
--     towns/categories/businesses. Approvals go through SECURITY DEFINER functions that
--     re-check is_admin().
--   • The publishable key is the only key the app uses; no service-role key is required.

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Admins
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()));
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Towns
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.towns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  province text,
  description text check (char_length(description) <= 2000),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  kind text not null default 'town' check (kind in ('city', 'town', 'suburb')),
  radius_km numeric(5, 2) not null default 5 check (radius_km > 0 and radius_km <= 25),
  cover_image_url text check (cover_image_url ~* '^https://'),
  cover_image_credit text,
  cover_image_license text,
  cover_image_source_url text,
  wiki_url text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Categories (hierarchical: groups have parent_id null)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  icon text,
  color text check (color is null or color ~* '^#[0-9a-f]{6}$'),
  description text,
  parent_id uuid references public.categories (id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists categories_parent_idx on public.categories (parent_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Businesses (approved / imported listings)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (char_length(description) <= 2000),
  category_id uuid references public.categories (id) on delete set null,
  town_id uuid references public.towns (id) on delete set null,
  address text check (char_length(address) <= 300),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  phone text check (char_length(phone) <= 40),
  email text check (char_length(email) <= 160),
  website_url text check (website_url is null or website_url ~* '^https?://'),
  image_url text check (image_url is null or image_url ~* '^https://'),
  opening_hours text check (char_length(opening_hours) <= 300),
  -- ratings stay NULL unless they come from a real, attributable source
  rating numeric(2, 1) check (rating is null or rating between 0 and 5),
  review_count integer check (review_count is null or review_count >= 0),
  rating_source text,
  source text not null default 'submission' check (source in ('submission', 'osm', 'admin', 'import')),
  source_place_id text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_coords_together check ((latitude is null) = (longitude is null)),
  constraint businesses_source_unique unique (source, source_place_id)
);
create index if not exists businesses_town_idx on public.businesses (town_id);
create index if not exists businesses_category_idx on public.businesses (category_id);
create index if not exists businesses_created_idx on public.businesses (created_at desc);
create index if not exists businesses_latlng_idx on public.businesses (latitude, longitude);

drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Business submissions (public, unmoderated — kept separate from businesses)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.business_submissions (
  id uuid primary key default gen_random_uuid(),
  business_name text not null check (char_length(business_name) between 2 and 120),
  category_id uuid references public.categories (id) on delete set null,
  category_slug text check (char_length(category_slug) <= 60),
  town_name text not null check (char_length(town_name) between 2 and 80),
  address text not null check (char_length(address) between 5 and 200),
  description text not null check (char_length(description) between 20 and 1000),
  contact_number text check (contact_number is null or contact_number ~ '^(\+27|0)[0-9 -]{8,13}$'),
  email text check (email is null or (char_length(email) <= 160 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  website_url text check (website_url is null or (char_length(website_url) <= 300 and website_url ~* '^https?://')),
  opening_hours text check (char_length(opening_hours) <= 200),
  image_paths text[] not null default '{}' check (cardinality(image_paths) <= 3),
  is_owner boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  business_id uuid references public.businesses (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists business_submissions_status_idx on public.business_submissions (status, created_at desc);

-- Non-admins can never choose moderation fields, whatever they send.
create or replace function public.business_submissions_force_pending()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    new.status := 'pending';
    new.review_notes := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.business_id := null;
    new.created_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists business_submissions_force_pending on public.business_submissions;
create trigger business_submissions_force_pending before insert on public.business_submissions
  for each row execute function public.business_submissions_force_pending();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.admin_users enable row level security;
alter table public.towns enable row level security;
alter table public.categories enable row level security;
alter table public.businesses enable row level security;
alter table public.business_submissions enable row level security;

-- admin_users: you can see only your own row (lets the admin UI check membership). No API writes.
drop policy if exists "admin_users_select_self" on public.admin_users;
create policy "admin_users_select_self" on public.admin_users
  for select to authenticated using (user_id = (select auth.uid()));

-- towns
drop policy if exists "towns_public_read" on public.towns;
create policy "towns_public_read" on public.towns for select to anon, authenticated using (true);
drop policy if exists "towns_admin_insert" on public.towns;
create policy "towns_admin_insert" on public.towns for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "towns_admin_update" on public.towns;
create policy "towns_admin_update" on public.towns for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "towns_admin_delete" on public.towns;
create policy "towns_admin_delete" on public.towns for delete to authenticated using ((select public.is_admin()));

-- categories
drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories for select to anon, authenticated using (true);
drop policy if exists "categories_admin_insert" on public.categories;
create policy "categories_admin_insert" on public.categories for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "categories_admin_update" on public.categories;
create policy "categories_admin_update" on public.categories for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "categories_admin_delete" on public.categories;
create policy "categories_admin_delete" on public.categories for delete to authenticated using ((select public.is_admin()));

-- businesses: public sees everything except suspended listings; only admins write
drop policy if exists "businesses_public_read" on public.businesses;
create policy "businesses_public_read" on public.businesses for select to anon, authenticated
  using (verification_status <> 'suspended' or (select public.is_admin()));
drop policy if exists "businesses_admin_insert" on public.businesses;
create policy "businesses_admin_insert" on public.businesses for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "businesses_admin_update" on public.businesses;
create policy "businesses_admin_update" on public.businesses for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "businesses_admin_delete" on public.businesses;
create policy "businesses_admin_delete" on public.businesses for delete to authenticated using ((select public.is_admin()));

-- business_submissions: anyone may submit (forced to pending); only admins read/update/delete
drop policy if exists "submissions_public_insert" on public.business_submissions;
create policy "submissions_public_insert" on public.business_submissions for insert to anon, authenticated
  with check (status = 'pending' and reviewed_at is null and reviewed_by is null and business_id is null);
drop policy if exists "submissions_admin_read" on public.business_submissions;
create policy "submissions_admin_read" on public.business_submissions for select to authenticated using ((select public.is_admin()));
drop policy if exists "submissions_admin_update" on public.business_submissions;
create policy "submissions_admin_update" on public.business_submissions for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "submissions_admin_delete" on public.business_submissions;
create policy "submissions_admin_delete" on public.business_submissions for delete to authenticated using ((select public.is_admin()));

-- Belt and braces: the anonymous role has no reason to update/delete anything.
revoke update, delete, truncate on public.towns, public.categories, public.businesses, public.business_submissions, public.admin_users from anon;
revoke insert on public.towns, public.categories, public.businesses, public.admin_users from anon;
revoke insert, update, delete, truncate on public.admin_users from authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Moderation functions (admin only)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.approve_submission(
  p_submission_id uuid,
  p_town_id uuid,
  p_category_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_name text default null,
  p_description text default null,
  p_image_url text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.business_submissions%rowtype;
  v_business_id uuid;
  v_name text;
  v_slug text;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can approve submissions' using errcode = '42501';
  end if;

  select * into s from public.business_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Submission not found';
  end if;
  if s.status <> 'pending' then
    raise exception 'Submission has already been reviewed';
  end if;
  if p_latitude is null or p_longitude is null then
    raise exception 'Confirmed coordinates are required before a listing can be published';
  end if;

  v_name := coalesce(nullif(trim(p_name), ''), s.business_name);
  v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then v_slug := 'business'; end if;
  v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.businesses (
    name, slug, description, category_id, town_id, address, latitude, longitude,
    phone, email, website_url, image_url, opening_hours, source, source_place_id, verification_status
  ) values (
    v_name, v_slug, coalesce(nullif(trim(p_description), ''), s.description), coalesce(p_category_id, s.category_id), p_town_id,
    s.address, p_latitude, p_longitude, s.contact_number, s.email, s.website_url, p_image_url, s.opening_hours,
    'submission', s.id::text, 'verified'
  ) returning id into v_business_id;

  update public.business_submissions
     set status = 'approved', reviewed_at = now(), reviewed_by = (select auth.uid()), business_id = v_business_id, review_notes = p_notes
   where id = s.id;

  return v_business_id;
end;
$$;

create or replace function public.reject_submission(p_submission_id uuid, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can reject submissions' using errcode = '42501';
  end if;
  update public.business_submissions
     set status = 'rejected', reviewed_at = now(), reviewed_by = (select auth.uid()), review_notes = p_notes
   where id = p_submission_id and status = 'pending';
  if not found then
    raise exception 'Submission not found or already reviewed';
  end if;
end;
$$;

revoke all on function public.approve_submission(uuid, uuid, uuid, double precision, double precision, text, text, text, text) from public, anon;
grant execute on function public.approve_submission(uuid, uuid, uuid, double precision, double precision, text, text, text, text) to authenticated;
revoke all on function public.reject_submission(uuid, text) from public, anon;
grant execute on function public.reject_submission(uuid, text) to authenticated;
revoke all on function public.business_submissions_force_pending() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage
--   business-submission-images: PRIVATE. Anyone may upload into pending/…; only admins read.
--   business-images:            PUBLIC read. Only admins upload (approved listing photos).
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-submission-images', 'business-submission-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-images', 'business-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "submission_images_public_upload" on storage.objects;
create policy "submission_images_public_upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'business-submission-images' and (storage.foldername(name))[1] = 'pending');

drop policy if exists "submission_images_admin_read" on storage.objects;
create policy "submission_images_admin_read" on storage.objects for select to authenticated
  using (bucket_id = 'business-submission-images' and (select public.is_admin()));

drop policy if exists "submission_images_admin_delete" on storage.objects;
create policy "submission_images_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'business-submission-images' and (select public.is_admin()));

drop policy if exists "business_images_admin_write" on storage.objects;
create policy "business_images_admin_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'business-images' and (select public.is_admin()));

drop policy if exists "business_images_admin_delete" on storage.objects;
create policy "business_images_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'business-images' and (select public.is_admin()));
