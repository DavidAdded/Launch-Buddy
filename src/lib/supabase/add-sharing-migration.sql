-- Launch Buddy: Sharing Migration (for existing databases)
-- Run this in the Supabase SQL Editor AFTER the initial migration + checklist migration

-- 1. Add is_public column to projects
alter table public.projects add column if not exists is_public boolean not null default false;

-- 2. New RLS policies for projects
create policy "Users can view public projects"
  on public.projects for select
  using (is_public = true);

create policy "Users can update public projects"
  on public.projects for update
  using (is_public = true and auth.uid() is not null);

-- 3. New RLS policies for project_files (public project access)
create policy "Users can view public project files"
  on public.project_files for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_files.project_id
      and projects.is_public = true
    )
  );

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

-- 4. New RLS policies for checklist_items (public project access)
create policy "Users can view public project checklist items"
  on public.checklist_items for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = checklist_items.project_id
      and projects.is_public = true
    )
  );

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

-- 5. Storage: allow authenticated users to read files in project-files bucket.
-- Security: signed URLs are only generated server-side for files visible via project_files RLS.

create policy "Authenticated users can view project files in storage"
  on storage.objects for select
  using (
    bucket_id = 'project-files'
    and auth.uid() is not null
  );
