alter table public.plaid_webhook_events add column if not exists source_plaid_item_id text;

create table public.plaid_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  plaid_item_id uuid not null references public.plaid_items(id) on delete restrict,
  idempotency_key text not null unique,
  webhook_code text not null,
  status text not null default 'queued' check (status in ('queued','running','retry','complete','failed')),
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  safe_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index plaid_sync_jobs_one_active_per_item on public.plaid_sync_jobs(plaid_item_id) where status in ('queued','running','retry');
create index plaid_sync_jobs_due_idx on public.plaid_sync_jobs(status, available_at);

create table public.plaid_link_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  state_hash text not null unique,
  consent_version text not null,
  status text not null default 'created' check (status in ('created','consumed','expired','failed')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index plaid_link_attempts_user_idx on public.plaid_link_attempts(user_id, created_at desc);

alter table public.plaid_sync_jobs enable row level security;
alter table public.plaid_link_attempts enable row level security;
revoke all on public.plaid_sync_jobs, public.plaid_link_attempts from anon, authenticated;

-- These operational tables are service-role only. Link state is consumed through
-- authenticated server routes and sync jobs through the dedicated worker.
