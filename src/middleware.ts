import { isIP } from "node:net";
import type { APIContext, MiddlewareHandler, MiddlewareNext } from "astro";
import { site } from "./lib/site.config";
import { auditLog, newAuditSessionId } from "./lib/audit";
import { AUDIT_COOKIE } from "./lib/audit-session";
import {
  REQUEST_ID_HEADER,
  currentRequestId,
  requestContext,
  requestIdFrom,
  type RequestContext,
} from "./lib/request-context";

// ─────────────────────────────────────────────
// CLIENT IP
// Cloud Run's front end APPENDS the address it received the request from to
// X-Forwarded-For, so the trustworthy entry is the one TRUSTED_PROXY_HOPS from the right
// (1 for the run.app URL; +1 per proxy added in front, e.g. a load balancer or Cloudflare).
// Everything to its left was written by the visitor and is spoofable: reading the leftmost
// entry (the old code) let anyone get a fresh rate-limit bucket per request.
// ─────────────────────────────────────────────
const TRUSTED_PROXY_HOPS = Number(process.env.TRUSTED_PROXY_HOPS ?? 1) || 1;

/** The visitor's IP as our proxy saw it, or undefined (local dev without a proxy). */
export function clientIpFrom(request: Request): string | undefined {
  const parts = (request.headers.get("x-forwarded-for") ?? "").split(",").map((p) => p.trim());
  const ip = parts.length >= TRUSTED_PROXY_HOPS ? parts[parts.length - TRUSTED_PROXY_HOPS] : "";
  return ip && isIP(ip) ? ip : undefined;
}

/** Rate-limit key: IPv6 by /64 (one home or phone gets a whole /64), IPv4 as is. */
function bucketKey(ip: string | undefined): string {
  if (!ip) return "unknown";
  if (isIP(ip) !== 6) return ip;
  const [head, tail = ""] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const fill = Array<string>(Math.max(0, 8 - left.length - right.length)).fill("0");
  const groups = [...left, ...fill, ...right].slice(0, 4);
  return `${groups.map((g) => parseInt(g, 16).toString(16)).join(":")}::/64`;
}

/** Network only (a.b.c.0 / first three IPv6 groups): logs never hold a full visitor IP. */
function truncateIp(ip: string | undefined): string {
  if (!ip) return "unknown";
  if (isIP(ip) === 6) return `${ip.split(":").slice(0, 3).join(":")}::`;
  return ip.replace(/\.\d+$/, ".0");
}

// ─────────────────────────────────────────────
// ABUSE LOG
// One JSON line per rejection episode. Cloud Run turns JSON on stdout into structured
// logs (filter jsonPayload.event="abuse"), which a log-based metric counts and alerts on
// (runbook: listing-agent-api docs/abuse-protection.md). Deduplicated: the 1st, 10th,
// 100th, ... rejection per client and window. No form content, no full IPs.
// ─────────────────────────────────────────────

/** Logs one abuse event (rate_limited, bad_request, forbidden_origin, spend_cap). */
export function logAbuse(fields: {
  abuseType: string;
  rule: string;
  status: number;
  ip?: string;
  count?: number;
}): void {
  console.warn(
    JSON.stringify({
      severity: "WARNING",
      message: `Abuse: ${fields.abuseType} on ${fields.rule} -> ${fields.status}`,
      event: "abuse",
      abuseType: fields.abuseType,
      rule: fields.rule,
      status: fields.status,
      clientNet: truncateIp(fields.ip),
      count: fields.count ?? 1,
      requestId: currentRequestId(),
    }),
  );
}

/** 1, 10, 100, ...: the first rejection and each order of magnitude. */
function isLogworthy(n: number): boolean {
  while (n >= 10 && n % 10 === 0) n /= 10;
  return n === 1;
}

// ─────────────────────────────────────────────
// IN-MEMORY RATE LIMITER
// Fixed windows per rule and client. Per Cloud Run instance: N instances allow N times
// these numbers, one reason max-instances is capped (runbook). Each window has its own map
// (entries expire with their own window) and a size cap, so a flood of fake clients can't
// grow memory without bound.
// ─────────────────────────────────────────────

interface Window {
  /** Requests allowed per window. */
  max: number;
  windowMs: number;
}

interface Rule {
  name: string;
  windows: Window[];
  /** Shown to the visitor on rejection. */
  message: string;
  /** JSON for endpoints, HTML for pages. */
  json: boolean;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Pages and endpoints that cost server work or money per request. Each listing page makes
 * an API call; a person reads a few listings a minute, a scraper hundreds. Search engines
 * slow down on a 429 with Retry-After rather than drop pages.
 */
const RULES = {
  contact: {
    name: "contact",
    windows: [
      { max: 5, windowMs: 15 * MINUTE },
      { max: 20, windowMs: 24 * HOUR },
    ],
    message: "Too many requests. Please wait a few minutes and try again.",
    json: true,
  },
  listingPage: {
    name: "listing_page",
    windows: [
      { max: 30, windowMs: MINUTE },
      { max: 300, windowMs: HOUR },
    ],
    message: "You're opening listings faster than we can show them. Please wait a minute.",
    json: false,
  },
  searchPage: {
    name: "search_page",
    windows: [
      { max: 30, windowMs: MINUTE },
      { max: 600, windowMs: HOUR },
    ],
    message: "Too many searches at once. Please wait a minute.",
    json: false,
  },
  sitemap: {
    name: "sitemap",
    windows: [{ max: 10, windowMs: MINUTE }],
    message: "Too many requests.",
    json: false,
  },
} satisfies Record<string, Rule>;

/** The rule a request counts against, or undefined (static pages, assets). */
function ruleFor(method: string, path: string): Rule | undefined {
  if (path === "/api/contact") return method === "POST" ? RULES.contact : undefined;
  if (method !== "GET" && method !== "HEAD") return undefined;
  if (path === "/listings" || path === "/listings/") return RULES.searchPage;
  if (path.startsWith("/listings/")) return RULES.listingPage;
  if (path === "/sitemap-listings.xml") return RULES.sitemap;
  return undefined;
}

interface Counter {
  count: number;
  windowStart: number;
}

const MAX_ENTRIES_PER_WINDOW = 20_000;
const counters = new Map<string, Map<string, Counter>>();

/** Counts the request; returns how far over and the retry delay if a window is exceeded. */
function hit(rule: Rule, client: string): { over: number; retryAfterS: number } | undefined {
  const now = Date.now();
  let rejected: { over: number; retryAfterS: number } | undefined;
  rule.windows.forEach((w, i) => {
    const id = `${rule.name}#${i}`;
    let store = counters.get(id);
    if (!store) {
      store = new Map();
      counters.set(id, store);
    }
    let entry = store.get(client);
    if (!entry || now - entry.windowStart >= w.windowMs) {
      entry = { count: 0, windowStart: now };
      store.delete(client); // re-insert, so the Map stays oldest-first for pruning
      store.set(client, entry);
      if (store.size > MAX_ENTRIES_PER_WINDOW) prune(store, w.windowMs, now);
    }
    entry.count++;
    if (entry.count > w.max && !rejected) {
      rejected = {
        over: entry.count - w.max,
        retryAfterS: Math.max(1, Math.ceil((entry.windowStart + w.windowMs - now) / 1000)),
      };
    }
  });
  return rejected;
}

/** Drops expired entries, then the oldest ones while still over the cap. */
function prune(store: Map<string, Counter>, windowMs: number, now: number): void {
  for (const [key, entry] of store) {
    if (now - entry.windowStart >= windowMs) store.delete(key);
  }
  for (const key of store.keys()) {
    if (store.size <= MAX_ENTRIES_PER_WINDOW * 0.9) break;
    store.delete(key);
  }
}

// Expired entries are also swept every 10 minutes, so idle clients don't linger.
setInterval(() => {
  const now = Date.now();
  for (const rule of Object.values(RULES) as Rule[]) {
    rule.windows.forEach((w, i) => {
      const store = counters.get(`${rule.name}#${i}`);
      if (store) prune(store, w.windowMs, now);
    });
  }
}, 10 * MINUTE).unref();

// ─────────────────────────────────────────────
// REQUEST CHECKS
// ─────────────────────────────────────────────

/** Contact form posts are a few KB; a bigger declared body is not a person typing. */
const MAX_CONTACT_BODY_BYTES = 16 * 1024;

/**
 * Same-origin check for the contact form (astro.config's checkOrigin is off). Browsers
 * send Origin on POST; Referer is the fallback. Cross-site posts are bots or CSRF. Compared
 * with the Host header (the public host on Cloud Run, the custom domain later), not
 * request.url, whose host the Node adapter doesn't take from the request.
 */
function isSameOrigin(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const host = request.headers.get("host");
  const source = request.headers.get("origin") ?? request.headers.get("referer");
  if (!host || !source) return false;
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

function rejection(rule: Rule, status: number, message: string, retryAfterS = 0): Response {
  const headers: Record<string, string> = {
    "Content-Type": rule.json ? "application/json" : "text/html; charset=utf-8",
  };
  if (retryAfterS > 0) headers["Retry-After"] = String(retryAfterS);
  const body = rule.json
    ? JSON.stringify({ success: false, error: message })
    : `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Please slow down — ${site.name}</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#1c1917"><h1 style="font-size:1.5rem">Please slow down</h1><p>${message}</p><p><a href="/" style="display:inline-block;padding:0.75rem 0">Home</a></p></body></html>`;
  return new Response(body, { status, headers });
}

// ─────────────────────────────────────────────
// MIDDLEWARE HANDLER
// Astro runs this before every request.
// ─────────────────────────────────────────────
export const onRequest: MiddlewareHandler = async (context, next) => {
  // Every request gets an id (kept from X-Request-Id when valid). Rendering runs inside
  // requestContext, so API calls made for this page forward it (see lib/api.ts), and
  // the response carries it for debugging. The visitor's IP rides along too, for
  // fetchWithTimeout to forward to the API (X-Visitor-Ip, with the site key), so the API
  // limits the visitor rather than Cloud Run's shared egress IP.
  const requestId = requestIdFrom(context.request.headers.get(REQUEST_ID_HEADER));
  // Audit trail (§5.9(b)): a random id per browser session ties one visitor's actions
  // together without identifying them. Set once; it ends when the browser closes.
  const existingSid = context.cookies.get(AUDIT_COOKIE)?.value;
  const auditSessionId =
    existingSid && /^[A-Za-z0-9_-]{16,64}$/.test(existingSid) ? existingSid : newAuditSessionId();
  if (auditSessionId !== existingSid) {
    context.cookies.set(AUDIT_COOKIE, auditSessionId, {
      path: "/",
      sameSite: "lax",
      secure: context.request.headers.get("x-forwarded-proto") === "https",
    });
  }
  const store: RequestContext = {
    requestId,
    clientIp: clientIpFrom(context.request),
    auditSessionId,
  };
  const response = await requestContext.run(store, () => {
    // Pages with MLS data: what was viewed (the path holds the MLS number or search filters).
    const { pathname, search } = new URL(context.request.url);
    if (context.request.method === "GET" && /^\/listings(\/|$)/.test(pathname)) {
      auditLog("page_view", { path: pathname + search });
    }
    return handle(context, next, store.clientIp);
  });
  try {
    response.headers.set(REQUEST_ID_HEADER, requestId);
  } catch {
    // Some responses (e.g. redirects) have immutable headers; the id is optional there.
  }
  return response;
};

async function handle(
  context: APIContext,
  next: MiddlewareNext,
  ip: string | undefined,
): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);
  const rule = ruleFor(request.method, url.pathname);

  if (rule) {
    // ── Request checks (contact form) ──
    // A missing Content-Length is allowed (HTTP/2 may omit it); /api/contact caps the
    // body it reads either way.
    if (rule === RULES.contact) {
      if (!isSameOrigin(request)) {
        logAbuse({ abuseType: "forbidden_origin", rule: rule.name, status: 403, ip });
        return rejection(rule, 403, "Please use the form on our website.");
      }
      if (Number(request.headers.get("content-length") ?? 0) > MAX_CONTACT_BODY_BYTES) {
        logAbuse({ abuseType: "bad_request", rule: rule.name, status: 413, ip });
        return rejection(rule, 413, "That message is too long. Please shorten it and try again.");
      }
    }

    // ── Rate limit ──
    // No IP (local dev, or a misconfigured TRUSTED_PROXY_HOPS): skip rather than put every
    // visitor in one shared "unknown" bucket, which would throttle the whole site.
    const limited = ip ? hit(rule, bucketKey(ip)) : undefined;
    if (limited) {
      if (isLogworthy(limited.over)) {
        logAbuse({
          abuseType: "rate_limited",
          rule: rule.name,
          status: 429,
          ip,
          count: limited.over,
        });
      }
      return rejection(rule, 429, rule.message, limited.retryAfterS);
    }
  }

  // Request is allowed — continue to the page or API endpoint
  return compress(request, await next());
}

// ─────────────────────────────────────────────
// RESPONSE COMPRESSION
// The Node server and Cloud Run don't compress, so pages, sitemaps and feeds went out
// at full size (HTML compresses ~5-10x). gzip text responses here. Static files under
// /_astro (JS/CSS, cached for a year) bypass middleware; a CDN in front of the domain
// covers those at go-live. Production only: Vite's dev server handles its own.
// ─────────────────────────────────────────────
const COMPRESSIBLE = /^(text\/|application\/(json|xml|rss\+xml|ld\+json))/;

function compress(request: Request, response: Response): Response {
  if (!import.meta.env.PROD || !response.body) return response;
  const type = response.headers.get("Content-Type") ?? "";
  if (
    response.headers.has("Content-Encoding") ||
    !COMPRESSIBLE.test(type) ||
    !/\bgzip\b/.test(request.headers.get("Accept-Encoding") ?? "")
  ) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("Content-Encoding", "gzip");
  headers.delete("Content-Length");
  headers.append("Vary", "Accept-Encoding");
  return new Response(response.body.pipeThrough(new CompressionStream("gzip")), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
