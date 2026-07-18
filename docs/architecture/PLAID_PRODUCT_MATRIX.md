# Plaid Product Configuration Matrix

Plaid Dashboard approval status cannot be inferred from SDK access or the founder's general Production approval. The founder must confirm the **Approved** column directly in Plaid Dashboard before changing `PLAID_PRODUCTS`.

| Product | Approved | First beta | Endpoint / initialization | User benefit | Cost consideration | Retention / consent |
|---|---|---|---|---|---|---|
| Transactions | **Verify in Dashboard** | Recommended required | Initialize in Link; `/transactions/sync` | Financial activity, cash flow, recurring evidence | Subscription/product pricing; Item removal ends billing | Transaction history and provenance; explicit purpose and retention |
| Accounts/cached balances | **Verify availability** | Required with Transactions | `/accounts/get`; balances returned with account data | Current account position | Typically part of connected product response; verify contract | Balance snapshots need freshness and retention policy |
| Balance (real-time) | **Verify in Dashboard** | Optional | `/accounts/balance/get`; do not add `balance` blindly to Link products | Fresh balance for time-sensitive decisions | Per-call/product cost; use only at decision points | Record observation time and purpose; additional disclosure if used |
| Liabilities | **Verify in Dashboard** | Conditional, high value | Initialize if approved; `/liabilities/get` | Minimums, APR, due dates, terms for debt decisions | Coverage and product pricing | Sensitive debt data; explicit purpose and review of retention |
| Identity | **Verify in Dashboard** | Not recommended by default | Initialize if required; `/identity/get` | Ownership/contact verification | Additional product cost and sensitive data | Higher sensitivity; separate consent and strict minimization |
| Enrich | **Verify in Dashboard** | Optional/later | `/transactions/enrich` for non-Plaid raw transactions | Improve merchant/category quality | Per-use cost | Do not send more local transaction data than necessary |
| Income | **Verify exact product** | Later unless Transactions inference is insufficient | Product-specific endpoints/user model | Improve income reliability | Product-specific pricing and potentially different user APIs | Separate purpose, consent, and retention analysis |

Initial configuration should request only verified, approved products that materially improve the first decision. Do not activate a product merely because Production access exists.
