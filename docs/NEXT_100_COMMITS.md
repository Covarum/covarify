# Covarify: Next 100 Logical Commits

**Roadmap authority:** Master Playbook v1.0  
**Ordering rule:** strategic user value and trust readiness before engineering convenience  
**Effort scale:** XS (<0.5 day), S (0.5–1 day), M (2–3 days), L (4–5 days), XL (multi-commit-sized investigation; keep the resulting commit reviewable)

This roadmap assumes focused, reviewable commits. A commit may include tests and documentation required to make its behavior complete, but should not hide unrelated work. Any item that changes a locked decision, recommendation scope, data use, retention, public claim, or high-consequence pathway must first follow the playbook change protocol.

## Phase 1 — Establish the production trust substrate (1–15)

| # | Commit title | Purpose | Dependencies | Effort | Why it matters | Related playbook sections |
|---:|---|---|---|---|---|---|
| 1 | Establish authenticated user and household ownership | Add production identity/session integration, user and household IDs, and protected server helpers. | Approved identity ADR | L | Every financial record needs a trustworthy owner before persistence begins. | 06 Logical architecture; 06 Production security; 07 Pre-beta trust gate |
| 2 | Enforce object-level authorization at API boundaries | Require authenticated ownership checks for protected reads/writes and add denial tests. | 1 | M | Prevents cross-user financial-data access. | 06 Required safeguards; 07 Privacy/security operations |
| 3 | Add privileged admin roles and MFA policy hooks | Separate consumer/admin capabilities and require MFA-ready privileged sessions. | 1–2 | M | Administrative access is a pre-beta security requirement. | 06 Production security; 07 Security operating requirements |
| 4 | Separate local, sandbox, preview, and production environments | Centralize environment validation and block unsafe cross-environment configuration. | 1 | M | Prevents demo data, credentials, and claims from leaking across environments. | 06 Production security; 10 Release gates |
| 5 | Create the canonical data-flow and threat-model ADR | Document trust boundaries, vendors, secrets, PII, commands, logs, and deletion paths. | 1–4 | M | Makes security and minimization decisions reviewable before data expands. | 06 Data pipeline; 07 Privacy/security; TDR-002 |
| 6 | Introduce managed secrets and encryption-key interfaces | Replace ad hoc secret access with typed server-only providers and rotation metadata. | 4–5 | M | Plaid tokens and sensitive configuration need controlled lifecycle management. | 06 Production security; 07 Security operations |
| 7 | Add immutable audit-event foundation | Persist actor, action, target, time, request, environment, and safe metadata. | 1–6 | L | User control and recommendation traceability require durable evidence. | 06 Consent/audit layer; 16 Financial Memory; 07 Trust principles |
| 8 | Record progressive consent receipts | Version consent text, scope, purpose, optionality, grant/revoke time, and actor. | 1, 7 | M | Connection and voice must be based on explainable, revocable consent. | 05 Progressive consent; 07 Privacy requirements |
| 9 | Implement data inventory and retention registry | Define purpose, source, sensitivity, access roles, retention, and deletion for each field class. | 5, 8 | M | Enforces data minimization instead of collecting by default. | 06 Data minimization; ODR-006 |
| 10 | Add account export, disconnect, and deletion job contracts | Create authorized request/status models and idempotent orchestration interfaces. | 1–9 | L | Control is incomplete without usable exit paths. | 00 User control; 05 Reliance without lock-in; 07 Privacy |
| 11 | Add API rate limits and abuse telemetry | Protect early-access, Plaid, voice-command, and sensitive mutation routes. | 1–7 | M | Limits denial-of-service, enumeration, and cost abuse. | 06 Production security; 07 Security operations |
| 12 | Sanitize structured application logging | Add redaction, correlation IDs, log-level policy, and tests preventing financial payload leakage. | 5–7 | M | Observability must not become a shadow financial database. | 06 Required safeguards; 07 Privacy/security |
| 13 | Add security headers and request-origin protections | Configure CSP, HSTS, framing, referrer, CSRF/origin checks, and secure cookies. | 1–4 | M | Hardens the public and authenticated web boundary. | 06 Production security; 07 Security operations |
| 14 | Establish backup and restoration verification | Define encrypted backups, recovery objectives, restore test, and evidence log. | 6–9 | L | Financial memory cannot be trusted without recoverability. | 06 Production security; 07 Incident/continuity |
| 15 | Add private-beta trust-gate CI checklist | Fail release readiness when required identity, audit, consent, deletion, security, and restore checks are absent. | 1–14 | M | Turns playbook requirements into an enforceable release gate. | 07 Pre-beta trust gate; 10 Gate B |

## Phase 2 — Build canonical financial memory and records (16–30)

| # | Commit title | Purpose | Dependencies | Effort | Why it matters | Related playbook sections |
|---:|---|---|---|---|---|---|
| 16 | Define canonical financial fact schemas | Model accounts, balances, transactions, liabilities, income, obligations, provenance, freshness, and ownership. | 1–9 | L | Facts must remain distinct from interpretations and recommendations. | 03 Core objects; 16 Canonical record types |
| 17 | Define Context Assertion and Conversation Turn schemas | Store explicit meaning, source, confirmation, confidence, and correction history. | 7, 16 | M | Conversation must create reviewable state, not disposable chat. | 03 Required behavior; 06 Conversation-to-state; 16 |
| 18 | Define Financial Event and relationship schemas | Link people, facts, documents, purposes, projects, and events with permission-aware edges. | 16–17 | L | Financial Event is the primary meaning object. | PDR-025; 03 Financial Event; 16 Memory |
| 19 | Separate Discovery, Recommendation, Decision, Action, and Outcome records | Create explicit lifecycles and foreign-key relationships. | 16–18 | L | Prevents observations, advice, user choice, and results from collapsing into one record. | 16 Canonical records; Recommendation lifecycle |
| 20 | Model constraints, protected choices, and declined choices | Persist “must keep,” refusals, reasons, scope, review date, and revocation. | 17–19 | M | Financial memory must remember boundaries, not only accepted advice. | PDR-033; 04 Empowerment loop; 16 |
| 21 | Add recommendation version envelope | Store engine/policy/model/prompt/disclosure versions, inputs, missing data, assumptions, and options. | 19 | L | Allows Covarify to explain why recommendations changed. | 03 Recommendations versioned; 06 Recommendation versioning; PDR-032 |
| 22 | Add reversible domain command and undo records | Persist command intent, preview, authorization, idempotency, result, reversal, and audit link. | 7, 17–21 | L | No-silent-change behavior needs a durable mechanism. | 03 No silent inference; 06 Safeguards; 16 |
| 23 | Create schema migrations and integrity constraints | Implement tenancy keys, immutability rules, status transitions, and cascade/deletion behavior. | 16–22 | L | Domain promises must be enforced below UI code. | 06 Logical architecture; 16 Engineering implications |
| 24 | Add repository/service boundaries for canonical records | Expose typed server-side interfaces and keep UI from writing persistence directly. | 23 | M | Separates domain policy from presentation. | TDR-001; 06 Rules first, AI second |
| 25 | Migrate the in-memory Decision Ledger to durable records | Map prototype statuses, scopes, confirmations, reviews, and undo into canonical services. | 19–24 | L | Turns a signature demo into real continuity. | 16 Decision Ledger; PDR-033 |
| 26 | Add user-readable decision history | Render evidence, choice, rationale, alternatives, status, review date, and revisions. | 21, 25 | M | Users must understand and inspect what Covarify remembers. | 05 Reliance without lock-in; 16 UX implications |
| 27 | Add correction and dispute workflow | Let users correct facts/context and record downstream recomputation needs. | 16–26 | L | Corrections must become structured data with provenance. | 03 User correction; 07 User control |
| 28 | Add financial-memory export format | Export facts, events, decisions, constraints, and outcomes in human-readable and machine-readable forms. | 16–27 | M | Avoids lock-in and makes memory accountable. | 05 Reliance without lock-in; 07 Privacy |
| 29 | Implement retention-aware deletion propagation | Remove or de-identify linked records while preserving only legally justified audit evidence. | 9–10, 16–28 | L | Deletion must work across a graph, not only a profile row. | 07 Privacy requirements; ODR-006 |
| 30 | Add canonical record contract tests | Verify ownership, lifecycle, immutability, reversal, export, and deletion invariants. | 23–29 | L | Protects the core memory model from silent drift. | 09 Definition of done; 16 Engineering implications |

## Phase 3 — Make the real-data Money Picture reliable (31–44)

| # | Commit title | Purpose | Dependencies | Effort | Why it matters | Related playbook sections |
|---:|---|---|---|---|---|---|
| 31 | Persist encrypted Plaid items and tokens | Store item ownership, encrypted token reference, consent, products, institution, and status. | 1–15, 23–24 | L | Continuity and secure sync require durable tokens. | 06 Financial integration; Production security |
| 32 | Use per-user Plaid Link identity and production-aware config | Remove fixed sandbox user and safely support approved environments. | 31 | M | Connects items to real authenticated owners without environment confusion. | 06 Data pipeline; 10 Gate B |
| 33 | Implement cursor-based background transaction sync | Persist cursors; process added/modified/removed records through jobs and retries. | 31–32 | L | Synchronous one-shot reads cannot maintain a Money Picture. | 06 Financial integration; Data pipeline |
| 34 | Verify and queue Plaid webhooks | Validate webhook authenticity/replay constraints and enqueue item-scoped sync. | 31–33 | L | Unverified no-op webhooks create stale and spoofable state. | 06 Production security; Observability |
| 35 | Normalize accounts, balances, and transactions with provenance | Map Plaid data into canonical facts while retaining source timestamps/IDs. | 16, 33–34 | L | Evidence must remain attributable and fresh. | 03 Money Picture; 06 Data pipeline |
| 36 | Reconcile pending, posted, modified, refunded, and removed transactions | Add deterministic lifecycle and duplicate prevention. | 35 | L | Cash-flow truth depends on accurate transaction state. | 06 Data pipeline; 04 Analysis sequence |
| 37 | Detect transfers, debt payments, and income safely | Add rule-first classifications with evidence and correction hooks. | 27, 35–36 | L | Misclassification can reverse a recommendation. | 04 Analysis sequence; 06 Testing |
| 38 | Add manual account, transaction, and obligation input | Provide respected non-Plaid path with provenance and validation. | 16, 24, 27 | L | Connection is primary, not mandatory. | 01 Use connection as means; 05 Connection first, not only |
| 39 | Reconcile manual entries with later imported records | Match candidates, ask on ambiguity, merge without losing context, and audit. | 22, 35–38 | L | Prevents double-counting while preserving user meaning. | 03 Signature behavior; 06 Deduplication |
| 40 | Integrate liabilities and required payment data | Store balance, minimum, statement, APR, due date, term, and confidence where available. | 31–37 | XL | Safe debt decisions require liability-level evidence. | 04 Payment controls/pathways; 06 Plaid sequencing |
| 41 | Add recurring income and obligation detection | Detect patterns, expected dates, variability, and user confirmation. | 35–40 | L | Timing and durability matter more than monthly totals alone. | 03 Money Picture; 04 Income timing |
| 42 | Compute freshness and data completeness | Score missing accounts/history/income/liabilities/obligations/unknowns and expose blockers. | 35–41 | L | Completeness must govern confidence. | 03 Required behavior; 06 Completeness score |
| 43 | Add stale-data and institution-health monitoring | Alert on broken items, delayed syncs, cursor failures, and degraded product data. | 33–42 | M | Recommendations must not rely silently on stale evidence. | 06 Observability; 07 Trust metrics |
| 44 | Add Money Picture golden datasets and sync tests | Cover variable income, transfers, refunds, debt, pending items, one-time events, and gaps. | 33–43 | L | Real-world edge cases are the basis of safe decisions. | 06 Testing requirements; 09 Definition of done |

## Phase 4 — Deliver a safe, complete First Win v1 (45–61)

| # | Commit title | Purpose | Dependencies | Effort | Why it matters | Related playbook sections |
|---:|---|---|---|---|---|---|
| 45 | Create calculation, policy, and explanation service boundaries | Move math, recommendation eligibility, and copy into separately testable layers. | 24, 42–44 | L | AI and UI must not own safety logic. | TDR-001; 06 Rules first, AI second |
| 46 | Build forward cash timeline through next pay cycle | Project dated inflows, essentials, minimums, selected actions, and buffer. | 40–45 | XL | Stabilize decisions are timing decisions, not only 30-day totals. | 04 Analysis sequence; 10 Phase 1 |
| 47 | Define essential-obligation protection policy | Centralize protected classes, user overrides, coverage checks, and escalation. | 20, 40, 45–46 | L | Essentials must precede optimization. | 04 Decision ladder; 07 Safeguards 1–2 |
| 48 | Separate required minimums from optional extra payments | Normalize payment components and update scenario inputs/outputs. | 40, 45–47 | M | Prevents extra payoff from being treated as mandatory. | PDR-029; 04 Payment controls |
| 49 | Implement Stabilize pathway | Generate safe candidates for liquidity, essentials, minimums, and immediate timing risks. | 45–48 | L | This is the first decision-ladder priority. | 04 Level 1; Pathways A/B/F |
| 50 | Implement Repair pathway | Combine spending, timing, minimum strategy, bill options, and income actions. | 49 | L | Flexible cuts alone must not masquerade as a complete repair plan. | 04 Level 2; Pathway A |
| 51 | Implement Optimize and Build eligibility gates | Block premature optimization and allocate durable positive margin safely. | 47–50 | M | Covarify should not jump ladders while stability is unresolved. | 04 Levels 3–4; Pathway E |
| 52 | Add action consequence classes | Encode low/moderate/high behavior, required alternatives, warnings, and human handoff. | 45–51 | L | Product behavior must change with downstream risk. | PDR-028; 04 Action risk; 07 Safety framework |
| 53 | Implement multi-action scenario combinations | Model category, merchant, timing, income, savings, and payment actions together. | 46–52 | XL | Real repair plans require combinations, not isolated cuts. | 04 Interactive scenario board; v1 path |
| 54 | Add consequence-aware scenario ranking | Score safety, required payments, impact, durability, reversibility, burden, preference, cost, risk, confidence, and timing. | 52–53 | L | The largest immediate dollar result is not always the best choice. | 04 Recommendation ranking |
| 55 | Enforce the recommendation contract schema | Require headline, diagnosis, evidence, assumptions, context, action, alternatives, impact, tradeoffs, safeguards, confidence, plan, review, and handoff. | 21, 45–54 | L | Completeness and explainability become structural requirements. | 04 Recommendation contract; PDR-032 |
| 56 | Implement full-balance versus minimum pathway | Compare liquidity, essentials, cost, grace implications, charges, buffer, and review date. | 40, 46–55 | L | Avoids blanket debt advice. | 04 Pathway B |
| 57 | Add consolidation and refinance comparison | Compare rate, fees, term, total cost, payment relief, security, inquiry, reuse, and uncertainty. | 40, 52–55 | XL | Moderate-consequence relief must expose its true cost. | 04 Pathway C; 07 Legal triggers |
| 58 | Add hardship and debt-management education pathway | Provide verified questions, uncertainty, alternatives, escalation, and no execution. | 52, 55 | L | Users need options without unsupported acceptance claims. | 04 Pathway D; 07 Human escalation |
| 59 | Add First Win review date and fallback plan | Store measurable success criteria, primary/fallback actions, and reassessment trigger. | 19–25, 55–58 | M | A recommendation becomes a learning loop, not a static tip. | PDR-026; 04 Required outcome |
| 60 | Add estimated-versus-actual outcome comparison | Recompute at review and explain which assumptions held or changed. | 42, 59 | L | This is how Financial Memory improves decisions transparently. | 04 Empowerment loop; 16 Lifecycle |
| 61 | Add adversarial and golden First Win suites | Test missing data, misleading income, near-term bills, reversals, protected choices, and all consequence classes. | 45–60 | XL | Recommendation quality must be demonstrable before beta. | 06 Testing; 09 Definition of done; 10 Gate B |

## Phase 5 — Turn conversation into safe structured state (62–75)

| # | Commit title | Purpose | Dependencies | Effort | Why it matters | Related playbook sections |
|---:|---|---|---|---|---|---|
| 62 | Extract typed command orchestration from the UI | Create server-side Ask, Tell/Correct, and Explore command contracts. | 17, 22, 24, 45 | L | Conversation needs a durable service boundary. | 05 Core interface; 06 Conversation architecture |
| 63 | Add schema-validated intent and entity candidates | Parse explicit amount, merchant, person, purpose, event, recurrence, constraint, and intent. | 62 | L | Language models may propose candidates, not unvalidated state. | 06 AI policy; Required safeguards |
| 64 | Build deterministic transaction and object resolver | Rank candidates using owner, source, merchant, amount, date, account, and context. | 35–39, 63 | L | Covarify must not pretend a match exists. | 03 Signature behavior; 06 Example path |
| 65 | Add ambiguity and minimum-question gate | Show candidates or ask one focused question when meaning could change a decision. | 64 | M | Preserves calm while preventing silent guessing. | 03 No silent inference; 05 Interaction rules |
| 66 | Add state-change preview and confirmation policy | Centralize low-risk confirmation/undo and explicit confirmation for ambiguous/material updates. | 22, 52, 62–65 | L | User control must be consistent across every surface. | 05 Confirmation pattern; 06 Safeguards |
| 67 | Execute authorized idempotent domain commands | Route confirmed context and scenario changes through canonical services and audit. | 2, 7, 22, 66 | L | Prevents duplicate or unauthorized conversational changes. | 06 Validated command; TDR-001 |
| 68 | Recompute affected discoveries and recommendations | Track dependencies and version downstream changes after confirmed commands. | 21, 45–61, 67 | L | Conversation must visibly change the actual financial picture. | 03 Required behavior; 06 Pipeline |
| 69 | Implement the signature Dick’s transaction flow | Match/create, label purpose/person/event, preserve cash impact, clarify recurrence, confirm, and undo. | 18, 39, 62–68 | L | This is the defining proof of Covarify’s differentiation. | 01 Differentiator; 03/05 Signature interaction |
| 70 | Add Ask responses grounded only in verified records | Answer without state change and expose evidence, freshness, completeness, and uncertainty. | 42, 62–68 | L | Trust requires a clear distinction between answering and changing. | 05 Ask intent; 07 Trust presentation |
| 71 | Add Explore sessions isolated from committed state | Persist temporary scenarios separately and commit only selected decisions/actions. | 19, 22, 53–55, 62 | L | “What if” should never silently rewrite the ledger. | 05 Explore intent; 16 Record separation |
| 72 | Add conversational history review and deletion | Provide user-readable turns, linked commands, retention status, and deletion controls. | 9–10, 17, 29, 62–71 | M | Conversation is sensitive financial data and must remain controllable. | 05 Interaction rules; 07 Privacy |
| 73 | Add golden conversational command tests | Cover matches, no-match, ambiguity, corrections, constraints, confirmation, undo, and deduplication. | 62–72 | L | Signature behavior needs regression protection. | 06 Testing requirements |
| 74 | Add conversational safety/red-team tests | Test prompt injection, cross-user references, invented facts, unsafe advice, and confirmation bypass. | 2, 52, 62–73 | L | Natural language expands the attack and failure surface. | 06 AI may not; 07 Safety framework |
| 75 | Replace prototype parser with the production command client | Wire Talk to Covarify UI to orchestration while preserving explicit sandbox labeling. | 62–74 | L | Converts the demo into an accountable product interaction. | PDR-034; 05 Conversational interaction |

## Phase 6 — Add voice without weakening trust (76–83)

| # | Commit title | Purpose | Dependencies | Effort | Why it matters | Related playbook sections |
|---:|---|---|---|---|---|---|
| 76 | Approve voice vendor and retention ADR | Decide transcription vendor, raw-audio default, transcript retention, regions, consent, and deletion. | 5, 8–9, 62–75 | M | Voice must not launch on unresolved privacy assumptions. | ODR-007; 06 AI policy; 07 Privacy |
| 77 | Add explicit microphone consent and session indicator | Require user action, display provider/processing disclosure, and expose stop/revoke controls. | 76 | M | Voice is optional and must never activate silently. | 05 Accessibility/dignity; 06 Production security |
| 78 | Add secure transcription adapter with typed fallback | Send minimal audio securely, avoid raw retention by default, and normalize transcripts. | 76–77 | L | Production voice needs controlled vendor behavior. | 06 Data pipeline; AI may not |
| 79 | Add transcript review before material commands | Display heard text, confidence, edit path, and required confirmation based on consequence. | 66, 78 | M | Speech errors must not become financial state. | 05 Interaction rules; 06 Safeguards |
| 80 | Add speaker-status and household safety controls | Mark unconfirmed speakers and prevent permission-sensitive household changes. | 1–3, 18, 76–79 | L | Shared environments create privacy and abuse risks. | 16 Multiple speakers; ODR-004 |
| 81 | Add voice accessibility and interruption behavior | Support keyboard control, screen readers, no-speech/errors, reduced motion, and predictable stop. | 77–80 | M | Voice must expand access without becoming required. | 05 Accessibility baseline |
| 82 | Add voice test corpus and privacy assertions | Test accents, noise, amounts, merchant names, corrections, retention, logs, and fallback. | 78–81 | L | Financial speech errors and data leakage require targeted evidence. | 06 Voice tests; 07 Trust metrics |
| 83 | Connect Voice Mode to production command orchestration | Route reviewed transcripts through the same validated preview/confirm/undo path as text. | 75, 78–82 | L | Voice should be an input method, not a second safety system. | PDR-034; 06 Conversation-to-state |

## Phase 7 — Complete the memory, continuity, and user-control experience (84–92)

| # | Commit title | Purpose | Dependencies | Effort | Why it matters | Related playbook sections |
|---:|---|---|---|---|---|---|
| 84 | Build Financial Event creation and review UX | Let users inspect people, purpose, facts, documents, recurrence, and money visibility. | 18, 27, 69 | L | Meaning must be user-reviewable, not only inferred. | 03 Financial Event; 16 UX implications |
| 85 | Add Financial Life Vault secure upload foundation | Store files with ownership, scanning, metadata, retention, and event links. | 6, 9, 18, 29 | XL | Documents complete the context around financial events. | 03 Financial Life Vault; 06 Security |
| 86 | Add decision outcome and learning review UX | Ask what happened, compare estimate/actual, and record user explanation. | 26, 59–60 | L | Memory should improve future decisions through consented learning. | 04 Empowerment loop; 16 Recommendation lifecycle |
| 87 | Add user-controlled review reminders | Schedule review dates with channel, frequency, quiet hours, snooze, and opt-out. | 8, 19, 59 | L | Return should follow real decisions, not engagement pressure. | 05 Reliance; 09 Retention metrics |
| 88 | Add protected-choice and declined-choice management | Let users review, edit, expire, or remove remembered constraints and refusals. | 20, 26–29 | M | Memory must remain visible and reversible. | PDR-033; 16 Principles |
| 89 | Implement consistent Financial Zoom pattern | Standardize summary, rationale, evidence, assumptions, scenario math, and policy detail. | 42, 55, 75, 84 | L | Users need calm first and evidence on demand. | 03 Financial Zoom; 05 Summary first |
| 90 | Add save-and-return state across decision flows | Persist progress, selected scenario, unanswered questions, and safe resume state. | 19–25, 53, 71 | M | Reduces executive-function burden and abandoned work. | 05 Neurodivergent requirements |
| 91 | Complete export/disconnect/delete user center | Surface request status, scope, consequences, download, revocation, and verified completion. | 10, 28–29, 72, 85 | L | User control must be operational, not buried in policy. | 00 User control; 07 Privacy |
| 92 | Add continuity and memory acceptance tests | Verify reload, multi-device session, correction, undo, export, deletion, review, and outcomes. | 84–91 | L | The product promise depends on continuity that can be proven. | 16 Financial Memory; 09 Definition of done |

## Phase 8 — Pass the private-beta evidence gate (93–100)

| # | Commit title | Purpose | Dependencies | Effort | Why it matters | Related playbook sections |
|---:|---|---|---|---|---|---|
| 93 | Align all product language with v1.0 | Replace retired positioning, claims, labels, encoding artifacts, and inconsistent “Talk/Tell/Ask” terminology. | 55, 75, 89 | M | Product language is part of trust and category definition. | 01 Brand architecture; 05 Voice; 17 Public language |
| 94 | Run and fix WCAG-oriented product accessibility audit | Cover keyboard, focus, labels, status, contrast, zoom/reflow, errors, motion, touch, and voice controls. | 75, 83, 89–90 | XL | Accessibility is a required pre-beta baseline. | 05 Accessibility baseline; 10 Gate B |
| 95 | Implement product and trust analytics taxonomy | Measure activation, conversation accuracy, alternatives explored, overrides, outcomes, confidence, and trust without sensitive payloads. | 12, 21, 60, 75 | L | Beta must generate evidence without surveillance. | 09 Metrics; 07 Trust metrics |
| 96 | Add operational observability and alert runbooks | Monitor uptime, errors, sync health, stale data, command failures, security events, and notification delivery. | 12, 33–43, 87, 95 | L | Silent failures can turn correct logic into unsafe advice. | 06 Observability; 07 Security operations |
| 97 | Implement incident response and support escalation | Add triage contacts, severity, user communication, evidence preservation, and financial/professional handoff procedures. | 3, 7, 15, 96 | L | Trust failures need a practiced human response. | 07 Human escalation; 06 Incident response |
| 98 | Complete recommendation scope and disclosure review | Version approved disclosures, professional-review triggers, public claims, and high-consequence restrictions. | 52, 55–58, 93, 97 | L | Legal/trust review must match actual behavior before beta. | 07 Legal triggers; Consumer disclosures |
| 99 | Run private-beta release-gate rehearsal | Execute security, privacy, restore, accessibility, decision-quality, support, and data-deletion evidence checks. | 15, 61, 74, 82, 92, 94–98 | L | A rehearsed gate exposes operational gaps before users do. | 07 Pre-beta gate; 10 Gate B |
| 100 | Enable the controlled design-partner cohort | Add cohort flags, explicit beta consent, sandbox/real-data labels, support channel, rollback, and founder dashboard. | 99 and founder approval | L | Releases a narrow, observable product only after trust and decision-quality evidence exists. | 08 Cohort 1; 09 Founder dashboard; 10 Phase 2 |

## Roadmap governance

- Before any application-code commit, review `PLAYBOOK_GAP_ANALYSIS.md`; before significant work, update its production-ready, prototype, placeholder, contradicted, and refactoring classifications when repository reality has changed.
- Do not start a roadmap commit whose affected surface contradicts the Master Playbook until the conflict is resolved or the playbook is formally changed.
- Reassess ordering after every ten commits or any material evidence from design partners.
- A failed trust, decision-quality, or data-completeness gate blocks downstream release work even when UI work is ready.
- Keep “do not build yet” items out of this roadmap unless the Master Playbook is formally updated.
- Record each completed roadmap item in the playbook’s current-state snapshot and link the implementation commit where the change protocol requires it.
- Effort estimates are directional; scope should be split before implementation when a commit cannot remain safely reviewable.
