# Covarify Master Playbook v1.0 Gap Analysis

**Assessment date:** July 17, 2026  
**Authority:** `docs/codex_pack/COVARIFY_MASTER_PLAYBOOK_v1.0.md`  
**Repository state assessed:** current working tree, including uncommitted application changes; no application code was changed during this documentation task.

## Executive assessment

The repository is a strong interactive prototype with a verified narrow production identity and persistence foundation, not yet the complete production financial decision platform defined by the playbook. Supabase authentication, durable user profiles, founder bootstrap, session persistence, protected routes, ownership-aware Plaid tables, production KMS, durable worker execution, approved retention/deletion policy, and RLS controls are implemented. The largest remaining Plaid rollout gaps are an updated immutable consent disclosure, privileged-administration MFA, and controlled end-to-end evidence.

This creates a material architecture mismatch. The UI can appear to remember, decide, and protect choices, while most state is local or request-scoped and cannot yet provide the continuity, traceability, deletion, authorization, or safety guarantees required by the Master Playbook.

**Plaid Production foundation update (2026-07-21):** Supabase Auth/Postgres, authenticated ownership, RLS, founder allowlisting, production KMS, worker/cron infrastructure, approved retention/deletion controls, webhook verification, update mode, disconnect behavior, rollout flags, and operating runbooks exist. The immutable v1 consent predates the final retention policy; approve an updated immutable disclosure before a real connection. Admin MFA and controlled end-to-end evidence also remain blockers. `PLAID_PRODUCTION_CONNECTIONS_ENABLED=false` remains mandatory.

## Mandatory pre-code gate

This document is the bridge between the Master Playbook and implementation. **Codex must review this analysis before writing or modifying application code.** Before a significant feature or architecture change, update it when the working tree has changed materially and identify whether the affected code is production-ready, prototype, placeholder, contradicted by the playbook, or in need of refactoring.

The gate is complete only when:

1. The proposed work is mapped to governing playbook sections.
2. Current behavior and data durability are verified from code, not inferred from UI copy.
3. Contradictions and trust risks are named explicitly.
4. Required refactoring and dependencies are understood.
5. A playbook conflict is escalated for a decision rather than resolved by assumption.

## Implementation status classification

These labels describe current repository evidence, not marketing readiness. “Production-ready” means the inspected surface is reasonably complete for its narrow stated purpose; it does not make the overall product ready for real financial data or private beta.

### Production-ready for a narrow purpose

| Surface | Current evidence | Qualification |
|---|---|---|
| Documentation governance | Canonical v1.0 pack, archive notice, gap analysis, and roadmap are present under `docs/`. | Ready to govern work if the pre-code gate is followed and the analysis stays current. |
| Early-access request validation and email delivery | The API bounds input, validates email, uses a honeypot, checks server configuration, and has focused route tests. | Suitable for its narrow contact-collection purpose after deployment configuration and operational monitoring are verified; it is not a financial-data workflow. |
| Static legal/trust page framework | Privacy, Security, and Terms surfaces clearly identify an early-stage informational product. | The framework is usable, but copy requires review whenever actual data handling or connectivity changes. |

No authenticated financial-data, Financial Memory, recommendation, Decision Ledger, Talk to Covarify, or Voice Mode capability is currently verified as production-ready.

### Prototype

| Surface | Why it is a prototype | Evidence needed to advance |
|---|---|---|
| Plaid connection and First Win flow | The existing demo still uses sandbox configuration, fixed sandbox identity, immediate reads, and no durable Item. A separate Production foundation exists but intentionally fails closed because auth, database, KMS, and queue adapters are unapproved. | Approve ADR-001; implement authenticated ownership, database/KMS/queue adapters, OAuth resume state, connection UI, consent, health, monitoring, deletion, and the remaining security tests. |
| Decision Studio | Interactive scenario behavior exists, but policy and state are coupled to UI/client state. | Durable scenario records, centralized safeguards, liability evidence, forward timeline, ranking contract, and golden tests. |
| Talk to Covarify | Typed heuristics can model a limited set of commands and expose confirmation/undo. | Server-side schemas, resolver, authorization, idempotency, durable commands, audit, ambiguity gates, and recomputation. |
| Voice Mode | Explicit browser microphone controls and typed fallback demonstrate the interaction. | Approved vendor/retention policy, secure transcription, transcript review, speaker safety, accessibility, privacy, and command-path integration. |
| Decision Ledger | Client-session records demonstrate decision statuses, review, scope, confirmation, and undo. | Canonical durable records, ownership, versioning, export, deletion, outcomes, and immutable audit links. |
| Financial Brain and Financial Event previews | Types and sample views demonstrate meaning-first concepts. | One canonical domain model integrated with real facts, provenance, permissions, context assertions, and persistence. |
| Onboarding | Calm, responsive multi-step experience demonstrates product tone. | Decision-first entry, progressive consent, real connection/manual path, save-and-return, accessibility evidence, and unambiguous sample/real states. |

### Placeholder or illustrative-only

- Financial Brain scores, confidence percentages, Decision Margin values, recommendations, timelines, and 30/60/90-day plans sourced from hard-coded demo data.
- Browser-session voice transcript and listening behavior presented as a stand-in for an approved production voice service.
- Plaid webhook response that logs a safe subset but does not authenticate the event or initiate synchronization.
- Manual status strings for APR, minimum payments, statement balances, and due dates where liability data is unavailable.
- Sample Financial Events, documents, people, discoveries, and next moves that are not connected to a durable context graph.
- Client-only confirmation, undo, and ledger continuity that disappear outside the current session.
- Public trust/security descriptions that must evolve with actual production data handling.

### Contradicted by the playbook

| Current behavior or language | Playbook conflict | Required resolution |
|---|---|---|
| Some product surfaces retain earlier “AI-powered Financial Operating System” or dashboard-oriented framing. | Locked hierarchy is Financial Clarity and a financial decision platform; the narrowest honest claim wins. | Replace retired language through roadmap commit 93 and review public claims. |
| Main onboarding starts broad and proceeds through several selection screens before capturing the hardest decision. | v1.0 requires decision-first onboarding and the minimum data needed for that decision. | Redesign entry and progressive-consent sequence before beta. |
| Low-risk client commands can appear applied without a durable structured state change. | Conversation must create reviewable state, and Covarify must not say it handled something when only chat/client state changed. | Label prototype/session scope now; route all production changes through durable commands. |
| Static confidence percentages and precise projections can appear without complete derivation or missing-data gates. | Completeness comes before confidence; avoid false precision. | Remove or clearly label illustrative values until computed evidence and completeness exist. |
| The custom CSS brand mark is a reconstructed symbol rather than the locked final brand-board asset. | The source-pack README says not to redraw, simplify, substitute, or reinterpret the logo without founder approval. | Replace with an approved exported brand asset or obtain explicit founder approval. |
| Security copy says live account connectivity is not claimed while sandbox connectivity exists and production access is approved. | Public trust language must be accurate, narrow, and continuous with current reality. | Conduct a copy/legal review and state sandbox, approved access, and production availability precisely. |

### Needs refactoring

| Area | Refactoring need | Strategic reason |
|---|---|---|
| Talk to Covarify component | Separate parsing, policy, command creation, transitions, voice adapter, and rendering. | Safety rules and auditability cannot live inside a large client component. |
| Plaid token-exchange route | Split exchange, item persistence, sync jobs, normalization, and response presentation. | Immediate request-scoped reads cannot support continuity or webhook-driven updates. |
| Financial Brain modules | Consolidate duplicate types/logic/demo modules and define one canonical domain boundary. | Parallel models will drift from Financial Memory and recommendation records. |
| Decision Studio and Ledger state | Move canonical decisions/scenarios to server-owned services; keep UI state as a projection. | The ledger must survive reloads and reconstruct why a recommendation changed. |
| Recommendation logic | Separate deterministic calculation, policy/action library, and explanation. | Implements TDR-001 and prevents UI or AI copy from overriding safeguards. |
| Demo data and labels | Introduce explicit fixture boundaries and environment-visible “illustrative” labeling. | Prevents placeholders from being mistaken for verified financial conclusions. |
| Tests | Expand beyond early-access behavior into domain, authorization, data-quality, adversarial, accessibility, and golden recommendation suites. | Production trust requires evidence, not only working demos. |

## Areas already implemented

### Product and UX foundation

- Next.js App Router and TypeScript application with reusable UI/layout primitives.
- Calm, low-clutter visual system; responsive pages; reduced-motion use in onboarding; generally short, plain-language copy.
- Decision-first prompts exist in early access and parts of the sandbox experience.
- First Win views expose cash-flow evidence, flexible categories/merchants, assumptions, confidence language, and seven-day actions.
- Decision Studio supports interactive category reductions, merchant pauses, payment scenarios, and visible gap impact.
- Talk to Covarify accepts typed commands and opt-in browser speech recognition with typed fallback.
- Commands that can materially alter the working plan can require confirmation; Decision Ledger exposes confirmation, dismissal, review, scope, and undo behaviors.
- Demo copy usually protects agency and avoids shame-based language.

### Financial logic and domain concepts

- Deterministic transaction classification, inflow/outflow calculations, essential/flexible/debt/unknown grouping, cash-gap calculation, merchant/category rollups, and candidate savings levers.
- Separate sample-domain types for Transaction, Financial Event, Person, Document Record, Discovery, and Next Best Move.
- Financial Events are modeled as meaning objects connected to transactions and documents.
- Sandbox account normalization distinguishes cash and debt accounts and reports when APR/minimum/due-date data is unavailable.
- Recommendation and scenario prototypes expose confidence and tradeoff-oriented language.

### Integration and public trust foundation

- Plaid sandbox link token, public-token exchange, accounts retrieval, transaction sync, and webhook endpoint exist.
- Access tokens are not logged, returned to the client, or persisted by the current immediate-read sandbox route.
- Environment variables are server-only and checked; errors are normalized before returning.
- Early-access endpoint validates and bounds input, includes a honeypot, and sends administrator/applicant email.
- Public Privacy, Security, and Terms pages exist and correctly frame the product as early-stage and informational.

## Areas partially implemented

### Money Picture and First Win

- Current analysis is primarily trailing-history cash flow. It does not yet build the forward timeline through the next pay cycle required for Stabilize decisions.
- Liability information is account-level and explicitly incomplete. Required minimum, statement balance, APR, due date, autopay, hardship, and term data are not integrated.
- Flexible-spend reductions and payment scenarios exist, but multi-action consequence ranking is limited and does not reliably protect all essential obligations across time.
- Confidence appears in the UX, but a formal completeness score tied to missing decision-changing inputs is not consistently calculated.

### Talk to Covarify and Voice Mode

- Typed and voice command parsing exists, but it is heuristic, component-local, and limited to a small command vocabulary.
- Browser speech recognition is opt-in and session-scoped, but provider behavior, transcript handling, speaker identity, retention policy, accessibility validation, and production support are unresolved.
- Some commands mutate only in-memory scenario state. There is no durable validated command bus, idempotency key, authorization boundary, structured Context Assertion store, or audit event.
- Conversation does not yet match/create/reconcile real transactions and Financial Events as specified by the signature interaction.

### Decision Ledger and Financial Memory

- The prototype records decision-like objects and supports statuses/undo in the current client session.
- It does not yet persist the canonical record separation among financial facts, observations, recommendations, decisions, actions, outcomes, and protected/declined choices.
- Recommendation versions do not durably preserve engine version, data window, included accounts, missing-data flags, prompt/model version, disclosure version, user edits, confirmation/undo, and actual outcome.
- Financial Event and Document Record types exist, but there is no production context graph, vault storage, provenance, retention, permissions, household safety, or retrieval service.

### Trust presentation and accessibility

- Trust copy, confidence labels, assumptions, and demo disclaimers are visible in several flows.
- Evidence, missing data, assumptions, alternatives, safeguards, review timing, and professional handoff are not enforced as a single recommendation contract across every pathway.
- Keyboard/screen-reader behavior is not covered by automated accessibility tests; focus management, live regions, zoom/reflow, contrast, motion reduction, and error association need a formal audit.

## Areas missing

- Production authentication, secure session management, account recovery, and privileged/admin MFA.
- Household/user tenancy, object-level authorization, relationship permissions, and multi-speaker safety.
- Durable production database and normalized schemas for all canonical domain objects.
- Encrypted Plaid access-token persistence, production-environment support, cursor persistence, webhook verification, background sync/retries, institution health, and stale-data monitoring.
- Consent receipts, progressive permissions, data inventory, retention schedules, export, disconnect, deletion, and deletion-verification workflows.
- Immutable audit trail for sensitive reads, writes, recommendations, confirmations, reversals, and administrative actions.
- Formal calculation, policy, and explanation layer separation at service boundaries.
- Versioned recommendation policy/action library with consequence classes and legal-review triggers.
- Completeness/freshness service that can block or downgrade recommendations.
- Forward cash calendar and essential/required-minimum coverage engine.
- Production liabilities ingestion and manual correction flow.
- Scenario combination generator and ranking across safety, impact, durability, reversibility, burden, preference, cost, risk, confidence, and time to impact.
- Recommendation lifecycle, review scheduler, notification preferences, reassessment, and estimated-versus-actual outcomes.
- Production conversational orchestration: schemas, entity extraction, candidate resolution, ambiguity gates, preview, validated commands, idempotency, deduplication, and undo.
- Financial Life Vault file storage, malware scanning, metadata, access controls, and event links.
- Observability, analytics taxonomy, security monitoring, incident response implementation, backups, and tested restoration.
- Golden/adversarial tests for decision pathways, conversational state changes, recommendation policy, and high-consequence safeguards.
- Human escalation workflow and qualified-professional handoff experience.

## Technical debt

- Plaid link uses a fixed `covarify-sandbox-user`, so identity and item ownership are not real.
- Token exchange performs synchronous immediate reads and discards the access token; this cannot support continuity, webhooks, or memory.
- Webhook accepts and logs selected fields but does not verify origin/signature or enqueue work.
- Business rules, parsing, state transitions, and UI rendering are coupled inside large client components.
- Duplicate/parallel financial-brain type and logic files indicate model drift and unclear ownership.
- Important demo values and recommendations are hard-coded, which risks confusing illustrative confidence with computed confidence.
- Dependency versions use `latest` broadly, reducing reproducibility and increasing supply-chain/change risk.
- Automated test coverage is minimal and concentrated on early-access email behavior.
- No database migrations, schema contract, API schema, job runner, feature flags, or environment isolation strategy is present.
- The root README was aligned during the documentation-governance task; future status changes must keep it synchronized with this analysis without turning it into a competing source of truth.
- Text encoding artifacts appear in several source files and user-facing strings, creating product-language and accessibility risk.

## Architecture mismatches

| Playbook requirement | Current architecture | Risk |
|---|---|---|
| Conversation creates structured, reviewable state | Component-local parsing and state | Apparent actions may not survive reload or be auditable. |
| Financial Memory is a durable product layer | Sample types and in-memory ledger | No continuity, provenance, export, deletion, or outcome learning. |
| Rules first, AI second, with separate calculation/policy/explanation layers | Rules distributed across route and UI modules | Safety policy can drift with presentation code. |
| Production trust controls before real-data beta | Sandbox-only integration and no verified auth/store | Real data would lack required access, retention, and audit controls. |
| Recommendations are explainable and versioned | UI objects lack durable version envelopes | Covarify cannot reconstruct why advice changed. |
| Financial Event is primary meaning object | Separate sample model not integrated with Plaid flow | Transaction analysis remains category-centric. |
| No silent state changes | Some low-risk typed changes can apply immediately in client state | Confirmation policy is not centrally enforceable or durable. |
| Completeness before confidence | No shared completeness service/gate | Confident language can outpace available evidence. |

## UX mismatches

- Main onboarding begins with a broad welcome and multiple selection screens rather than immediately capturing the hardest current decision and explaining the minimum data needed for it.
- The onboarding connection step visually implies a secure read-only connection while the displayed flow advances without performing Plaid Link; sample versus connected state must remain unmistakable.
- Some experiences are dashboard/card dense and expose multiple competing actions, conflicting with one primary decision per screen.
- The Financial Brain preview uses scores, precise dollar projections, and confidence percentages from static demo data without always showing derivation, missing inputs, or a visible evidence path.
- “Voice Mode listens while this page is open” may feel broader than the playbook’s explicit-activation and progressive-consent posture; listening state, provider disclosure, and transcript review need stronger controls.
- The prototype says it updates a plan but does not always distinguish scenario-only, client-session, and durable state in plain language.
- Financial Zoom is approximated with expandable detail but is not a consistent five-level pattern from calm summary through evidence, assumptions, scenario math, and policy detail.
- Some public and onboarding language reflects earlier positioning (“AI-powered Financial Operating System”) instead of the locked “Financial Clarity” / “financial decision platform” hierarchy.

## Trust and compliance gaps

- No verified privacy counsel review, recommendation-scope review, or state-by-state regulatory analysis is represented.
- No production consent record, privacy request workflow, data export, disconnect, deletion, appeal/correction, or retention implementation.
- No authentication/authorization boundary for sensitive API routes.
- No secure persistent token strategy, key management, secrets rotation, access reviews, vendor inventory, data-flow map, or environment separation evidence.
- No rate limiting or abuse controls on Plaid and early-access endpoints.
- No immutable recommendation/audit history or disclosure versioning.
- No operational incident response, security contact workflow, alerting, backup/restore evidence, or breach-response drill.
- No verified human escalation path for high-consequence decisions.
- Voice privacy claims depend on browser speech services that may operate outside Covarify’s direct control and require vendor-specific disclosure and testing.
- Public Security copy says live connectivity is not claimed, while production Plaid access is approved and sandbox connectivity exists; public language needs a careful, truthful continuity update before launch.

## Highest-leverage next milestones

1. **Production trust substrate:** approve the production architecture and data-flow threat model; implement identity, tenancy, authorization, encrypted secrets/token storage, audit events, consent receipts, and environment separation.
2. **Canonical financial schema and durable memory:** migrate facts, context assertions, events, recommendations, decisions, actions, outcomes, protected/declined choices, and version envelopes into a single durable domain model.
3. **Reliable real-data pipeline:** production Plaid item lifecycle, cursor-based background sync, verified webhooks, normalization, deduplication, freshness, completeness, and manual input/correction.
4. **Safe First Win v1:** forward cash timeline, liability minimums/due dates, essential coverage, consequence classes, multi-action scenarios, recommendation contract, and golden tests.
5. **Production conversational command path:** typed first, then voice; schema-validated intent/entities, object resolution, preview/clarification, authorized idempotent commands, confirmation, undo, and full audit.
6. **Financial Memory and Decision Ledger continuity:** review dates, notification preferences, actual outcomes, user-readable history, export, correction, and deletion.
7. **Private-beta release gate:** accessibility, security review, observability, support/escalation, policy/disclosure review, analytics, backup restoration, and controlled design-partner operations.

## Recommended first implementation commit

**Establish the production identity, tenancy, and protected API boundary.**

Before persisting Plaid tokens or financial memory, create authenticated user/household ownership, server-side authorization helpers, protected-route tests, and an administrative role boundary. This is the smallest foundational commit that prevents every later data, decision, memory, and audit record from being built on an unsafe ownership model. It directly supports Sections 06 (Logical Production Architecture; Production Security Requirements), 07 (Privacy and Security Operating Requirements; Pre-beta Trust Gate), and PDR/TDR decisions requiring user control and production trust controls.
