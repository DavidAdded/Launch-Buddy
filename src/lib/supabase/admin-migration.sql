-- Launch Buddy: Admin Role Migration
-- Run this in the Supabase SQL Editor
--
-- IMPORTANT: After running this migration, disable public signups:
--   Supabase Dashboard > Authentication > Providers > Email > Uncheck "Allow new users to sign up"
--   New users can only be added via admin invite.

-- 1. Add is_admin column to profiles
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- 2. Add email column to profiles (for admin user listing)
alter table public.profiles
  add column if not exists email text;

-- 3. Update the trigger to store email on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

-- 4. Backfill emails for existing users
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id;

-- 5. Set david@added.digital as admin
update public.profiles
set is_admin = true
where id = (
  select id from auth.users where email = 'david@added.digital' limit 1
);

-- 6. Helper function to check admin status (usable in RLS policies)
create or replace function public.is_admin()
returns boolean as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$ language sql security definer stable;
