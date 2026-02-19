-- Launch Buddy: Todos Migration
-- Run this in the Supabase SQL Editor

create table if not exists public.todo_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  checked boolean not null default false,
  assigned_to uuid references auth.users(id) on delete set null,
  position integer not null,
  created_at timestamptz not null default now()
);

alter table public.todo_items enable row level security;

-- Users can view their own items
create policy "Users can view their own todo items"
  on public.todo_items for select
  using (auth.uid() = user_id);

-- Users can view items assigned to them
create policy "Users can view todo items assigned to them"
  on public.todo_items for select
  using (auth.uid() = assigned_to);

-- Users can create their own items
create policy "Users can create their own todo items"
  on public.todo_items for insert
  with check (auth.uid() = user_id);

-- Users can update their own items (full access)
create policy "Users can update their own todo items"
  on public.todo_items for update
  using (auth.uid() = user_id);

-- Assignees can update items assigned to them (only checked column)
create policy "Assignees can check todo items assigned to them"
  on public.todo_items for update
  using (auth.uid() = assigned_to)
  with check (auth.uid() = assigned_to);

-- Users can delete their own items only
create policy "Users can delete their own todo items"
  on public.todo_items for delete
  using (auth.uid() = user_id);
