export const LINK_FAILURE_MESSAGE = "We couldn’t complete the connection with your bank. Your account was not connected and no banking credentials were received by Covarify. Please return to your account while we verify the connection.";

const SAFE_VALUE = /^[A-Za-z0-9_.:-]{1,128}$/;

export type SafeLinkDiagnostic = {
  eventName: string;
  errorCode: string | null;
  errorType: string | null;
  institutionId: string | null;
  linkSessionId: string | null;
  requestId: string | null;
};

function safeValue(value: unknown) {
  return typeof value === "string" && SAFE_VALUE.test(value) ? value : null;
}

export function sanitizeLinkDiagnostic(input: unknown): SafeLinkDiagnostic | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const eventName = safeValue(value.event_name);
  if (!eventName) return null;
  return {
    eventName,
    errorCode: safeValue(value.error_code),
    errorType: safeValue(value.error_type),
    institutionId: safeValue(value.institution_id),
    linkSessionId: safeValue(value.link_session_id),
    requestId: safeValue(value.request_id),
  };
}
