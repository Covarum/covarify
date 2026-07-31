alter table public.recurring_commitment_decision_versions
  drop constraint if exists recurring_commitment_decision_versions_recurring_status_check;

alter table public.recurring_commitment_decision_versions
  add constraint recurring_commitment_decision_versions_recurring_status_check
  check (
    recurring_status in ('confirmed', 'completed', 'possible', 'not_recurring')
  );

comment on column public.recurring_commitment_decision_versions.recurring_status is
  'Versioned activity state: confirmed is active, completed is finished, possible is uncertain, and not_recurring rejects recurrence without erasing commitment_type.';
