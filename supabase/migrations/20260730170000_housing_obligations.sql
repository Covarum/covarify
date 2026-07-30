insert into public.category_subcategories(
  id, parent_category_id, display_name, normalized_name, aliases, category_type
) values
  (
    '20000000-0000-4000-8000-000000000016',
    '10000000-0000-4000-8000-000000000008',
    'Rent',
    'rent',
    '{"lease","lease payment","monthly rent"}',
    'system'
  ),
  (
    '20000000-0000-4000-8000-000000000017',
    '10000000-0000-4000-8000-000000000008',
    'Mortgage',
    'mortgage',
    '{"home loan","home loan payment","mortgage payment"}',
    'system'
  )
on conflict (id) do nothing;

create table public.recurring_obligation_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  obligation_key uuid not null,
  supersedes_version_id uuid references public.recurring_obligation_versions(id) on delete restrict,
  obligation_type text not null check (obligation_type in ('rent', 'mortgage')),
  payee_display_name text not null,
  normalized_payee_name text not null,
  expected_amount numeric check (expected_amount is null or expected_amount > 0),
  currency text not null default 'USD',
  frequency text not null default 'monthly' check (frequency = 'monthly'),
  due_day smallint check (due_day is null or due_day between 1 and 31),
  ongoing_status text not null check (ongoing_status in ('ongoing', 'ended', 'unsure')),
  effective_start_date date,
  effective_end_date date,
  confidence text not null default 'user_confirmed' check (confidence in ('user_confirmed', 'unsure')),
  source text not null default 'transaction_understanding' check (source = 'transaction_understanding'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  check (effective_end_date is null or effective_start_date is null or effective_end_date >= effective_start_date)
);

create index recurring_obligation_versions_owner_key_idx
  on public.recurring_obligation_versions(user_id, obligation_key, created_at desc);

create table public.obligation_payment_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  obligation_version_id uuid not null,
  plaid_transaction_id uuid not null references public.plaid_transactions(id) on delete restrict,
  payment_type text not null check (payment_type in ('full', 'partial', 'catch_up', 'late', 'extra', 'unsure')),
  link_status text not null default 'active' check (link_status in ('active', 'unlinked')),
  actual_payment_amount numeric not null check (actual_payment_amount > 0),
  expected_amount_snapshot numeric check (expected_amount_snapshot is null or expected_amount_snapshot > 0),
  remaining_due numeric check (remaining_due is null or remaining_due >= 0),
  payment_date date not null,
  due_period date,
  periods_outstanding smallint check (periods_outstanding is null or periods_outstanding > 0),
  next_due_date date,
  supersedes_record_id uuid references public.obligation_payment_records(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (user_id, obligation_version_id)
    references public.recurring_obligation_versions(user_id, id) on delete restrict
);

create index obligation_payment_records_owner_obligation_idx
  on public.obligation_payment_records(user_id, obligation_version_id, payment_date desc);
create index obligation_payment_records_transaction_idx
  on public.obligation_payment_records(user_id, plaid_transaction_id, created_at desc);

create function public.validate_obligation_payment_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.plaid_transactions plaid_tx
    where plaid_tx.id = new.plaid_transaction_id
      and plaid_tx.user_id = new.user_id
  ) then
    raise exception 'obligation payment transaction is not owned by this user' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger obligation_payment_records_validate_owner
before insert on public.obligation_payment_records
for each row execute function public.validate_obligation_payment_owner();

create function public.reject_obligation_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'recurring obligation history is append-only' using errcode = '55000';
end;
$$;

create trigger recurring_obligation_versions_append_only
before update or delete on public.recurring_obligation_versions
for each row execute function public.reject_obligation_history_mutation();
create trigger obligation_payment_records_append_only
before update or delete on public.obligation_payment_records
for each row execute function public.reject_obligation_history_mutation();

alter table public.recurring_obligation_versions enable row level security;
alter table public.obligation_payment_records enable row level security;

revoke all on public.recurring_obligation_versions, public.obligation_payment_records from anon, authenticated;
grant all on public.recurring_obligation_versions, public.obligation_payment_records to service_role;

create policy "service role manages recurring obligation versions"
  on public.recurring_obligation_versions for all to service_role
  using (true) with check (true);
create policy "service role manages obligation payment records"
  on public.obligation_payment_records for all to service_role
  using (true) with check (true);

create function public.record_housing_obligation(
  p_user_id uuid,
  p_transaction_id uuid,
  p_obligation_type text,
  p_payee_display_name text,
  p_normalized_payee_name text,
  p_expected_amount numeric,
  p_due_day smallint,
  p_ongoing_status text,
  p_payment_type text,
  p_remaining_due numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version_id uuid := gen_random_uuid();
  v_obligation_key uuid := gen_random_uuid();
  v_supersedes_version_id uuid;
  v_prior_payment_id uuid;
  v_prior_link_status text;
  v_amount numeric;
  v_payment_date date;
begin
  select abs(plaid_tx.amount), plaid_tx.transaction_date
    into v_amount, v_payment_date
  from public.plaid_transactions plaid_tx
  where plaid_tx.id = p_transaction_id
    and plaid_tx.user_id = p_user_id
    and plaid_tx.removed_at is null;
  if not found then
    raise exception 'owned transaction not found' using errcode = 'P0002';
  end if;

  select payment.obligation_version_id, payment.id, payment.link_status
    into v_supersedes_version_id, v_prior_payment_id, v_prior_link_status
  from public.obligation_payment_records payment
  where payment.user_id = p_user_id
    and payment.plaid_transaction_id = p_transaction_id
  order by payment.created_at desc
  limit 1;
  if v_prior_link_status = 'active' then
    select obligation.obligation_key
      into v_obligation_key
    from public.recurring_obligation_versions obligation
    where obligation.id = v_supersedes_version_id
      and obligation.user_id = p_user_id;
  else
    v_supersedes_version_id := null;
    v_prior_payment_id := null;
  end if;

  insert into public.recurring_obligation_versions(
    id, user_id, obligation_key, supersedes_version_id, obligation_type, payee_display_name,
    normalized_payee_name, expected_amount, due_day, ongoing_status,
    effective_start_date, created_by
  ) values (
    v_version_id, p_user_id, v_obligation_key, v_supersedes_version_id, p_obligation_type,
    p_payee_display_name, p_normalized_payee_name, p_expected_amount,
    p_due_day, p_ongoing_status, v_payment_date, p_user_id
  );

  insert into public.obligation_payment_records(
    user_id, obligation_version_id, plaid_transaction_id, payment_type,
    actual_payment_amount, expected_amount_snapshot, remaining_due,
    payment_date, supersedes_record_id, created_by
  ) values (
    p_user_id, v_version_id, p_transaction_id, p_payment_type,
    v_amount, p_expected_amount, p_remaining_due, v_payment_date,
    v_prior_payment_id, p_user_id
  );
  return v_version_id;
end;
$$;

revoke all on function public.record_housing_obligation(
  uuid, uuid, text, text, text, numeric, smallint, text, text, numeric
) from public, anon, authenticated;
grant execute on function public.record_housing_obligation(
  uuid, uuid, text, text, text, numeric, smallint, text, text, numeric
) to service_role;

create function public.unlink_housing_obligation(
  p_user_id uuid,
  p_transaction_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prior public.obligation_payment_records%rowtype;
  v_record_id uuid := gen_random_uuid();
begin
  select *
    into v_prior
  from public.obligation_payment_records payment
  where payment.user_id = p_user_id
    and payment.plaid_transaction_id = p_transaction_id
  order by payment.created_at desc
  limit 1;
  if not found or v_prior.link_status = 'unlinked' then
    raise exception 'active obligation link not found' using errcode = 'P0002';
  end if;
  insert into public.obligation_payment_records(
    id, user_id, obligation_version_id, plaid_transaction_id, payment_type,
    link_status, actual_payment_amount, expected_amount_snapshot, remaining_due,
    payment_date, due_period, periods_outstanding, next_due_date,
    supersedes_record_id, created_by
  ) values (
    v_record_id, v_prior.user_id, v_prior.obligation_version_id,
    v_prior.plaid_transaction_id, v_prior.payment_type, 'unlinked',
    v_prior.actual_payment_amount, v_prior.expected_amount_snapshot,
    v_prior.remaining_due, v_prior.payment_date, v_prior.due_period,
    v_prior.periods_outstanding, v_prior.next_due_date, v_prior.id, p_user_id
  );
  return v_record_id;
end;
$$;

revoke all on function public.unlink_housing_obligation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.unlink_housing_obligation(uuid, uuid)
  to service_role;

comment on table public.recurring_obligation_versions is
  'Append-only, user-owned versions of confirmed rent and mortgage obligations. Transaction amounts never become expected amounts implicitly.';
comment on table public.obligation_payment_records is
  'Append-only links between a confirmed obligation version and an owned Plaid payment transaction.';
