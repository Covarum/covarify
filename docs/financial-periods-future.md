# Future Financial Periods

Time Intelligence v1 resolves every selection into one canonical inclusive
`start` and `end` date, plus the immediately preceding equivalent comparison
period. Every downstream engine receives that resolved scope rather than
interpreting a period independently.

Future event-relative periods should use the same contract:

- Since last paycheck
- Since vacation
- Since buying a home
- Since changing jobs
- Since my last Money Picture

Add a `financial-event` selection kind with a stable event reference. Resolve
that reference server-side into the canonical date contract before loading or
calculating financial data. The Money Picture, Financial Events, observations,
Guided Understanding, account analytics, recurring-pattern analysis, and
transaction browsing must continue consuming only the resolved scope.

This keeps Financial Periods first-class without introducing a second filtering
model or allowing sections to choose different windows.
