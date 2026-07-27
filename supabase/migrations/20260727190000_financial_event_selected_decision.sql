alter table public.financial_event_confirmations
  add column selected_decision text not null;

alter table public.financial_event_confirmations
  add constraint financial_event_selected_decision
  check (
    selected_decision in (
      'subscription',
      'utility_bill',
      'insurance_premium',
      'loan_payment',
      'credit_card_payment',
      'membership',
      'recurring_service',
      'other_recurring_bill',
      'not_recurring',
      'unsure',
      'confirm_group',
      'separate',
      'rename'
    )
  );

comment on column public.financial_event_confirmations.selected_decision is
  'Exact founder-selected review decision retained for append-only audit history.';
