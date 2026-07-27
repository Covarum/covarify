revoke update, delete, truncate, references, trigger
  on table public.financial_event_confirmations
  from service_role;

grant select, insert
  on table public.financial_event_confirmations
  to service_role;

comment on table public.financial_event_confirmations is
  'Append-only founder review history. Service-role access is limited to SELECT and INSERT; source evidence remains unchanged.';
