# Authenticated native development transport v1

## Canonical contract and compatibility

The canonical transport schema is server-owned in `lib/conversation/transport-schema.ts`, alongside the complete Turn Contract. Mobile no longer maintains a structural mirror: `mobile/lib/turn-contract.ts` directly re-exports the canonical types and runtime parser. Existing monorepo TypeScript and Expo/Metro tooling support this without packages or code generation.

Both request and response identify contract version 1. The development endpoint rejects any unsupported request version. Mobile validates the response version and the complete render-critical Turn shape before storing or rendering it. A newer version produces an upgrade-required compatibility message; malformed content produces a safe invalid-response state. Neither path partially renders financial content.

## Transport modes

`CovarifyClient.sendTurn(input)` has two explicit implementations:

- `FixtureCovarifyClient`: local, visibly labelled, no backend financial data.
- `AuthenticatedCovarifyClient`: existing Supabase bearer session, read-only development endpoint, server-issued session token.

The Ask surface starts in fixture mode and requires an explicit user selection to enter connected development. Switching modes creates a new connected client/session and clears visual conversation state. There is no automatic fallback between connected and fixture data, and fixture controls are hidden in connected mode. Production is not a valid mode.

## Authorized endpoint and continuity

`POST /api/development/covarify-turn` is disabled when `VERCEL_ENV` is `production`. It verifies an explicit bearer credential or existing cookie through the shared Supabase request-auth core, then applies the existing founder authorization. It rejects client authority fields and exact-validates `TurnInput` and action payloads.

The server loads owner-scoped transactions, builds authenticated-preview Canonical Financial Truth, creates an authorized Conversation Core session, calls `runCovarifyTurn`, validates the resulting `CovarifyTurn`, and returns it. It accepts no client balances, transactions, Financial Truth, user ID, household ID, or account authority.

After each turn, the endpoint returns a 15-minute encrypted and authenticated development session token. Its server-only contents bind user, session ID, sequence, authoritative conversation context, and hashes of allowed action IDs/payloads. The next turn restores only that server-issued context. The native client sends no conversation history or financial state. Wrong-user, expired, corrupted, unknown-action, and payload-mutated tokens fail closed.

The Phase 2 follow-up proof is:

1. “How many OLU’KAI transactions do I have?”
2. Server returns the count Turn and an opaque token.
3. “What do they total?” plus the opaque token.
4. The backend restores the evidence antecedent and returns `TRANSACTION_TOTAL` over the same authorized transaction IDs.

The token currently derives an encryption key with domain separation from the existing server-only service credential to avoid new configuration in this controlled development milestone. Before any production transport, replace this with a dedicated rotating signing/encryption key or managed KMS-backed token service. Consequential actions additionally require one-time server persistence, nonce/replay tracking, and stronger transaction binding; they remain unapproved here.

## Errors, retry, and conversation lifecycle

Native errors are typed as `OFFLINE`, `TIMEOUT`, `UNAUTHORIZED`, `FORBIDDEN`, `CONTRACT_MISMATCH`, `INVALID_RESPONSE`, `SERVER_ERROR`, `STALE_ACTION`, and `SESSION_EXPIRED`. User copy reveals no tokens, IDs, payloads, endpoint internals, or stack traces.

Read-only offline, timeout, and server failures expose manual Retry. There is no automatic retry. The visible submitted message is appended once, retry reuses the pending input without adding another message, and failed text is restored to the draft. Loading immediately acknowledges that Covarify is checking the authorized picture and, after a delay, changes to a calm waiting state. Nothing claims that money is changing. On success, VoiceOver focus moves to the validated response; scrolling respects Reduce Motion.

Connected Ask uses a restrained user-turn treatment followed by the same generic semantic renderer. It exposes no contract terminology, debug identifiers, diagnostic panels, or fixture controls. Today, Money, and Decisions remain placeholders. Voice remains fixture/mock-only and is hidden in connected mode.

## Privacy and logging audit

Data leaving the device in connected development is limited to:

- the existing Supabase bearer credential in the Authorization header;
- supported contract version;
- typed statement or future reviewed transcript;
- exact semantic action ID and typed payload;
- the opaque current session/action token.

The client sends no complete financial picture, transaction history, canonical balance, arbitrary account history, local conversation transcript, user/household authority, or fixture truth. The server loads Financial Truth itself. Newly touched native and server paths contain no raw-statement, account, balance, transaction-value, token, or full-Turn logging. Only existing privacy-safe authentication behavior remains.

## Accessibility and device review

Connected state reuses the Phase 1 Dynamic Type renderer, VoiceOver block/action semantics, 44-point controls, keyboard input, and Reduce Motion support. It adds submitted-message semantics, polite waiting/result announcements, assertive but bounded error announcements, Retry semantics, and response focus. Automated source/contract coverage validates these paths.

This Windows environment cannot run Xcode or iOS Simulator. The Expo iOS/Hermes export is the available native build validation. Standard/small iPhone layouts, largest Dynamic Type sizes, VoiceOver interruption behavior, dark mode, Reduce Motion, hardware/software keyboard, and offline transitions remain physical-device or macOS Simulator founder-review items. Dark mode is not yet tokenized and should be treated as debt, not claimed as passed.

## Apple Developer and internal-build readiness

Before the first internal/TestFlight build:

- complete/verify Apple Developer organization membership;
- verify ownership and registration of `com.covarify.mobile`;
- approve Apple team, signing, provisioning, and EAS development/internal strategy;
- provide final app icon, launch, and brand assets;
- review privacy manifest and collected-data declarations;
- add purpose-specific microphone usage text only when real microphone access is approved;
- configure approved development backend URL and client-safe Supabase values;
- conduct physical-device authentication, accessibility, network-loss, and privacy review;
- approve crash/diagnostic policy before adding any SDK;
- do not submit to TestFlight until the connected-development gate is approved.

## Portability and remaining debt

Transport, authentication provider, financial-data provider, and native renderer remain replaceable. Financial Truth, user isolation, deterministic decision IP, reference resolution, correction semantics, action authority, and memory governance remain server-owned. No financial intelligence moved into iOS.

Remaining debt includes a dedicated token key/service, one-time replay storage for consequential actions, canonical schema generation for non-TypeScript clients, endpoint rate limiting, production-grade session revocation, approved network observability with privacy-safe fields, device UI automation, dark-mode tokens, and physical-device review. Production networking, Plaid, Financial Memory, providers, analytics, speech, and external actions remain NO-GO.
