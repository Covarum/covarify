create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  notification_email text,
  status text not null check (status in ('processing','scheduled','action_required','legal_hold','completed')),
  requested_at timestamptz not null default now(),
  immediate_actions_completed_at timestamptz,
  deletion_due_at timestamptz not null,
  completed_at timestamptz,
  received_email_sent_at timestamptz,
  completed_email_sent_at timestamptz,
  legal_hold_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index account_deletion_one_open on public.account_deletion_requests(user_id) where status <> 'completed';
create index account_deletion_due on public.account_deletion_requests(status,deletion_due_at);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from anon, authenticated;

create or replace function public.disconnect_plaid_item_for_deletion(target_item_id uuid, disconnected_time timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.plaid_sync_jobs where plaid_item_id = target_item_id;
  update public.transaction_sync_states set sync_status='idle', last_error=null, updated_at=disconnected_time where plaid_item_id=target_item_id;
  update public.plaid_items set status='disconnected', encrypted_access_token=null, token_key_version=null, disconnected_at=disconnected_time, updated_at=disconnected_time where id=target_item_id;
end $$;
revoke all on function public.disconnect_plaid_item_for_deletion(uuid,timestamptz) from public, anon, authenticated;

create or replace function public.complete_account_deletion(request_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target_user uuid; completed_time timestamptz := now();
begin
  select user_id into target_user from public.account_deletion_requests where id=request_id and status='scheduled' and deletion_due_at<=completed_time for update;
  if target_user is null then raise exception 'Deletion request is not due'; end if;
  delete from public.plaid_sync_jobs where plaid_item_id in (select id from public.plaid_items where user_id=target_user);
  delete from public.plaid_webhook_events where plaid_item_id in (select id from public.plaid_items where user_id=target_user) or source_plaid_item_id in (select plaid_item_id from public.plaid_items where user_id=target_user);
  delete from public.plaid_transactions where user_id=target_user;
  delete from public.transaction_sync_states where plaid_item_id in (select id from public.plaid_items where user_id=target_user);
  delete from public.plaid_accounts where user_id=target_user;
  delete from public.plaid_items where user_id=target_user;
  delete from public.plaid_link_attempts where user_id=target_user;
  update public.profiles set display_name=null, account_status='closed', updated_at=completed_time where id=target_user;
  update public.account_deletion_requests set status='completed', completed_at=completed_time, updated_at=completed_time where id=request_id;
  insert into public.audit_events(user_id,event_type,entity_type,entity_id,safe_metadata) values(target_user,'account_deletion_completed','account_deletion_request',request_id,'{}'::jsonb);
end $$;
revoke all on function public.complete_account_deletion(uuid) from public, anon, authenticated;

create or replace function public.purge_expired_plaid_operational_records()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.plaid_sync_jobs where created_at < now()-interval '30 days' and status in ('complete','failed');
  delete from public.plaid_webhook_events where received_at < now()-interval '90 days';
  delete from public.audit_events where created_at < now()-interval '7 years';
  delete from public.consent_records c where c.created_at < now()-interval '7 years' and not exists(select 1 from public.plaid_items i where i.consent_id=c.id);
  delete from public.account_deletion_requests where requested_at < now()-interval '7 years' and status='completed';
end $$;
revoke all on function public.purge_expired_plaid_operational_records() from public, anon, authenticated;
