-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql/new)

-- 1. Create Categories Table
create table if not exists categories (
  id text primary key,
  name text not null,
  display_name text not null,
  icon text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Models Table
create table if not exists models (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category_id text references categories(id),
  file_url text not null,
  thumbnail_url text,
  config jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable RLS
alter table categories enable row level security;
alter table models enable row level security;

-- 4. Create Policies (Public Access for Development)
-- Categories
create policy "Public Read Categories" on categories for select using (true);
create policy "Public Insert Categories" on categories for insert with check (true);
create policy "Public Update Categories" on categories for update using (true);
create policy "Public Delete Categories" on categories for delete using (true);

-- Models
create policy "Public Read Models" on models for select using (true);
create policy "Public Insert Models" on models for insert with check (true);
create policy "Public Update Models" on models for update using (true);
create policy "Public Delete Models" on models for delete using (true);

-- 5. Storage Bucket Setup
insert into storage.buckets (id, name, public) values ('models', 'models', true)
on conflict (id) do nothing;

create policy "Public Access Storage" on storage.objects for all using ( bucket_id = 'models' );
