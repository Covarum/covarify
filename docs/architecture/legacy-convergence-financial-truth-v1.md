# Legacy convergence and canonical Financial Truth v1

## Authoritative turn path

`runCovarifyTurn(session, input)` is the single product-facing semantic orchestration facade. The transaction-understanding API now authorizes the request, builds canonical Financial Truth from the already user-scoped transaction result, creates an authorized session, and invokes that facade.

The former transaction orchestrator remains deterministic internal adapter machinery:

`runCovarifyTurn` → `TRANSACTION_UNDERSTANDING` adapter → legacy matching/evidence machinery → `CanonicalDecisionResult` → response presentation → `CovarifyTurn`

`orchestrateConversation` is deprecated for product-surface use. `createHeadlessSession` is a deprecated fixture harness. Golden Journeys may construct test inputs, but neither Golden Journey types nor fixture recommendation injection are dependencies of the authoritative facade. The temporary legacy response projection exists only to preserve the current API wire contract while callers migrate to `CovarifyTurn`; it is not another decision path.

## Canonical Financial Truth

`CanonicalFinancialTruth` is the authorized, read-only input boundary for future Plaid/account data, transactions, liabilities, recurring obligations, income, off-account cash, receivables, goals, constraints, people and household context, user-confirmed context, and governed memory. Its source mode may be fixture, sandbox, authenticated preview, or a future production adapter. The core consumes the same shape in every mode.

Every evidence source carries a provenance type (`CONNECTED_DATA`, `USER_CONFIRMED`, `DERIVED`, `INFERRED`, `EXPECTED`, `FIXTURE`, or `MEMORY_CONFIRMED`), source ID, observation/update times when available, freshness, confidence, and user/household/business ownership. Provenance is projected into the Turn Contract and survives adapter and decision processing.

Domain adapters accept authorized canonical truth, a resolved semantic request, and relevant session context. They return `CanonicalDecisionResult`. The stable adapter identities are `TRANSACTION_UNDERSTANDING`, `ALLOCATION`, `EXPECTED_RESOURCE`, `GOAL_STRATEGY`, and `SNAPSHOT_COMPARISON`. Domain calculations and legacy matching stay private to adapters; the facade coordinates semantics and presentation without reimplementing them.

## Truth, session state, and memory

Canonical truth and conversation state have separate lifetimes. A session owns a defensive copy of canonical truth plus overlays such as active references, presentation depth, pending corrections, reversible history, the current question, and stopped/resumed state. Accepted session corrections update overlays only. They do not silently rewrite canonical truth.

Raw statements are turn input, not memory. Transaction meaning may produce an unconfirmed contextual fact and a memory proposal. A proposal remains session-only and requires an explicit future confirmation and governed persistence path before it can enter `governedMemory`. This milestone performs no durable write.

## Authorization and user isolation

Authenticated identity enters at the backend route. Data loading scopes transactions to that identity before canonical truth is constructed. `createAuthorizedCovarifySession` rejects truth owned by another user. The Turn Contract and surface payload grant no authority: `TurnInput` cannot supply an authenticated user or replace canonical truth. Surface-provided transaction IDs and conversation context are revalidated against authorized truth and the current user/session before an adapter sees them.

Future native clients must not enforce isolation and must not submit balances or Financial Truth as trusted values. The intended transport is:

Authenticated session + `TurnInput` + optional current turn/action token → backend authorization → authorized Financial Truth loading → `runCovarifyTurn` → `CovarifyTurn`

Local fixture truth is acceptable only in an explicit development or test mode.

## Privacy boundary

The device or surface collects typed input, reviewed voice input, and renders semantic state. Backend orchestration owns authorization, truth loading, decisions, confirmation boundaries, and memory governance. Future financial, speech, or AI providers remain replaceable and purpose-scoped.

Only the minimum data required for an operation should leave each boundary. A provider must not receive the whole financial picture by default. Sensitive raw statements, account values, tokens, and financial content must not enter analytics. iOS microphone permission must be contextual. Native UI and transcript state are not canonical Financial Memory.

## Stable and private interfaces

Stable internal platform APIs are `TurnInput`, `CovarifyTurn`, the `CovarifySession` contract, `CanonicalFinancialTruth`, `CanonicalDecisionResult`, `SemanticAction`, `DomainAdapter`, the memory-proposal contract, and consequence/confirmation semantics.

Replaceable implementation details include transaction parsing and matching, vendor data adapters, response rendering, fixture builders, shadow comparison, provider integrations, and the legacy compatibility projection. This keeps deterministic financial logic and governed state proprietary while clients and vendors remain portable.

## Current gate and remaining debt

The authenticated transaction route runs a read-only shadow comparison between legacy output and the authoritative facade for intent, entity, scope, evidence, financial facts, decision meaning, response, actions, confirmation, and Next Best Step. A mismatch fails closed with a non-sensitive error; raw financial values are not logged.

The pre-native foundation is suitable for an isolated iOS foundation branch. Production native financial behavior remains blocked: non-transaction domain adapters still need production-backed truth mappings, API consumers still use the legacy-compatible response projection, durable confirmation/memory is intentionally absent, and no provider or production data adapter is approved.
