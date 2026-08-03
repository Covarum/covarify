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
