# Covarify Product and Decision System

**Status:** Working product doctrine with locked principles  
**Last updated:** July 16, 2026  
**Owner:** Founder and Product  

This module defines how Covarify should understand a user's financial life, turn evidence into decisions, involve the user in shaping the answer, and support action over time.

It is both a product blueprint and a behavioral contract. Any feature that conflicts with this document should be treated as a product decision, not a small implementation detail.

---

## 1. Product thesis

Covarify should not make users do the final mile of interpretation alone.

A traditional finance product may show that food spending increased, a credit-card balance rose, or cash flow is negative. Covarify should go further:

1. Determine whether the pattern is recurring, temporary, mistimed, or incomplete.
2. Explain what is creating pressure.
3. Identify the decision that matters now.
4. Compare realistic levers.
5. Let the user confirm what is possible.
6. Build a practical action plan.
7. Revisit the result when new data arrives.

The product is not complete when it has displayed the data. It is complete when it has helped the user understand and act.

---

## 2. Product architecture

### 2.1 Experience layers

Covarify should develop as five connected layers:

| Layer | Purpose | Core question |
|---|---|---|
| **Evidence layer** | Accounts, balances, transactions, recurring streams, liabilities, documents, and user input. | What information do we have? |
| **Context layer** | People, goals, Financial Events, life buckets, timing, obligations, priorities, and user corrections. | What does the information mean? |
| **Decision layer** | State classification, Decision Margin™, scenarios, tradeoffs, confidence, and recommendations. | What matters first and what are the options? |
| **Action layer** | First Win, Repair Plan Builder, tasks, reminders, check-ins, and 30/60/90-day plans. | What should happen next? |
| **Memory layer** | Decision history, outcomes, documents, changes, and relationship permissions. | What should Covarify remember for the next decision? |

### 2.2 Product surfaces

The long-term product system includes:

1. Money Picture
2. First Win
3. Repair Plan Builder
4. Decision Margin™
5. Decision Simulator
6. Personal Decision Plan
7. Discovery Engine
8. Financial Zoom
9. Financial Events
10. Financial Life Vault
11. Financial Consolidation Engine™
12. Relationship Mode
13. Explain My Money
14. Timeline and decision history

These should not become disconnected tabs. They should feel like different views of the same financial operating system.

---

## 3. The primary user journey

### Step 1 - Start with the decision

Before requesting a large financial intake, Covarify should ask a simple question such as:

- What feels hardest to see clearly right now?
- What decision are you trying to make?
- What are you most worried could go wrong?

This gives the system a purpose for the data and gives the user a reason to continue.

### Step 2 - Connect the financial picture

Plaid account connection is the primary path. The initial scope should focus on the data necessary for the first decision:

- Depository accounts
- Credit cards and loans
- Transactions
- Recurring inflows and outflows
- Balances
- Liability details when available
- Investments where they are relevant to the full picture
- Identity only where needed for account ownership and consent workflows

Manual input should remain available for:

- Unconnected accounts
- Cash income
- Known bills or obligations not visible in transactions
- Expected reimbursements
- Upcoming one-time events
- User corrections

Manual entry should support the connected picture rather than replace it.

### Step 3 - Confirm the picture

Covarify should ask the user to confirm only the facts that materially change the decision:

- Which deposits are income?
- Which bills are essential and recurring?
- Which payments are debt payments?
- Are any recent transactions one-time events?
- Is there an upcoming expense or deposit that is not visible yet?
- Is the user responsible for all connected accounts?

The product should show why each confirmation matters.

### Step 4 - Deliver the First Win

The First Win should be generated quickly and should answer:

- What is the most important near-term issue or opportunity?
- What evidence supports that conclusion?
- What can the user do within seven days?
- What should the user avoid doing until the picture changes?

### Step 5 - Let the user shape the plan

The recommendation should become interactive. The user can:

- Mark a transaction as necessary, avoidable, reducible, reimbursable, business-related, or one-time.
- Adjust a proposed reduction amount.
- Confirm or reject a recurring charge.
- Add an expected deposit or obligation.
- Compare a payment-timing option.
- Select a preferred action.
- State a constraint the engine missed.

Every change should update the projected result immediately.

### Step 6 - Commit to one next action

The user should leave with one clear commitment, not a long list of financial chores.

Examples:

- Keep $300 in checking until the next deposit.
- Pay the required minimum this cycle and schedule a full review after payday.
- Cancel or pause two selected subscriptions.
- Contact the card issuer about a hardship or due-date option.
- Move a bill due date to reduce the timing gap.
- Apply an identified surplus to one selected debt after preserving the buffer.

### Step 7 - Return for the result

Covarify should automatically or manually revisit the plan at the next meaningful trigger:

- The next paycheck arrives.
- A large bill clears.
- A card statement closes.
- A selected action is completed.
- A cash gap closes or worsens.
- A user-defined review date arrives.

The return experience should explain what changed and whether the prior decision worked.

---

## 4. User financial states

Covarify should classify the user's current operating state before prioritizing actions. The state is not a judgment of the person. It is a description of the financial system at a point in time.

### 4.1 State A - Immediate risk

Indicators may include:

- Essential obligations due before available cash or expected income.
- A likely missed minimum payment.
- Insufficient funds for housing, utilities, insurance, food, medication, or transportation.
- Repeated overdraft or returned-payment exposure.
- A negative balance or account closure risk.

Primary objective: prevent avoidable harm and stabilize the next seven to fourteen days.

### 4.2 State B - Timing mismatch

Indicators may include:

- Monthly income is sufficient in total, but deposits arrive after major bills.
- The user repeatedly uses credit or overdraft between pay periods.
- The month ends positive, but specific weeks are negative.

Primary objective: repair timing through bill sequencing, due-date changes, buffer design, or income allocation.

### 4.3 State C - Structural deficit

Indicators may include:

- Recurring essential and committed outflows exceed recurring inflows.
- The gap persists after removing one-time events.
- Credit use is financing normal monthly operations.

Primary objective: build a multi-lever repair plan that addresses the recurring gap rather than suggesting isolated cuts.

### 4.4 State D - Debt-service overload

Indicators may include:

- Minimum payments consume a material share of available cash flow.
- Multiple high-cost balances are growing or barely declining.
- The user can pay bills but cannot build a buffer or progress.

Primary objective: preserve account standing, stop new balance growth, and compare repayment, hardship, transfer, consolidation, or professional-support paths.

### 4.5 State E - Stabilizing

Indicators may include:

- Essential obligations and minimums are covered.
- A small buffer exists but is fragile.
- Cash flow is neutral or slightly positive.

Primary objective: protect the buffer, reduce recurrence risk, and select one improvement priority.

### 4.6 State F - Building

Indicators may include:

- Positive recurring Decision Margin™.
- Required obligations are current.
- The user can allocate money to debt reduction, reserves, or goals.

Primary objective: make deliberate tradeoffs and automate progress.

### 4.7 State G - Optimizing or advancing

Indicators may include:

- Strong liquidity and positive margin.
- Multiple competing goals or opportunities.
- The question is no longer whether the user can act, but which action creates the most value.

Primary objective: compare scenarios, opportunity cost, timing, and long-term alignment.

A user can move between states. The product should explain the state change without presenting it as a permanent identity.

---

## 5. Decision priority hierarchy

The engine should generally reason in the following order. Exceptions require explicit logic and a visible explanation.

1. Protect essential life and safety obligations.
2. Prevent missed required payments, avoidable fees, or account damage.
3. Preserve enough liquidity to avoid immediately reversing the action through new borrowing.
4. Stop the financial position from worsening.
5. Distinguish one-time events from recurring structural problems.
6. Repair a recurring cash-flow deficit.
7. Resolve timing mismatches.
8. Build or protect an appropriate operating buffer.
9. Reduce expensive debt using an explainable strategy.
10. Advance near-term goals.
11. Optimize longer-term saving, investing, protection, or consolidation.

This hierarchy prevents a simplistic rule such as "always pay the highest-interest card first" from overriding the user's ability to pay rent, avoid an overdraft, or keep all accounts current.

---

## 6. Money Picture

The Money Picture is the first coherent view of the user's current system. It is not intended to be a permanent dashboard full of charts.

### 6.1 Minimum Money Picture

- Available and current cash balances
- Credit and loan balances
- Recent inflows and outflows
- Recurring income estimate
- Recurring essential obligations
- Recurring flexible obligations
- Debt minimums and due dates when available
- Near-term known events
- Seven-day and thirty-day cash outlook
- Data coverage and freshness

### 6.2 Required distinctions

Covarify must visibly distinguish:

- Current balance vs available balance
- Pending vs posted transaction
- Recurring vs one-time
- Essential vs flexible vs committed
- Debt purchase vs debt payment
- Income vs transfer
- Verified vs user-confirmed vs inferred
- Gross amount vs net amount where relevant
- Individual vs household responsibility

### 6.3 Data-quality view

The user should be able to see:

- When each account last refreshed
- What accounts are missing
- What facts were inferred
- What facts the user confirmed
- What missing information could change the recommendation

---

## 7. First Win

### 7.1 Purpose

The First Win is the clearest valuable action Covarify can support using the currently available evidence.

It is not necessarily the mathematically optimal long-term move. It is the best next move given timing, confidence, constraints, and user readiness.

### 7.2 First Win criteria

A valid First Win should be:

- Specific
- Achievable within seven days or tied to a clear near-term trigger
- Supported by visible evidence
- Material enough to matter
- Conservative when data is incomplete
- Reversible where uncertainty is high
- Understandable without financial jargon
- Connected to a measurable result

### 7.3 First Win families

- Protect a cash buffer
- Prevent a missed payment
- Close a near-term cash gap
- Pause or reduce a selected flexible commitment
- Correct a recurring timing mismatch
- Stop new balance growth
- Redirect a verified surplus
- Consolidate or remove a redundant expense
- Confirm an income stream or obligation
- Organize missing records needed for a decision
- Compare a debt restructuring path

### 7.4 First Win anti-patterns

Do not produce a First Win that:

- Lists several unrelated priorities.
- Tells the user to "spend less" without identifying where, how much, and why.
- Recommends a debt payment without checking near-term liquidity.
- Treats transfers as spending or deposits as income without confirmation.
- Assumes a one-time expense is recurring.
- Recommends consolidation without total-cost and behavior guardrails.
- Uses a low-confidence estimate as a definitive answer.
- Implies guaranteed savings.

---

## 8. Repair Plan Builder

`Repair Plan Builder` is a working name for the interactive experience that helps a user close a cash gap or reduce recurring pressure.

The core insight is that the answer may require several types of levers, not only spending cuts.

### 8.1 User interaction model

The experience should show the gap and let the user test possible contributions toward closing it.

For relevant transactions or recurring items, the user can select:

- **Keep** - Necessary or intentionally chosen.
- **Reduce** - A lower amount is realistic.
- **Skip once** - Avoidable in the current period.
- **Pause** - Stop temporarily.
- **Cancel** - Remove the recurring item.
- **Reclassify** - Transfer, reimbursement, business expense, debt payment, or one-time event.
- **Not mine** - Exclude from personal responsibility where appropriate.

The product should show a live progress indicator:

- Original gap
- Selected spending changes
- Timing changes
- Payment changes
- Income or reimbursement changes
- Remaining gap
- Buffer after the plan

### 8.2 Non-spending levers

The builder should also support:

- Pay a required minimum rather than the full statement balance for one cycle when paying in full would create a more harmful cash shortage.
- Delay an optional extra debt payment.
- Move a bill due date.
- Split a payment where the provider allows it.
- Use an issuer hardship program.
- Compare a promotional balance transfer.
- Compare an unsecured consolidation loan.
- Refinance an eligible obligation.
- Correct duplicate subscriptions or overlapping services.
- Apply a known reimbursement or receivable when timing is credible.
- Add a realistic near-term income action.
- Use available cash reserves deliberately.
- Consider whether a nonessential asset or service should be sold or removed.
- Escalate to nonprofit credit counseling, legal help, or another qualified professional when the situation exceeds the product's safe scope.

### 8.3 Empowerment rule

The user should not feel that Covarify selected sacrifices for them. Covarify should identify candidates, explain the impact, and let the user decide what is realistic.

A transaction checkbox is not merely a budgeting control. It is a commitment and context capture mechanism. The user's selections should teach the system what is essential, flexible, meaningful, or temporary in that user's life.

### 8.4 Progress language

Use language such as:

- "You have identified $240 of the $410 gap."
- "This closes the immediate gap but leaves only a $35 buffer."
- "Keeping the extra card payment would reopen the gap."
- "Paying the minimum this cycle costs an estimated amount of additional interest, but preserves the cash needed for required bills."

Avoid celebratory language that ignores tradeoffs.

---

## 9. Debt decision framework

This section defines product logic, not individualized financial advice. Production use requires appropriate legal, compliance, and subject-matter review.

### 9.1 Required debt data

Before generating a high-confidence debt recommendation, Covarify should seek:

- Current balance
- Statement balance
- Minimum payment
- Due date
- Interest rate or effective rate
- Promotional rate and expiration
- Account status
- Available credit
- Secured vs unsecured status
- Fees
- Whether new purchases are still occurring
- User goal, such as lowering interest, improving monthly cash flow, reducing utilization, or eliminating accounts
- Near-term cash requirements

When the data is missing, the engine should provide a lower-confidence option comparison rather than a definitive instruction.

### 9.2 Full statement vs minimum payment

Covarify should not assume paying the full statement balance is always the correct immediate action.

The decision should compare:

1. Cash available before the next reliable inflow.
2. Required essential obligations due in the same period.
3. All required minimum payments.
4. The user's operating buffer.
5. The cost of carrying the unpaid statement amount.
6. The cost and risk of creating a cash shortage, overdraft, missed bill, or immediate need to re-borrow.

A temporary minimum-payment strategy may be the safer short-term option when paying in full would cause a more harmful gap. The product must show the added interest cost, establish a revisit trigger, and avoid presenting minimum payments as a sustainable long-term solution.

### 9.3 Extra payment allocation

After essentials, minimums, and an appropriate buffer are protected, Covarify can compare:

- Highest effective interest rate
- Smallest balance
- Highest utilization
- Highest payment relief after payoff
- Promotional expiration risk
- Secured or legally urgent obligation
- User motivation and likelihood of completion

The engine should identify which objective each strategy optimizes. It should not present avalanche or snowball as universally correct.

### 9.4 Balance-transfer guardrails

A balance transfer should only be presented as potentially beneficial when the product can evaluate:

- Transfer fee
- Promotional rate and duration
- Post-promotional rate
- Amount eligible to transfer
- Required monthly payment to clear the balance before expiration
- Whether new purchases receive a grace period
- Risk that the original card will be used again
- Credit eligibility uncertainty

The experience should show total estimated cost under both the current and transfer scenarios.

### 9.5 Consolidation-loan guardrails

A consolidation loan is not automatically debt reduction. It changes the structure of the debt.

Covarify should compare:

- Effective APR including origination fees
- Monthly payment
- Total repayment cost
- Term length
- Fixed vs variable rate
- Prepayment terms
- Whether the loan is secured
- Whether revolving accounts are likely to be reused
- Cash-flow relief vs total-interest increase
- Credit impact uncertainty

The product should clearly state when consolidation lowers the monthly payment by extending the debt for longer.

Covarify should be especially cautious about converting unsecured debt into debt secured by a home, vehicle, retirement asset, or another essential asset.

### 9.6 Hardship and credit-counseling paths

When minimums are not sustainable, Covarify should surface options such as:

- Issuer hardship programs
- Due-date changes
- Fee waivers
- Reduced-rate plans
- Nonprofit credit counseling or debt-management plans
- Legal or bankruptcy consultation when appropriate

It should explain that eligibility and consequences vary and should never claim an outcome before the user speaks with the provider or qualified professional.

---

## 10. Decision Margin™

### 10.1 Definition

Decision Margin™ is the amount of financial room available after accounting for expected inflows, essential obligations, committed payments, selected goals, known near-term events, and an appropriate buffer over a defined horizon.

It is not simply checking-account cash or monthly income minus average spending.

### 10.2 Horizons

Covarify should calculate Decision Margin™ across multiple views:

- Seven days
- Until next reliable income
- Thirty days
- Ninety days
- A user-defined decision date

### 10.3 Conceptual calculation

`Decision Margin = reliable inflows + usable cash - essential obligations - committed payments - selected goal funding - known events - protected buffer`

The displayed amount should include:

- Horizon
- Confidence
- Included accounts
- Included and excluded obligations
- Pending transactions
- User-confirmed adjustments

### 10.4 Interpretation

- **Negative:** A gap exists within the selected horizon.
- **Near zero:** The user has little room for error.
- **Positive but fragile:** A choice is possible but could be reversed by an expected risk.
- **Positive and durable:** The user has capacity to compare goal or optimization choices.

Decision Margin™ should never be presented as permission to spend without showing the assumptions.

---

## 11. Decision Simulator

The simulator should answer questions such as:

- Can I make this purchase now?
- Should I take this trip?
- What happens if I make an extra debt payment?
- What happens if I refinance or consolidate?
- Can I handle a job change?
- What happens if income falls for one or two months?
- Which goal should receive the next dollar?

### 11.1 Output states

Use clear outcome language:

- **Proceed** - The decision appears supportable under stated assumptions.
- **Adjust** - The decision may work if timing, amount, or another variable changes.
- **Wait** - Current evidence indicates the decision would create unacceptable pressure.
- **Need more information** - Missing information materially affects the answer.

### 11.2 Required output

- Impact on Decision Margin™
- Impact on cash flow
- Impact on selected goals
- Impact on debt or liquidity
- Key assumptions
- Primary tradeoff
- Earliest safer timing where relevant
- Confidence level

---

## 12. Personal Decision Plan

The Personal Decision Plan turns a chosen path into a 30/60/90-day sequence.

### First 30 days

- Protect the immediate result.
- Complete one to three priority actions.
- Correct missing data.
- Establish the next review trigger.

### Days 31 to 60

- Measure whether the action changed the financial state.
- Address the next constraint.
- Automate or simplify what worked.

### Days 61 to 90

- Consolidate gains.
- Reassess goals and Decision Margin™.
- Move from repair to building where possible.

The plan should remain intentionally short. A plan that overwhelms the user is not operational.

---

## 13. Discovery Engine

The Discovery Engine identifies evidence-based patterns that may deserve attention.

### 13.1 Discovery types

- Recurring cash gap
- Bill and income timing mismatch
- Subscription or service duplication
- Unexpected change in spending or income
- Debt balance growth
- Promotional-rate expiration
- Unusually high unknown or uncategorized activity
- Missing account or document
- Goal conflict
- Repeated decision reversal
- Household communication mismatch where permissions allow
- Opportunity to consolidate tools or accounts

### 13.2 Discovery contract

A discovery must include:

- What changed or was noticed
- The evidence
- Why it may matter
- Confidence
- Whether the user should confirm it
- A next useful action

The Discovery Engine should not pretend to infer emotional meaning from a merchant name alone.

---

## 14. Financial Zoom

Financial Zoom lets the user move between levels of the same financial reality:

1. Transaction
2. Recurring stream
3. Week or pay cycle
4. Month
5. Quarter
6. Goal
7. Financial Event
8. Year
9. Long-term plan

The product should preserve context when zooming. A high restaurant total may look problematic at the category level but be explained by a one-time family event. A monthly surplus may look healthy until the annual insurance bill is included.

---

## 15. Financial Events and Financial Life Vault

### 15.1 Refined object doctrine

Transactions are immutable financial evidence. Financial Events are the richer contextual objects that connect evidence to real life.

A Financial Event can connect:

- Transactions
- Documents
- People
- Accounts
- Notes
- Photos
- Projects
- Goals
- Tax or business relevance
- Decisions
- Follow-up actions

This refines the earlier statement that the Financial Event is the core object. The event is the core contextual and user-facing object for meaning, but transactions and account records remain first-class analytical evidence.

### 15.2 Example

A card charge at Home Depot is a transaction.

A `Backyard Refresh` event may include:

- Several transactions
- Receipts
- Product warranties
- Photos
- Notes
- A budget
- The people involved
- A future maintenance reminder

### 15.3 Financial Life Vault

The Vault should not become an unstructured file-storage product. Documents should be attached to the event, account, decision, or obligation that gives them meaning.

Likely record types include:

- Receipts
- Warranties
- Loan documents
- Insurance policies
- Tax records
- Invoices
- Benefit statements
- Contracts
- Property records
- Medical bills
- Education records
- Business records

Retention and sensitivity rules must vary by type.

---

## 16. Financial Consolidation Engine™

The Consolidation Engine helps users simplify their financial lives by identifying redundant tools, subscriptions, services, accounts, and workflows.

### 16.1 Savings labels

- **Verified savings** - The price difference or eliminated charge is directly supported by evidence.
- **Estimated opportunity** - The amount depends on user action, eligibility, behavior, or a future price.
- **Financial efficiency gain** - The benefit is reduced complexity, fewer tools, less administrative burden, or better organization rather than a direct dollar saving.

Never combine these into one inflated savings total.

### 16.2 Consolidation targets

- Duplicate subscriptions
- Overlapping financial apps
- Redundant monitoring services
- Unused memberships
- Multiple accounts with avoidable fees
- Repeated manual workflows that Covarify can replace
- Fragmented documents or account views

The goal is simplification, not indiscriminate account closure.

---

## 17. Relationship Mode and Explain My Money

Relationship Mode should help people build shared clarity while preserving consent and autonomy.

### 17.1 Permission model

Possible permission levels include:

- Shared goals only
- Shared household obligations
- Selected accounts
- Aggregated category totals
- Specific transactions
- Full shared financial picture

Permissions should be granular, reversible, and visible to both parties.

### 17.2 Explain My Money

A user may attach context to a transaction, event, or decision and choose to share it with another person.

Examples:

- "This charge will be reimbursed by work."
- "This was part of Callie's school event."
- "I moved this payment because the deposit is late."

Explain My Money is not a surveillance feature. It is a permissioned context-sharing feature.

### 17.3 Safety rule

Relationship Mode must account for financial abuse and coercive control. The product should never quietly expose previously private financial information because another household member requested access.

---

## 18. Core domain objects

The product should maintain clear distinctions among:

- User
- Household
- Relationship permission
- Institution
- Account
- Balance snapshot
- Transaction
- Recurring stream
- Income stream
- Obligation
- Liability
- Minimum payment
- Goal
- Financial Event
- Document record
- Decision
- Scenario
- Recommendation
- Action
- Outcome
- User correction
- Consent record
- Data-source record
- Confidence record

Each material recommendation should be reproducible from a recorded snapshot of these inputs.

---

## 19. Decision-engine pipeline

1. **Ingest** - Retrieve and store raw evidence with source and timestamp.
2. **Normalize** - Standardize amounts, categories, transaction direction, dates, and account types.
3. **Reconcile** - Detect transfers, payments, duplicates, reversals, reimbursements, and pending items.
4. **Infer** - Suggest recurring streams, income, obligations, categories, and events.
5. **Confirm** - Ask the user only for facts that materially change the decision.
6. **Classify state** - Determine immediate risk, timing mismatch, structural deficit, debt overload, stabilizing, building, or optimizing.
7. **Generate options** - Produce realistic levers and remove unsafe or irrelevant paths.
8. **Compare** - Calculate impact, timing, cost, risk, and confidence.
9. **Recommend** - Present the First Win or decision comparison.
10. **Co-create** - Let the user adjust assumptions and select actions.
11. **Commit** - Save the plan and revisit trigger.
12. **Observe** - Track what happened and learn from the outcome.

---

## 20. Confidence model

Confidence should reflect evidence quality, not stylistic certainty.

### High confidence

- Relevant accounts are connected and fresh.
- Income and obligations are confirmed.
- The recommendation is based on posted transactions and known due dates.
- Missing information is unlikely to change the answer.

### Medium confidence

- Most evidence is available but one or more meaningful assumptions remain.
- The recommendation should be presented with a confirmation step.

### Low confidence

- Important accounts, rates, due dates, income, or upcoming events are missing.
- The product should focus on organizing the missing information or presenting a range of options.

The interface should explain why confidence is high, medium, or low.

---

## 21. AI behavior

AI can assist with:

- Classification
- Summarization
- Merchant and transaction context
- User-language interpretation
- Identifying questions that would reduce uncertainty
- Drafting explanations
- Comparing structured scenarios
- Detecting inconsistencies

AI should not independently:

- Invent balances, rates, due dates, or eligibility.
- Make a consequential recommendation without structured evidence and rules.
- Hide assumptions.
- Execute a payment or account change.
- Present legal, tax, investment, bankruptcy, or credit claims as certain.
- Use emotional manipulation to drive engagement.

The structured decision system should determine the recommendation boundaries. AI should improve clarity, not replace evidence or controls.

---

## 22. Experience and content standards

### 22.1 Tone

- Calm
- Direct
- Human
- Respectful
- Specific
- Never patronizing
- Never overly cheerful in a difficult situation
- Never alarmist unless there is a real time-sensitive risk

### 22.2 Content pattern

Use:

- "Here is what Covarify sees."
- "Here is what could change the answer."
- "You have three realistic options."
- "This protects cash now but increases interest by an estimated amount."
- "You decide what is realistic."

Avoid:

- "You failed your budget."
- "Bad spending."
- "Just cut unnecessary expenses."
- "This is the best choice" when evidence is incomplete.
- Artificial urgency.

### 22.3 Neurodivergent-friendly design

- One primary decision per screen.
- Progressive disclosure.
- Plain-language labels.
- Visible completion state.
- Save and resume.
- Short task sequences.
- No punishment for delayed action.
- Clear reminders tied to an event or reason.
- Reduced visual noise.

### 22.4 Mobile standard

The critical journey must work on a mobile device with one hand:

- Connect
- Confirm
- Understand
- Select
- Commit
- Return

No critical decision should require reading a desktop-sized table.

---

## 23. Safe escalation

Covarify should recognize situations that require a professional or emergency resource rather than continuing to optimize inside the app.

Examples include:

- Imminent eviction, foreclosure, utility shutoff, repossession, or loss of essential insurance.
- Suspected fraud or identity theft.
- Bankruptcy or active litigation questions.
- Tax enforcement or legal deadlines.
- Domestic or financial abuse concerns.
- A debt situation where no proposed payment path is sustainable.
- Investment, insurance, or tax decisions requiring licensed or individualized advice.

Escalation should be specific, transparent, and optional where appropriate. It should not become a disguised sales handoff.

---

## 24. Product status map

### Built or partially built

- Stealth landing and early-access experience
- First Win preview
- Plaid sandbox account connection
- Balance and transaction view
- First Win Engine v0
- Financial Brain foundation
- Financial Events sample model
- Decision Margin™ and simulator concepts in prototype work
- Product-decision folder and initial PDRs

### Next

- Early-access form backend, success state, and notification
- Authentication and secure user lifecycle
- Durable financial data model
- Plaid transaction sync and webhook flow
- User confirmation layer
- Repair Plan Builder
- Expanded debt and cash-flow state logic
- Action selection and seven-day follow-through
- Recommendation audit trail
- Production trust and deletion workflows

### Later

- Decision Simulator production experience
- Personal Decision Plan
- Financial Zoom
- Discovery Engine automation
- Financial Life Vault
- Financial Consolidation Engine™
- Relationship Mode
- Explain My Money
- Household subscription
- Partner distribution

---

## 25. Product release gate

A feature should not be considered complete until:

1. The user job is defined.
2. The decision or behavior it supports is clear.
3. Required data and data quality are defined.
4. The output and confidence contract are defined.
5. User correction is possible.
6. Risks and escalation paths are documented.
7. Analytics measure whether it helped.
8. Mobile behavior is acceptable.
9. Product claims match the implementation.
10. The playbook and decision log are updated.
