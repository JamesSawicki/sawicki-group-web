/**
 * Per-request context on the server: the request id for the page being rendered.
 *
 * middleware.ts runs each request inside `requestContext.run(...)`; anything called while
 * rendering that page (e.g. fetchWithTimeout) can read the id without it being passed
 * around. fetchWithTimeout sends it to the API as X-Request-Id, so the API's log lines
 * for a page view carry the same id as the page itself.
 */
import { AsyncLocalStorage } from "node:async_hooks";

/** Header the request id travels in (same name the API uses). */
export const REQUEST_ID_HEADER = "X-Request-Id";

export interface RequestContext {
  requestId: string;
  /** The visitor's IP (middleware.ts), forwarded to the API with the site key. */
  clientIp?: string;
  /** The visit's pseudonymous audit-trail id (lib/audit.ts), forwarded to the API. */
  auditSessionId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

/** The current page's request id, or undefined outside a request (build time, tests). */
export function currentRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

/** The visit's audit-trail session id, or undefined outside a request. */
export function currentAuditSessionId(): string | undefined {
  return requestContext.getStore()?.auditSessionId;
}

/** The current visitor's IP, or undefined outside a request. */
export function currentClientIp(): string | undefined {
  return requestContext.getStore()?.clientIp;
}

/** The incoming id if it looks valid (as the API checks), else a new one. */
export function requestIdFrom(header: string | null): string {
  return header && /^[A-Za-z0-9._-]{8,64}$/.test(header) ? header : crypto.randomUUID();
}
