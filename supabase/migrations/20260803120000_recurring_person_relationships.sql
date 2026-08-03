-- Expand the existing owner-scoped, append-only context vocabulary. No rows are rewritten.
alter table public.recurring_commitment_decisions
  drop constraint if exists recurring_commitment_decisions_context_relationship_check;
alter table public.recurring_commitment_decisions
  add constraint recurring_commitment_decisions_context_relationship_check
  check (context_relationship is null or context_relationship in ('owner','employee','contractor','child','partner','household_member','friend_family','someone_else','other'));
