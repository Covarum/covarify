# Public Launch Backlog

**Track B:** Public Launch  
**Effect on Track A:** none unless a control is explicitly listed in the Founder Pilot runbook

The following work remains required before public availability but does not block the one-founder pilot:

- automated rollback-independent deletion-tombstone ledger and mandatory restore reconciliation gate
- tested restore exercise with approved RPO/RTO; reassess PITR based on public-user risk and acceptable data loss
- public-grade privileged RBAC, workforce identity, phishing-resistant MFA enforcement, break-glass governance, and audit review
- jurisdiction-specific privacy review and public legal-policy review
- scalable deletion/export support and delivery monitoring
- complete Item-health and update-mode UX, user remediation, and support escalation
- production monitoring, paging, incident response, service-level objectives, and capacity/cost controls
- accessibility and cross-browser validation of Link, OAuth, consent, disconnect, and deletion
- controlled-pilot evidence for Link, OAuth, KMS, webhook, Transactions Sync, Money Picture, Decision Studio, logging, disconnect, and deletion
- public-cohort authorization, abuse controls, support staffing, and launch rollback plan

PITR is not automatically required. Before public launch, the founder must approve an RPO/RTO and then choose whether daily backups satisfy it or whether PITR is justified.
