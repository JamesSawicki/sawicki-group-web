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

import { currentClientIp, currentRequestId, REQUEST_ID_HEADER } from "./request-context";
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
 * A minimal, self-contained, on-brand HTML response for transient backend
 * failures on pages that cannot render without data (e.g. the listing detail
 * page). Returns a real 503 so monitoring and crawlers see the truth, while
 * the visitor gets a styled page with a way forward instead of a stack trace.
 *
 * Kept inline (no Layout import) so it works even if the failure happened
 * before/around layout data was available.
 */
export function serviceUnavailableResponse(message?: string): Response {
  const body = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Temporarily unavailable — ${site.name}</title>
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
    <h1>This page is temporarily unavailable</h1>
    <p>${message ?? "We couldn't load this listing right now. Please try again in a moment."}</p>
    <a href="/listings">Back to listings</a>
  </div>
</body>
</html>`;
  return new Response(body, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Retry-After": "30" },
  });
}
