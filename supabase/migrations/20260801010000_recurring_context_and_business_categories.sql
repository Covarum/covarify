begin;

do $$
declare
  v_parent_id uuid := '10000000-0000-4000-8000-000000000014';
  v_subcategory_id uuid := '20000000-0000-4000-8000-000000000026';
begin
  insert into public.category_parents(id, display_name, normalized_name, aliases)
  values (v_parent_id, 'Business', 'business', '{"work","business expense"}')
  on conflict (id) do nothing;
  if not exists (select 1 from public.category_parents where id = v_parent_id and normalized_name = 'business' and status = 'active') then
    raise exception 'canonical Business category is missing or mismatched' using errcode = '23514';
  end if;
  insert into public.category_subcategories(id, parent_category_id, display_name, normalized_name, aliases, category_type)
  values (v_subcategory_id, v_parent_id, 'Software & Services', 'software and service', '{"software","software service","business software","saas"}', 'system')
  on conflict (id) do nothing;
  if not exists (select 1 from public.category_subcategories where id = v_subcategory_id and parent_category_id = v_parent_id and status = 'active') then
    raise exception 'canonical Software & Services category is missing or mismatched' using errcode = '23514';
  end if;
end;
$$;

alter table public.recurring_commitment_decision_versions
  add column context_owner_kind text check (context_owner_kind is null or context_owner_kind in ('personal','household','business','unknown')),
  add column context_entity_name text check (context_entity_name is null or char_length(context_entity_name) <= 80),
  add column context_relationship text check (context_relationship is null or context_relationship in ('owner','employee','contractor','other')),
  add column context_purpose text check (context_purpose is null or char_length(context_purpose) <= 240),
  add column business_use boolean,
  add column context_complete boolean not null default false,
  add column merchant_memory_created boolean not null default false;

create function public.preserve_recurring_commitment_context()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.supersedes_version_id is not null
    and new.context_owner_kind is null and new.context_entity_name is null
    and new.context_relationship is null and new.context_purpose is null
    and new.business_use is null and not new.context_complete and not new.merchant_memory_created then
    select prior.context_owner_kind, prior.context_entity_name, prior.context_relationship,
      prior.context_purpose, prior.business_use, prior.context_complete, prior.merchant_memory_created
    into new.context_owner_kind, new.context_entity_name, new.context_relationship,
      new.context_purpose, new.business_use, new.context_complete, new.merchant_memory_created
    from public.recurring_commitment_decision_versions prior
    where prior.user_id = new.user_id and prior.commitment_id = new.commitment_id
      and prior.id = new.supersedes_version_id;
  end if;
  return new;
end;
$$;
create trigger recurring_commitment_context_preserve
before insert on public.recurring_commitment_decision_versions
for each row execute function public.preserve_recurring_commitment_context();

create function public.record_recurring_commitment_context_decision(
  p_user_id uuid,
  p_pattern_key text,
  p_context jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_commitment_id uuid;
  v_prior public.recurring_commitment_decision_versions%rowtype;
  v_decision_id uuid;
  v_normalized_merchant text;
  v_parent_id uuid := nullif(p_context->>'effectiveParentCategoryId', '')::uuid;
  v_subcategory_id uuid := nullif(p_context->>'effectiveSubcategoryId', '')::uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || ':' || p_pattern_key, 0));
  select id, normalized_merchant into v_commitment_id, v_normalized_merchant from public.recurring_commitments
  where user_id = p_user_id and pattern_key = p_pattern_key;
  if not found then raise exception 'owned commitment not found' using errcode = 'P0002'; end if;
  select * into v_prior from public.recurring_commitment_decision_versions decision
  where decision.user_id = p_user_id and decision.commitment_id = v_commitment_id
    and not exists (select 1 from public.recurring_commitment_decision_versions successor where successor.user_id = decision.user_id and successor.supersedes_version_id = decision.id)
  order by decision.created_at desc, decision.id desc limit 1 for update;
  if not found then raise exception 'current recurring decision not found' using errcode = 'P0002'; end if;
  if v_parent_id is not null and not exists (
    select 1 from public.category_subcategories subcategory
    where subcategory.id = v_subcategory_id and subcategory.parent_category_id = v_parent_id
      and subcategory.status = 'active' and (subcategory.user_id is null or subcategory.user_id = p_user_id)
  ) then raise exception 'category is unavailable to this user' using errcode = '23503'; end if;

  insert into public.recurring_commitment_decision_versions(
    user_id, commitment_id, supersedes_version_id, recurring_status, recognition_status,
    disposition, commitment_type, owner_label, user_note, identity_note, login_status,
    duplicate_decision, manual_original_purpose, manual_current_balance,
    manual_original_amount, manual_payments_remaining, manual_next_payment_date,
    created_by, effective_parent_category_id, effective_subcategory_id,
    effective_parent_category, effective_subcategory, category_resolution,
    supporting_transactions_classified, context_owner_kind, context_entity_name,
    context_relationship, context_purpose, business_use, context_complete, merchant_memory_created
  ) values (
    p_user_id, v_commitment_id, v_prior.id, v_prior.recurring_status, v_prior.recognition_status,
    v_prior.disposition, v_prior.commitment_type, v_prior.owner_label, v_prior.user_note,
    v_prior.identity_note, v_prior.login_status, v_prior.duplicate_decision,
    v_prior.manual_original_purpose, v_prior.manual_current_balance,
    v_prior.manual_original_amount, v_prior.manual_payments_remaining,
    v_prior.manual_next_payment_date, p_user_id,
    coalesce(v_parent_id, v_prior.effective_parent_category_id),
    coalesce(v_subcategory_id, v_prior.effective_subcategory_id),
    coalesce(nullif(p_context->>'effectiveParentCategory',''), v_prior.effective_parent_category),
    coalesce(nullif(p_context->>'effectiveSubcategory',''), v_prior.effective_subcategory),
    coalesce(nullif(p_context->>'categoryResolution',''), v_prior.category_resolution),
    v_prior.supporting_transactions_classified,
    coalesce(nullif(p_context->>'contextOwnerKind',''), v_prior.context_owner_kind),
    coalesce(nullif(p_context->>'contextEntityName',''), v_prior.context_entity_name),
    coalesce(nullif(p_context->>'contextRelationship',''), v_prior.context_relationship),
    coalesce(nullif(p_context->>'contextPurpose',''), v_prior.context_purpose),
    case when p_context ? 'businessUse' then (p_context->>'businessUse')::boolean else v_prior.business_use end,
    case when p_context ? 'contextComplete' then (p_context->>'contextComplete')::boolean else v_prior.context_complete end,
    case when p_context ? 'merchantMemoryCreated' then (p_context->>'merchantMemoryCreated')::boolean else v_prior.merchant_memory_created end
  ) returning id into v_decision_id;
  if coalesce((p_context->>'merchantMemoryCreated')::boolean, false) then
    if exists (
      select 1 from public.merchant_category_rules rule
      where rule.user_id = p_user_id and rule.normalized_merchant_name = v_normalized_merchant
        and rule.status = 'active'
        and (rule.parent_category_id <> v_parent_id or rule.subcategory_id <> v_subcategory_id)
    ) then raise exception 'conflicting merchant memory requires review' using errcode = '23505'; end if;
    insert into public.merchant_category_rules(
      id, user_id, normalized_merchant_name, parent_category_id, subcategory_id, rule_scope, status
    ) select pg_catalog.gen_random_uuid(), p_user_id, v_normalized_merchant,
      v_parent_id, v_subcategory_id, 'future', 'active'
    where not exists (
      select 1 from public.merchant_category_rules rule
      where rule.user_id = p_user_id and rule.normalized_merchant_name = v_normalized_merchant
        and rule.parent_category_id = v_parent_id and rule.subcategory_id = v_subcategory_id
        and rule.status = 'active'
    );
  end if;
  return v_decision_id;
end;
$$;

revoke all on function public.record_recurring_commitment_context_decision(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.record_recurring_commitment_context_decision(uuid,text,jsonb) to service_role;

create or replace view public.recurring_commitment_current_decisions
with (security_invoker = true) as
select c.user_id, c.pattern_key, d.id, d.commitment_id, d.recurring_status,
  d.recognition_status, d.disposition, d.commitment_type, d.owner_label,
  d.user_note, d.identity_note, d.login_status, d.duplicate_decision,
  d.manual_original_purpose, d.manual_current_balance, d.manual_original_amount,
  d.manual_payments_remaining, d.manual_next_payment_date, d.created_at,
  d.effective_parent_category_id, d.effective_subcategory_id,
  d.effective_parent_category, d.effective_subcategory, d.category_resolution,
  d.supporting_transactions_classified, d.context_owner_kind, d.context_entity_name,
  d.context_relationship, d.context_purpose, d.business_use, d.context_complete,
  d.merchant_memory_created
from public.recurring_commitments c
join public.recurring_commitment_decision_versions d on d.user_id = c.user_id and d.commitment_id = c.id
where not exists (select 1 from public.recurring_commitment_decision_versions successor where successor.user_id = d.user_id and successor.supersedes_version_id = d.id);
revoke all on public.recurring_commitment_current_decisions from anon, authenticated;
grant select on public.recurring_commitment_current_decisions to authenticated;

commit;
