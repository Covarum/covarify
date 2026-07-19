-- Database-backed RLS verification for the linked project.
-- All fixture data is rolled back at the end of the transaction.
begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rls-user-1@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rls-user-2@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.consent_records (id, user_id, consent_version, products_requested, purposes, accepted_at) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'test-v1', array['transactions'], array['rls-test'], now()),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'test-v1', array['transactions'], array['rls-test'], now());

insert into public.plaid_items (id, user_id, plaid_item_id, environment, encrypted_access_token, token_key_version, status, consent_id) values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'rls-item-1', 'sandbox', 'secret-1', 'test', 'active', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'rls-item-2', 'sandbox', 'secret-2', 'test', 'active', '10000000-0000-4000-8000-000000000002');

insert into public.plaid_accounts (id, user_id, plaid_item_id, plaid_account_id, name, type) values
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'rls-account-1', 'Test 1', 'depository'),
  ('30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'rls-account-2', 'Test 2', 'depository');

insert into public.transaction_sync_states (plaid_item_id) values
  ('20000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002');

insert into public.plaid_transactions (user_id, plaid_item_id, plaid_account_id, plaid_transaction_id, amount, transaction_name, transaction_date, pending) values
  ('00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'rls-transaction-1', 10, 'Test 1', current_date, false),
  ('00000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'rls-transaction-2', 20, 'Test 2', current_date, false);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

do $$
begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'profile RLS isolation failed for user 1'; end if;
  if (select count(*) from public.consent_records) <> 1 then raise exception 'consent RLS isolation failed for user 1'; end if;
  if (select count(*) from public.plaid_items) <> 1 then raise exception 'item RLS isolation failed for user 1'; end if;
  if (select count(*) from public.plaid_accounts) <> 1 then raise exception 'account RLS isolation failed for user 1'; end if;
  if (select count(*) from public.transaction_sync_states) <> 1 then raise exception 'sync-state RLS isolation failed for user 1'; end if;
  if (select count(*) from public.plaid_transactions) <> 1 then raise exception 'transaction RLS isolation failed for user 1'; end if;
  if has_column_privilege('authenticated', 'public.plaid_items', 'encrypted_access_token', 'select') then raise exception 'encrypted access token is selectable'; end if;
  if has_column_privilege('authenticated', 'public.plaid_items', 'token_key_version', 'select') then raise exception 'token key version is selectable'; end if;
  if has_table_privilege('authenticated', 'public.plaid_webhook_events', 'select') then raise exception 'webhook events are selectable'; end if;
  if has_table_privilege('authenticated', 'public.audit_events', 'select') then raise exception 'audit events are selectable'; end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);

do $$
begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'profile RLS isolation failed for user 2'; end if;
  if (select count(*) from public.consent_records) <> 1 then raise exception 'consent RLS isolation failed for user 2'; end if;
  if (select count(*) from public.plaid_items) <> 1 then raise exception 'item RLS isolation failed for user 2'; end if;
  if (select count(*) from public.plaid_accounts) <> 1 then raise exception 'account RLS isolation failed for user 2'; end if;
  if (select count(*) from public.transaction_sync_states) <> 1 then raise exception 'sync-state RLS isolation failed for user 2'; end if;
  if (select count(*) from public.plaid_transactions) <> 1 then raise exception 'transaction RLS isolation failed for user 2'; end if;
end $$;

rollback;
