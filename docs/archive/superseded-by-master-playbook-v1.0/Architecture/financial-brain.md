# Financial Brain Architecture

Sprint 3 establishes the first domain layer for how Covarify thinks about a user's financial life. The key architecture choice is that a Financial Event is the primary object, while a Transaction is supporting evidence.

## Why Financial Events

Most finance tools begin with transactions because transactions are easy to import, sort, and total. Covarify starts one level higher because people do not experience money as rows in a ledger. They experience home projects, trips, relationships, business setup, debt decisions, documents, notes, and memories.

A transaction can answer what happened financially. A Financial Event can answer what it meant.

## Financial Event > Transaction

Example:

Transaction:
- Home Depot
- $257.69
- Garden center purchase

Financial Event:
- Backyard Refresh
- Home Depot receipt
- Plants and pots
- Photos
- Notes
- Life Bucket: Home
- Project: Backyard Refresh
- Purpose: Outdoor improvement

The transaction is still useful, but it is no longer the whole product surface. It becomes one piece of context inside a richer event.

## showMoneyByDefault

`showMoneyByDefault` controls whether money should lead the presentation of an event.

Money is shown by default when the financial amount is central to the user's decision, such as debt payoff, business records, tax prep, or cash-flow planning.

Money is hidden by default when the event is primarily about context, memory, or life organization, such as travel, relationships, home projects, or family events. The amount can still be available, but it does not need to define the event.

This keeps Covarify from reducing every life moment to a cost.

## Financial Life Vault

Financial Events give the future Financial Life Vault a stable organizing object. Receipts, warranties, invoices, photos, notes, policy documents, manuals, and tax records can attach to a life event instead of floating as isolated files.

This means a user can later search for "Backyard Refresh" or "business setup" and find the supporting records without needing to remember the merchant name or transaction date.

## Discovery Engine

The Discovery Engine can use Financial Events to generate observations that are evidence-based and honest. Instead of pretending to infer deep meaning from one transaction, Covarify can point to event context:

- which transactions were linked
- which documents exist
- which life bucket the event belongs to
- whether the event is tax or business relevant
- whether money should be visible by default

This supports discoveries that naturally lead to a next best move.

## Future Integrations

Plaid:
Imported transactions can start as raw `Transaction` records. Covarify can then suggest event links, life buckets, and context prompts.

Receipts:
Uploaded receipts can become `DocumentRecord` objects and link to either transactions, events, or both.

AI:
AI should assist with classification, summarization, and context suggestions only when enough evidence exists. If Covarify does not know something, it should say so.

Tax prep:
Tax-relevant and business-relevant events can preserve invoices, receipts, and notes in a way that is easier to retrieve than transaction search alone.

The current Sprint 3 implementation uses sample data and rule-based placeholder logic only. It does not perform real financial analysis.
