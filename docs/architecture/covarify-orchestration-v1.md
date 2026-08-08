# Covarify Authoritative Orchestration v1

Status: pre-native, fixture-only architecture proof. No persistence, providers, production data, analytics SDK, or native UI.

## Authoritative flow

`runCovarifyTurn(session, input)` is the production-direction facade:

`TurnInput -> typed intent/scope -> contextual entity/field resolution -> capability registry -> domain adapter -> CanonicalDecisionResult -> response presenter -> semantic Next Best Step -> CovarifyTurn`

Text, reviewed voice, and guided actions enter the same facade. Guided actions carry discriminated payloads; clients never infer behavior from labels. `covarify-orchestrator.ts` neither imports nor names golden journeys. Golden IDs exist only in fixture construction and tests.

## Stable internal interfaces

Long-term stable candidates:

- `runCovarifyTurn`, `TurnInput`, `CovarifySession`, and `CovarifyTurn`;
- typed financial entities, fields, ambiguity candidates, decisions, actions, confirmation classes, and Next Best Steps;
- capability registry descriptors;
- governed memory disposition;
- deterministic domain-adapter boundary.

Private implementation details:

- regex normalization and contextual alias scoring;
- fixture builders and shadow comparison;
- presenter copy templates;
- adapters translating canonical facts into current deterministic engines.

## Corrections and context

One correction engine resolves entity, field, and value; validates the proposed change; calculates a prospective decision through the relevant adapter; and returns Apply/Cancel. Apply mutates session state only, reruns the decision, and creates specifically named Undo. Cancel does not mutate. The same engine handles repair estimate, card minimum, utility amount, invoice gross/materials, and camp deposit.

High-confidence explicit or single recent references resolve. Multiple plausible numeric entities return typed candidates containing entity ID, field ID, display label, confidence, reason, and clarification requirement. Missing targets or values produce visible unresolved feedback.

## Decision and presentation truth

`CanonicalDecisionResult` owns decision type, goal, constraints, facts considered, typed recommendation, quantities, allocation, reconciliation, alternatives, tradeoffs, delay consequence, uncertainty, confidence, status, and affected entities. Presenters only translate that result into render-safe blocks. They do not allocate, prioritize, inspect fixtures, or mutate state. Next Best Step follows proposal, critical fact, evidence wait, recommendation review, optional exploration, and valid stopping semantics.

## Domain adapters

The allocation adapter translates canonical facts into the proven `allocation-intelligence` engine; the engine now reads corrected card-minimum and utility values from its supplied fixture instead of fixed literals. Expected-resource, goal-priority, and snapshot-comparison adapters return the same decision contract. Transaction meaning remains a typed, unconfirmed memory proposal.

## Native client loop

1. iOS sends `TurnInput`.
2. Core returns `CovarifyTurn`.
3. iOS renders semantic blocks.
4. iOS renders semantic actions.
5. iOS dispatches action ID plus discriminated payload.
6. Core returns the next turn.

iOS does not calculate allocations, infer priority, parse prose for meaning, infer confirmation severity, know golden IDs, reconstruct Undo, or invent Next Best Step.

## Cost-aware future AI routing

- Level 1, deterministic/local: guided payloads, calculations, allocation, reconciliation, consequence classification, known entity resolution, state transitions, and presentation commands.
- Level 2, lightweight language understanding: paraphrase normalization, bounded ambiguity, entity/reference interpretation, and summarization.
- Level 3, heavier reasoning: complex goal conflicts, multi-factor strategy, and nuanced uncertainty/tradeoff explanation.

Financial arithmetic and accepted state transitions remain deterministic at every level. No provider is integrated.

## Shadow proof

The authenticated transaction-understanding preview executes a pure, non-visible fixture comparison after authorization. It performs no I/O, logging, persistence, or user-state mutation and does not alter rendered UX. It compares entity resolution, facts, decision type, financial values, rationale meaning, confirmation class, actions, Next Best Step, and stopping semantics.

## Trust coverage

T1-T10 are represented by contract invariants and regression tests. This phase adds direct coverage for reconciliation words/numbers (T1), correction scope isolation (T8), and session context continuity across text, guided Apply, and reviewed voice (T9). Existing tests retain T2-T7 and T10 protections.

## Acquisition/IP audit

Reusable proprietary core: allocation/triage/strategy engines, evidence and context resolvers, governed-memory contracts, typed Turn Contract, capability registry, generic correction engine, domain adapters, canonical decision result, presenter, and semantic Next Best Step.

Fixture-only: golden journeys, adaptive journey preview, strategy/allocation/off-account previews, browser-speech fallback, and shadow comparison.

Portability risks:

- the legacy transaction `orchestrator.ts` remains a separate narrow path and must become an adapter behind the authoritative facade;
- preview components still own financial and correction behavior;
- some older decision modules contain consumer copy beside calculations;
- entity recognition remains deterministic and deliberately bounded rather than production-complete;
- canonical truth is session-local and fixture-backed.

The strongest “hardcoded demo” signals are the large adaptive preview, fixture-specific presentation modules, and older flow-oriented component names. They remain frozen regression assets, not promoted interfaces.

## Pre-native gate

GO for an isolated native iOS foundation branch limited to shared contract packaging, client transport abstractions, privacy/security scaffolding, accessibility architecture, and fixture-driven contract rendering.

NO-GO for production native financial behavior until the legacy transaction orchestrator is routed behind the authoritative facade, authenticated shadow coverage includes a live read-only transaction turn, canonical Financial Truth adapters replace fixture snapshots, and security/privacy review approves the transport and memory boundaries. Native screens, persistence, providers, analytics, production Plaid, merge, and deployment remain out of scope.
