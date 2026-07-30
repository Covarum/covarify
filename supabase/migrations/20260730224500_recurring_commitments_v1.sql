create unique index if not exists plaid_transactions_owner_id_idx
  on public.plaid_transactions(user_id, id);
create unique index if not exists plaid_accounts_owner_id_idx
  on public.plaid_accounts(user_id, id);

create table public.recurring_commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  pattern_key text not null,
  source_condition_signature text not null,
  engine_rule_version text not null,
  display_name text not null check (char_length(display_name) between 1 and 160),
  normalized_merchant text not null check (char_length(normalized_merchant) between 1 and 160),
  commitment_type text not null check (commitment_type in (
    'subscription', 'utility', 'insurance', 'membership', 'software_service',
    'installment_loan', 'buy_now_pay_later', 'loan_payment',
    'recurring_transfer', 'other_recurring', 'unknown_recurring'
  )),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  cadence text not null check (cadence in (
    'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual', 'irregular'
  )),
  typical_amount numeric not null check (typical_amount >= 0),
  amount_min numeric not null check (amount_min >= 0),
  amount_max numeric not null check (amount_max >= amount_min),
  first_observed date not null,
  last_observed date not null check (last_observed >= first_observed),
  next_expected date,
  payment_account_id uuid,
  effective_category text,
  housing_obligation_version_id uuid,
  detection_evidence jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, pattern_key),
  unique (user_id, id),
  foreign key (user_id, payment_account_id)
    references public.plaid_accounts(user_id, id) on delete restrict,
  foreign key (user_id, housing_obligation_version_id)
    references public.recurring_obligation_versions(user_id, id) on delete restrict,
  check (housing_obligation_version_id is null or commitment_type in ('other_recurring', 'unknown_recurring'))
);

create table public.recurring_commitment_detection_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  commitment_id uuid not null,
  source_condition_signature text not null,
  engine_rule_version text not null,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  cadence text not null check (cadence in (
    'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual', 'irregular'
  )),
  evidence jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, commitment_id, source_condition_signature),
  unique (user_id, id),
  foreign key (user_id, commitment_id)
    references public.recurring_commitments(user_id, id) on delete restrict
);

create table public.recurring_commitment_transactions (
  user_id uuid not null references auth.users(id) on delete restrict,
  commitment_id uuid not null,
  plaid_transaction_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, commitment_id, plaid_transaction_id),
  foreign key (user_id, commitment_id)
    references public.recurring_commitments(user_id, id) on delete restrict,
  foreign key (user_id, plaid_transaction_id)
    references public.plaid_transactions(user_id, id) on delete restrict
);

create table public.recurring_commitment_decision_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  commitment_id uuid not null,
  supersedes_version_id uuid,
  recurring_status text not null check (recurring_status in ('confirmed', 'possible', 'not_recurring')),
  recognition_status text not null check (recognition_status in ('recognized', 'unrecognized', 'unsure')),
  disposition text not null check (disposition in ('keep', 'review', 'cancellation_requested', 'unsure')),
  commitment_type text check (commitment_type is null or commitment_type in (
    'subscription', 'utility', 'insurance', 'membership', 'software_service',
    'installment_loan', 'buy_now_pay_later', 'loan_payment',
    'recurring_transfer', 'other_recurring', 'unknown_recurring'
  )),
  owner_label text check (owner_label is null or owner_label in (
    'Mine', 'Household', 'Business', 'Someone else', 'Not sure'
  )),
  user_note text check (user_note is null or char_length(user_note) <= 1000),
  identity_note text check (identity_note is null or char_length(identity_note) <= 500),
  login_status text check (login_status is null or login_status in (
    'known', 'cannot_find', 'belongs_to_someone_else', 'unsure'
  )),
  duplicate_decision text check (duplicate_decision is null or duplicate_decision in (
    'separate', 'review', 'unrecognized_one'
  )),
  manual_original_purpose text check (
    manual_original_purpose is null or char_length(manual_original_purpose) <= 240
  ),
  manual_current_balance numeric check (manual_current_balance is null or manual_current_balance >= 0),
  manual_original_amount numeric check (manual_original_amount is null or manual_original_amount >= 0),
  manual_payments_remaining integer check (manual_payments_remaining is null or manual_payments_remaining >= 0),
  manual_next_payment_date date,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  unique (user_id, id),
  foreign key (user_id, commitment_id)
    references public.recurring_commitments(user_id, id) on delete restrict,
  foreign key (user_id, supersedes_version_id)
    references public.recurring_commitment_decision_versions(user_id, id) on delete restrict,
  check (created_by = user_id)
);

create unique index recurring_commitment_decisions_one_root_idx
  on public.recurring_commitment_decision_versions(user_id, commitment_id)
  where supersedes_version_id is null;
create unique index recurring_commitment_decisions_one_successor_idx
  on public.recurring_commitment_decision_versions(user_id, supersedes_version_id)
  where supersedes_version_id is not null;
create index recurring_commitments_owner_updated_idx
  on public.recurring_commitments(user_id, updated_at desc);
create index recurring_commitment_transactions_owner_tx_idx
  on public.recurring_commitment_transactions(user_id, plaid_transaction_id);

alter table public.recurring_commitments enable row level security;
alter table public.recurring_commitment_detection_versions enable row level security;
alter table public.recurring_commitment_transactions enable row level security;
alter table public.recurring_commitment_decision_versions enable row level security;

create policy recurring_commitments_select_own
  on public.recurring_commitments for select to authenticated
  using ((select auth.uid()) = user_id);
create policy recurring_detection_select_own
  on public.recurring_commitment_detection_versions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy recurring_transactions_select_own
  on public.recurring_commitment_transactions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy recurring_decisions_select_own
  on public.recurring_commitment_decision_versions for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.recurring_commitments from anon, authenticated;
revoke all on public.recurring_commitment_detection_versions from anon, authenticated;
revoke all on public.recurring_commitment_transactions from anon, authenticated;
revoke all on public.recurring_commitment_decision_versions from anon, authenticated;
grant select on public.recurring_commitments to authenticated;
grant select on public.recurring_commitment_detection_versions to authenticated;
grant select on public.recurring_commitment_transactions to authenticated;
grant select on public.recurring_commitment_decision_versions to authenticated;

create view public.recurring_commitment_current_decisions
with (security_invoker = true) as
select
  c.user_id,
  c.pattern_key,
  d.id,
  d.commitment_id,
  d.recurring_status,
  d.recognition_status,
  d.disposition,
  d.commitment_type,
  d.owner_label,
  d.user_note,
  d.identity_note,
  d.login_status,
  d.duplicate_decision,
  d.manual_original_purpose,
  d.manual_current_balance,
  d.manual_original_amount,
  d.manual_payments_remaining,
  d.manual_next_payment_date,
  d.created_at
from public.recurring_commitments c
join public.recurring_commitment_decision_versions d
  on d.user_id = c.user_id and d.commitment_id = c.id
where not exists (
  select 1
  from public.recurring_commitment_decision_versions successor
  where successor.user_id = d.user_id
    and successor.supersedes_version_id = d.id
);

revoke all on public.recurring_commitment_current_decisions from anon, authenticated;
grant select on public.recurring_commitment_current_decisions to authenticated;

create function public.record_recurring_commitment_decision(
  p_user_id uuid,
  p_pattern_key text,
  p_detection jsonb,
  p_supporting_transaction_ids uuid[],
  p_decision jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commitment_id uuid;
  v_prior_id uuid;
  v_decision_id uuid;
  v_transaction_count integer;
begin
  if p_user_id is null or coalesce(char_length(p_pattern_key), 0) < 1 then
    raise exception 'INVALID_RECURRING_COMMITMENT';
  end if;
  if coalesce(array_length(p_supporting_transaction_ids, 1), 0) < 3 then
    raise exception 'INSUFFICIENT_RECURRING_EVIDENCE';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_pattern_key, 0));

  select count(*) into v_transaction_count
  from public.plaid_transactions t
  where t.user_id = p_user_id
    and t.id = any(p_supporting_transaction_ids)
    and t.removed_at is null;
  if v_transaction_count <> array_length(p_supporting_transaction_ids, 1) then
    raise exception 'CROSS_USER_OR_MISSING_TRANSACTION';
  end if;

  insert into public.recurring_commitments(
    user_id, pattern_key, source_condition_signature, engine_rule_version,
    display_name, normalized_merchant, commitment_type, confidence, cadence,
    typical_amount, amount_min, amount_max, first_observed, last_observed,
    next_expected, payment_account_id, effective_category,
    housing_obligation_version_id, detection_evidence
  ) values (
    p_user_id,
    p_pattern_key,
    p_detection->>'sourceConditionSignature',
    p_detection->>'engineRuleVersion',
    p_detection->>'displayName',
    p_detection->>'normalizedMerchant',
    p_detection->>'commitmentType',
    p_detection->>'confidence',
    p_detection->>'cadence',
    (p_detection->>'typicalAmount')::numeric,
    (p_detection->>'amountMin')::numeric,
    (p_detection->>'amountMax')::numeric,
    (p_detection->>'firstObserved')::date,
    (p_detection->>'lastObserved')::date,
    nullif(p_detection->>'nextExpected', '')::date,
    nullif(p_detection->>'paymentAccountId', '')::uuid,
    nullif(p_detection->>'effectiveCategory', ''),
    nullif(p_detection->>'housingObligationVersionId', '')::uuid,
    p_detection
  )
  on conflict (user_id, pattern_key) do update set
    source_condition_signature = excluded.source_condition_signature,
    engine_rule_version = excluded.engine_rule_version,
    display_name = excluded.display_name,
    normalized_merchant = excluded.normalized_merchant,
    commitment_type = excluded.commitment_type,
    confidence = excluded.confidence,
    cadence = excluded.cadence,
    typical_amount = excluded.typical_amount,
    amount_min = excluded.amount_min,
    amount_max = excluded.amount_max,
    first_observed = excluded.first_observed,
    last_observed = excluded.last_observed,
    next_expected = excluded.next_expected,
    payment_account_id = excluded.payment_account_id,
    effective_category = excluded.effective_category,
    housing_obligation_version_id = excluded.housing_obligation_version_id,
    detection_evidence = excluded.detection_evidence,
    updated_at = now()
  returning id into v_commitment_id;

  insert into public.recurring_commitment_detection_versions(
    user_id, commitment_id, source_condition_signature, engine_rule_version,
    confidence, cadence, evidence
  ) values (
    p_user_id, v_commitment_id, p_detection->>'sourceConditionSignature',
    p_detection->>'engineRuleVersion', p_detection->>'confidence',
    p_detection->>'cadence', p_detection
  ) on conflict (user_id, commitment_id, source_condition_signature) do nothing;

  insert into public.recurring_commitment_transactions(
    user_id, commitment_id, plaid_transaction_id
  )
  select p_user_id, v_commitment_id, transaction_id
  from unnest(p_supporting_transaction_ids) transaction_id
  on conflict do nothing;

  select d.id into v_prior_id
  from public.recurring_commitment_decision_versions d
  where d.user_id = p_user_id
    and d.commitment_id = v_commitment_id
    and not exists (
      select 1
      from public.recurring_commitment_decision_versions successor
      where successor.user_id = d.user_id
        and successor.supersedes_version_id = d.id
    )
  order by d.created_at desc
  limit 1
  for update;

  insert into public.recurring_commitment_decision_versions(
    user_id, commitment_id, supersedes_version_id, recurring_status,
    recognition_status, disposition, commitment_type, owner_label, user_note,
    identity_note, login_status, duplicate_decision, manual_original_purpose,
    manual_current_balance, manual_original_amount, manual_payments_remaining,
    manual_next_payment_date, created_by
  ) values (
    p_user_id, v_commitment_id, v_prior_id,
    p_decision->>'recurringStatus',
    p_decision->>'recognitionStatus',
    p_decision->>'disposition',
    nullif(p_decision->>'commitmentType', ''),
    nullif(p_decision->>'ownerLabel', ''),
    nullif(p_decision->>'userNote', ''),
    nullif(p_decision->>'identityNote', ''),
    nullif(p_decision->>'loginStatus', ''),
    nullif(p_decision->>'duplicateDecision', ''),
    nullif(p_decision->>'manualOriginalPurpose', ''),
    nullif(p_decision->>'manualCurrentBalance', '')::numeric,
    nullif(p_decision->>'manualOriginalAmount', '')::numeric,
    nullif(p_decision->>'manualPaymentsRemaining', '')::integer,
    nullif(p_decision->>'manualNextPaymentDate', '')::date,
    p_user_id
  )
  returning id into v_decision_id;

  return v_decision_id;
end;
$$;

revoke all on function public.record_recurring_commitment_decision(
  uuid, text, jsonb, uuid[], jsonb
) from public, anon, authenticated;
grant execute on function public.record_recurring_commitment_decision(
  uuid, text, jsonb, uuid[], jsonb
) to service_role;

comment on table public.recurring_commitments is
  'Current deterministic recurring-pattern projection. Housing truth remains in recurring_obligation_versions.';
comment on table public.recurring_commitment_decision_versions is
  'Append-only, owner-scoped user decisions. Cancellation is intent only and never evidence of provider cancellation.';
