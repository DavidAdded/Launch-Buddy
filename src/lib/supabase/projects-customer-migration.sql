-- Launch Buddy: Connect Projects to Customers Migration
-- Run this in the Supabase SQL Editor

alter table public.projects
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

do $$
declare
  proj record;
  cust_id uuid;
begin
  for proj in
    select id, company_name, user_id
    from public.projects
    where company_name is not null
      and trim(company_name) <> ''
      and customer_id is null
  loop
    select c.id into cust_id
    from public.customers c
    where lower(c.name) = lower(trim(proj.company_name))
    limit 1;

    if cust_id is null then
      insert into public.customers (name, created_by)
      values (trim(proj.company_name), proj.user_id)
      returning id into cust_id;
    end if;

    update public.projects
    set customer_id = cust_id
    where id = proj.id;
  end loop;
end $$;
