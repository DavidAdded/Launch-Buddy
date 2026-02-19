-- Launch Buddy: Projects + File Upload Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. Projects table
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  project_budget_hours numeric,
  staging_url text,
  prod_url text,
  figma_url text,
  webflow_url text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Project files table
create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  content_type text,
  created_at timestamptz not null default now()
);

-- 3. Enable RLS
alter table public.projects enable row level security;
alter table public.project_files enable row level security;

-- 4. RLS policies for projects
create policy "Users can view their own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can view public projects"
  on public.projects for select
  using (is_public = true);

create policy "Users can create their own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on public.projects for update
  using (auth.uid() = user_id);

create policy "Users can update public projects"
  on public.projects for update
  using (is_public = true and auth.uid() is not null);

create policy "Users can delete their own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- 5. RLS policies for project_files
create policy "Users can view their own project files"
  on public.project_files for select
  using (auth.uid() = user_id);

create policy "Users can view public project files"
  on public.project_files for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_files.project_id
      and projects.is_public = true
    )
  );

create policy "Users can insert their own project files"
  on public.project_files for insert
  with check (auth.uid() = user_id);

create policy "Users can insert public project files"
  on public.project_files for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = project_files.project_id
      and projects.is_public = true
      and auth.uid() is not null
    )
  );

create policy "Users can delete their own project files"
  on public.project_files for delete
  using (auth.uid() = user_id);

create policy "Users can delete public project files"
  on public.project_files for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_files.project_id
      and projects.is_public = true
      and auth.uid() is not null
    )
  );

-- 6. Auto-update updated_at on projects
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_projects_updated
  before update on public.projects
  for each row execute function public.handle_updated_at();

-- 7. Profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view all profiles"
  on public.profiles for select
  using (auth.uid() is not null);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger on_profiles_updated
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- 8. Storage bucket for project files
insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;

-- 9. Storage RLS policies (path: {user_id}/{project_id}/{filename})
create policy "Users can upload to their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view their own files"
  on storage.objects for select
  using (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own files"
  on storage.objects for delete
  using (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
