# Covarify Decision Log

**Last updated:** July 16, 2026  
**Owner:** Founder  

This log preserves the decisions that shape Covarify. A decision is not complete until its status, reasoning, tradeoffs, and revisit trigger are visible.

Statuses:

- **Locked** - Current operating decision.
- **Working** - Current direction under validation.
- **Open** - Decision required.
- **Archived** - No longer current, preserved for context.

---

# Product Decision Records

## PDR-022 - Users arrive on meaning, not information

**Date:** June 30, 2026  
**Status:** Locked

**Decision:** Covarify should not begin by dropping users into raw financial data. The first experience should organize money around what it means in the user's life, then reveal detail when the detail helps.

**Reason:** Users experience financial pressure as decisions, relationships, timing, obligations, and life events, not as ledger rows.

**Tradeoff:** The product must still give users transparent access to the underlying evidence.

**Revisit trigger:** User research shows that the decision-first opening materially reduces trust or activation.

---

## PDR-023 - Covarify never begins with what is wrong

**Date:** June 30, 2026  
**Status:** Locked

**Decision:** Begin with a true strength, stabilizing fact, or useful context before surfacing a problem.

**Reason:** A constructive opening improves trust and prevents the product from feeling punitive.

**Tradeoff:** Do not use false positivity when an urgent risk exists.

**Revisit trigger:** None anticipated. Urgent-risk language can be refined without removing the principle.

---

## PDR-024 - Every insight should naturally lead to an action

**Date:** June 30, 2026  
**Status:** Locked

**Decision:** A discovery or insight is incomplete unless it points to a useful next move, confirmation, or organization task.

**Reason:** Users already have access to data and observations. Covarify exists to support decisions and action.

**Tradeoff:** The product should sometimes recommend gathering information rather than forcing an action.

---

## PDR-025 - Financial Events are the core context objects

**Date:** June 30, 2026  
**Status:** Locked with July 16 refinement

**Original decision:** Financial Events, not transactions, are the richer user-facing objects connecting transactions, documents, people, projects, purpose, and life buckets.

**Refinement:** Transactions and account records remain first-class analytical evidence. Financial Events are the core context and meaning objects, not replacements for financial evidence.

**Reason:** The product must support both accurate financial analysis and real-life meaning.

**Tradeoff:** The domain model is more complex than a transaction-only product.

**Revisit trigger:** The event model creates friction without measurable value in decisions, retrieval, or retention.

---

## PDR-026 - Plaid connection is primary and manual input is secondary

**Date:** July 13, 2026  
**Status:** Locked

**Decision:** Secure account connection is the primary user experience. Manual input supports missing accounts, cash, corrections, upcoming events, and user preference but is not the main product path.

**Reason:** Covarify requires an ongoing, current picture to support recurring decisions. A manual-first product would recreate the work users already avoid.

**Tradeoff:** Plaid cost, connection failures, and trust requirements become core product concerns.

**Revisit trigger:** Account-connection completion or retention is materially weaker than a tested alternative.

---

## PDR-027 - The Money Picture and First Win are the MVP wedge

**Date:** July 13, 2026  
**Status:** Locked

**Decision:** The first end-to-end value loop is connect accounts, understand the Money Picture, receive a First Win, shape the plan, and take one action.

**Reason:** The wedge proves the decision-company thesis without requiring the entire long-term platform.

**Tradeoff:** Later features must wait even when they are strategically attractive.

**Revisit trigger:** The First Win does not create a measurable action or return behavior after repeated iteration.

---

## PDR-028 - Decision Margin™ is a primary differentiator

**Date:** July 1, 2026  
**Status:** Locked as a product concept

**Decision:** Decision Margin™ should show the user's financial room to act after obligations, known events, selected goals, and a protected buffer across a defined horizon.

**Reason:** Users need to know what is safe or supportable, not only what remains in an account.

**Tradeoff:** The metric requires stronger timing, obligation, and confidence logic than a simple cash-flow number.

**Revisit trigger:** Users consistently misunderstand the metric or it fails to improve decision quality.

---

## PDR-029 - Repair must use multiple lever types

**Date:** July 16, 2026  
**Status:** Locked

**Decision:** Covarify must not treat discretionary spending cuts as the default answer to every cash gap. Repair logic should compare spending changes, payment timing, temporary minimum-payment strategies, hardship options, balance transfers, consolidation, refinancing, income actions, reimbursements, available liquidity, and professional escalation where relevant.

**Reason:** Real financial deficits can be structural, temporal, debt-driven, or event-driven. A spending-only answer is often incomplete and can be harmful.

**Tradeoff:** The decision engine and data requirements become more complex.

**Revisit trigger:** None for the multi-lever principle. Individual lever rules require ongoing review.

---

## PDR-030 - Users co-create consequential plans

**Date:** July 16, 2026  
**Status:** Locked

**Decision:** Users should be able to confirm, reject, reclassify, reduce, pause, or select candidate actions and see the projected result update.

**Reason:** The user knows constraints and meaning that transaction data cannot fully reveal. Participation improves agency, accuracy, and commitment.

**Tradeoff:** The experience requires careful interaction design and cannot be a one-click recommendation only.

**Revisit trigger:** Interaction adds complexity without improving accuracy, trust, or completion.

---

## PDR-031 - Consequential recommendations require an explanation contract

**Date:** July 16, 2026  
**Status:** Locked

**Decision:** A material recommendation should show the diagnosis, evidence, horizon, action, alternatives where relevant, estimated impact, tradeoffs, confidence, missing information, safeguards, and revisit trigger.

**Reason:** Explainability and user control are core trust advantages.

**Tradeoff:** The product must balance completeness with cognitive load.

---

## PDR-032 - Covarify will not move money in the initial product

**Date:** July 13, 2026  
**Status:** Locked

**Decision:** Remove payment-initiation products from the MVP and use Plaid for data aggregation only.

**Reason:** Money movement is not required to prove the product value and creates additional security, operational, and regulatory scope.

**Tradeoff:** Users must complete actions outside Covarify or through later approved integrations.

**Revisit trigger:** Strong evidence shows execution is the primary barrier after the decision and the company is ready for the additional obligations.

---

## PDR-033 - Income verification is deferred

**Date:** July 13, 2026  
**Status:** Locked for MVP

**Decision:** Use transaction data to identify recurring payroll deposits and ask users to confirm or edit them. Do not include verified income in the MVP unless a future use case requires it.

**Reason:** The initial decision experience needs a credible income picture, not formal underwriting-grade verification.

**Tradeoff:** Some income remains estimated or user-confirmed.

**Revisit trigger:** A product or partner use case requires verification and the user benefit justifies the additional data.

---

## PDR-034 - Relationship Mode is permissioned, not total sharing

**Date:** June 28 and July 16, 2026  
**Status:** Working

**Decision:** Relationship Mode should support granular, reversible permissions across goals, obligations, selected accounts, aggregated categories, specific transactions, and context.

**Reason:** Shared financial clarity should not require surveillance or erase personal autonomy.

**Tradeoff:** Permissions and safety design are more complex than a single collaborator invite.

**Revisit trigger:** User research identifies a simpler model that preserves the same safety and autonomy.

---

## PDR-035 - Explain My Money is user-controlled context sharing

**Date:** June 28, 2026  
**Status:** Working

**Decision:** Users may add context to a transaction, event, or decision and choose whether to share it with another authorized person.

**Reason:** Many financial conflicts come from missing context, not missing numbers.

**Tradeoff:** Context can be sensitive and must not be shared silently.

---

## PDR-036 - Financial Consolidation Engine™ separates savings types

**Date:** June 30, 2026  
**Status:** Locked

**Decision:** Report verified savings, estimated opportunities, and financial-efficiency gains separately.

**Reason:** Combining them would inflate claims and weaken trust.

**Tradeoff:** The headline number may appear smaller but will be more credible.

---

## PDR-037 - Financial Clarity Score is not a moral score

**Date:** July 16, 2026  
**Status:** Open

**Working direction:** If a Financial Clarity Score remains in the product, it should measure data completeness, freshness, confirmation, and decision readiness rather than financial worth or behavior quality.

**Concern:** Users may interpret any financial score as judgment, creditworthiness, or success.

**Decision needed:** Keep, rename, redesign, or remove after user testing.

---

# Brand Decision Records

## BRD-001 - Financial Clarity category

**Date:** June 30, 2026  
**Status:** Locked

**Decision:** The user-facing category is `Financial Clarity`.

**Reason:** It communicates the outcome without forcing users to understand fintech architecture.

---

## BRD-002 - Tagline

**Date:** June 30, 2026  
**Status:** Locked

**Decision:** `From Complexity to Confidence.`

---

## BRD-003 - Core positioning sentence

**Date:** July 1, 2026  
**Status:** Locked

**Decision:** `Covarify is not a financial data company. It is a financial decision company.`

---

## BRD-004 - Experience posture

**Date:** June 30 to July 16, 2026  
**Status:** Locked

**Decision:** Covarify should feel premium, intelligent, calm, and human. It should avoid the visual and verbal language of legacy banking, accounting software, dense spreadsheets, shame, and product hype.

---

# Business Decision Records

## BDR-001 - Subscription-led business model

**Date:** July 16, 2026  
**Status:** Working

**Decision:** Build toward a user-paid subscription with an individual core product, a possible advanced tier, a future household tier, and later partner distribution.

**Reason:** Subscription revenue is more aligned with ongoing user value than advertising, data sale, or compensation-ranked product placement.

**Tradeoff:** Covarify must prove recurring value beyond a one-time cleanup.

**Revisit trigger:** Retention or willingness-to-pay evidence supports a materially different model.

---

## BDR-002 - Personal financial information will not be sold

**Date:** July 14 to July 16, 2026  
**Status:** Locked

**Decision:** Do not sell personal financial information or use it for behavioral advertising.

**Reason:** The product requires deep trust and financial context.

---

## BDR-003 - Affiliated referrals are separate and explicit

**Date:** July 16, 2026  
**Status:** Locked principle

**Decision:** Any referral to Covarum or another affiliated provider must be user-requested or explicitly accepted, separately disclosed, and unable to influence personalized recommendation ranking.

**Reason:** The founder's related financial-services work creates a conflict that must be managed visibly.

**Tradeoff:** Referral conversion may be lower, but product trust and alignment are protected.

---

## BDR-004 - Private beta optimizes for evidence, not scale

**Date:** July 16, 2026  
**Status:** Locked

**Decision:** Begin with a small founder-led cohort representing different financial states and observe behavior directly.

**Reason:** Sign-up volume will not prove recommendation quality or recurring value.

---

## BDR-005 - Pricing remains a test

**Date:** July 16, 2026  
**Status:** Open

**Current testing bands:**

- Individual core: $12 to $20 monthly
- Advanced individual: $20 to $35 monthly
- Household: $25 to $45 monthly
- Human-guided add-on: $99 to $299 one time, only after scope review

**Decision needed:** Final packaging and prices after real users experience the First Win and recurring loop.

---

# Trust Decision Records

## TDR-001 - Data collection follows current user benefit

**Date:** July 16, 2026  
**Status:** Locked

**Decision:** Do not collect a data type because it may be useful later. Each collection must have an identified purpose and user benefit.

---

## TDR-002 - Recommendation auditability

**Date:** July 16, 2026  
**Status:** Locked

**Decision:** Material recommendations must be reproducible from recorded data, confirmation, logic or model version, calculations, and output.

---

## TDR-003 - Claims match environment

**Date:** July 15 to July 16, 2026  
**Status:** Locked

**Decision:** Public and private pages must clearly distinguish concept, prototype, sandbox, private beta, and production capability.

---

## TDR-004 - No live-user beta before baseline controls

**Date:** July 16, 2026  
**Status:** Locked

**Decision:** Do not use live user financial data until authentication, secure storage, consent records, authorization, account disconnection, monitoring, support, and deletion foundations exist.

---

# Open Decision Register

| ID | Decision | Owner | Evidence needed | Decision point |
|---|---|---|---|---|
| ODR-001 | Final legal and operating relationship between Covarify and Covarum LLC | Founder / Counsel | Entity, tax, licensing, privacy, and conflict analysis | Before paid beta |
| ODR-002 | Final pricing and packaging | Founder / Product | First Win value, recurring use, willingness to pay, unit economics | After initial private-beta evidence |
| ODR-003 | Authentication, database, analytics, monitoring, and email stack | Engineering / Security | Security, speed, cost, migration, and deletion requirements | Before private-beta build |
| ODR-004 | Final financial-guidance and professional-advice boundary | Founder / Counsel | Use-case review and applicable legal analysis | Before live recommendations |
| ODR-005 | Human review and coaching model | Founder / Product | User need, support cost, scope, licensing, and conversion evidence | After initial beta |
| ODR-006 | Financial Clarity Score | Product / Research | Comprehension, motivation, shame risk, and behavioral effect | Before production use |
| ODR-007 | Final name for Repair Plan Builder | Brand / Product | User comprehension and emotional response | Before public launch of feature |
| ODR-008 | First partner-distribution vertical | Founder / Business | Direct-user proof, partner economics, privacy, and activation | After paid proof |
| ODR-009 | Financial Life Vault packaging and retention model | Product / Trust | User value, storage cost, document sensitivity, and retention | Before Vault development |
| ODR-010 | Relationship Mode first permission set | Product / Trust / Research | Household interviews and financial-abuse safety review | Before household beta |

---

# Decision Log Maintenance

- Add a record when a decision changes product behavior, positioning, business alignment, data collection, risk, roadmap, or external claims.
- Do not reuse an ID.
- Mark superseded records as archived and link the replacement.
- Review open decisions weekly during private beta.
- Update the master playbook and relevant module in the same release as the decision.
