-- Launch Buddy: Scopes Migration
-- Run this in the Supabase SQL Editor

-- 1. Add scopes column to profiles (jsonb array of allowed scope strings)
alter table public.profiles
  add column if not exists scopes jsonb not null default '["projects"]'::jsonb;

-- 2. Backfill existing users with default scopes
update public.profiles
set scopes = '["projects"]'::jsonb
where scopes is null;
