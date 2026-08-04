# Conversation Core v1 — controlled-beta architecture

## Governing contract

Intent → Scope → Entities → Evidence → Answer → Meaning → Confirmed Goal → Financial Priority → Constraints → Whole-Picture Evidence → Candidate Options → Tradeoffs → Recommended Strategy → Next Best Step → Clarification → Proposal → User Adjustment → Confirmation → Plan → Monitoring → Adaptation → Financial Memory.

The production Talk surface enters one deterministic orchestrator. Existing transaction, category, merchant-rule, recurring, housing, and append-only confirmation systems remain trusted tools. Conversation Core is not the default production route and has no authority to mutate source financial data.

## Personalized strategy and generic-advice prevention

A strategy requires a confirmed goal, owner-scoped whole-picture evidence, evidence-backed options, quantified contributions, constraints, protected expenses, assumptions, tradeoffs, confidence, and progress measures. Missing any of those inputs fails closed. Goal candidates cannot drive optimization. Competing confirmed goals without priority produce one clarification.

The whole-picture model keeps unknown values null, excludes available credit and investments from cash, protects debt minimums and essential obligations, records missing coverage, and lowers confidence for stale accounts. Recommendations may be blocked until fresher data arrives.

## Triage, gap, flexibility, and constraints

Financial Triage ranks immediate housing and utility stability above optimization. The canonical housing gap keeps monthly rent, actual payment, payment type, outstanding amount, periods behind, next due date, and catch-up date separate. A shortfall is calculated only when required resources and protected obligations are known.

Spending candidates are classified as protected essential, committed obligation, flexible essential, discretionary, potentially cancellable, user protected, unusual one-time, or uncertain. Constraints filter candidates before option generation and ranking. Required minimums, protected expenses, one-time spending, investments, and stale or unsupported resources cannot become savings levers.

## Levers, options, and recommendation ranking

Every lever carries evidence IDs, amount, timeframe, benefit, effort, reversibility, tradeoff, assumptions, confidence, protection impact, confirmation needs, and professional-involvement status. Cancellation remains a review suggestion; Covarify never claims it occurred.

Options include a goal, target, date, per-lever contributions, total contribution, protected expenses, assumptions, risks, tradeoffs, evidence, confidence, projected completion, and unresolved questions. The generator creates fewer than three options when evidence cannot support three. Contributions are capped by both evidence and the target.

Strategy ranking is goal-dependent and constraint-dependent. It explains why the highest option fits this user, why alternatives rank lower, what remains protected, expected impact, tradeoffs, assumptions, confidence, what could change the result, and how progress is measured. Alternatives remain available for comparison or adjustment.

## Next Best Step

Every supported orchestrated turn evaluates exactly one primary Next Best Step. Inputs include goal alignment, intent, evidence, priority, effort, reversibility, confidence, constraints, unresolved work, and whole-picture consequences. `no_action` is valid. Stale data selects wait/refresh; missing material facts select one clarification; urgent evidence-backed options select comparison; a ready strategy selects confirmation; behind plans select adjustment. Mutating steps always lead to proposal and confirmation.

## Plan persistence and reuse

Decision Studio is a client-side scenario and decision ledger; it is not an adequate authoritative recovery-plan store. A durable plan should reuse its interaction patterns but requires a separately reviewed owner-scoped, append-only/versioned persistence model with confirmation, milestones, evidence, status, progress, revisions, pause/cancel/defer/completion, RLS, and concurrency protection. No migration is created or applied in this phase.

## Monitoring, adaptation, and escalation

Monitoring compares real transaction, payment, and income activity with confirmed milestones while preserving protected spending. States include on track, ahead, behind, blocked by missing data, needs adjustment, completed, paused, and canceled. Changed facts recompute options, explain the change, preserve prior versions, and require confirmation before activating a revision. Housing, utility, collection, or legal-risk situations may calmly offer contact with a provider, local assistance, or an appropriate qualified professional without making legal conclusions or promising outcomes.

## Rent-recovery release gate

Implemented contracts support partial-rent identification, separate gap facts, sequential clarification, whole-picture assembly, protection-aware evidence levers, constrained option generation, strategy ranking, Next Best Step, and monitoring calculations. Existing housing writes remain confirmed and append-only.

Contracts only: durable confirmed goals, active recovery plans, append-only revisions, monitoring jobs, and Financial Memory integration. The authenticated end-to-end rent workflow and 390px option comparison remain controlled-beta work. Release remains NO-GO for plan activation, default routing, migration, merge, or deployment.

## Rollout

1. Controlled transaction count/total/list and account follow-ups.
2. Named-context and category proposals.
3. Read-only goal, situation, triage, option, strategy, and Next Best Step previews.
4. Authenticated rent-recovery UI and manual responsive verification.
5. Separately reviewed plan/goal persistence migration.
6. Confirmed-plan activation and monitoring behind a controlled flag.
7. Recurring, observation, housing, and merchant-rule orchestration expansion.

## Whole-picture priority and allocation milestone

The fixture allocation layer extends the governing contract through known needs, event timing, consequence evaluation, bounded resources, competing priorities, one blocking question, preliminary allocation, goal discovery, options, tradeoffs, recommendation, confirmation boundary, plan preview, monitoring contract, and governed memory candidates. It reuses evidence IDs, confidence, protected constraints, null-for-unknown semantics, and read-only Next Best Step behavior. It does not replace the existing transaction or rent engines.

`FinancialNeed` keeps current obligations and past-due balances distinct and records amount required, minimum useful payment, full amount, timing, partial-payment usefulness, consequence basis, stability and income effects, reversibility, negotiability, source, freshness, evidence, and personal/household/business scope. Consequences are classified as verified, user reported, system derived, generally possible, or uncertain and requiring verification. Unverified housing, credit, utility, legal, creditor, or partial-payment effects never become absolute claims.

The bounded cash-flow timeline orders current balances and reliable income by date. Resources classify cash, protected or restricted funds, household and business funds, reliable and uncertain income, credit, investments, reimbursements, refunds, and transfers. Only explicitly included, deduplicated resources can fund an allocation. Available credit and investments are excluded; transfers and debt proceeds are not income; business funds are not automatically personal funds.

The allocation engine works only with cash available before the next relevant income event. It first protects a work-critical repair when user-confirmed, then satisfies the verified card minimum, optionally protects the utility payment, reserves remaining cash for upcoming current rent, and assigns zero to arrears rather than double-counting the same money. Every line states what is funded, unfunded, mitigated, deferred, assumed, evidenced, and subject to confirmation. Missing noncritical utility timing permits explicitly preliminary guidance; the work-critical repair question blocks recommendation ranking until answered.

Goal discovery follows value delivery and asks what would be most helpful now. Goal choices explain what they optimize and remain unconfirmed until an exact named confirmation. The fixture supports fast and detailed views using the same calculation, session-local pause/resume, a baseline-preserving extra-shifts simulation, and a nondefensive income-reliability correction. Simulations remain labeled, inactive, and noncanonical.

Memory disposition is explicit: evidence bundles, unconfirmed facts, viewed allocations, simulations, disputes, and resume state are temporary; confirmed needs, consequences, goals, priorities, constraints, allocations, strategies, plans, and income reliability are merely durable candidates requiring governed confirmation metadata; raw media/transcripts, abandoned scenarios, unsupported inference, low-confidence consequences, and unaccepted allocations are never canonical. No writer is invoked.

The real-data readiness contract names the future Canonical Financial Snapshot, transactions, balances and freshness, obligations, recurring commitments, income, user facts, ownership boundaries, active plans, reserves, documents, Financial Memory, and missing institutions. Every future number must retain source record IDs, calculation period, freshness, known/estimated/missing status, inclusion and exclusion reasons, and a deduplication key. This milestone remains fixture-only; production adapters, durable resume, multi-option optimization beyond the bounded fixture, plan activation, monitoring jobs, and persistence remain contracts-only and NO-GO.

## Cash and sole-proprietor resource extension

Cash earned, cash received, cash on hand, deposits, spending, protections, and current availability remain separate typed values. Expected cash is future-only; only confirmed cash on hand or reconciled deposited cash can increase current resources. Variable cash uses the low end of its supported range unless the user explicitly overrides it. Event-scoped protections reduce allocable cash without becoming global preferences.

Cash receipt and its later deposit share one reconciliation key. A deposit or transfer changes location, not total income. The same rule applies to an invoice payment, its bank deposit, and a later business-to-personal transfer. Distinct cash and invoice events retain distinct keys, evidence, timing, and scope.

Sole-proprietor receivables are business-scope objects with invoice amount, paid and remaining balances, dates, terms, status, dispute state, payment history, confidence, schedule, costs, reserves, protected business funds, evidence, and correction lineage. Outstanding or scheduled invoices are never current cash. Future planning may conditionally include a reliable payment inside the analysis window, with its dependency disclosed.

Owner-available estimates use `gross receipt − confirmed business costs − user-confirmed tax reserve − vendor obligations − protected business funds`. Deductions remain visible and are applied once. Covarify makes no tax conclusion and does not recommend changing a reserve. Partial receipts expose only the owner-available portion of received funds; overdue, doubtful, disputed, canceled, or written-off receivables leave the active expected-income path.

Cash and invoice statements, protections, provisional estimates, payment timing, simulations, and reconciliation remain session-only. Confirmed facts are governed durable candidates only; no persistence exists. Production invoice parsing, bookkeeping connections, bank reconciliation adapters, durable cash patterns, and tax handling remain contracts-only and NO-GO.
