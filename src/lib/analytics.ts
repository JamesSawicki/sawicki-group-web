/**
 * analytics.ts — Google Analytics 4 (gtag.js) for the browser: the visitor's opt-out,
 * the bootstrap that Analytics.astro runs on every page, and a typed `track()` helper
 * that islands call for their own events.
 *
 * Rules (see docs/compliance/privacy-analytics.md and the privacy policy):
 *   - **No PII to Google, ever** (Google Analytics terms §7; site rule: never log chat or
 *     contact-form content). Events carry listing ids, cities, price bands, counts and
 *     labels we wrote — never anything a visitor typed. Every event name and parameter is
 *     declared in `AnalyticsEvents`, so a new one gets reviewed here.
 *   - **Opt-out:** a Global Privacy Control signal or a saved choice on /privacy-choices
 *     means gtag.js is never loaded and `ga-disable-<ID>` is set.
 *   - **No ID, no analytics:** without PUBLIC_GA_MEASUREMENT_ID (dev) nothing loads and
 *     `track()` does nothing.
 *   - **Ads personalization off** (`ADS_PERSONALIZATION`): Google Signals and ad
 *     personalization stay off until remarketing is a deliberate decision, because turning
 *     them on is a "sale/share/targeted advertising" under state privacy laws and needs the
 *     policy updated first.
 *
 * gtag.js (~150 KB) loads after the page's `load` event, when the browser is idle, so it
 * never competes with the page's own content. Events sent before then wait in dataLayer.
 */
import { applyFiltersToParams, DEFAULT_STATUS, type SearchFilters } from "./search-filters";
import { parseMlsNumber } from "./listing-utils";
import { PHOTO_VIEWED_EVENT } from "./chat-events";
import { OPEN_PHOTO_EVENT } from "./photo-utils";
import { OPEN_MAP_EVENT } from "./map-utils";

// ─── Settings ────────────────────────────────────────────────────────────────

/**
 * Google Signals + ad personalization (remarketing audiences). Off: flipping this on is
 * a policy change, not just a code change (see the header comment and the memo).
 */
const ADS_PERSONALIZATION = false;

/** localStorage key holding the visitor's opt-out ("1"). */
const OPT_OUT_KEY = "sawicki:analyticsOptOut";

/** id of the JSON config element Analytics.astro renders when an ID is configured. */
export const ANALYTICS_CONFIG_ID = "analytics-config";

/** Scroll depths reported as `scroll_depth` (GA's enhanced measurement already sends 90%). */
const SCROLL_MARKS = [25, 50, 75] as const;

/** Distinct photos viewed on a listing that are worth an event. */
const PHOTO_MARKS = [5, 10, 20];

// ─── Event catalogue ─────────────────────────────────────────────────────────

/** Where a listing preview (photo card on the search map) was opened from. */
export type PreviewSource = "pin" | "list" | "search";

/** Which form a lead came from (home_value: the home page's "What's it worth?"). */
export type LeadForm = "contact_page" | "listing_chat" | "home_value" | "home_contact";

/**
 * Every custom event and its parameters. `listing_id` is filled in automatically on
 * listing pages. Values must never contain anything a visitor typed.
 */
export interface AnalyticsEvents {
  /** A listing or article was shared (GA4 recommended event). */
  share: { method: string; content_type: "listing" | "article"; item_id: string };
  /** The visitor accepted the NorthstarMLS EULA (once per session). */
  eula_accept: Record<string, never>;
  /** A listing page was viewed (GA4 ecommerce event, so Google Ads can use it later). */
  view_item: {
    /** The MLS number (stable across our database rebuilds), as in listing URLs. */
    listing_id: string;
    city?: string;
    property_type?: string;
    price_band?: string;
    currency: "USD";
    value?: number;
    items: {
      item_id: string;
      item_category?: string;
      item_category2?: string;
      price?: number;
    }[];
  };
  /** A listing's preview card opened on the search map. */
  listing_preview_open: { listing_id: string; source: PreviewSource };
  /** A search-box suggestion was chosen (the typed text is never sent). */
  search_select:
    | { kind: "place"; place_type: "city" | "zip"; search_term: string }
    | { kind: "listing"; listing_id: string };
  /** Search criteria applied: how many, which ones (our own option values) and the sort. */
  search_filters_apply: { active_filters: number; filters: string; sort: string };
  /** The filter drawer was opened. */
  filters_open: Record<string, never>;
  /** Draw-an-area on the search map. */
  map_draw: { action: "start" | "complete" | "clear" };
  /** The photo lightbox opened (from the gallery itself or the summary card). */
  photo_lightbox_open: { set: "photos" | "floorPlans"; source: "gallery" | "summary" };
  /** The visitor has now seen this many distinct photos of the listing. */
  listing_photos_viewed: { count: number };
  /** The interactive neighborhood map was opened. */
  neighborhood_map_open: Record<string, never>;
  /** The phone chat sheet opened (desktop's chat is always visible). */
  chat_open: { trigger: "bubble" | "contact_button" };
  /** The phone chat's "Questions about this home?" nudge appeared. */
  chat_nudge_shown: Record<string, never>;
  /** A chat message was sent. Never the text: only its position and whether it was our preset showing request. */
  chat_message_sent: { message_number: number; showing_request: boolean };
  /** The AI prepared a contact request card for the visitor to review. */
  chat_contact_prepared: Record<string, never>;
  /** A contact request reached us (GA4 recommended lead event). Never the fields. */
  generate_lead: { form: LeadForm };
  /** A tel: link was tapped. */
  click_to_call: { link_location: string };
  /** A mailto: link was clicked. */
  click_to_email: { link_location: string };
  /** The page was scrolled this far (percent of its height). */
  scroll_depth: { percent: (typeof SCROLL_MARKS)[number] };
}

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
  interface Navigator {
    /** Global Privacy Control (https://globalprivacycontrol.org); not in TS's DOM types yet. */
    globalPrivacyControl?: boolean;
  }
}

// ─── Opt-out ─────────────────────────────────────────────────────────────────

/** Whether the browser sends a Global Privacy Control signal (treated as an opt-out). */
export function gpcEnabled(): boolean {
  return typeof navigator !== "undefined" && navigator.globalPrivacyControl === true;
}

/** Whether the visitor opted out on /privacy-choices (false if storage is unavailable). */
export function savedOptOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Whether analytics must stay off for this visitor (GPC or a saved opt-out). */
export function analyticsOptedOut(): boolean {
  return gpcEnabled() || savedOptOut();
}

/**
 * Saves (or clears) the visitor's opt-out. Opting out also stops GA on this page and
 * deletes Google Analytics cookies; opting back in takes effect on the next page view.
 *
 * @returns false when the choice couldn't be saved (storage blocked).
 */
export function setOptOut(optOut: boolean): boolean {
  let saved = true;
  try {
    if (optOut) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    saved = false;
  }
  if (optOut) {
    const id = measurementId();
    if (id) (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = true;
    deleteGoogleAnalyticsCookies();
  }
  return saved;
}

/** Deletes `_ga` / `_ga_<container>` cookies on this host and each parent domain. */
function deleteGoogleAnalyticsCookies(): void {
  const names = document.cookie
    .split(";")
    .map((c) => c.split("=")[0].trim())
    .filter((name) => name === "_ga" || name.startsWith("_ga_"));
  const parts = location.hostname.split(".");
  const domains = parts.map((_, i) => parts.slice(i).join(".")).filter((d) => d.includes("."));
  for (const name of names) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
    for (const domain of domains)
      document.cookie = `${name}=; Max-Age=0; path=/; domain=.${domain}`;
  }
}

// ─── Tracking ────────────────────────────────────────────────────────────────

/** The GA4 measurement ID rendered by Analytics.astro, or null when none is configured. */
export function measurementId(): string | null {
  const el = document.getElementById(ANALYTICS_CONFIG_ID);
  if (!el?.textContent) return null;
  try {
    const id = (JSON.parse(el.textContent) as { measurementId?: unknown }).measurementId;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

/** The MLS number when this is a listing page (/listings/<slug>-<number>), else null. */
function currentListingId(): string | null {
  const m = location.pathname.match(/^\/listings\/([^/]+)\/?$/);
  return m ? parseMlsNumber(m[1]) : null;
}

/**
 * Sends a GA4 event. A no-op when analytics is off (no ID, opted out, or GPC). On listing
 * pages `listing_id` is added when the event doesn't carry one.
 */
export function track<E extends keyof AnalyticsEvents>(name: E, params: AnalyticsEvents[E]): void {
  if (typeof window === "undefined" || !window.gtag) return;
  const listingId = currentListingId();
  const withListing =
    listingId != null && !("listing_id" in params) ? { ...params, listing_id: listingId } : params;
  window.gtag("event", name, withListing);
}

/** A list price as a coarse band for reports and audiences (e.g. "500k-750k"). */
export function priceBand(price: number): string {
  if (price < 250_000) return "under-250k";
  if (price < 500_000) return "250k-500k";
  if (price < 750_000) return "500k-750k";
  if (price < 1_000_000) return "750k-1m";
  if (price < 2_000_000) return "1m-2m";
  return "2m-plus";
}

/** Reports applied search criteria: which filters are set, with our own option values. */
export function trackFilters(filters: SearchFilters): void {
  const params = new URLSearchParams();
  applyFiltersToParams(filters, params);
  params.delete("sortBy");
  if (params.get("status") === DEFAULT_STATUS) params.delete("status");
  // city is one of our option values (a city name), never free text.
  const summary = [...params].map(([k, v]) => (v === "true" ? k : `${k}=${v}`)).join(",");
  track("search_filters_apply", {
    active_filters: [...params.keys()].length,
    filters: summary.slice(0, 100), // GA4 parameter values are capped at 100 characters
    sort: filters.sortBy,
  });
}

// ─── Bootstrap (run once per page by Analytics.astro) ───────────────────────

/**
 * Starts GA4 on this page unless analytics is off: queues the config + page view, wires
 * the site-wide listeners, and loads gtag.js once the page is idle.
 */
export function startAnalytics(): void {
  const id = measurementId();
  if (!id) return;
  if (analyticsOptedOut()) {
    (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = true;
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // gtag.js expects the arguments object itself, not an array.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", id, {
    allow_google_signals: ADS_PERSONALIZATION,
    allow_ad_personalization_signals: ADS_PERSONALIZATION,
    ...(import.meta.env.DEV ? { debug_mode: true } : {}),
  });

  trackListingView();
  listenForLinkClicks();
  listenForContactSubmissions();
  listenForListingPageEvents();
  listenForScrollDepth();
  loadWhenIdle(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
}

/** Adds the gtag.js script after `load`, when the main thread is idle. */
function loadWhenIdle(src: string): void {
  const inject = () => {
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    document.head.appendChild(script);
  };
  // Safari before 18 has no requestIdleCallback.
  const whenIdle = () =>
    typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(inject, { timeout: 3000 })
      : window.setTimeout(inject, 1);
  if (document.readyState === "complete") whenIdle();
  else window.addEventListener("load", whenIdle, { once: true });
}

/**
 * Listing pages: `view_item` from the page's own JSON-LD (lib/structured-data.ts
 * `listingNodes`), so the page needs no analytics code. The street address is not sent.
 */
function trackListingView(): void {
  const listingId = currentListingId();
  if (listingId == null) return;
  type Node = Record<string, unknown>;
  const nodes: Node[] = [];
  for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const doc = JSON.parse(el.textContent ?? "") as { "@graph"?: Node[] } | Node;
      nodes.push(...("@graph" in doc && Array.isArray(doc["@graph"]) ? doc["@graph"] : [doc]));
    } catch {
      // Malformed JSON-LD: still send the view, just without details.
    }
  }
  const listing = nodes.find((n) => n["@type"] === "RealEstateListing");
  const homeId = (listing?.mainEntity as Node | undefined)?.["@id"];
  const home = nodes.find((n) => n["@id"] === homeId);
  const price = Number((listing?.offers as Node | undefined)?.price) || undefined;
  const city = ((home?.address as Node | undefined)?.addressLocality as string) || undefined;
  const propertyType = typeof home?.["@type"] === "string" ? home["@type"] : undefined;

  track("view_item", {
    listing_id: listingId,
    city,
    property_type: propertyType,
    price_band: price ? priceBand(price) : undefined,
    currency: "USD",
    value: price,
    items: [{ item_id: listingId, item_category: city, item_category2: propertyType, price }],
  });
}

/** tel: and mailto: links anywhere on the site (outbound links: GA enhanced measurement). */
function listenForLinkClicks(): void {
  document.addEventListener(
    "click",
    (e) => {
      const link = (e.target as Element | null)?.closest?.("a[href]");
      const href = link?.getAttribute("href") ?? "";
      const where = location.pathname;
      if (href.startsWith("tel:")) track("click_to_call", { link_location: where });
      else if (href.startsWith("mailto:")) track("click_to_email", { link_location: where });
    },
    { capture: true },
  );
}

/**
 * Leads: a successful POST to /api/contact, from the contact page, the chat's contact
 * card or a home-page form. Observed at fetch() so no form needs analytics code; the
 * request and its response pass through untouched and nothing from the form is read
 * except which form it was (the chat card attaches a listing; home-page forms send a
 * hidden `leadForm`).
 */
function listenForContactSubmissions(): void {
  const originalFetch = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>): Promise<Response> {
    const response = await originalFetch.apply(window, args);
    try {
      const [input, init] = args;
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      const method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();
      if (response.ok && method === "POST" && url.pathname === "/api/contact") {
        const body = init?.body instanceof FormData ? init.body : undefined;
        const homeForm = body?.get("leadForm");
        const form: LeadForm = body?.has("listingPath")
          ? "listing_chat"
          : homeForm === "home_value" || homeForm === "home_contact"
            ? homeForm
            : "contact_page";
        track("generate_lead", { form });
      }
    } catch {
      // Analytics must never break a request.
    }
    return response;
  };
}

/** Listing-page window events other islands already dispatch (photos, map, lightbox). */
function listenForListingPageEvents(): void {
  if (currentListingId() == null) return;
  const seen = new Set<number>();
  window.addEventListener(PHOTO_VIEWED_EVENT, (e) => {
    const index = (e as CustomEvent<{ index?: number }>).detail?.index;
    if (typeof index !== "number" || seen.has(index)) return;
    seen.add(index);
    if (PHOTO_MARKS.includes(seen.size)) track("listing_photos_viewed", { count: seen.size });
  });
  window.addEventListener(OPEN_PHOTO_EVENT, () =>
    track("photo_lightbox_open", { set: "photos", source: "summary" }),
  );
  window.addEventListener(OPEN_MAP_EVENT, () => track("neighborhood_map_open", {}));
}

/** `scroll_depth` at 25/50/75% on pages long enough to scroll. */
function listenForScrollDepth(): void {
  const sent = new Set<number>();
  let queued = false;
  const check = () => {
    queued = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max < 200) return;
    const percent = (window.scrollY / max) * 100;
    for (const mark of SCROLL_MARKS) {
      if (percent >= mark && !sent.has(mark)) {
        sent.add(mark);
        track("scroll_depth", { percent: mark });
      }
    }
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!queued) {
        queued = true;
        window.requestAnimationFrame(check);
      }
    },
    { passive: true },
  );
}
