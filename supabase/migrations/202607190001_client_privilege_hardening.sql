-- Supabase grants broad table privileges to API roles by default. RLS still
-- filters rows, but explicit least-privilege grants are required to keep
-- service-only columns and operations unavailable to client roles.
revoke all on table
  public.profiles,
  public.consent_records,
  public.plaid_items,
  public.plaid_accounts,
  public.transaction_sync_states,
  public.plaid_transactions,
  public.plaid_webhook_events,
  public.audit_events
from anon, authenticated;

grant select on table
  public.profiles,
  public.consent_records,
  public.plaid_accounts,
  public.transaction_sync_states,
  public.plaid_transactions
to authenticated;

grant update (display_name, updated_at)
on public.profiles
to authenticated;

grant select (
  id,
  user_id,
  plaid_item_id,
  institution_id,
  institution_name,
  environment,
  status,
  consent_id,
  last_successful_sync_at,
  last_webhook_at,
  error_code,
  needs_update_mode,
  disconnected_at,
  created_at,
  updated_at
)
on public.plaid_items
to authenticated;
