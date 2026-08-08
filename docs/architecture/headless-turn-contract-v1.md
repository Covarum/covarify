# Covarify Headless Turn Contract v1

Status: founder-preview architecture foundation. No production persistence, provider, analytics SDK, external action, or native screen is implemented.

## Architecture map and coupling audit

| Layer | Current modules | Boundary assessment |
| --- | --- | --- |
| Financial Truth | `types.ts`, `evidence-bundle.ts`, `whole-picture.ts`, `off-account-resources.ts`, canonical transaction inputs | Reusable calculations and provenance exist, but fixture and product truth types are not yet unified into one canonical snapshot. |
| Decision | `allocation-intelligence.ts`, `financial-triage.ts`, `strategy-engine.ts`, `goals.ts`, `recommendation-presentation.ts` | Deterministic and React-free. Some fixture-specific rationale remains beside calculations and should move behind decision-result presenters. |
| Conversation Core | `orchestrator.ts`, intent/scope/entity/reference resolvers, context, clarification/proposal/response planners, safety and next-best-step modules | Reusable transaction path exists. Intent and reference vocabulary remain narrower than the generalized platform contract. |
| Turn Contract | `turn-contract.ts`, `headless-turn-orchestrator.ts`, `golden-journeys.ts` | New UI-independent v1 boundary shared by text, reviewed voice, and guided actions. |
| Governed Memory | `memory-writer.ts`, proposal types, Turn Contract memory disposition | Confirmation guard exists. Durable storage is deliberately absent. |
| Surface | account preview components and future native surfaces | Must render semantic blocks and dispatch semantic action IDs; it must not invent financial meaning. |

`adaptive-journey-preview.tsx` currently owns repair and utility state, calls allocation directly, interprets repair edits, creates correction/undo state, chooses journey steps, and synthesizes consequence feedback. Tap callbacks and text parsing converge late rather than beginning as semantic actions. Browser voice does use the typed statement callback, but transport state remains surface-local. The component therefore remains a regression fixture, not the product architecture. Broad migration was intentionally stopped.

Logic to extract later:

- repair/utility entities and field compatibility -> Conversation Core and Financial Truth;
- allocation invocation and before/after comparison -> Decision layer;
- correction proposal, Apply, cancellation, and named Undo -> action orchestration;
- current question, stopping state, and next step -> Turn Contract;
- response copy based on financial impact -> decision presentation;
- session-only transcript, proposal, and undo snapshots -> governed session state.

## Canonical turn

`CovarifyTurn` carries identity and ordering; modality-neutral input; intent, scope, references, confidence, and ambiguity; evidence provenance/freshness; facts read, proposed and accepted changes, calculations, and before/after state; one decision result; semantic response blocks; stable actions; Next Best Step; stopping/waiting status; memory disposition; and privacy-safe telemetry metadata.

Hard invariants reject confirmed/unresolved conflicts, proposed changes represented as accepted, confirmation-class mismatches, actions without semantic IDs, silent input consumption, and invalid confirmed-memory state. Additional domain invariants remain required as canonical Financial Truth expands.

## Consequence, action, and memory contracts

| Consequence | Confirmation | Examples |
| --- | --- | --- |
| `READ_ONLY` | none | show evidence/math, compare |
| `SESSION_REVERSIBLE` | explicit Apply where meaningful | scenario fact, presentation preference, correction |
| `DURABLE_REVERSIBLE` | explicit durable confirmation | future Financial Memory write |
| `EXTERNAL_CONSEQUENTIAL` | strong confirmation | future message or transfer |
| `IRREVERSIBLE_OR_HIGH_RISK` | strong confirmation plus future safeguards | future deletion or irreversible action |

Every action has a stable ID, semantic type, label, consequence, confirmation, reversibility, and typed primitive payload. Undo names the specific reversible change. Raw text and voice are never canonical memory. Memory dispositions are `no_memory`, `session_only`, `memory_proposal`, `confirmed_memory`, `supersede_candidate`, and `revoke_candidate`. This milestone creates proposals only.

## Presentation and Apple-grade surface contract

Surfaces render semantic blocks: situation summary, answer, question, recommendation, allocation, reconciliation, rationale, warning, assumption, evidence, calculation, correction review, and stopping state. Presentation depth (`GUIDED`, `CONCISE`, `DETAILED`) changes disclosure only, never financial state.

Web and native surfaces own typography, layout, focus, animation, accessibility, reduced motion, and native controls. They preserve context, present one primary action, make state changes visible, support recovery, use no color-only meaning, provide logical focus and adequate touch targets, and support Dynamic Type and VoiceOver. Browser primitives are excluded from the contract. Native sheets and menus may render secondary actions; future haptics may acknowledge meaningful actions.

## Golden journey harness

All six fixtures use `runHeadlessTurn`:

1. Competing cash needs: allocation, timing, uncertainty, correction.
2. Transaction meaning: transaction/person context and separate memory proposal.
3. Expected business income: gross, materials, receipt status, and unavailable expected money.
4. Goal conflict: consequence of delay and tradeoff.
5. What changed: controlled snapshot comparison and continuity.
6. Contextual correction: references, proposal, Apply, and Undo.

Typed statements, reviewed voice transcripts, and guided actions enter the same function. Equivalent repair-estimate inputs resolve to the same entity, field, proposed value, consequence class, confirmation, Apply action, and Undo contract. The harness has no React dependency.

## Trust-error taxonomy

- T1: words contradict numbers.
- T2: confirmed fact shown as unresolved.
- T3: unconfirmed fact shown as confirmed.
- T4: expected money treated as available.
- T5: input silently ignored.
- T6: tap and conversation produce different financial meaning.
- T7: rationale differs from the decision result.
- T8: correction changes unrelated state.
- T9: context is lost across modality or surface.
- T10: action appears complete when nothing happened.

Golden tests directly cover T2-T7 and T10 contract boundaries. T1, T8, and T9 need broader canonical-state and multi-turn property testing before beta.

## Privacy, AI, and telemetry readiness

Production iOS must minimize data, state precise collection purposes, request microphone access only when voice is invoked, disclose server AI use, govern sensitive financial content, inventory subprocessors, map App Store privacy disclosures, initiate deletion in-app, support export/deletion lifecycle, prohibit training on financial data unless explicitly governed and disclosed, distinguish session from durable memory, preserve provenance/correction, and use privacy-safe telemetry.

Allowed semantic metrics are `turn_started`, `turn_understood`, `clarification_requested`, `recommendation_presented`, `recommendation_corrected`, `correction_proposed`, `correction_applied`, `correction_cancelled`, `undo_used`, `evidence_opened`, `calculation_opened`, `stopped_for_now`, `resumed`, and `trust_error_detected`. Attributes must exclude raw values, raw conversation, account numbers, and sensitive content.

## Future iOS information architecture

- Today: what matters now, changes, decisions, timing concerns, First Win, calm state.
- Ask Covarify: text, voice, guided actions, evidence, calculations, corrections, recommendations.
- Money: cash, accounts, debts, income, obligations, expected resources, goals, recurring items.
- Decisions: active/past decisions, waiting items, review dates, change monitoring.
- Profile/Settings: security, connections, privacy, data controls, accessibility, account deletion.

iPhone is a first-class native presentation over the shared brain, not a responsive-web wrapper. Use native navigation, top-level tabs only, platform sheets/menus, context preservation, contextual permissions, graceful denial, and accessibility from the first implementation.

## Full branch audit against `origin/main`

The branch adds the Conversation Core family, controlled preview surfaces, voice fallback, allocation/off-account fixtures, founder-preview authorization, transaction query support, documentation, and tests. `package.json` adds only the `test:conversation-core` command and includes it in the aggregate test; no dependency entry changed and `pnpm-lock.yaml` has no branch delta. No `next-env.d.ts` or `next.config.ts` delta is expected.

Fixture-only/prototype surfaces: adaptive journey, conversation strategy, whole-picture allocation, off-account resource, and browser-speech preview. Reusable candidates: deterministic allocation/triage/strategy modules, evidence/context/resolution modules, governed memory guard, Turn Contract, and headless orchestration boundary. Risky coupling remains in large preview components and fixture-specific rationale. There are overlapping orchestration paths (`orchestrator.ts` for transactions and `headless-turn-orchestrator.ts` for generalized golden journeys); they are transitional adapters, not two permitted product brains, and must converge behind one production orchestration facade before beta. Obsolete code should be identified by coverage/import analysis rather than deleted in this milestone.

## Migration plan and gate

1. Unify canonical Financial Truth and evidence IDs across transaction, cash, receivable, goal, and allocation domains.
2. Move fixture rationale out of allocation and preview components into decision-result presenters.
3. Route one read-only existing preview turn through the headless facade and compare semantic output in shadow tests.
4. Adapt surface controls to dispatch Turn action IDs; keep existing visual state until parity passes.
5. Move correction/Apply/Undo ownership to headless session orchestration.
6. Replace preview-created calculations and rationale with render-safe blocks.
7. Retire transitional duplicate orchestration only after all six journeys and authenticated regression paths pass.

GO: continue headless contract hardening, canonical state unification, and non-visual native foundation planning. NO-GO: native screens, production iOS work, production adapters, persistence, providers, analytics SDKs, merge, or deployment until the duplicate orchestration and preview coupling are removed and privacy/security contracts receive founder review.
