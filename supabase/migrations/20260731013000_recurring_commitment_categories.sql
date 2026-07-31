do $$
declare
  v_parent_id constant uuid := '10000000-0000-4000-8000-000000000013';
  v_seed record;
begin
  insert into public.category_parents(id, display_name, normalized_name, aliases)
  values (v_parent_id, 'Insurance', 'insurance', '{"insurance policy"}')
  on conflict (id) do nothing;

  if not exists (
    select 1 from public.category_parents
    where id = v_parent_id and normalized_name = 'insurance' and status = 'active'
  ) then
    raise exception 'canonical Insurance category is missing or mismatched' using errcode = '23514';
  end if;

  for v_seed in select * from (values
    ('20000000-0000-4000-8000-000000000018'::uuid, 'Renters Insurance', 'renters insurance', '{"renter insurance","renters","rental insurance","renters policy"}'::text[]),
    ('20000000-0000-4000-8000-000000000019'::uuid, 'Homeowners Insurance', 'homeowners insurance', '{"homeowner insurance","home insurance"}'::text[]),
    ('20000000-0000-4000-8000-000000000020'::uuid, 'Auto Insurance', 'auto insurance', '{"car insurance","vehicle insurance"}'::text[]),
    ('20000000-0000-4000-8000-000000000021'::uuid, 'Life Insurance', 'life insurance', '{}'::text[]),
    ('20000000-0000-4000-8000-000000000022'::uuid, 'Health Insurance', 'health insurance', '{"medical insurance"}'::text[]),
    ('20000000-0000-4000-8000-000000000023'::uuid, 'Disability Insurance', 'disability insurance', '{}'::text[]),
    ('20000000-0000-4000-8000-000000000024'::uuid, 'Pet Insurance', 'pet insurance', '{}'::text[]),
    ('20000000-0000-4000-8000-000000000025'::uuid, 'Other Insurance', 'other insurance', '{"insurance"}'::text[])
  ) seed(id, display_name, normalized_name, aliases)
  loop
    if exists (
      select 1 from public.category_subcategories
      where user_id is null and normalized_name = v_seed.normalized_name
        and (parent_category_id <> v_parent_id or status <> 'active')
    ) then
      raise exception 'canonical % category exists in a conflicting state', v_seed.display_name using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.category_subcategories
      where user_id is null and parent_category_id = v_parent_id
        and normalized_name = v_seed.normalized_name and status = 'active'
    ) then
      insert into public.category_subcategories(
        id, parent_category_id, display_name, normalized_name, aliases, category_type
      ) values (
        v_seed.id, v_parent_id, v_seed.display_name, v_seed.normalized_name,
        v_seed.aliases, 'system'
      );
    end if;
  end loop;
end;
$$;

alter table public.recurring_commitment_decision_versions
  add column effective_parent_category_id uuid references public.category_parents(id) on delete restrict,
  add column effective_subcategory_id uuid references public.category_subcategories(id) on delete restrict,
  add column effective_parent_category text,
  add column effective_subcategory text,
  add column category_resolution text check (category_resolution in ('accepted', 'kept_current', 'unresolved')),
  add column supporting_transactions_classified boolean not null default false;

create function public.validate_recurring_commitment_category()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.supersedes_version_id is not null and new.category_resolution is null then
    select
      prior.effective_parent_category_id,
      prior.effective_subcategory_id,
      prior.effective_parent_category,
      prior.effective_subcategory,
      prior.category_resolution,
      prior.supporting_transactions_classified
    into
      new.effective_parent_category_id,
      new.effective_subcategory_id,
      new.effective_parent_category,
      new.effective_subcategory,
      new.category_resolution,
      new.supporting_transactions_classified
    from public.recurring_commitment_decision_versions prior
    where prior.id = new.supersedes_version_id
      and prior.user_id = new.user_id
      and prior.commitment_id = new.commitment_id;
  end if;
  if new.category_resolution = 'accepted' then
    if new.effective_parent_category_id is null or new.effective_subcategory_id is null then
      raise exception 'accepted recurring category requires canonical IDs' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.category_subcategories subcategory
      where subcategory.id = new.effective_subcategory_id
        and subcategory.parent_category_id = new.effective_parent_category_id
        and subcategory.status = 'active'
        and (subcategory.user_id is null or subcategory.user_id = new.user_id)
    ) then
      raise exception 'recurring category is unavailable to this user' using errcode = '23503';
    end if;
  elsif new.effective_parent_category_id is not null or new.effective_subcategory_id is not null then
    raise exception 'unaccepted recurring category cannot set canonical IDs' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger recurring_commitment_category_validate
before insert on public.recurring_commitment_decision_versions
for each row execute function public.validate_recurring_commitment_category();

create function public.record_recurring_commitment_category_decision(
  p_user_id uuid,
  p_pattern_key text,
  p_resolution text,
  p_parent_category_id uuid,
  p_subcategory_id uuid,
  p_supporting_transactions_classified boolean
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_commitment_id uuid;
  v_prior public.recurring_commitment_decision_versions%rowtype;
  v_decision_id uuid;
  v_parent_name text;
  v_subcategory_name text;
begin
  if p_resolution not in ('accepted', 'kept_current', 'unresolved') then
    raise exception 'invalid category resolution' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || p_pattern_key, 0)
  );
  select id into v_commitment_id from public.recurring_commitments
  where user_id = p_user_id and pattern_key = p_pattern_key;
  if not found then raise exception 'owned commitment not found' using errcode = 'P0002'; end if;

  select * into v_prior from public.recurring_commitment_decision_versions decision
  where decision.user_id = p_user_id and decision.commitment_id = v_commitment_id
    and not exists (
      select 1 from public.recurring_commitment_decision_versions successor
      where successor.user_id = decision.user_id
        and successor.supersedes_version_id = decision.id
    )
  order by decision.created_at desc, decision.id desc limit 1 for update;
  if not found then raise exception 'current recurring decision not found' using errcode = 'P0002'; end if;

  if p_resolution = 'accepted' then
    select parent.display_name, subcategory.display_name
      into v_parent_name, v_subcategory_name
    from public.category_parents parent
    join public.category_subcategories subcategory
      on subcategory.parent_category_id = parent.id
    where parent.id = p_parent_category_id
      and subcategory.id = p_subcategory_id
      and parent.status = 'active' and subcategory.status = 'active'
      and (subcategory.user_id is null or subcategory.user_id = p_user_id);
    if not found then raise exception 'category is unavailable to this user' using errcode = '23503'; end if;
  end if;

  insert into public.recurring_commitment_decision_versions(
    user_id, commitment_id, supersedes_version_id, recurring_status,
    recognition_status, disposition, commitment_type, owner_label, user_note,
    identity_note, login_status, duplicate_decision, manual_original_purpose,
    manual_current_balance, manual_original_amount, manual_payments_remaining,
    manual_next_payment_date, created_by, effective_parent_category_id,
    effective_subcategory_id, effective_parent_category, effective_subcategory,
    category_resolution, supporting_transactions_classified
  ) values (
    p_user_id, v_commitment_id, v_prior.id, v_prior.recurring_status,
    v_prior.recognition_status, v_prior.disposition, v_prior.commitment_type,
    v_prior.owner_label, v_prior.user_note, v_prior.identity_note,
    v_prior.login_status, v_prior.duplicate_decision, v_prior.manual_original_purpose,
    v_prior.manual_current_balance, v_prior.manual_original_amount,
    v_prior.manual_payments_remaining, v_prior.manual_next_payment_date, p_user_id,
    case when p_resolution = 'accepted' then p_parent_category_id end,
    case when p_resolution = 'accepted' then p_subcategory_id end,
    v_parent_name, v_subcategory_name, p_resolution,
    p_supporting_transactions_classified
  ) returning id into v_decision_id;
  return v_decision_id;
end;
$$;

revoke all on function public.record_recurring_commitment_category_decision(
  uuid, text, text, uuid, uuid, boolean
) from public, anon, authenticated;
grant execute on function public.record_recurring_commitment_category_decision(
  uuid, text, text, uuid, uuid, boolean
) to service_role;

create or replace view public.recurring_commitment_current_decisions
with (security_invoker = true) as
select
  c.user_id, c.pattern_key, d.id, d.commitment_id, d.recurring_status,
  d.recognition_status, d.disposition, d.commitment_type, d.owner_label,
  d.user_note, d.identity_note, d.login_status, d.duplicate_decision,
  d.manual_original_purpose, d.manual_current_balance, d.manual_original_amount,
  d.manual_payments_remaining, d.manual_next_payment_date, d.created_at,
  d.effective_parent_category_id, d.effective_subcategory_id,
  d.effective_parent_category, d.effective_subcategory,
  d.category_resolution, d.supporting_transactions_classified
from public.recurring_commitments c
join public.recurring_commitment_decision_versions d
  on d.user_id = c.user_id and d.commitment_id = c.id
where not exists (
  select 1 from public.recurring_commitment_decision_versions successor
  where successor.user_id = d.user_id and successor.supersedes_version_id = d.id
);
revoke all on public.recurring_commitment_current_decisions from anon, authenticated;
grant select on public.recurring_commitment_current_decisions to authenticated;
