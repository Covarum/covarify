# Money Picture Intelligence Engine v0

The engine separates raw RLS-scoped data, calculated metrics, candidate rules, ranked observations, and user-facing copy. It is deterministic and does not use an LLM for calculations or selection.

## Ranking

Each candidate receives normalized 0–1 values and the score:

`100 × (25% impact + 15% urgency + 25% confidence + 10% behavioral usefulness + 5% goal relevance + 10% novelty + 5% actionability + 5% data completeness)`

Primary observations require confidence ≥ 0.65 and score ≥ 55. At most three are surfaced. Critical alerts additionally require score ≥ 85, confidence ≥ 0.85, urgency ≥ 0.90, and a rule explicitly marked critical.

An unchanged observation with the same stable identifier and condition signature is suppressed for seven days unless marked handled or its material condition changes. Stable identifiers combine the rule, sorted account scope, and period end. Candidate records retain the rule, period, account scope, sanitized aggregates, confidence, score, generation time, expiry, and reevaluation condition.

## Implemented candidates

- Outflow is concentrated in one selected account.
- Identified cash flow materially changed from the prior comparable period.
- One expense materially affected the period.
- Connected data is stale or the sync state needs attention.
- Multiple complete positive-cash-flow months may support a future savings-capacity analysis.

Savings output is observation-only. It requires at least three complete positive
months, a positive current comparison period, and an average identified surplus
above the configured threshold. It never proposes a transfer amount without
established income frequency, surplus evidence, and obligation coverage. No
securities, borrowing, refinancing, insurance, tax, or legal recommendations
are generated.

Category completeness is not ranked as a financial observation because it is not
meaningfully actionable by the user. When at least 35% of period outflow lacks a
reliable category, the engine emits a separate quiet data-quality status:
“Covarify is still organizing your spending.” The status is excluded from the
three primary “What matters today” observations.

Plaid Personal Finance Category values are persisted as structured JSON with the
primary value, detailed value, source model, and any legacy category array.
Historical rows that contain only a JSON string remain readable without a
database backfill and are marked in memory as `legacy_persisted_primary`.
