# Covarify

Covarify is a personal financial decision platform you can speak to in everyday language. It understands the user's real financial picture, remembers what things mean in their life, and helps them know what to do next.

The official category is **Financial Clarity**. Covarify is not a bank, lender, debt settlement service, investment manager, or automatic money-movement product.

## Canonical documentation

The governing product, architecture, UX, recommendation, financial-memory, trust, voice, and language decisions are in [`docs/`](docs/README.md). Read the Master Playbook before making any significant product change. When implementation and documentation conflict, ask rather than assume.

## Current repository state

This repository contains a Next.js/TypeScript interactive prototype with onboarding, early-access collection, Plaid sandbox connectivity, rule-based First Win analysis, Decision Studio, Talk to Covarify/Voice Mode prototypes, an in-memory Decision Ledger, and Financial Brain sample experiences.

It is not yet ready for a real-financial-data private beta. Production identity, persistence, encrypted token storage, authorization, consent/audit workflows, recommendation versioning, deletion/export, background sync, and other trust controls remain required. See the [gap analysis](docs/PLAYBOOK_GAP_ANALYSIS.md) and [implementation roadmap](docs/NEXT_100_COMMITS.md).

## Local development

```bash
pnpm install
pnpm dev
```

Server-only configuration is documented in `.env.example`. Never expose Plaid or email-provider secrets through `NEXT_PUBLIC_` variables.
