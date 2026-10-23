/**
 * The audit trail's pseudonymous session id (NorthstarMLS Rules §5.9(b)), browser side.
 * middleware.ts sets the `audit_sid` session cookie; islands that call the API directly (map
 * search, chat) send it as X-Audit-Session so the API's audit lines join the page's. It's a
 * random id with no personal data, readable by scripts for exactly this reason.
 */

/** Session cookie holding the id (no expiry: it ends with the browser session). */
export const AUDIT_COOKIE = "audit_sid";
/** Header the id travels in to the API (RequestLoggingFilter reads it). */
export const AUDIT_HEADER = "X-Audit-Session";

/** Headers that tie a browser API call to this visit's audit trail (empty if no cookie). */
export function auditHeaders(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const m = document.cookie.match(/(?:^|;\s*)audit_sid=([A-Za-z0-9_-]{16,64})/);
  return m ? { [AUDIT_HEADER]: m[1] } : {};
}
