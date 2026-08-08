# Covarify native iOS foundation v1

## Existing native audit

The repository already contains a suitable native project under `mobile/`: Expo 56, React Native 0.85, TypeScript, and Expo Router. `mobile/app/_layout.tsx` is the application entry and a protected Expo Router tab group is the authenticated navigation root. Supabase password authentication, session restoration, token refresh, chunked Expo Secure Store persistence, and an authenticated backend fetch helper already exist. The project uses a small color theme and native React Native controls; it has no large component system.

The checked-in project intentionally has no generated Xcode project. Expo generates ignored `ios/` artifacts for local development builds. Existing accessibility support included native text scaling and labelled sign-out controls, but there was no systematic Turn renderer, Reduce Motion handling, semantic action model, or native voice shell. Existing screens were lightweight placeholders. No duplicated allocation or recommendation engine was found. Fixture/demo orchestration and native contract tests did not exist.

Dependencies remain unchanged. Existing Expo Router, React Native, Supabase, Secure Store, safe-area, and screens packages are sufficient.

## Contract and transport boundary

The native app mirrors the transport-safe TypeScript shapes for `TurnInput`, `CovarifyTurn`, `PresentationBlock`, `SemanticAction`, consequence/confirmation classes, presentation depth, and ambiguity candidates. This is a wire-contract mirror, not a copy of server business logic. It uses existing TypeScript tooling and requires no code generator. Contract-version evolution should later be governed by a server-owned schema or generated artifact before production networking is enabled.

`CovarifyClient` is the replaceable transport interface:

`sendTurn(TurnInput) -> Promise<CovarifyTurn>`

The Phase 1 implementation is explicitly `fixture` mode. A future HTTPS implementation can replace it without changing the UI. Client input validation rejects trusted balances, Financial Truth, user IDs, and account IDs. The intended production loop remains:

authenticated native request + `TurnInput` + optional turn/action token → backend authorization → authorized Financial Truth loading → `runCovarifyTurn` → `CovarifyTurn`

The client never supplies authoritative financial values.

## Native information architecture and session

The authenticated native shell uses four Apple-style tab destinations: Today, Ask Covarify, Money, and Decisions. Profile/settings remains a top-level header action and hidden route. Today, Money, and Decisions intentionally remain bounded placeholders.

Ask Covarify is the proof surface. It renders the latest turn from semantic block types, with optional assumptions, evidence, and calculations behind disclosure. It renders ambiguity candidates and dispatches stable action IDs with their typed payloads. It does not parse recommendation copy, calculate allocations, reconstruct rationale, choose confirmation severity, synthesize Undo, or infer a Next Best Step.

Local native session state contains rendered turns, the current disclosure, scroll position, typed draft, reviewed fixture transcript, and permission-presentation state. It contains no canonical financial session or authorized Financial Truth. Expo Router preserves mounted tab state, and the Ask surface explicitly retains its visual scroll offset.

## Confirmation and golden proofs

Contract consequence and confirmation classes map to three surface behaviors: execute, explicit session review/apply, or unavailable. Durable, external, irreversible, and high-risk actions remain unavailable. Labels never determine severity.

The competing-needs fixture covers situation summary, a blocking question, answer choices, recommendation, allocation, reconciliation, rationale, semantic next action, stopping/resume, and optional evidence/calculation detail. The correction fixture covers current/proposed values, contract-authored impact, Apply, Cancel, updated turn, and semantic Undo. The out-of-scope fixture renders Covarify's bounded financial response without handing off to a general assistant. All numbers and impact language arrive in `CovarifyTurn`; the native renderer performs no financial arithmetic.

## Accessibility and visual architecture

Native tokens define restrained typography, spacing, surfaces, primary/secondary actions, warning, confirmation, focus, and financial-value roles. The UI uses native text and controls, generous spacing, limited surfaces, one primary visual action, minimum 44-point targets, and no internal architecture terminology in the consumer journey.

Text remains Dynamic Type enabled with no line-count or font-scale cap. Financial blocks receive meaningful combined accessibility labels. Actions expose roles, labels, hints, disabled state, and disclosure state. Reading order follows visual order. Warning and confirmation surfaces use both copy and color. Modal voice presentation is accessibility-isolated. Reduce Motion disables modal animation and automatic scrolling. Inputs remain usable with hardware keyboards and simulator/iPad keyboards.

## Voice, privacy, and security

The microphone control is a UI-only fixture shell. Permission presentation occurs only after the microphone action. The shell supports allowed/denied states, reviewed mock transcript, editing, and a fully usable typed fallback. It records and transmits no audio and adds no speech provider.

Device state is limited to typed input, reviewed transcript, navigation, permissions, and visual state. Backend responsibilities remain authentication, authorized Financial Truth, orchestration, confirmation, and memory governance. Future providers must be purpose-scoped and receive only the minimum operation data. Raw transcripts and financial values must not enter analytics.

The native audit found no hardcoded financial secrets, client-side authorization decisions, sensitive logging, transcript logging, trusted client balances, or production/fixture crossover in the new surface. Fixture mode is visually unmistakable. Existing Supabase access-token handling remains isolated in the pre-existing authenticated API helper and secure session adapter.

## Cost-aware execution and remaining debt

The native contract is intentionally unaware whether a future turn used deterministic/local execution, lightweight language understanding, or heavier reasoning. Every level returns `CovarifyTurn`.

Remaining debt before production networking includes schema generation/version negotiation, authenticated turn endpoint approval, transport error and retry semantics, native UI automation and snapshot coverage on macOS, real contextual microphone permission integration, production accessibility testing on devices, final icons/assets, and server-driven session/action tokens. Production authentication changes, Plaid, Financial Truth, memory, providers, analytics, money movement, and complete Today/Money/Decisions experiences remain out of scope.
