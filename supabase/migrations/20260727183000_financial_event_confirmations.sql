create table public.financial_event_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  event_id text not null,
  inferred_type text not null,
  user_confirmed_type text,
  user_confirmed_title text,
  recurrence_confirmed boolean,
  recurrence_rejected boolean not null default false,
  grouping_confirmed boolean,
  grouping_rejected boolean not null default false,
  reviewed_at timestamptz not null default now(),
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  source_condition_signature text not null,
  engine_rule_version text not null,
  created_at timestamptz not null default now(),
  constraint financial_event_title_length
    check (user_confirmed_title is null or char_length(user_confirmed_title) between 1 and 80),
  constraint financial_event_recurrence_decision
    check (not (recurrence_rejected and recurrence_confirmed is true)),
  constraint financial_event_grouping_decision
    check (not (grouping_rejected and grouping_confirmed is true))
);

create index financial_event_confirmations_user_event_idx
  on public.financial_event_confirmations(user_id, event_id, reviewed_at desc);

alter table public.financial_event_confirmations enable row level security;

revoke all on table public.financial_event_confirmations from anon, authenticated;
grant select, insert on table public.financial_event_confirmations to service_role;

comment on table public.financial_event_confirmations is
  'Append-only founder review history. Source transactions and deterministic inference remain unchanged.';
