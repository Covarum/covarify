create table public.transaction_understanding_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plaid_transaction_id uuid not null references public.plaid_transactions(id) on delete cascade,
  source_condition_signature text not null,
  parsed_intent jsonb not null,
  prior_effective_state jsonb not null,
  confirmed_category text,
  treatment text check (treatment in ('personal', 'business', 'split', 'unsure')),
  split_details jsonb,
  context_label text,
  note text,
  reimbursable boolean not null default false,
  receipt_needed boolean not null default false,
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid not null references auth.users(id),
  supersedes_record_id uuid references public.transaction_understanding_confirmations(id),
  rule_version text not null,
  input_modality text not null check (input_modality in ('typed', 'spoken', 'selected_transaction')),
  match_confidence text not null check (match_confidence in ('high', 'medium')),
  created_at timestamptz not null default now()
);

create index transaction_understanding_user_transaction_idx
  on public.transaction_understanding_confirmations(user_id, plaid_transaction_id, confirmed_at desc);

alter table public.transaction_understanding_confirmations enable row level security;
revoke all on table public.transaction_understanding_confirmations from anon, authenticated;
grant select, insert on table public.transaction_understanding_confirmations to service_role;

create policy "service role owns transaction understanding"
  on public.transaction_understanding_confirmations
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.transaction_understanding_confirmations is
  'Append-only structured user meaning. Plaid source transaction fields remain immutable.';
