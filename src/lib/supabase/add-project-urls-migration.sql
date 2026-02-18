-- Add Figma and Webflow URL columns to existing projects table
-- Run this in the Supabase SQL Editor if you already have the projects table

alter table public.projects add column if not exists figma_url text;
alter table public.projects add column if not exists webflow_url text;
