-- Replace coexisting generated/truncated vocabulary checks with one stable check.
-- This operates only on single-column CHECK constraints governing context_relationship.
do $$
declare
  v_table regclass := to_regclass('public.recurring_commitment_decision_versions');
  v_attnum smallint;
  v_constraint record;
  v_dropped integer := 0;
  v_final_count integer;
  v_final_definition text;
begin
  if v_table is null then
    raise exception 'recurring_commitment_decision_versions does not exist';
  end if;

  select attnum into v_attnum
  from pg_catalog.pg_attribute
  where attrelid = v_table
    and attname = 'context_relationship'
    and not attisdropped;

  if v_attnum is null then
    raise exception 'context_relationship does not exist on recurring_commitment_decision_versions';
  end if;

  for v_constraint in
    select c.conname, pg_catalog.pg_get_constraintdef(c.oid, true) as definition
    from pg_catalog.pg_constraint c
    where c.conrelid = v_table
      and c.contype = 'c'
      and c.conkey = array[v_attnum]::smallint[]
      and pg_catalog.pg_get_constraintdef(c.oid, true) ilike '%context_relationship%'
  loop
    if v_constraint.definition not ilike '%context_relationship is null%'
      or v_constraint.definition not ilike '%context_relationship = any%'
      or v_constraint.definition not ilike '%''owner''%'
      or v_constraint.definition not ilike '%''employee''%'
      or v_constraint.definition not ilike '%''contractor''%'
      or v_constraint.definition not ilike '%''other''%' then
      raise exception 'unexpected context_relationship check constraint %: %',
        v_constraint.conname, v_constraint.definition;
    end if;

    execute format(
      'alter table public.recurring_commitment_decision_versions drop constraint %I',
      v_constraint.conname
    );
    v_dropped := v_dropped + 1;
  end loop;

  if v_dropped = 0 then
    raise exception 'no recognized context_relationship vocabulary constraint found';
  end if;

  alter table public.recurring_commitment_decision_versions
    add constraint rcdv_context_relationship_check
    check (context_relationship is null or context_relationship in (
      'owner', 'employee', 'contractor', 'child', 'partner',
      'household_member', 'friend_family', 'someone_else', 'other'
    ));

  select count(*), min(pg_catalog.pg_get_constraintdef(c.oid, true))
    into v_final_count, v_final_definition
  from pg_catalog.pg_constraint c
  where c.conrelid = v_table
    and c.contype = 'c'
    and pg_catalog.pg_get_constraintdef(c.oid, true) ilike '%context_relationship%';

  if v_final_count <> 1 then
    raise exception 'expected exactly one context_relationship check, found %', v_final_count;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid = v_table
      and c.contype = 'c'
      and c.conname = 'rcdv_context_relationship_check'
  ) then
    raise exception 'canonical context_relationship constraint is missing';
  end if;

  if v_final_definition not ilike '%''owner''%'
    or v_final_definition not ilike '%''employee''%'
    or v_final_definition not ilike '%''contractor''%'
    or v_final_definition not ilike '%''child''%'
    or v_final_definition not ilike '%''partner''%'
    or v_final_definition not ilike '%''household_member''%'
    or v_final_definition not ilike '%''friend_family''%'
    or v_final_definition not ilike '%''someone_else''%'
    or v_final_definition not ilike '%''other''%' then
    raise exception 'canonical context_relationship vocabulary is incomplete: %',
      v_final_definition;
  end if;
end;
$$;
