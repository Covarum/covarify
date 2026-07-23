# Account role model

Covarify keeps two distinct role concepts for each connected account:

- **Inferred account role:** a temporary, explainable observation calculated from transaction patterns. It is never persisted as user intent and must include its period, supporting calculation, and confidence.
- **User-confirmed account role:** a future user-managed value that can be confirmed, changed, or cleared independently of inferred patterns.

Candidate roles are Primary income, Bills, Everyday spending, Savings, Emergency fund, Transfers, and Other. Account type or subtype alone must never assign a role. Until a dedicated user-controlled field and audit path exist, the Money Picture displays pattern observations only and does not persist either role.

Every transaction retains its selected connected-account relationship. Internal transfers are matched conservatively using equal-and-opposite amounts across different selected accounts within three days; matched pairs remain visible but are excluded from combined income and spending. Unmatched transfers remain labelled as transfers and are also excluded from income and spending.
