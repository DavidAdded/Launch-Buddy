-- Launch Buddy: Checklist Migration
-- Run this in the Supabase SQL Editor AFTER the initial migration

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
