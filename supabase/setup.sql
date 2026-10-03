-- Run this in the Supabase SQL Editor for the handbook project.
-- Keep the email here in sync with ADMIN_EMAIL in app.js.

create table if not exists public.handbook_tabs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('link', 'file')),
  url text,
  storage_path text,
  created_at timestamptz not null default now(),
  constraint handbook_tabs_target_check check (
    (kind = 'link' and url ~ '^https?://' and storage_path is null)
    or
    (kind = 'file' and url is null and storage_path is not null)
  )
);

create table if not exists public.handbook_pages (
  page_id text primary key check (char_length(page_id) between 1 and 120),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  content_html text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.handbook_tabs enable row level security;
alter table public.handbook_pages enable row level security;

grant select on public.handbook_tabs to anon, authenticated;
grant insert, update, delete on public.handbook_tabs to authenticated;
grant select on public.handbook_pages to anon, authenticated;
grant insert, update, delete on public.handbook_pages to authenticated;

drop policy if exists "Anyone can view handbook tabs" on public.handbook_tabs;
create policy "Anyone can view handbook tabs"
  on public.handbook_tabs for select to anon, authenticated
  using (true);

drop policy if exists "Only the handbook admin can add tabs" on public.handbook_tabs;
create policy "Only the handbook admin can add tabs"
  on public.handbook_tabs for insert to authenticated
  with check (lower(auth.jwt() ->> 'email') = '2240084@slu.edu.ph');

drop policy if exists "Only the handbook admin can edit tabs" on public.handbook_tabs;
create policy "Only the handbook admin can edit tabs"
  on public.handbook_tabs for update to authenticated
  using (lower(auth.jwt() ->> 'email') = '2240084@slu.edu.ph')
  with check (lower(auth.jwt() ->> 'email') = '2240084@slu.edu.ph');

drop policy if exists "Only the handbook admin can delete tabs" on public.handbook_tabs;
create policy "Only the handbook admin can delete tabs"
  on public.handbook_tabs for delete to authenticated
  using (lower(auth.jwt() ->> 'email') = '2240084@slu.edu.ph');

drop policy if exists "Anyone can view handbook pages" on public.handbook_pages;
create policy "Anyone can view handbook pages"
  on public.handbook_pages for select to anon, authenticated
  using (true);

drop policy if exists "Only the handbook admin can add pages" on public.handbook_pages;
create policy "Only the handbook admin can add pages"
  on public.handbook_pages for insert to authenticated
  with check (lower(auth.jwt() ->> 'email') = '2240084@slu.edu.ph');

drop policy if exists "Only the handbook admin can edit pages" on public.handbook_pages;
create policy "Only the handbook admin can edit pages"
  on public.handbook_pages for update to authenticated
  using (lower(auth.jwt() ->> 'email') = '2240084@slu.edu.ph')
  with check (lower(auth.jwt() ->> 'email') = '2240084@slu.edu.ph');

drop policy if exists "Only the handbook admin can delete pages" on public.handbook_pages;
create policy "Only the handbook admin can delete pages"
  on public.handbook_pages for delete to authenticated
  using (lower(auth.jwt() ->> 'email') = '2240084@slu.edu.ph');

insert into storage.buckets (id, name, public, file_size_limit)
values ('tab-uploads', 'tab-uploads', true, 26214400)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

drop policy if exists "Anyone can view handbook uploads" on storage.objects;
create policy "Anyone can view handbook uploads"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'tab-uploads');

drop policy if exists "Only the handbook admin can upload handbook files" on storage.objects;
create policy "Only the handbook admin can upload handbook files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tab-uploads'
    and lower(auth.jwt() ->> 'email') = '2240084@slu.edu.ph'
  );

drop policy if exists "Only the handbook admin can delete handbook files" on storage.objects;
create policy "Only the handbook admin can delete handbook files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'tab-uploads'
    and lower(auth.jwt() ->> 'email') = '2240084@slu.edu.ph'
  );
