-- Launch Buddy: Digital Footprint Migration
-- Run this in the Supabase SQL Editor AFTER the initial + checklist migrations

-- 1. Add company_name to projects table
alter table public.projects add column if not exists company_name text;

-- 2. Footprint requests table (stores both raw + parsed LLM responses)
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

-- 3. Enable RLS
alter table public.footprint_requests enable row level security;

-- 4. RLS policies for footprint_requests
-- Owner can view their own project footprints
create policy "Users can view own project footprint requests"
  on public.footprint_requests for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = footprint_requests.project_id
      and projects.user_id = auth.uid()
    )
  );

-- Public project footprints visible to all authenticated users
create policy "Users can view public project footprint requests"
  on public.footprint_requests for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = footprint_requests.project_id
      and projects.is_public = true
    )
  );

-- Authenticated users can insert footprint requests for projects they can access
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

-- Only request creator can update (for setting status/response after LLM call)
create policy "Users can update own footprint requests"
  on public.footprint_requests for update
  using (auth.uid() = requested_by);

-- Owner can delete
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

-- 5. Index for fast lookups by project
create index if not exists idx_footprint_requests_project_id
  on public.footprint_requests (project_id, created_at desc);


-- 6. Optional metadata index for experimental flow lookups
create index if not exists idx_footprint_requests_model_name
  on public.footprint_requests (project_id, model_name, created_at desc);
