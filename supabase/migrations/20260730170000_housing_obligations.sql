do $$
declare
  v_housing_id constant uuid := '10000000-0000-4000-8000-000000000008';
  v_seed record;
begin
  if not exists (
    select 1
    from public.category_parents parent
    where parent.id = v_housing_id
      and parent.normalized_name = 'housing'
  ) then
    raise exception 'canonical Housing category is missing or mismatched' using errcode = '23514';
  end if;

  for v_seed in
    select *
    from (values
      (
        '20000000-0000-4000-8000-000000000016'::uuid,
        'Rent'::text,
        'rent'::text,
        '{"lease","lease payment","monthly rent"}'::text[]
      ),
      (
        '20000000-0000-4000-8000-000000000017'::uuid,
        'Mortgage'::text,
        'mortgage'::text,
        '{"home loan","home loan payment","mortgage payment"}'::text[]
      )
    ) seed(id, display_name, normalized_name, aliases)
  loop
    if exists (
      select 1
      from public.category_subcategories category
      where category.user_id is null
        and category.category_type = 'system'
        and category.normalized_name = v_seed.normalized_name
        and (
          category.parent_category_id <> v_housing_id
          or category.status <> 'active'
        )
    ) then
      raise exception 'canonical % category exists in a conflicting state', v_seed.display_name
        using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.category_subcategories category
      where category.user_id is null
        and category.category_type = 'system'
        and category.normalized_name = v_seed.normalized_name
        and category.parent_category_id = v_housing_id
        and category.status = 'active'
    ) then
      continue;
    end if;

    if exists (
      select 1
      from public.category_subcategories category
      where category.id = v_seed.id
    ) then
      raise exception 'reserved % category ID is already in use', v_seed.display_name
        using errcode = '23514';
    end if;

    insert into public.category_subcategories(
      id, parent_category_id, display_name, normalized_name, aliases, category_type
    ) values (
      v_seed.id, v_housing_id, v_seed.display_name, v_seed.normalized_name,
      v_seed.aliases, 'system'
    );
  end loop;
end;
$$;

create table public.recurring_obligation_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  obligation_key uuid not null,
  supersedes_version_id uuid,
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
  foreign key (user_id, supersedes_version_id)
    references public.recurring_obligation_versions(user_id, id) on delete restrict,
  check (supersedes_version_id is null or supersedes_version_id <> id),
  check (effective_end_date is null or effective_start_date is null or effective_end_date >= effective_start_date)
);

create index recurring_obligation_versions_owner_key_idx
  on public.recurring_obligation_versions(user_id, obligation_key, created_at desc);
create unique index recurring_obligation_versions_one_root_idx
  on public.recurring_obligation_versions(user_id, obligation_key)
  where supersedes_version_id is null;
create unique index recurring_obligation_versions_one_successor_idx
  on public.recurring_obligation_versions(user_id, supersedes_version_id)
  where supersedes_version_id is not null;

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
  supersedes_record_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, obligation_version_id)
    references public.recurring_obligation_versions(user_id, id) on delete restrict,
  foreign key (user_id, supersedes_record_id)
    references public.obligation_payment_records(user_id, id) on delete restrict,
  check (supersedes_record_id is null or supersedes_record_id <> id)
);

create index obligation_payment_records_owner_obligation_idx
  on public.obligation_payment_records(user_id, obligation_version_id, payment_date desc);
create index obligation_payment_records_transaction_idx
  on public.obligation_payment_records(user_id, plaid_transaction_id, created_at desc);
create unique index obligation_payment_records_one_root_idx
  on public.obligation_payment_records(user_id, plaid_transaction_id)
  where supersedes_record_id is null;
create unique index obligation_payment_records_one_successor_idx
  on public.obligation_payment_records(user_id, supersedes_record_id)
  where supersedes_record_id is not null;

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
  if new.supersedes_record_id is not null and not exists (
    select 1
    from public.obligation_payment_records prior
    where prior.id = new.supersedes_record_id
      and prior.user_id = new.user_id
      and prior.plaid_transaction_id = new.plaid_transaction_id
  ) then
    raise exception 'obligation payment predecessor has a different owner or transaction'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create function public.validate_obligation_version_predecessor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.supersedes_version_id is not null and not exists (
    select 1
    from public.recurring_obligation_versions prior
    where prior.id = new.supersedes_version_id
      and prior.user_id = new.user_id
      and prior.obligation_key = new.obligation_key
  ) then
    raise exception 'obligation predecessor has a different owner or logical identity'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger recurring_obligation_versions_validate_predecessor
before insert on public.recurring_obligation_versions
for each row execute function public.validate_obligation_version_predecessor();

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
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version_id uuid := gen_random_uuid();
  v_obligation_key uuid := gen_random_uuid();
  v_supersedes_version_id uuid;
  v_prior_payment_id uuid;
  v_amount numeric;
  v_payment_date date;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || p_transaction_id::text, 0)
  );

  select abs(plaid_tx.amount), plaid_tx.transaction_date
    into v_amount, v_payment_date
  from public.plaid_transactions plaid_tx
  where plaid_tx.id = p_transaction_id
    and plaid_tx.user_id = p_user_id
    and plaid_tx.removed_at is null;
  if not found then
    raise exception 'owned transaction not found' using errcode = 'P0002';
  end if;

  select payment.obligation_version_id, payment.id
    into v_supersedes_version_id, v_prior_payment_id
  from public.obligation_payment_records payment
  where payment.user_id = p_user_id
    and payment.plaid_transaction_id = p_transaction_id
    and not exists (
      select 1
      from public.obligation_payment_records successor
      where successor.user_id = payment.user_id
        and successor.supersedes_record_id = payment.id
    )
  order by payment.created_at desc, payment.id desc
  limit 1;
  if v_prior_payment_id is not null then
    select obligation.obligation_key
      into v_obligation_key
    from public.recurring_obligation_versions obligation
    where obligation.id = v_supersedes_version_id
      and obligation.user_id = p_user_id;
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
  return pg_catalog.jsonb_build_object(
    'obligationVersionId', v_version_id,
    'paymentRecordId', (
      select payment.id
      from public.obligation_payment_records payment
      where payment.user_id = p_user_id
        and payment.obligation_version_id = v_version_id
    ),
    'linkStatus', 'active'
  );
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
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prior public.obligation_payment_records%rowtype;
  v_record_id uuid := gen_random_uuid();
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || p_transaction_id::text, 0)
  );

  select *
    into v_prior
  from public.obligation_payment_records payment
  where payment.user_id = p_user_id
    and payment.plaid_transaction_id = p_transaction_id
    and not exists (
      select 1
      from public.obligation_payment_records successor
      where successor.user_id = payment.user_id
        and successor.supersedes_record_id = payment.id
    )
  order by payment.created_at desc, payment.id desc
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
  return pg_catalog.jsonb_build_object(
    'obligationVersionId', v_prior.obligation_version_id,
    'paymentRecordId', v_record_id,
    'linkStatus', 'unlinked'
  );
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
