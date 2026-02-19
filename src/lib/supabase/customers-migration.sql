-- Launch Buddy: Customers Migration
-- Run this in the Supabase SQL Editor

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  fortnox_id text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.customers
  add column if not exists fortnox_id text;

alter table public.customers enable row level security;

alter table public.todo_items
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

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
