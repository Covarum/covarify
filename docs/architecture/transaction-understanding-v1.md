# Transaction Understanding v1

Conversation, selected-row detail, and future voice transcription all produce the same constrained `TransactionIntent`. The server independently resolves that intent against authenticated, account-scoped transactions and always requires confirmation before constructing an append-only understanding record.

Source transaction fields remain unchanged. User-facing category precedence is current user confirmation, reliable Covarify inference, then normalized source category. Corrections and undo create superseding records; history is never updated or deleted.

The founder preview is fixture-only and session-local. It does not expose a production write action, call Plaid, resynchronize data, or persist classifications.

## Future merchant-pattern learning

User-confirmed transactions may later produce a merchant-pattern candidate. A deterministic confidence threshold should create only a suggestion, followed by explicit user confirmation. A single confirmation must never relabel historical transactions or establish a universal merchant rule.
