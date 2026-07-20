create sequence if not exists public.beta_application_number_seq;

create table if not exists public.beta_applications (
  id uuid primary key default gen_random_uuid(),
  application_number bigint not null default nextval('public.beta_application_number_seq'),
  application_id text generated always as ('CF-' || lpad(application_number::text, 6, '0')) stored unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254),
  financial_stress text not null default '' check (char_length(financial_stress) <= 1500),
  decision text not null default '' check (char_length(decision) <= 1500),
  lead_source text not null default 'Other',
  lead_source_detail text not null default '',
  referred_by_name text not null default '',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  status text not null default 'waiting' check (status in ('waiting','invited','active','archived')),
  founder_notes text not null default '',
  invited_at timestamptz,
  activated_at timestamptz,
  admin_email_sent boolean not null default false,
  confirmation_email_sent boolean not null default false
);

create index if not exists beta_applications_created_at_idx on public.beta_applications (created_at desc);
create index if not exists beta_applications_status_idx on public.beta_applications (status);
create index if not exists beta_applications_email_idx on public.beta_applications (lower(email));
create index if not exists beta_applications_lead_source_idx on public.beta_applications (lead_source);

alter table public.beta_applications enable row level security;
revoke all on public.beta_applications from anon, authenticated;

create or replace function public.set_beta_application_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists beta_applications_updated_at on public.beta_applications;
create trigger beta_applications_updated_at before update on public.beta_applications
for each row execute function public.set_beta_application_updated_at();

comment on table public.beta_applications is 'Private Covarify early-access CRM. Access only through server-side service-role operations after founder authentication.';
