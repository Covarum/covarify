# Covarify Operations, Trust, and Roadmap Playbook

**Status:** Working operating system with locked trust principles  
**Last updated:** July 16, 2026  
**Owner:** Founder, Product, Engineering, and Security  

This module defines how Covarify should operate, protect users, ship responsibly, document decisions, and move from prototype to private beta and production.

Financial clarity requires trust. Trust is not a legal page or security claim added after the product is built. It is the combined result of accurate claims, limited collection, meaningful consent, secure implementation, explainable recommendations, user control, and responsible escalation.

---

## 1. Trust doctrine

### 1.1 Trust principles

1. Collect only what is needed for an identified user benefit.
2. Explain why data is requested before collecting it.
3. Separate raw evidence, system inference, user confirmation, and final recommendation.
4. Let users correct, exclude, disconnect, and delete where appropriate.
5. Do not sell personal financial information.
6. Do not use personalized financial data for behavioral advertising.
7. Do not let compensation influence personalized recommendation ranking.
8. Use restraint when evidence is incomplete.
9. Preserve an audit trail for consequential recommendations.
10. Make product claims match the real environment - concept, sandbox, private beta, or production.
11. Treat account connection as a permission, not ownership of the user's data.
12. Design for vulnerable users and recognize when the product should stop and escalate.

### 1.2 Trust promise

A user should be able to understand:

- What Covarify has access to.
- Why it needs the information.
- How recently the information was refreshed.
- What Covarify inferred.
- What the user confirmed.
- Why a recommendation was made.
- What could change the recommendation.
- How to disconnect an account.
- How to request deletion.
- Whether Covarify or an affiliate may be compensated by a referral.

---

## 2. Product and regulatory boundary

Covarify is intended to provide financial clarity, educational decision support, organizational tools, and planning assistance. It is not automatically exempt from financial regulation merely because it uses software or disclaimers.

Qualified legal and compliance counsel must determine which laws, licensing rules, disclosures, and supervisory obligations apply to each use case, state, product capability, and business relationship.

### 2.1 Initial boundary

The initial product should:

- Explain observed financial data.
- Help users identify priorities.
- Compare user-controlled scenarios.
- Provide educational tradeoff information.
- Support short action plans.
- Identify when professional help may be appropriate.

The initial product should not:

- Execute payments or transfers.
- Hold customer funds.
- Negotiate debt on the user's behalf.
- Guarantee credit, debt, investment, tax, or insurance outcomes.
- Represent itself as a bank, lender, credit-repair organization, debt-settlement provider, investment adviser, tax preparer, or law firm unless and until the relevant structure and requirements are intentionally met.
- Automatically recommend or sell a regulated product based on compensation.

### 2.2 Advice-risk review

Before a feature produces individualized guidance involving investments, insurance, credit products, taxes, bankruptcy, debt settlement, or another regulated area, document:

1. The user question.
2. The data used.
3. The output language.
4. Whether the output recommends a specific product, security, provider, or transaction.
5. Whether compensation is involved.
6. Whether a licensed person or entity is involved.
7. Required disclosures and recordkeeping.
8. The safe fallback when the product lacks enough information.

### 2.3 Disclaimers are not the control

A disclaimer is useful, but it does not correct misleading behavior or an impermissible business model. Product logic, claims, workflow, compensation, and supervision must support the stated boundary.

---

## 3. Data governance

### 3.1 Data classes

| Class | Examples | Handling expectation |
|---|---|---|
| **Public** | Marketing copy, public help content | Normal publishing controls |
| **Internal** | Roadmap, product decisions, de-identified metrics | Limited to authorized team members |
| **Confidential** | User contact information, support messages, beta feedback | Access controlled and logged where appropriate |
| **Sensitive financial** | Accounts, balances, transactions, liabilities, income, recommendations | Strong access control, encryption, minimization, auditability |
| **Highly sensitive** | Government identifiers, identity-verification data, certain tax, medical, legal, or abuse-related records | Avoid collection unless required; apply enhanced controls and retention limits |

### 3.2 Data-source labels

Every important financial fact should carry:

- Source
- Source record identifier
- Retrieval date and time
- Effective date
- Freshness status
- Verification state
- User correction history
- Whether it is raw, normalized, inferred, estimated, or confirmed

### 3.3 Consent records

Store a record of:

- What the user consented to
- The purpose described
- The account or data scope
- The version of the policy and disclosure shown
- Date and time
- Revocation or disconnection
- Material changes requiring renewed consent

### 3.4 Data minimization

Do not request a Plaid product, account type, document, identity field, or user answer because it might be useful later. Connect collection to a current feature and document the purpose.

### 3.5 Data retention

Covarify has drafted a Data Retention and Deletion Policy v1.0. The current working retention concepts include:

- Customer and account records may be retained for up to seven years where needed for legal, contractual, dispute, security, or business requirements.
- Security and audit logs may be retained for approximately twelve months.
- Backups should not persist beyond approximately ninety days after deletion unless a documented legal hold applies.
- The schedule should be reviewed at least annually.

These periods require legal and operational validation before production launch. The implementation must be able to enforce the final schedule by data type rather than relying only on policy language.

### 3.6 Deletion workflow

A production deletion request should:

1. Authenticate the requester.
2. Identify the scope of data and legal exceptions.
3. Disconnect linked data sources.
4. Remove active data from application systems.
5. Queue deletion from derived stores, analytics, and document systems where applicable.
6. Allow normal backup expiration or targeted deletion where supported.
7. Record completion without retaining the deleted content.
8. Communicate status and any limited exception to the user.

The current security contact is `security@covarify.com`.

---

## 4. Plaid operating scope

### 4.1 MVP product scope

Current working Plaid scope:

- Transactions
- Recurring Transactions
- Enrich
- Liabilities
- Investments
- Balance
- Identity where needed for account ownership and consent-related use

Income verification was removed from the MVP recommendation. Covarify should infer recurring payroll deposits from transaction data and ask the user to confirm or edit the income picture. Verified income can be considered later for a use case that truly requires it.

### 4.2 Explicitly out of scope for the initial product

- Auth for payment initiation
- Transfers
- Signal
- Payment products
- Money movement
- Products not tied to an identified user need

### 4.3 Plaid data lifecycle

Production flow should include:

1. Server-created Link token.
2. User consent through Plaid Link.
3. Server-side public-token exchange.
4. Encrypted storage of access credentials.
5. Webhook-driven transaction sync.
6. Idempotent cursor handling.
7. Institution and item health monitoring.
8. User-visible refresh status.
9. Update Mode for broken connections.
10. Account disconnection and deletion handling.

Do not expose Plaid secrets, access tokens, or raw diagnostic information to the browser or logs.

---

## 5. Security baseline

### 5.1 Identity and access

Before production financial data:

- Require authenticated user accounts.
- Support MFA or a clearly documented phased MFA plan.
- Use secure session management.
- Apply least-privilege access.
- Separate administrative access from normal user access.
- Review and remove access when roles change.
- Protect support tools from broad data visibility.

### 5.2 Encryption

- Use TLS 1.2 or better for data in transit.
- Encrypt sensitive data at rest using managed, industry-standard controls.
- Store credentials and secrets in a managed secret system, not source code or client-visible environment variables.
- Consider field-level protection for highly sensitive credentials or identifiers.

### 5.3 Application security

- Validate and sanitize inputs.
- Use secure headers and cookie settings.
- Protect against common web vulnerabilities.
- Implement authorization checks at every data boundary.
- Rate limit authentication, form, and sensitive API endpoints.
- Prevent sensitive data from appearing in logs or analytics.
- Use dependency scanning and timely patching.
- Require review for changes to financial logic, authentication, permissions, secrets, and data deletion.

### 5.4 Secure development lifecycle

Every production change should include:

- Defined user and data impact
- Threat or misuse considerations
- Tests appropriate to the risk
- Code review
- Deployment traceability
- Rollback plan
- Monitoring
- Documentation update

### 5.5 Logging and monitoring

Log enough to investigate problems without copying sensitive financial payloads unnecessarily.

Monitor:

- Authentication failures
- Privileged access
- Account-connection errors
- Webhook failures
- Data-sync gaps
- Recommendation-generation errors
- Unexpected recommendation changes
- Deletion workflow failures
- Unusual export or data-access patterns
- Email and notification failures
- Form-submission failures

### 5.6 Incident response

Maintain a written process covering:

1. Detection
2. Triage
3. Containment
4. Evidence preservation
5. Eradication
6. Recovery
7. User, partner, insurer, regulator, or law-enforcement notification where required
8. Root-cause review
9. Control and playbook updates

Assign an incident lead and maintain current contact information before private beta.

### 5.7 Vendor management

For each vendor with user or financial data, document:

- Purpose
- Data received
- Security and privacy terms
- Retention and deletion behavior
- Subprocessors
- Breach-notification terms
- Availability and recovery expectations
- Contract owner
- Exit plan

Initial vendors may include hosting, database, authentication, Plaid, email, analytics, AI, error monitoring, document storage, and payment processing.

---

## 6. AI and recommendation governance

### 6.1 Recommendation record

For every material recommendation, retain enough structured information to reproduce:

- User and financial snapshot identifier
- Data sources and freshness
- User confirmations
- State classification
- Options considered
- Rules or model versions used
- Calculations
- Final output
- Confidence
- Missing information
- User edits and selected action
- Outcome where known

### 6.2 Model and prompt changes

A change to classification, recommendation logic, prompts, model provider, or thresholds should be versioned and tested against a fixed scenario set.

The scenario set should include:

- Negative cash flow with upcoming essential bills
- Positive month but negative pre-payday week
- Credit-card statement that can be paid in full only by eliminating the cash buffer
- Multiple high-interest cards
- Promotional balance transfer expiration
- Consolidation that lowers payment but raises total cost
- Variable income
- One-time large expense
- Transfer misclassified as spending
- Reimbursement misclassified as income
- Missing account
- Financial abuse or coercion indicator

### 6.3 Human review

During private beta, low-confidence or high-consequence outputs should be eligible for internal review before being shown or before the user acts.

A human reviewer should not silently rewrite the answer without preserving the original system output and the reason for the change.

### 6.4 Prohibited AI behavior

- Fabricating data
- Hiding uncertainty
- Claiming eligibility for a product or program
- Making emotional or coercive statements
- Using sensitive financial information to optimize advertising
- Automatically sending user data to an unaudited external system
- Executing a financial action

---

## 7. Product claims and environment labels

Every user-facing environment should be clearly labeled:

| Environment | Allowed claim posture |
|---|---|
| **Concept** | Demonstrates intended experience only. No claim that analysis or connection works. |
| **Prototype** | Some interactions work with sample or local data. Clearly state limitations. |
| **Sandbox** | Uses provider test systems and test data. Do not imply live financial connectivity. |
| **Private beta** | Real users and potentially live data under controlled access. Clearly state beta status and support limits. |
| **Production** | Available under the documented policies, controls, and support commitments. |

The public landing page, private previews, and sandbox pages should not contradict each other.

---

## 8. Operating model

### 8.1 Source-of-truth hierarchy

1. Current law, contract, and formal policy
2. `COVARIFY_PLAYBOOK.md`
3. Decision records
4. Product requirements and architecture documents
5. GitHub issues and roadmap
6. Design files and prototypes
7. Chat history and informal notes

Chat history is input, not the final source of truth.

### 8.2 Weekly founder review

Review:

- What was built
- What users did
- What users corrected
- What recommendation failed or surprised us
- Current activation funnel
- Current critical risks
- Decisions made during the week
- Playbook sections requiring updates
- The next smallest end-to-end learning goal

### 8.3 Monthly business review

Review:

- User cohort and retention
- Product costs
- Support burden
- Security and trust incidents
- Revenue or willingness-to-pay evidence
- Roadmap changes
- Competitive changes
- Partnership opportunities
- Open legal or compliance decisions

### 8.4 Quarterly strategic review

Reassess:

- Category and positioning
- Beachhead customer
- North-star metric
- Core product wedge
- Business model
- Distribution strategy
- Risk posture
- Hiring and funding needs

### 8.5 Decision record format

Each important record should include:

- ID and title
- Date
- Status
- Owner
- Context
- Decision
- Evidence
- Alternatives considered
- Tradeoffs
- Implementation effect
- Revisit trigger

### 8.6 Experiment record format

- Hypothesis
- User segment
- Experience change
- Primary metric
- Guardrail metrics
- Start and end dates
- Sample
- Result
- Interpretation
- Decision

---

## 9. Prioritization framework

Score proposed work across:

1. User harm prevented
2. User value created
3. Strategic differentiation
4. Learning value
5. Trust or compliance necessity
6. Revenue or retention potential
7. Effort
8. Reversibility
9. Dependency risk

### Priority classes

- **P0 - Critical:** Security, data loss, misleading claims, broken core funnel, or demo/launch blocker.
- **P1 - Core:** Required for the First Win loop or private-beta trust.
- **P2 - Important:** Improves retention, accuracy, or operational readiness.
- **P3 - Later:** Platform expansion not required to prove the wedge.

A P3 feature should not displace a P0 or P1 item because it is more exciting.

---

## 10. Current roadmap

### Phase 0 - Founder demo

**Target:** Sunday, July 19, 2026

Objective: demonstrate the decision-company experience with honest sandbox and sample boundaries.

#### P0 demo items

1. Repair the early-access form submission flow.
   - Secure server-side endpoint
   - Success state after submission
   - Founder email notification
   - Error state
   - Basic spam and abuse protection
   - Stored timestamp and consent context

2. Verify the complete Plaid sandbox path.
   - Link token
   - Account connection
   - Transaction readiness
   - Money Picture
   - First Win generation
   - Useful fallback when transaction history is still processing

3. Stabilize the demo route.
   - Sample or sandbox badge
   - No unsupported production claim
   - Reliable reload behavior
   - Mobile review
   - Clear return path

4. Add a user-participation concept.
   - Transaction selection or a credible interactive mock
   - Gap progress
   - At least one non-spending lever
   - Visible tradeoff

5. Prepare a short demo script.
   - User problem
   - Connected picture
   - What Covarify sees
   - First Win
   - User shapes the plan
   - What happens next

#### Demo guardrail

Do not attempt to complete authentication, production Plaid, Relationship Mode, the full Vault, and advanced AI before the demo. Show the product thesis clearly.

### Phase 1 - Private-beta foundation

Objective: support controlled real-user use.

Required work:

- Authentication
- User and consent records
- Secure database
- Encrypted Plaid access-token storage
- Transaction sync and webhooks
- Account refresh and disconnection
- User confirmation layer
- Recommendation audit trail
- Basic administration and support tooling
- Data deletion workflow
- Monitoring and incident response
- Private-beta terms and notices
- Test scenario suite

### Phase 2 - First Win and repair loop

Objective: prove Actionable Clarity Rate.

Required work:

- Robust state classification
- Seven-day and thirty-day horizon
- Repair Plan Builder
- Minimum vs full-payment comparison
- Debt and timing levers
- User-selected transaction changes
- Action commitment
- Review trigger
- Outcome tracking

### Phase 3 - Recurring decision value

Objective: prove users return for a second decision.

Potential work:

- Decision Margin™
- Decision Simulator
- Personal Decision Plan
- Change explanations
- Discovery Engine
- Timeline

### Phase 4 - Context and household expansion

Objective: deepen retention and shared value.

Potential work:

- Financial Events production model
- Financial Life Vault
- Relationship Mode
- Explain My Money
- Shared goals and plans

### Phase 5 - Scale and distribution

Objective: establish sustainable consumer and partner growth.

Potential work:

- Paid subscriptions
- Household tier
- Partner administration
- Employer or association distribution
- Human-review network
- Expanded compliance and supervision

---

## 11. Private-beta launch gates

Do not invite real users with live financial data until the following are true:

### Product

- Core onboarding completes.
- Money Picture is understandable.
- First Win can decline to answer when evidence is insufficient.
- User correction works.
- A user can disconnect accounts.

### Trust

- Privacy, security, terms, consent, and deletion language match the product.
- Data retention can be implemented.
- Support and incident contacts are active.
- Product and affiliate conflicts are disclosed.

### Security

- Authentication and session controls are in place.
- Sensitive credentials are stored securely.
- Authorization is tested.
- Sensitive logging is minimized.
- Monitoring and backups are configured.
- A basic incident-response process exists.

### Operations

- A small cohort and invitation process are defined.
- Support ownership is assigned.
- Feedback and issue tracking are ready.
- A rollback or access-disable process exists.
- The founder can identify every current beta user.

### Decision quality

- Scenario tests pass.
- Recommendation versions are recorded.
- High-risk situations have safe fallbacks.
- Consequential outputs show evidence, confidence, and missing information.

---

## 12. Current action register

### P0 - Before the July 19 demo

| Action | Owner role | Status |
|---|---|---|
| Fix early-access form backend, success state, and notification | Engineering | Open |
| Confirm notification recipient and delivery path | Founder / Engineering | Open |
| Test Plaid sandbox end to end | Engineering | In progress |
| Confirm First Win output with at least two financial states | Product / Engineering | Open |
| Add or mock interactive plan shaping | Product / Engineering | Open |
| Review mobile demo experience | Design / Engineering | Open |
| Verify all demo labels and disclaimers | Product / Trust | Open |
| Create founder demo script | Founder | Open |

### P1 - Immediately after the demo

| Action | Owner role | Status |
|---|---|---|
| Choose authentication and production database stack | Engineering / Security | Open |
| Define user and household data model | Product / Engineering | Open |
| Define consent and deletion implementation | Trust / Engineering | Open |
| Build webhook transaction sync | Engineering | Open |
| Create recommendation audit schema | Product / Engineering | Open |
| Establish beta cohort and interview process | Founder / Product | Open |
| Obtain targeted legal and compliance review | Founder / Counsel | Open |

---

## 13. Quality and release checklist

Before merging a material feature:

### User value

- The user problem is documented.
- The expected action or outcome is measurable.
- The feature does not add unnecessary steps.

### Data

- Source, freshness, and uncertainty are handled.
- Transfers, duplicates, and pending states are considered.
- User correction exists where needed.

### Decision quality

- The recommendation follows the priority hierarchy.
- Alternatives and tradeoffs appear where consequential.
- Confidence and missing information are clear.

### Trust and security

- Permissions are enforced.
- Sensitive information is not leaked to logs or analytics.
- Claims match implementation.
- Data-retention and deletion effects are understood.

### Experience

- Mobile behavior is reviewed.
- Language is calm and nonjudgmental.
- The user can understand what happened and what to do next.

### Operations

- Analytics and monitoring are included.
- Support impact is understood.
- Playbook and decision records are updated.

---

## 14. Definition of production readiness

Covarify is production-ready only when it can reliably do all of the following:

1. Protect connected financial data.
2. Explain what data it has and why.
3. Produce a useful answer or safely decline.
4. Reproduce why a recommendation was made.
5. Let the user correct the picture.
6. Let the user disconnect and request deletion.
7. Detect and respond to failures.
8. Support users when the experience does not work.
9. Keep public claims aligned with actual capability.
10. Operate within a reviewed legal and compliance boundary.

A successful demo is evidence of product direction. It is not production readiness.
