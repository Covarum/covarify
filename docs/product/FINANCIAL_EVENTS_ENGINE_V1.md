# Financial Events Engine v1

Financial Events v1 is a deterministic, read-only semantic layer above posted
transactions. It creates fewer, higher-value semantic objects; it is not a
transaction relabeling system.

Transactions remain the source of truth. Every event and activity classification
retains its source transaction and selected-account provenance.

## Boundaries

- No event is persisted or rendered in v1.
- No Plaid synchronization, ingestion, RLS, canonical metric, observation, or
  Guided Understanding behavior is changed.
- Pending transactions are excluded.
- No raw Plaid response is retained by the current schema or repository.
- Historical rows can use only fields actually present in `plaid_transactions`.
- Live Money Picture integration requires a separate founder approval.

## Historical category reconciliation

`plaid_transactions.category_data` is a nullable `jsonb` column. The production
repository currently writes a structured object containing Plaid primary,
detailed, source, and legacy category values for newly added or modified rows.
That structured write was introduced after the original transaction ingestion.
Earlier rows were stored without that structured provenance, and no raw Plaid
payload or counterparty object is retained.

Therefore:

- the schema's ability to hold detailed categories does not establish historical
  detailed-category coverage;
- existing historical rows must not be assumed to have detailed categories;
- v1 works from primary category, merchant/transaction name, amount, account,
  direction, timing, recurrence, pending state, and transfer classification;
- richer detailed-category behavior applies only where a row actually contains
  it;
- no resync is required or authorized for this engine review.

The existing server-side reads in `app/account/page.tsx`,
`app/api/account/transactions/route.ts`, and
`scripts/preview-financial-events.ts` select `category_data` directly. There is
no richer transaction-detail endpoint or retained raw Plaid payload to use as a
historical backfill source.

## Three output layers

### A. Meaningful financial events

High- or medium-confidence objects that add semantic value. An event is emitted
only when it is a recognized income or obligation, a defensibly grouped
occurrence, a planning-relevant recurring pattern, a relative material
exception, a fee/refund/returned payment, or a user-confirmed event.

Every event has `eventWorthy: true` and at least one documented reason:

- `recurring_obligation`
- `income_event`
- `grouped_activity`
- `material_exception`
- `user_confirmed`
- `memory_relevant`
- `recommendation_relevant`

### B. Classified activity

Reliable transaction-level classifications that support analytics but do not
become prominent events: ordinary transfers, cash withdrawals, grocery, dining,
food and drink, general merchandise, transportation, and ungrouped travel
activity.

### C. Unresolved activity

Rows whose meaning is not reliable remain `unresolved_activity`. They are
transaction evidence and data-quality input, not user-facing Financial Events.

## Reliable-field taxonomy

Rules combine primary/detailed category when available with broad,
generalizable descriptors:

- payroll: payroll, paycheck, salary, direct deposit;
- insurance: insurance plus a bounded reusable carrier taxonomy;
- healthcare: pharmacy, hospital, medical, dental, clinic, laboratory,
  diagnostics;
- utilities: electric, energy, water, sewer, internet, wireless, telecom,
  cable;
- subscriptions: explicit subscription, streaming, software, SaaS, or digital
  service descriptors;
- membership: membership, dues, gym, club, association;
- recurring service: service-plan and bounded household-service descriptors;
- travel booking: airline, flight, hotel, lodging, resort, rental-car evidence;
- loans and card payments: explicit lender, loan-payment, card-payment, or
  payment-confirmation descriptors.

No founder-specific merchant name appears in product logic. Primary category
alone never turns every food, shopping, transportation, or travel row into an
event.

## Recurring-payment taxonomy

Recurrence is evidence, not an event type. A recurring review candidate requires
at least three same-merchant, same-selected-account outflows. Timing and amount
consistency determine recurrence confidence.

The candidate is then proposed as one of:

- Subscription
- Utility bill
- Insurance premium
- Loan payment
- Credit-card payment
- Membership
- Recurring service
- Other recurring bill
- Unresolved recurring payment

Only a medium- or high-confidence candidate with independent taxonomy evidence
becomes an event-worthy recurring series. Unresolved recurring payments remain
review candidates and are not promoted. A recurring series becomes one semantic
object with all occurrence transaction IDs retained.

Reliable repeated payroll deposits are likewise represented as one recurring
income series, but they are not included in the recurring-*payment* review.

## Grouping rules

- **Internal transfer:** equal amount with opposite signs, different selected
  accounts, within three days. Both sides and accounts are retained.
- **Travel cluster:** two or more recognized travel-booking merchants within
  seven days. Merely sharing the Travel primary category is insufficient.
- **Medical episode:** two or more transactions with the same normalized
  provider key within seven days. Different providers and later visits remain
  separate.
- **Shopping:** unrelated purchases are never grouped merely because dates
  match.
- **Payroll:** a bank deposit is represented as `Payroll received`. Taxes,
  benefits, or retirement deductions are never inferred unless separately
  observable, and v1 does not fold nearby transfers into payroll.

## Materiality

A large purchase must be at least the greater of:

- $500; or
- three times the median posted, non-transfer outflow in the supplied history.

This prevents a fixed threshold alone from overstating ordinary spending.

## User confirmation contract

The model separates `inferredType` from `effectiveType` and stores confirmation
without changing source evidence. It supports:

- confirmed event type;
- renamed event;
- confirmed or rejected recurring status;
- confirmed account role;
- separated or merged transaction action;
- not an event;
- not a subscription.

`applyFinancialEventConfirmation` is pure and local. No confirmation workflow or
database persistence is implemented in v1.

## Financial Memory handoff

Every event carries first/last observed dates, occurrence count, typical amount,
variability, recurrence, confidence history, current status, transaction
provenance, user confirmation, and superseded classification. Financial Memory
may persist snapshots of this contract later without replacing transaction
evidence or the inference history.

## Deployment gate

Internal deployment and Money Picture integration are separate decisions. The
engine should not be integrated until the founder reviews the sanitized
recurring-payment candidates and grouped-event sample from the current
read-only dataset.
## Founder confirmation and Financial Memory handoff

Founder review is an append-only metadata layer. A review stores the stable
event alias, the inference visible at review time, the founder's optional
classification and label, the authenticated reviewer and timestamp, the source
condition signature, and the engine rule version. It never updates a source
transaction, merchant, category, account relationship, or provider
provenance.

The effective classification contract is:

1. Use the newest non-stale user confirmation.
2. Otherwise use the current deterministic inference.
3. Preserve every prior confirmation as audit history.
4. Mark a confirmation stale when its condition signature or material engine
   rule version differs from the current event.

Financial Memory may later consume a confirmed or high-confidence event with:

- stable event ID and event type;
- first and last observed dates;
- occurrence count, cadence, typical amount, and amount variability;
- current status, confirmation state, and confidence history;
- masked related-account labels;
- source transaction references retained only as provenance.

Financial Memory must not treat a stale confirmation as current, infer health
details from a medical grouping, or expose provider IDs, account IDs, full
account numbers, access tokens, or raw provider payloads.
