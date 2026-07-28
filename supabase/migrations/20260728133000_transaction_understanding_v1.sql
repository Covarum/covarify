create table public.transaction_understanding_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plaid_transaction_id uuid not null,
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
  supersedes_record_id uuid,
  rule_version text not null,
  input_modality text not null check (input_modality in ('typed', 'spoken', 'selected_transaction')),
  match_confidence text not null check (match_confidence in ('high', 'medium')),
  created_at timestamptz not null default now()
);

alter table public.plaid_transactions
  add constraint plaid_transactions_id_user_unique unique (id, user_id);

alter table public.transaction_understanding_confirmations
  add constraint transaction_understanding_owned_transaction_fk
  foreign key (plaid_transaction_id, user_id)
  references public.plaid_transactions(id, user_id)
  on delete restrict;

alter table public.transaction_understanding_confirmations
  add constraint transaction_understanding_record_owner_unique
  unique (id, user_id, plaid_transaction_id);

alter table public.transaction_understanding_confirmations
  add constraint transaction_understanding_supersession_fk
  foreign key (supersedes_record_id, user_id, plaid_transaction_id)
  references public.transaction_understanding_confirmations(id, user_id, plaid_transaction_id)
  on delete restrict;

create unique index transaction_understanding_single_supersession_idx
  on public.transaction_understanding_confirmations(supersedes_record_id)
  where supersedes_record_id is not null;

create index transaction_understanding_user_transaction_idx
  on public.transaction_understanding_confirmations(user_id, plaid_transaction_id, confirmed_at desc);

alter table public.transaction_understanding_confirmations enable row level security;
revoke all on table public.transaction_understanding_confirmations from anon, authenticated;
grant select, insert on table public.transaction_understanding_confirmations to service_role;

create policy "service role reads transaction understanding"
  on public.transaction_understanding_confirmations
  for select
  to service_role
  using (true);

create policy "service role appends transaction understanding"
  on public.transaction_understanding_confirmations
  for insert
  to service_role
  with check (auth.uid() is null);

create function public.reject_transaction_understanding_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'transaction understanding history is append-only';
end;
$$;

create trigger transaction_understanding_no_update
before update on public.transaction_understanding_confirmations
for each row execute function public.reject_transaction_understanding_mutation();

create trigger transaction_understanding_no_delete
before delete on public.transaction_understanding_confirmations
for each row execute function public.reject_transaction_understanding_mutation();

comment on table public.transaction_understanding_confirmations is
  'Append-only structured user meaning. Plaid source transaction fields remain immutable.';
