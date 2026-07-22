export const PLAID_CONSENT_VERSION = "plaid-production-consent-v2-2026-07-22";

export function isCurrentPlaidConsentVersion(value: unknown): value is typeof PLAID_CONSENT_VERSION {
  return value === PLAID_CONSENT_VERSION;
}
