-- Launch Buddy: Add fortnox_id to profiles
-- Run this in the Supabase SQL Editor

alter table public.profiles
  add column if not exists fortnox_id text;
