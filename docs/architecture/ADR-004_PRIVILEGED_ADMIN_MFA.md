# ADR-004: Privileged Administration and MFA

**Status:** Proposed - founder decision required  
**Date:** 2026-07-20

Privileged operations require a separate least-privilege server boundary and must not infer authority from `profiles.is_internal`. Founder allowlisting permits only the controlled connection flow; it does not grant database, retry, deletion, key, or support administration.

Before an admin surface is enabled, define separate roles for sync retry, connection support, deletion execution, and security administration. Require phishing-resistant MFA, short sessions, reauthentication for destructive actions, immutable audit events, and two-person approval for KMS deletion or recovery changes. Do not create a broad `admin=true` role or expose service-role credentials to a client. Break-glass access must be time-limited, monitored, and reviewed.

Founder decisions: workforce identity provider, acceptable MFA factors, role owners, two-person approval scope, session duration, and break-glass custodians.
