/**
 * The NorthstarMLS §5.9(b) audit trail, server side: one JSON line per visitor action, with
 * `audit_event`, the visit's pseudonymous `audit_sid` and the request id. A Cloud Logging
 * sink copies lines that have `audit_event` (from this site and the API) into an 18-month
 * bucket (listing-agent-api docs/abuse-protection.md, "Audit trail").
 *
 * Never log personal data or visitor-typed text: no form or chat content, no full IPs.
 */
import { currentAuditSessionId, currentRequestId } from "./request-context";

/**
 * Writes one audit line.
 * @param event   the action, e.g. "page_view", "eula_accept", "contact_sent"
 * @param details extra fields; must not contain personal data
 */
export function auditLog(event: string, details: Record<string, unknown> = {}): void {
  console.log(
    JSON.stringify({
      audit_event: event,
      audit_sid: currentAuditSessionId(),
      requestId: currentRequestId(),
      ...details,
    }),
  );
}

/** A new random session id (URL-safe, 32 characters). */
export function newAuditSessionId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
