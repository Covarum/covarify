create table public.category_parents (
  id uuid primary key,
  display_name text not null,
  normalized_name text not null unique,
  aliases text[] not null default '{}',
  category_type text not null default 'system' check (category_type = 'system'),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.category_subcategories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  parent_category_id uuid not null references public.category_parents(id) on delete restrict,
  display_name text not null,
  normalized_name text not null,
  aliases text[] not null default '{}',
  category_type text not null check (category_type in ('system', 'user')),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((category_type = 'system' and user_id is null) or (category_type = 'user' and user_id is not null))
);

create unique index category_subcategories_system_name_idx
  on public.category_subcategories(parent_category_id, normalized_name)
  where user_id is null;
create unique index category_subcategories_user_name_idx
  on public.category_subcategories(user_id, parent_category_id, normalized_name)
  where user_id is not null;

create function public.reject_duplicate_subcategory()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.category_subcategories existing
    where existing.parent_category_id = new.parent_category_id
      and existing.normalized_name = new.normalized_name
      and existing.status = 'active'
      and (existing.user_id is null or existing.user_id = new.user_id)
  ) then
    raise exception 'subcategory already exists under this parent' using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger category_subcategories_no_duplicate
before insert on public.category_subcategories
for each row execute function public.reject_duplicate_subcategory();

create table public.merchant_category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_identifier text,
  normalized_merchant_name text not null,
  parent_category_id uuid not null references public.category_parents(id) on delete restrict,
  subcategory_id uuid not null references public.category_subcategories(id) on delete restrict,
  rule_scope text not null check (rule_scope in ('future', 'past_and_future')),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index merchant_category_rules_user_merchant_idx
  on public.merchant_category_rules(user_id, normalized_merchant_name, created_at desc);

create function public.validate_merchant_category_rule()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.category_subcategories subcategory
    where subcategory.id = new.subcategory_id
      and subcategory.parent_category_id = new.parent_category_id
      and subcategory.status = 'active'
      and (subcategory.user_id is null or subcategory.user_id = new.user_id)
  ) then
    raise exception 'merchant rule subcategory is unavailable to this user' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger merchant_category_rules_validate_category
before insert or update on public.merchant_category_rules
for each row execute function public.validate_merchant_category_rule();

alter table public.transaction_understanding_confirmations
  add column effective_parent_category_id uuid references public.category_parents(id) on delete restrict,
  add column effective_subcategory_id uuid references public.category_subcategories(id) on delete restrict,
  add column confirmed_parent_category text,
  add column confirmed_subcategory text,
  add column requested_subcategory_name text,
  add column assignment_source text check (assignment_source in ('user_transaction', 'merchant_rule')),
  add column merchant_rule_id uuid references public.merchant_category_rules(id) on delete restrict;

alter table public.category_parents enable row level security;
alter table public.category_subcategories enable row level security;
alter table public.merchant_category_rules enable row level security;

revoke all on public.category_parents, public.category_subcategories, public.merchant_category_rules from anon;
revoke all on public.category_parents, public.category_subcategories, public.merchant_category_rules from authenticated;
grant select on public.category_parents to authenticated;
grant select, insert on public.category_subcategories to authenticated;
grant select, insert on public.merchant_category_rules to authenticated;
grant all on public.category_parents, public.category_subcategories, public.merchant_category_rules to service_role;

create policy "authenticated reads system parents"
  on public.category_parents for select to authenticated
  using (status = 'active');
create policy "authenticated reads owned or system subcategories"
  on public.category_subcategories for select to authenticated
  using (status = 'active' and (user_id is null or user_id = auth.uid()));
create policy "authenticated creates owned subcategories"
  on public.category_subcategories for insert to authenticated
  with check (user_id = auth.uid() and category_type = 'user' and status = 'active');
create policy "authenticated reads owned merchant rules"
  on public.merchant_category_rules for select to authenticated
  using (user_id = auth.uid());
create policy "authenticated creates owned merchant rules"
  on public.merchant_category_rules for insert to authenticated
  with check (user_id = auth.uid() and status = 'active');
create policy "service role manages category hierarchy"
  on public.category_parents for all to service_role using (true) with check (true);
create policy "service role manages subcategories"
  on public.category_subcategories for all to service_role using (true) with check (true);
create policy "service role manages merchant rules"
  on public.merchant_category_rules for all to service_role using (true) with check (true);

insert into public.category_parents(id, display_name, normalized_name) values
  ('10000000-0000-4000-8000-000000000001', 'Food & Drink', 'food and drink'),
  ('10000000-0000-4000-8000-000000000002', 'Transportation', 'transportation'),
  ('10000000-0000-4000-8000-000000000003', 'Shopping', 'shopping'),
  ('10000000-0000-4000-8000-000000000004', 'Medical', 'medical'),
  ('10000000-0000-4000-8000-000000000005', 'Travel', 'travel'),
  ('10000000-0000-4000-8000-000000000006', 'Personal Care', 'personal care'),
  ('10000000-0000-4000-8000-000000000007', 'Entertainment', 'entertainment'),
  ('10000000-0000-4000-8000-000000000008', 'Housing', 'housing'),
  ('10000000-0000-4000-8000-000000000009', 'Income', 'income'),
  ('10000000-0000-4000-8000-000000000010', 'Transfers', 'transfers'),
  ('10000000-0000-4000-8000-000000000011', 'Loan Payments', 'loan payments'),
  ('10000000-0000-4000-8000-000000000012', 'Other', 'other');

insert into public.category_subcategories(id, parent_category_id, display_name, normalized_name, aliases, category_type) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Groceries', 'grocery', '{"grocery"}', 'system'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Restaurants', 'restaurant', '{"dining"}', 'system'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Fast Food', 'fast food', '{}', 'system'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'Coffee', 'coffee', '{"cafe"}', 'system'),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'Liquor', 'liquor', '{"alcohol","wine and spirit","wine spirit","spirit"}', 'system'),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', 'Bars', 'bar', '{"pub"}', 'system'),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000002', 'Gas', 'gas', '{"fuel","gasoline"}', 'system'),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000002', 'Parking', 'parking', '{}', 'system'),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000002', 'Tolls', 'toll', '{}', 'system'),
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000002', 'Rideshare', 'rideshare', '{"uber","lyft","uber lyft"}', 'system'),
  ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000002', 'Repairs', 'repair', '{"auto repair","car repair"}', 'system'),
  ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000003', 'Clothing', 'clothing', '{"clothes"}', 'system'),
  ('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000003', 'Household', 'household', '{"home goods"}', 'system'),
  ('20000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000003', 'Electronics', 'electronic', '{"technology"}', 'system'),
  ('20000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000003', 'Gifts', 'gift', '{}', 'system');

comment on table public.category_parents is 'System-controlled top-level analytical categories.';
comment on table public.category_subcategories is 'System and user-owned subcategories scoped to one parent.';
comment on table public.merchant_category_rules is 'Exact merchant rules assigning both parent and subcategory without mutating Plaid evidence.';
