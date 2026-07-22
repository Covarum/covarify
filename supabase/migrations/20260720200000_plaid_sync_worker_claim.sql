alter table public.plaid_sync_jobs add column if not exists lease_token uuid;
alter table public.plaid_sync_jobs add column if not exists resync_requested boolean not null default false;

create or replace function public.claim_plaid_sync_job(stale_after interval default interval '10 minutes')
returns table(id uuid, plaid_item_id uuid, webhook_code text, attempt_count integer, lease_token uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with candidate as (
    select j.id
    from public.plaid_sync_jobs j
    join public.plaid_items i on i.id = j.plaid_item_id
    where i.status <> 'disconnected'
      and (
        (j.status in ('queued', 'retry') and j.available_at <= now())
        or (j.status = 'running' and j.locked_at < now() - stale_after)
      )
    order by j.available_at, j.created_at
    for update of j skip locked
    limit 1
  ), claimed as (
    update public.plaid_sync_jobs j
    set status = 'running', attempt_count = j.attempt_count + 1, locked_at = now(),
        lease_token = gen_random_uuid(), updated_at = now()
    from candidate c
    where j.id = c.id
    returning j.id, j.plaid_item_id, j.webhook_code, j.attempt_count, j.lease_token
  )
  select c.id, c.plaid_item_id, c.webhook_code, c.attempt_count, c.lease_token from claimed c;
end;
$$;

create or replace function public.complete_plaid_sync_job(job_id uuid, job_lease_token uuid)
returns boolean language sql security definer set search_path = public, pg_temp as $$
  with changed as (
    update public.plaid_sync_jobs set
      status=case when resync_requested then 'queued' else 'complete' end,
      completed_at=case when resync_requested then null else now() end,
      available_at=case when resync_requested then now() else available_at end,
      attempt_count=case when resync_requested then 0 else attempt_count end,
      resync_requested=false, locked_at=null, lease_token=null, safe_error_code=null, updated_at=now()
    where id=job_id and status='running' and lease_token=job_lease_token returning plaid_item_id
  ), updated_item as (
    update public.plaid_items set status='active', last_successful_sync_at=now(), error_code=null, updated_at=now()
    where id=(select plaid_item_id from changed) returning 1
  ) select exists(select 1 from updated_item);
$$;

create or replace function public.retry_plaid_sync_job(job_id uuid, job_lease_token uuid, retry_at timestamptz, error_code text)
returns boolean language sql security definer set search_path = public, pg_temp as $$
  with changed as (
    update public.plaid_sync_jobs set status='retry', available_at=retry_at, locked_at=null,
      lease_token=null, safe_error_code=left(error_code,80), updated_at=now()
    where id=job_id and status='running' and lease_token=job_lease_token returning 1
  ) select exists(select 1 from changed);
$$;

create or replace function public.fail_plaid_sync_job(job_id uuid, job_lease_token uuid, error_code text)
returns boolean language sql security definer set search_path = public, pg_temp as $$
  with changed as (
    update public.plaid_sync_jobs set status='failed', locked_at=null, lease_token=null,
      safe_error_code=left(error_code,80), updated_at=now()
    where id=job_id and status='running' and lease_token=job_lease_token returning 1
  ) select exists(select 1 from changed);
$$;

revoke all on function public.claim_plaid_sync_job(interval) from public, anon, authenticated;
revoke all on function public.complete_plaid_sync_job(uuid,uuid) from public, anon, authenticated;
revoke all on function public.retry_plaid_sync_job(uuid,uuid,timestamptz,text) from public, anon, authenticated;
revoke all on function public.fail_plaid_sync_job(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.claim_plaid_sync_job(interval) to service_role;
grant execute on function public.complete_plaid_sync_job(uuid,uuid) to service_role;
grant execute on function public.retry_plaid_sync_job(uuid,uuid,timestamptz,text) to service_role;
grant execute on function public.fail_plaid_sync_job(uuid,uuid,text) to service_role;
