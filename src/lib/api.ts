/**
 * api.ts — shared server-side fetch helpers for SSR pages.
 *
 * WHY THIS EXISTS
 * Every SSR page (listings, search, map, listing detail) calls the listing
 * API with a bare `fetch`. A bare fetch has NO timeout: if the API hangs,
 * the Astro request hangs with it, holding a Cloud Run request open until the
 * platform kills it (~minutes). Under load that exhausts the instance's
 * concurrency and takes the whole site down. `fetchWithTimeout` bounds every
 * call with an AbortController so a slow/dead API fails fast and predictably.
 *
 * TAXONOMY (for future reference):
 *   - AbortController: the standard web API for cancelling in-flight fetches.
 *       .signal is passed to fetch; calling .abort() rejects the fetch with an
 *       AbortError. This is the modern, non-deprecated replacement for the old
 *       "wrap in Promise.race with a setTimeout" pattern.
 *   - AbortSignal.timeout(ms): a newer one-liner (Node 18.17+/20+) that builds
 *       a signal which auto-aborts. We use the explicit controller form because
 *       it lets us clearInterval-style clean up the timer deterministically.
 */

/** Default SSR fetch budget (fail-fast). The API responds in well under a
 *  second when healthy, so 8s only trips on a genuine hang — at which point
 *  failing fast beats holding the request open. Note this bounds time-to-first-
 *  byte; it clears once response headers arrive. Tune per-call via `timeoutMs`. */
export const DEFAULT_FETCH_TIMEOUT_MS = 8000;

import {
  currentAuditSessionId,
  currentClientIp,
  currentRequestId,
  REQUEST_ID_HEADER,
} from "./request-context";
import { AUDIT_HEADER } from "./audit-session";
import { site } from "./site.config";

export interface FetchWithTimeoutOptions extends RequestInit {
  /** Milliseconds before the request is aborted. Defaults to DEFAULT_FETCH_TIMEOUT_MS. */
  timeoutMs?: number;
}

/**
 * fetch() that rejects with an AbortError if it does not resolve within
 * `timeoutMs`. Drop-in replacement for `fetch` on the server.
 *
 * Callers should keep their existing try/catch — an aborted request throws,
 * exactly like a network failure, so error handling is uniform.
 */
export async function fetchWithTimeout(
  input: string | URL,
  { timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, ...init }: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Forward this page's request id, so the API's logs for this page view share it.
  const headers = new Headers(init.headers);
  const requestId = currentRequestId();
  if (requestId && !headers.has(REQUEST_ID_HEADER)) headers.set(REQUEST_ID_HEADER, requestId);
  // Audit trail (§5.9(b)): the API's lines for this page share the visit's session id.
  const auditSid = currentAuditSessionId();
  if (auditSid) headers.set(AUDIT_HEADER, auditSid);
  // Lets the API rate-limit the visitor, not Cloud Run's shared egress IPs. Server-only
  // secret: sent only to our API, never to the browser.
  const siteKey = process.env.SITE_API_KEY || import.meta.env.SITE_API_KEY;
  const apiBase = process.env.PUBLIC_API_BASE_URL || import.meta.env.PUBLIC_API_BASE_URL;
  if (siteKey && apiBase && String(input).startsWith(apiBase)) {
    headers.set("X-Site-Key", siteKey);
    const ip = currentClientIp();
    if (ip) headers.set("X-Visitor-Ip", ip);
  }
  try {
    return await fetch(input, { ...init, headers, signal: controller.signal });
  } finally {
    // Always clear the timer, whether the fetch resolved, rejected, or aborted.
    clearTimeout(timer);
  }
}

/**
 * A minimal, self-contained, on-brand HTML error page for pages that cannot render without
 * API data (e.g. the listing detail page). Real status codes, so monitoring and crawlers see
 * the truth, while the visitor gets a styled page with a way forward instead of a stack trace.
 *
 * Kept inline (no Layout import) so it works even if the failure happened
 * before/around layout data was available.
 */
function errorPageResponse(
  status: number,
  title: string,
  heading: string,
  message: string,
  retryAfterSeconds: number,
): Response {
  const body = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${title} — ${site.name}</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         background:#fafaf9; color:#1c1917; display:flex; min-height:100vh; align-items:center; justify-content:center; }
  .card { max-width:32rem; padding:2.5rem 2rem; text-align:center; }
  h1 { font-size:1.5rem; font-weight:600; margin:0 0 .75rem; }
  p { color:#57534e; line-height:1.6; margin:0 0 1.5rem; }
  a { display:inline-block; background:#1c1917; color:#fff; text-decoration:none;
      padding:.65rem 1.25rem; border-radius:.5rem; font-size:.9rem; }
</style>
</head>
<body>
  <div class="card">
    <h1>${heading}</h1>
    <p>${message}</p>
    <a href="/listings">Back to listings</a>
  </div>
</body>
</html>`;
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Retry-After": String(retryAfterSeconds),
    },
  });
}

/** 503 for transient backend failures (API down, timeout, unexpected status). */
export function serviceUnavailableResponse(message?: string): Response {
  return errorPageResponse(
    503,
    "Temporarily unavailable",
    "This page is temporarily unavailable",
    message ?? "We couldn't load this listing right now. Please try again in a moment.",
    30,
  );
}

/**
 * 429 when the API rate-limited this visitor (abuse protection): tells a real person to slow
 * down for a moment, and passes the API's Retry-After on (default 60 s).
 */
export function tooManyRequestsResponse(retryAfter: string | null): Response {
  const seconds = Math.min(Math.max(Number(retryAfter) || 60, 1), 3600);
  return errorPageResponse(
    429,
    "Please slow down",
    "Please slow down",
    `You've viewed a lot of listings very quickly. Please wait about ${seconds < 120 ? `${seconds} seconds` : `${Math.ceil(seconds / 60)} minutes`} and try again.`,
    seconds,
  );
}

// ─── MLS Grid "data as of" ───────────────────────────────────────────────────

let dataAsOfCache: { value: string | null; fetchedAt: number } | null = null;
const DATA_AS_OF_TTL_MS = 5 * 60 * 1000;

/**
 * When our listing data was last updated from MLS Grid (ISO 8601, the newest MLS change the
 * API holds), for the MLS Grid disclaimer. Cached 5 minutes per server instance so pages
 * don't add an API call each; a failed lookup returns the last known value (or null), never
 * an error, so the disclaimer can't break a page.
 */
export async function mlsDataAsOf(): Promise<string | null> {
  if (dataAsOfCache && Date.now() - dataAsOfCache.fetchedAt < DATA_AS_OF_TTL_MS) {
    return dataAsOfCache.value;
  }
  const apiBase = process.env.PUBLIC_API_BASE_URL || import.meta.env.PUBLIC_API_BASE_URL;
  if (!apiBase) return null;
  try {
    const res = await fetchWithTimeout(`${apiBase}/api/listings/data-as-of`, { timeoutMs: 1500 });
    if (!res.ok) return dataAsOfCache?.value ?? null;
    const { asOf } = (await res.json()) as { asOf: string | null };
    dataAsOfCache = { value: asOf, fetchedAt: Date.now() };
    return asOf;
  } catch {
    return dataAsOfCache?.value ?? null;
  }
}
