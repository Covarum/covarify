# Covarify Playbook

**Version:** 0.3 - Living Operating System  
**Last updated:** July 16, 2026  
**Owner:** Tara M. Wallace, Founder  
**Canonical location:** `docs/COVARIFY_PLAYBOOK.md` on the `main` branch  
**Company stage:** Pre-launch private beta  

> Covarify is not a financial data company. It is a financial decision company.

This playbook is Covarify's company memory and operating system. It exists so the product, business, brand, technology, trust posture, and roadmap develop as one coherent system. It should answer not only what Covarify is building, but why, for whom, how it should behave, how it will make money, what it will never do, and what evidence would cause a decision to change.

The playbook is deliberately stored beside the code. A product that learns and changes quickly cannot rely on scattered chat history, static PDFs, or founder memory as its only source of truth.

---

## 1. How to use this playbook

### 1.1 Decision states

Every meaningful statement in the playbook should be understood as one of four states:

| State | Meaning |
|---|---|
| **Locked** | The current operating decision. Build and communicate from it unless a new decision record replaces it. |
| **Working** | The current direction, but still being tested. |
| **Open** | A decision is required. Do not quietly treat an assumption as settled. |
| **Archived** | Previously considered or used, but no longer current. Preserve the reasoning. |

### 1.2 Update rules

1. Update the playbook whenever a product, business, trust, or positioning decision materially changes.
2. Record the reason for the change, not only the new answer.
3. Separate observed evidence from founder instinct and future hypothesis.
4. Use exact dates for decisions and experiments.
5. Do not delete important rejected ideas. Move them to the decision log with the reason they were rejected or deferred.
6. Keep product claims aligned with what is actually working in production, private beta, sandbox, prototype, or concept stage.
7. Review the current-state section weekly during private beta.
8. Review the business model, roadmap, and risk register monthly.
9. Complete a full strategic review quarterly or after any material change in customer, regulation, funding, distribution, or product scope.

### 1.3 Playbook modules

- [Product and Decision System](./Playbook/PRODUCT_AND_DECISION_SYSTEM.md)
- [Business and Go-to-Market](./Playbook/BUSINESS_AND_GTM.md)
- [Operations, Trust, and Roadmap](./Playbook/OPERATIONS_TRUST_AND_ROADMAP.md)
- [Decision Log](./Playbook/DECISION_LOG.md)

The master playbook contains the company-level truth. The modules contain the depth required to build and operate it.

---

## 2. Current company snapshot

### 2.1 What is locked

- **Brand category:** Financial Clarity
- **Tagline:** From Complexity to Confidence.
- **Core positioning:** Covarify is not a financial data company. It is a financial decision company.
- **Product promise:** Help people understand their full financial picture, identify what matters first, and take a practical next step.
- **Experience posture:** Calm, intelligent, premium, human, explainable, and nonjudgmental.
- **Primary data experience:** Secure account connection through Plaid is the primary path. Manual input is optional and secondary, not the main product.
- **MVP wedge:** A connected Money Picture followed by a personalized First Win.
- **Recommendation doctrine:** Every insight should naturally lead to an action, and every action should show the evidence, expected impact, tradeoffs, confidence, and safeguards.
- **Trust posture:** Covarify does not sell personal financial information and should collect only what it needs.
- **Product boundary:** Covarify does not move money, initiate payments, act as a bank, or autonomously execute financial decisions.

### 2.2 What exists as of July 16, 2026

- Public stealth landing site and early-access page.
- Brand, privacy, security, terms, sitemap, and robots pages.
- Private product and First Win preview pages.
- Plaid sandbox account connection prototype.
- Connected account balances and transaction display.
- First Win Engine v0 using available transaction history.
- Thirty-day or available-history cash-flow analysis.
- Spending classification across essential, flexible, debt-payment, income, and unknown categories.
- Ranked flexible categories, merchants, and largest outflows.
- Data-derived savings levers.
- Deficit-repair calculation and a structured recommendation with a seven-day checklist, confidence, safeguards, and disclaimer.
- A Financial Brain foundation with Financial Events, documents, people, projects, and life buckets.
- Early architecture and product-decision documentation.

### 2.3 Immediate gaps

- The early-access form does not yet deliver a proper success state or founder notification.
- The product is still sandbox and prototype heavy, not production-ready for live customer financial data.
- Authentication, durable user storage, consent records, secure account lifecycle, production webhooks, audit logging, and deletion workflows require completion.
- First Win logic is directionally useful but not yet robust enough for the full range of real debt, timing, income, and cash-flow situations.
- The current repair experience focuses too heavily on reducing flexible spending. It must also compare payment timing, minimum-payment strategies, hardship options, consolidation, balance transfers, refinancing, income actions, and other legitimate levers.
- User action selection, transaction-level interaction, progress tracking, and recommendation follow-through are not yet complete.
- Product, business, compliance, and operating decisions have not previously lived in one complete source of truth.

### 2.4 Near-term milestone

**Founder demo target:** Sunday, July 19, 2026.

For this milestone, the goal is not to imply production readiness. The goal is to prove the essential experience:

1. A user can connect a representative sandbox financial picture.
2. Covarify can explain what it sees.
3. Covarify can identify a credible First Win.
4. The user can participate in shaping the plan rather than passively receiving a verdict.
5. The experience feels materially more useful and more human than a budgeting dashboard.

---

## 3. Company identity

### 3.1 Mission

Help people turn financial complexity into clear, confident decisions.

### 3.2 Vision

Build the trusted financial operating system people return to whenever life and money collide - not because it creates dependence or anxiety, but because it remembers context, explains tradeoffs, and helps them become more capable over time.

### 3.3 The problem

Most people do not lack financial information. They lack a coherent way to interpret competing obligations, timing, debt, income, goals, relationships, documents, and life events together.

Traditional tools generally do one of the following:

- Show transactions and charts.
- Enforce a budgeting method.
- Track net worth.
- Sell or recommend financial products.
- Provide generic educational content.
- Require a human advisor and a larger asset base.

The user's real question is usually different:

> Given everything happening in my financial life, what matters first, what can I safely do, and what will that choice change?

Covarify is built around that question.

### 3.4 Category

**Financial Clarity** is the user-facing category.

Internally, Covarify is a **Financial Decision Operating System**.

It combines financial data, context, memory, decision logic, user participation, and ongoing action support. The category should remain understandable. Covarify should not force users to learn invented language before they understand the value.

### 3.5 Positioning statement

For people carrying more financial complexity than anyone can see, Covarify brings the picture together, identifies what matters first, and helps shape the next practical move. Unlike budgeting apps that primarily organize past spending, Covarify is designed around the decision in front of the user.

### 3.6 User promise

Covarify should consistently help a user answer five questions:

1. What is true right now?
2. What is creating the most pressure or opportunity?
3. What are my realistic options?
4. What changes if I choose each option?
5. What is the next action I can take with confidence?

### 3.7 Brand promise

Covarify should leave the user feeling clearer, steadier, and more capable than when they arrived.

It should never make the user feel scolded, exposed, manipulated, sold to, or reduced to a score.

---

## 4. Strategic thesis

### 4.1 The wedge

The first product wedge is not comprehensive financial planning. It is a fast, connected clarity experience:

**Connect accounts -> See the Money Picture -> Receive a credible First Win -> Shape the plan -> Take one action -> Return to review the result.**

The First Win must be specific enough to matter, conservative enough to trust, and simple enough to act on.

### 4.2 The expansion path

Covarify can expand from the First Win into a broader operating system through a connected set of capabilities:

1. **Money Picture** - What is happening now.
2. **First Win** - What matters first.
3. **Repair Plan Builder** - How the user can close a gap or relieve pressure using multiple types of levers.
4. **Decision Margin™** - What room the user has to act over a selected time horizon.
5. **Decision Simulator** - What changes under different choices.
6. **Personal Decision Plan** - What to do over 30, 60, and 90 days.
7. **Discovery Engine** - What patterns or risks deserve attention.
8. **Financial Zoom** - How the picture changes from this week to the month, quarter, year, and life-event horizon.
9. **Financial Events** - What transactions and documents mean in the user's life.
10. **Financial Life Vault** - The records and context needed when a decision, claim, tax event, repair, trip, business activity, or family event occurs.
11. **Financial Consolidation Engine™** - What tools, subscriptions, accounts, or services can be simplified, with verified savings separated from estimates.
12. **Relationship Mode** - How two people build shared clarity using explicit permissions rather than surveillance.

### 4.3 The long-term moat

Covarify's defensibility should not depend on account aggregation alone. Financial data access is infrastructure, not the product moat.

The intended moat is the combination of:

- A longitudinal model of the user's financial life.
- User-confirmed context and corrections.
- Financial Events connecting money to people, projects, documents, and purpose.
- Decision history and outcome memory.
- Explainable decision logic with strong trust controls.
- A product experience that turns complexity into action without shame.
- Permissioned household and relationship context.
- A growing library of real-world decision patterns and safe response strategies.

The system becomes more useful because it understands the user better and can compare current decisions with prior context. It must never become more powerful by making the user's information difficult to leave or understand.

### 4.4 Reliance without dependence

Covarify should become an ecosystem users rely on because it is consistently useful, not because it creates fear, hides information, or locks them in.

The operating principle is:

> Covarify earns repeat use by remembering, adapting, and teaching. It does not earn repeat use by withholding understanding.

A strong Covarify user should become more financially capable over time. The product should explain why an action matters, allow the user to disagree, preserve the decision context, and make data export and account disconnection understandable.

---

## 5. Product doctrine

### 5.1 Core product principles

1. **Meaning before information.** Do not begin by dropping the user into a ledger.
2. **Strength before problem.** Begin with a true stabilizing fact or useful context before surfacing pressure.
3. **Action after insight.** An observation without a next move is incomplete.
4. **Evidence before confidence.** Recommendations must show what data supports them and what is missing.
5. **Options before commands.** For consequential decisions, compare viable paths and tradeoffs.
6. **User participation before automation.** Let users confirm, correct, exclude, and shape the plan.
7. **Timing matters.** A good long-term choice can be dangerous at the wrong moment.
8. **Liquidity is not failure.** Preserving cash can be more responsible than maximizing a debt payment.
9. **No shame as a feature.** The product should distinguish behavior, circumstance, timing, and structural problems.
10. **Clarity over false precision.** Do not present an estimate as a fact.
11. **Restraint builds trust.** Covarify should say when it does not know.
12. **Real life is the unit of design.** Money decisions involve family, health, work, relationships, housing, transportation, and unexpected events.

### 5.2 The recommendation contract

Every material recommendation should contain:

- A clear headline.
- A diagnosis of the current state.
- The evidence used.
- The horizon being analyzed.
- The primary recommended next action.
- At least one realistic alternative when the decision is consequential.
- Estimated financial impact.
- Tradeoffs and possible costs.
- Confidence level.
- Missing information that could change the answer.
- A short action sequence.
- A revisit date or trigger.
- Appropriate safeguards and disclaimer.

### 5.3 What Covarify must not become

Covarify is not:

- A transaction feed with nicer language.
- A generic budgeting app.
- A credit-score shame engine.
- A product-recommendation marketplace disguised as advice.
- A lead-generation funnel that quietly routes users into compensated financial products.
- An autonomous money manager.
- A substitute for legal, tax, investment, bankruptcy, or individualized professional advice.
- A system that promises savings it cannot verify.
- A product that assumes cutting discretionary spending is the answer to every deficit.
- A dashboard that asks users to do all the interpretation themselves.

---

## 6. Customer strategy

### 6.1 Beachhead customer

The initial customer is a financially engaged but context-overloaded adult who has enough financial activity to create complexity but not enough clarity to confidently prioritize it.

Common characteristics include:

- Multiple deposit, credit, loan, investment, or payment accounts.
- Debt pressure or uncertainty about repayment order.
- Variable income or a mismatch between income and bill timing.
- Family obligations that compete with financial goals.
- A life transition such as divorce, a new job, caregiving, illness, relocation, business formation, a major purchase, or a change in household income.
- The feeling that the numbers exist in many places but the answer exists nowhere.
- A desire for support without judgment or a traditional advisor relationship.

The beachhead is defined more by the decision problem than by age, income, or net worth.

### 6.2 Priority user patterns

1. **Behind but functioning** - The user is meeting many obligations but cash timing and debt create recurring pressure.
2. **High income, low clarity** - The user earns enough that basic budgeting advice feels irrelevant, but complexity still causes poor or delayed decisions.
3. **Variable-income household** - Income is real but uneven, making monthly averages misleading.
4. **Life transition** - A current event has changed what is safe, urgent, or affordable.
5. **Two people, one financial reality** - The household needs shared understanding without forcing total visibility or erasing personal autonomy.
6. **Neurodivergent or cognitively overloaded** - The user benefits from reduced complexity, clear sequencing, memory, and low-friction follow-through.

### 6.3 Initial non-targets

Covarify should not initially optimize for:

- Active trading or investment research.
- Full business accounting or bookkeeping.
- High-net-worth portfolio management.
- Tax preparation.
- Bill payment or money movement.
- Bankruptcy case management.
- Users seeking guaranteed debt settlement outcomes.
- Users who primarily need emergency social-service navigation rather than a financial decision product.

The product can still recognize when a user may need specialized help and provide a careful handoff.

---

## 7. Business thesis

### 7.1 Primary value exchange

Users pay Covarify to reduce the time, uncertainty, and costly mistakes involved in understanding and acting on their financial life.

The value is not only dollars saved. It includes:

- Avoided late fees, overdrafts, or preventable interest.
- Better debt-payment timing.
- Fewer contradictory tools and subscriptions.
- Faster decisions.
- More confidence in tradeoffs.
- Better household communication.
- More consistent action.
- Preservation of documents and context.
- Reduced cognitive load.

### 7.2 Preferred revenue model

The preferred long-term model is subscription-led and aligned with the user.

Working model:

1. A limited free or trial experience that proves the Money Picture and First Win.
2. A paid individual subscription for ongoing account monitoring, Decision Margin™, scenario comparison, plans, and follow-through.
3. A paid household tier for Relationship Mode and shared planning.
4. Optional, clearly separated access to human professionals when the user requests it.
5. Later B2B2C distribution through employers, benefits platforms, associations, healthcare organizations, financial professionals, or other trusted channels.

Pricing is not yet locked. It must be tested against willingness to pay, Plaid cost, AI cost, support burden, retention, and measurable user value.

### 7.3 Alignment rules

- Do not sell personal financial information.
- Do not change the ranking of a recommendation because Covarify or an affiliate may be paid.
- Do not insert a financial product into a recommendation unless it is genuinely relevant and the user can see the assumptions, costs, alternatives, and relationship disclosure.
- Any referral to Covarum or another affiliated financial-services business must be optional, explicit, separated from the recommendation engine, and accompanied by a clear conflict disclosure.
- A user who declines a referral must receive the same product experience.
- Sponsored placement should not appear inside personalized decision logic.

### 7.4 Business stages

| Stage | Objective | Revenue posture |
|---|---|---|
| **Founder demo** | Prove the experience and strategic difference. | No revenue requirement. |
| **Private beta** | Validate activation, recommendation trust, action completion, and retention. | Free or tightly controlled founding-user pricing. |
| **Paid beta** | Prove willingness to pay and supportable unit economics. | Test subscription ranges and annual plans. |
| **Consumer launch** | Build repeatable acquisition and retention. | Subscription-led. |
| **Household expansion** | Add Relationship Mode and shared value. | Higher household tier. |
| **Partner distribution** | Lower acquisition cost and expand reach. | B2B2C, licensing, or per-member pricing. |

---

## 8. North star and scorecard

### 8.1 Beta north-star metric

**Actionable Clarity Rate**

The percentage of activated users who:

1. connect or complete a usable financial picture,
2. receive a First Win they confirm is relevant,
3. select or shape a next action, and
4. complete or meaningfully progress that action within seven days.

This is stronger than measuring account connections, page views, or generated recommendations alone.

### 8.2 Supporting product metrics

- Account-connection completion rate.
- Time to first useful insight.
- Percentage of recommendations rated accurate or relevant.
- Percentage of recommendations corrected by the user.
- First Win action-selection rate.
- Seven-day action-completion rate.
- Thirty-day return rate.
- Percentage of users with enough data for a high-confidence recommendation.
- Reduction in unresolved cash gap, preventable fees, or avoidable interest where measurable.
- Decision Margin™ improvement.
- Household invitation and acceptance rate when Relationship Mode launches.
- Number of support or trust incidents per active user.

### 8.3 Business metrics

- Free-to-paid conversion.
- Monthly and annual recurring revenue.
- Gross margin after Plaid, AI, infrastructure, and support costs.
- Monthly customer acquisition cost by channel.
- Payback period.
- Monthly and annual retention.
- Expansion from individual to household.
- Support minutes per active user.
- Referral-source concentration.

### 8.4 Trust metrics

- Percentage of users who understand why a recommendation was made.
- Percentage who know how to correct data or disconnect an account.
- Data-deletion completion time.
- Security and privacy incident count.
- Recommendation override and dispute rate.
- Percentage of consequential recommendations with complete evidence and audit records.

---

## 9. Strategic priorities

### Priority 1 - Make the First Win real

The First Win must handle real financial states, not only classify flexible spending. It should distinguish temporary timing pressure from a structural deficit, identify required obligations, preserve minimum payments and essential bills, and compare multiple repair levers.

### Priority 2 - Turn the user into a participant

The user should be able to review transactions, mark what is avoidable or reducible, confirm recurring commitments, identify one-time events, and see how each choice changes the gap. The experience should feel like building the answer together.

### Priority 3 - Build trust before breadth

Authentication, consent, secure storage, auditability, data freshness, deletion, and honest product claims are launch requirements, not later polish.

### Priority 4 - Validate the decision company thesis

The private beta must prove that users value help deciding what to do next more than they value another visualization of spending.

### Priority 5 - Establish a repeatable operating system

Product decisions, user evidence, experiments, risks, metrics, and roadmap changes must be documented as the company develops.

---

## 10. Open decision register

The following decisions are intentionally not treated as locked:

1. Final consumer pricing and packaging.
2. Whether the first paid product is individual-only or includes a household tier.
3. The exact legal and operating relationship between Covarify and Covarum LLC.
4. The scope and timing of any human financial-coaching layer.
5. The policy for professional referrals and compensation beyond the core conflict rules.
6. The production database, authentication, monitoring, and analytics stack.
7. Final data-retention periods by record type after legal review.
8. The precise boundary between educational financial guidance and regulated individualized advice.
9. The first partner-distribution vertical.
10. Whether Financial Clarity Score remains a product concept, is renamed, or is removed to avoid score-related shame or confusion.
11. The final name for the interactive deficit and action experience. `Repair Plan Builder` is a working name only.
12. The long-term role of the Financial Life Vault within the paid package.

Each open decision should receive an owner, evidence requirement, and target decision date in the decision log.

---

## 11. Founder and team operating principles

1. Do not overbuild the interface before the decision engine is credible.
2. Do not overbuild the decision engine before the data and consent model are trustworthy.
3. Do not add a feature unless it maps to a real user job, a measurable outcome, and an identified risk.
4. Do not treat a demo deadline as permission to make a production claim.
5. Use founder financial data only in controlled environments with deliberate privacy safeguards.
6. Favor small, testable end-to-end experiences over broad disconnected feature sets.
7. Preserve the user's language from interviews. Do not replace real pain with fintech jargon.
8. Separate what the product knows, infers, estimates, and asks the user to confirm.
9. Build for the mobile reality of users making decisions under stress.
10. Protect the trust advantage even when a faster growth tactic is available.

---

## 12. Definition of success

Covarify is succeeding when a user can say:

> It understood the full situation, showed me what mattered first, explained my options without judging me, and helped me take the next step.

The company is succeeding when that outcome is repeatable, trusted, economically sustainable, and delivered without compromising user agency or privacy.

---

## 13. Change log

### v0.3 - July 16, 2026

- Rebuilt the prior thin documentation structure into a company-wide living playbook.
- Added the current company, product, business, trust, and roadmap snapshot.
- Preserved the locked category, positioning, brand, Plaid-first approach, First Win wedge, Decision Margin™, Financial Events, Financial Life Vault, Discovery Engine, Financial Zoom, Financial Consolidation Engine™, and Relationship Mode concepts.
- Added the explicit principle of reliance without dependence.
- Added business alignment and affiliated-referral guardrails.
- Added Actionable Clarity Rate as the private-beta north-star metric.
- Identified the need for a multi-lever repair engine rather than a spending-cut-only experience.
- Added the open decision register and formal update rules.

### Prior foundation - June 30 to July 16, 2026

- Created the initial documentation folders.
- Built onboarding, First Win previews, the Financial Brain foundation, the stealth landing site, Plaid sandbox connectivity, and First Win Engine v0.
- Recorded PDR-022 through PDR-025.
