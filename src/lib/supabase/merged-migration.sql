-- =============================================================================
-- Launch Buddy: Merged Migration (fresh Supabase instance)
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- =============================================================================

-- =============================================================================
-- 1. UTILITY FUNCTIONS
-- =============================================================================

-- Auto-update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =============================================================================
-- 2. PROFILES TABLE
-- =============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text,
  is_admin boolean not null default false,
  fortnox_id text,
  scopes jsonb not null default '["projects"]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view all profiles" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;

create policy "Users can view all profiles"
  on public.profiles for select
  using (auth.uid() is not null);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on new user signup (stores email + admin bootstrap)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, is_admin)
  values (new.id, new.email, new.email = 'david@added.digital')
  on conflict (id) do update
    set email = excluded.email,
        is_admin = public.profiles.is_admin or excluded.is_admin;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_profiles_updated on public.profiles;
create trigger on_profiles_updated
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- Ensure the bootstrap super admin has admin rights if the auth user already exists
update public.profiles
set is_admin = true
where id = (
  select id
  from auth.users
  where email = 'david@added.digital'
  limit 1
);

-- Helper function to check admin status (usable in RLS policies)
create or replace function public.is_admin()
returns boolean as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$ language sql security definer stable;

-- =============================================================================
-- 3. CUSTOMERS TABLE
-- =============================================================================

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  fortnox_id text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.customers enable row level security;

drop policy if exists "Users can view customers" on public.customers;
drop policy if exists "Admins can create customers" on public.customers;
drop policy if exists "Admins can update customers" on public.customers;
drop policy if exists "Admins can delete customers" on public.customers;

create policy "Users can view customers"
  on public.customers for select
  using (auth.uid() is not null);

create policy "Admins can create customers"
  on public.customers for insert
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
      and profiles.is_admin = true
    )
  );

create policy "Admins can update customers"
  on public.customers for update
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
      and profiles.is_admin = true
    )
  );

create policy "Admins can delete customers"
  on public.customers for delete
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
      and profiles.is_admin = true
    )
  );

-- =============================================================================
-- 4. PROJECTS TABLE
-- =============================================================================

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  company_name text,
  customer_id uuid references public.customers(id) on delete set null,
  project_budget_hours numeric,
  staging_url text,
  prod_url text,
  figma_url text,
  webflow_url text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

drop policy if exists "Users can view their own projects" on public.projects;
drop policy if exists "Users can view public projects" on public.projects;
drop policy if exists "Users can create their own projects" on public.projects;
drop policy if exists "Users can update their own projects" on public.projects;
drop policy if exists "Users can update public projects" on public.projects;
drop policy if exists "Users can delete their own projects" on public.projects;

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

drop trigger if exists on_projects_updated on public.projects;
create trigger on_projects_updated
  before update on public.projects
  for each row execute function public.handle_updated_at();

-- =============================================================================
-- 5. PROJECT FILES TABLE
-- =============================================================================

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

alter table public.project_files enable row level security;

drop policy if exists "Users can view their own project files" on public.project_files;
drop policy if exists "Users can view public project files" on public.project_files;
drop policy if exists "Users can insert their own project files" on public.project_files;
drop policy if exists "Users can insert public project files" on public.project_files;
drop policy if exists "Users can delete their own project files" on public.project_files;
drop policy if exists "Users can delete public project files" on public.project_files;

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

-- =============================================================================
-- 6. CHECKLIST ITEMS TABLE
-- =============================================================================

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  group_name text not null,
  label text not null,
  checked boolean not null default false,
  irrelevant boolean not null default false,
  assignee text,
  position integer not null,
  created_at timestamptz not null default now()
);

alter table public.checklist_items enable row level security;

drop policy if exists "Users can view their own checklist items" on public.checklist_items;
drop policy if exists "Users can view public project checklist items" on public.checklist_items;
drop policy if exists "Users can create their own checklist items" on public.checklist_items;
drop policy if exists "Users can create public project checklist items" on public.checklist_items;
drop policy if exists "Users can update their own checklist items" on public.checklist_items;
drop policy if exists "Users can update public project checklist items" on public.checklist_items;
drop policy if exists "Users can delete their own checklist items" on public.checklist_items;
drop policy if exists "Users can delete public project checklist items" on public.checklist_items;

create policy "Users can view their own checklist items"
  on public.checklist_items for select
  using (auth.uid() = user_id);

create policy "Users can view public project checklist items"
  on public.checklist_items for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = checklist_items.project_id
      and projects.is_public = true
    )
  );

create policy "Users can create their own checklist items"
  on public.checklist_items for insert
  with check (auth.uid() = user_id);

create policy "Users can create public project checklist items"
  on public.checklist_items for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = checklist_items.project_id
      and projects.is_public = true
      and auth.uid() is not null
    )
  );

create policy "Users can update their own checklist items"
  on public.checklist_items for update
  using (auth.uid() = user_id);

create policy "Users can update public project checklist items"
  on public.checklist_items for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = checklist_items.project_id
      and projects.is_public = true
      and auth.uid() is not null
    )
  );

create policy "Users can delete their own checklist items"
  on public.checklist_items for delete
  using (auth.uid() = user_id);

create policy "Users can delete public project checklist items"
  on public.checklist_items for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = checklist_items.project_id
      and projects.is_public = true
      and auth.uid() is not null
    )
  );

-- =============================================================================
-- 7. TODO ITEMS TABLE
-- =============================================================================

create table if not exists public.todo_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  checked boolean not null default false,
  assigned_to uuid references auth.users(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  position integer not null,
  created_at timestamptz not null default now()
);

alter table public.todo_items enable row level security;

drop policy if exists "Users can view their own todo items" on public.todo_items;
drop policy if exists "Users can view todo items assigned to them" on public.todo_items;
drop policy if exists "Users can create their own todo items" on public.todo_items;
drop policy if exists "Users can update their own todo items" on public.todo_items;
drop policy if exists "Assignees can check todo items assigned to them" on public.todo_items;
drop policy if exists "Users can delete their own todo items" on public.todo_items;

create policy "Users can view their own todo items"
  on public.todo_items for select
  using (auth.uid() = user_id);

create policy "Users can view todo items assigned to them"
  on public.todo_items for select
  using (auth.uid() = assigned_to);

create policy "Users can create their own todo items"
  on public.todo_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own todo items"
  on public.todo_items for update
  using (auth.uid() = user_id);

create policy "Assignees can check todo items assigned to them"
  on public.todo_items for update
  using (auth.uid() = assigned_to)
  with check (auth.uid() = assigned_to);

create policy "Users can delete their own todo items"
  on public.todo_items for delete
  using (auth.uid() = user_id);

-- =============================================================================
-- 8. FOOTPRINT REQUESTS TABLE
-- =============================================================================

create table if not exists public.footprint_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  model_name text not null,
  company_name text not null,
  raw_response jsonb,
  parsed_response jsonb,
  status text not null default 'pending',
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.footprint_requests enable row level security;

drop policy if exists "Users can view own project footprint requests" on public.footprint_requests;
drop policy if exists "Users can view public project footprint requests" on public.footprint_requests;
drop policy if exists "Users can create footprint requests for own projects" on public.footprint_requests;
drop policy if exists "Users can create footprint requests for public projects" on public.footprint_requests;
drop policy if exists "Users can update own footprint requests" on public.footprint_requests;
drop policy if exists "Users can delete own project footprint requests" on public.footprint_requests;
drop policy if exists "Users can delete public project footprint requests" on public.footprint_requests;

create policy "Users can view own project footprint requests"
  on public.footprint_requests for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = footprint_requests.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can view public project footprint requests"
  on public.footprint_requests for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = footprint_requests.project_id
      and projects.is_public = true
    )
  );

create policy "Users can create footprint requests for own projects"
  on public.footprint_requests for insert
  with check (
    auth.uid() = requested_by
    and exists (
      select 1 from public.projects
      where projects.id = footprint_requests.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can create footprint requests for public projects"
  on public.footprint_requests for insert
  with check (
    auth.uid() = requested_by
    and exists (
      select 1 from public.projects
      where projects.id = footprint_requests.project_id
      and projects.is_public = true
      and auth.uid() is not null
    )
  );

create policy "Users can update own footprint requests"
  on public.footprint_requests for update
  using (auth.uid() = requested_by);

create policy "Users can delete own project footprint requests"
  on public.footprint_requests for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = footprint_requests.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can delete public project footprint requests"
  on public.footprint_requests for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = footprint_requests.project_id
      and projects.is_public = true
      and auth.uid() is not null
    )
  );

create index if not exists idx_footprint_requests_project_id
  on public.footprint_requests (project_id, created_at desc);

-- =============================================================================
-- 9. FORTNOX TOKENS TABLE
-- =============================================================================

create table if not exists public.fortnox_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fortnox_tokens enable row level security;

drop policy if exists "Users can read own fortnox tokens" on public.fortnox_tokens;
drop policy if exists "Users can insert own fortnox tokens" on public.fortnox_tokens;
drop policy if exists "Users can update own fortnox tokens" on public.fortnox_tokens;
drop policy if exists "Users can delete own fortnox tokens" on public.fortnox_tokens;

create policy "Users can read own fortnox tokens"
  on public.fortnox_tokens for select
  using (auth.uid() = user_id);

create policy "Users can insert own fortnox tokens"
  on public.fortnox_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can update own fortnox tokens"
  on public.fortnox_tokens for update
  using (auth.uid() = user_id);

create policy "Users can delete own fortnox tokens"
  on public.fortnox_tokens for delete
  using (auth.uid() = user_id);

-- =============================================================================
-- 10. STORAGE BUCKET + POLICIES
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;

drop policy if exists "Users can upload to their own folder" on storage.objects;
drop policy if exists "Users can view their own files" on storage.objects;
drop policy if exists "Users can delete their own files" on storage.objects;
drop policy if exists "Authenticated users can view project files in storage" on storage.objects;

-- Owner can upload to their own folder (path: {user_id}/{project_id}/{filename})
create policy "Users can upload to their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can view their own files
create policy "Users can view their own files"
  on storage.objects for select
  using (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can delete their own files
create policy "Users can delete their own files"
  on storage.objects for delete
  using (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can view any project file in storage
-- (actual access control is via signed URLs generated server-side using project_files RLS)
create policy "Authenticated users can view project files in storage"
  on storage.objects for select
  using (
    bucket_id = 'project-files'
    and auth.uid() is not null
  );
