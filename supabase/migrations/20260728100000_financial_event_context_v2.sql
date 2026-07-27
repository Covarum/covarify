alter table public.financial_event_confirmations
  add column relationship_decision text,
  add column user_context_label text,
  add column re_review_reason text,
  add column review_priority_score integer,
  add column review_priority_reason text;

alter table public.financial_event_confirmations
  add constraint financial_event_relationship_decision
    check (relationship_decision is null or relationship_decision in ('related', 'separate', 'unsure')),
  add constraint financial_event_context_label_length
    check (user_context_label is null or char_length(user_context_label) between 1 and 120),
  add constraint financial_event_re_review_reason
    check (re_review_reason is null or re_review_reason = 'inference_model_refined'),
  add constraint financial_event_review_priority_score
    check (review_priority_score is null or review_priority_score between 0 and 100),
  add constraint financial_event_review_priority_reason_length
    check (review_priority_reason is null or char_length(review_priority_reason) between 1 and 300);

alter table public.financial_event_confirmations
  drop constraint financial_event_selected_decision;

alter table public.financial_event_confirmations
  add constraint financial_event_selected_decision
  check (
    selected_decision in (
      'subscription', 'utility_bill', 'insurance_premium', 'loan_payment',
      'credit_card_payment', 'membership', 'recurring_service',
      'other_recurring_bill', 'not_recurring', 'unsure', 'confirm_group',
      'related', 'separate', 'rename'
    )
  );

comment on column public.financial_event_confirmations.user_context_label is
  'Optional user-authored meaning kept separate from deterministic inference and source transactions.';
comment on column public.financial_event_confirmations.relationship_decision is
  'Founder answer to whether grouped source purchases are related.';
comment on column public.financial_event_confirmations.re_review_reason is
  'Why an inference is presented again without deleting prior append-only history.';
