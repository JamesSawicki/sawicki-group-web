import type { Listing, Room } from "../types/listing";
import type { AmenityScores } from "../types/listing";
import { brokerage } from "./site.config";
/**
 * listing-utils.ts — pure functions for formatting and deriving listing values.
 *
 * These are intentionally framework-free: no Astro APIs, no fetch, no DOM.
 * Every function takes input and returns output. That makes them trivially
 * unit-testable and reusable from any context (search page, detail page,
 * future React island, future blog content references).
 *
 * Naming convention: format* returns a display string; calc/derive functions
 * return numbers or structured data.
 */

// -------------------------------------------------------------------
// BATH TOTAL — the derived value
//
// MLS counts baths with fractional weights:
//   Full       = 1.0    (toilet + sink + tub/shower)
//   ThreeQuarter = 0.75 (toilet + sink + shower, no tub)
//   Half       = 0.5    (toilet + sink only)
//   Quarter    = 0.25   (single fixture, usually just a toilet)
//
// We never store the rounded total in the database — we always derive it
// from the four raw counts so we never drift from RESO source-of-truth.
// -------------------------------------------------------------------

export function bathTotal(l: Listing): number {
  const f = l.bathsFull ?? 0;
  const tq = l.bathsThreeQuarter ?? 0;
  const h = l.bathsHalf ?? 0;
  const q = l.bathsQuarter ?? 0;
  return f * 1.0 + tq * 0.75 + h * 0.5 + q * 0.25;
}

/**
 * Format the bath total for card/list display.
 * 4.0 → "4", 4.5 → "4.5", 4.25 → "4.25".
 * JS number.toString() handles this correctly out of the box:
 * (4.0).toString() === "4", (4.25).toString() === "4.25".
 */
export function formatBathTotal(l: Listing): string {
  return bathTotal(l).toString();
}

// -------------------------------------------------------------------
// PRICE FORMATTING
// -------------------------------------------------------------------

/**
 * Full price with thousands separators: 1234567 → "$1,234,567"
 * toLocaleString('en-US') handles the comma grouping.
 */
export function formatPrice(price: number | undefined): string {
  if (price == null) return "Price upon request";
  return `$${price.toLocaleString("en-US")}`;
}

/**
 * Abbreviated price for compact displays: 1234567 → "$1.2M"
 * Use on small cards or mobile views where horizontal space is tight.
 */
export function formatPriceShort(price: number | undefined): string {
  if (price == null) return "—";
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `$${Math.round(price / 1_000)}K`;
  return `$${price}`;
}

// -------------------------------------------------------------------
// LOT SIZE — always in acres (1 acre = 43,560 sqft)
// -------------------------------------------------------------------

/**
 * Formats a lot size, stored in square feet, as acres: 5,662 sqft → "0.13 acres",
 * 106,722 → "2.45 acres", 535,000 → "12.3 acres", 43,560 → "1 acre". Precision drops
 * as lots get bigger, since nobody needs hundredths of an acre on a 40-acre parcel.
 */
export function formatLot(sqft: number | undefined): string {
  if (sqft == null) return "—";
  const acres = sqft / 43560;
  if (acres > 0 && acres < 0.01) return "< 0.01 acres";
  const digits = acres < 10 ? 2 : acres < 100 ? 1 : 0;
  const rounded = Number(acres.toFixed(digits));
  const text = rounded.toLocaleString("en-US", { maximumFractionDigits: digits });
  return `${text} ${rounded === 1 ? "acre" : "acres"}`;
}

// -------------------------------------------------------------------
// LEVELS (RESO "Levels", stored as listing.style)
// -------------------------------------------------------------------

// MLS spells out story counts ("Two"); split-level names are already descriptive.
const LEVELS_LABELS: Record<string, string> = {
  One: "1 Story",
  "One and One Half": "1.5 Story",
  Two: "2 Story",
  "Two and One Half": "2.5 Story",
  Three: "3 Story",
};

/**
 * Formats the MLS Levels value for display: "Two" → "2 Story", "One and One Half" →
 * "1.5 Story". Other values ("Split Entry (Bi-Level)", "More Than 2 Stories") pass
 * through unchanged; returns "" when unknown.
 */
export function formatLevels(levels: string | null | undefined): string {
  if (!levels) return "";
  return LEVELS_LABELS[levels] ?? levels;
}

// -------------------------------------------------------------------
// SQUARE FOOTAGE — comma-formatted display
// -------------------------------------------------------------------

export function formatSqft(sqft: number | undefined): string {
  if (sqft == null) return "—";
  return sqft.toLocaleString("en-US");
}

// -------------------------------------------------------------------
// STATUS LABELS AND CLASSES
//
// Status badges need both a human-readable label and a Tailwind color class.
// We centralize both here so every component renders status the same way.
//
// Color choices:
//   Active       — green (positive, available)
//   Pending      — yellow/amber (transitional, attention)
//   Coming Soon  — purple (anticipation)
//   TNAS         — red (cannot show)
//   Sold         — gray (closed, archival)
//   Withdrawn/Expired/Cancelled — muted slate
// -------------------------------------------------------------------

export function statusLabel(status: string | undefined): string {
  if (!status) return "Unknown";
  // Map raw MLS status codes to buyer-friendly wording. "TNAS" (Temporarily
  // Not Available for Showing) is internal MLS jargon that means nothing to a
  // consumer, so it must be translated. Unknown/other codes fall through to
  // the raw value rather than being hidden.
  const labels: Record<string, string> = {
    TNAS: "Temporarily off-market",
    "Coming Soon": "Coming soon",
    Pending: "Sale pending",
  };
  return labels[status] ?? status;
}

/**
 * Format a money value that arrives from the API as a numeric STRING
 * (e.g. taxAmount, associationFee are String columns on the entity).
 * "5432.00" -> "$5,432", "1200" -> "$1,200". Non-numeric input is returned
 * with a leading "$" untouched; null/empty -> "—".
 *
 * Cents are dropped: property taxes and HOA fees read cleaner as whole dollars,
 * and MLS data frequently carries a spurious ".00".
 */
export function formatMoneyString(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : parseFloat(value.replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(n)) return `$${value}`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/**
 * Returns Tailwind class string for the status badge.
 * Designed for: <span class="...">{label}</span>
 */
export function statusBadgeClasses(status: string | undefined): string {
  const base = "inline-block px-2 py-1 text-xs font-semibold rounded";
  switch (status) {
    case "Active":
      return `${base} bg-green-100 text-green-800`;
    case "Pending":
      return `${base} bg-amber-100 text-amber-800`;
    case "Coming Soon":
      return `${base} bg-purple-100 text-purple-800`;
    case "TNAS":
      return `${base} bg-red-100 text-red-800`;
    case "Sold":
      return `${base} bg-slate-200 text-slate-700`;
    default:
      return `${base} bg-slate-100 text-slate-600`;
  }
}

// -------------------------------------------------------------------
// ROOM INFO PARSING
//
// roomInfo is a JSON string. Detail pages need it as an array of objects.
// We parse defensively because: (a) the field may be null, (b) bad JSON
// from a future MLS import shouldn't crash a page.
// -------------------------------------------------------------------

export function parseRooms(roomInfo: string | undefined): Room[] {
  if (!roomInfo) return [];
  try {
    const parsed = JSON.parse(roomInfo);
    return Array.isArray(parsed) ? (parsed as Room[]) : [];
  } catch {
    return [];
  }
}

// -------------------------------------------------------------------
// PRESENCE CHECKS
// -------------------------------------------------------------------

/**
 * True when a numeric field has a real, positive value. Use it instead of
 * `{value && ...}` in templates: with a 0, `&&` renders a literal "0".
 */
export function isPositive(value: number | null | undefined): value is number {
  return typeof value === "number" && value > 0;
}

/**
 * Picks the singular or plural label for a count: `pluralize(1, "Bed")` → "Bed",
 * `pluralize(2.5, "Bath")` → "Baths". Only exactly 1 is singular.
 *
 * @param plural - irregular plural form; defaults to `singular + "s"`.
 */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

// -------------------------------------------------------------------
// LIST-VALUED FIELDS
//
// Many RESO fields are multi-valued (Heating, Basement, Appliances, ...). The API
// stores them as a JSON array string: '["Forced Air","Radiant Floor"]'. A few
// older/other fields are plain comma-separated text. These helpers accept both,
// so templates never show raw JSON.
// -------------------------------------------------------------------

/**
 * Splits a list-valued listing field into its items.
 *
 * @param value - a JSON array string ('["Full","Walkout"]') or comma-separated text
 *   ("Full, Walkout"); null, empty or malformed input yields `[]`.
 * @returns the non-empty, trimmed items in their original order.
 */
export function parseList(value: string | null | undefined): string[] {
  if (!value) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((v): v is string => typeof v === "string")
          .map((v) => v.trim())
          .filter(Boolean);
      }
    } catch {
      // Not valid JSON after all — fall through to comma-splitting.
    }
  }
  return trimmed
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Formats a list-valued listing field for display, e.g. '["Full","Walkout"]' →
 * "Full, Walkout". Returns "" when there's nothing to show, so it works directly in
 * `{value && ...}` template conditions.
 */
export function formatList(value: string | null | undefined): string {
  return parseList(value).join(", ");
}

// -------------------------------------------------------------------
// PRICE CHANGE INDICATOR
//
// If listPrice < originalListPrice, the listing has had a price reduction.
// Buyers care about this — it signals motivated sellers or stale listings.
// -------------------------------------------------------------------

export function hasPriceReduction(l: Listing): boolean {
  if (l.listPrice == null || l.originalListPrice == null) return false;
  return l.listPrice < l.originalListPrice;
}

export function priceReductionAmount(l: Listing): number {
  if (!hasPriceReduction(l)) return 0;
  return (l.originalListPrice ?? 0) - (l.listPrice ?? 0);
}

/**
 * Parse the amenityScores JSON string from the API into a typed object.
 * Returns null if the field is missing, empty, or malformed.
 */
export function parseAmenityScores(json: string | null | undefined): AmenityScores | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as AmenityScores;
    if (!parsed.scores || Object.keys(parsed.scores).length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Display a distance (given in meters, as the API stores it) in US units: miles to one
 * decimal from 0.1 mi up, feet (to the nearest 10) below that, "next door" under 100 ft.
 * 1230 -> "0.8 mi", 120 -> "390 ft", 20 -> "next door"
 */
export function formatDistance(meters: number | undefined | null): string {
  if (meters === undefined || meters === null) return "—";
  const miles = meters / 1609.344;
  if (miles >= 0.1) return `${miles.toFixed(1)} mi`;
  const feet = meters * 3.28084;
  if (feet < 100) return "next door";
  return `${Math.round(feet / 10) * 10} ft`;
}

/**
 * Map our internal category and subtype keys to display labels.
 * Kept here so the Astro page stays template-focused.
 */
export function categoryLabel(jsonKey: string): string {
  const labels: Record<string, string> = {
    grocery: "Grocery",
    restaurants: "Food & drink",
    parks: "Parks",
    pharmacy: "Pharmacy",
    hardware: "Hardware",
    transit_stations: "Train & BRT",
    bus_stops: "Bus stops",
  };
  return labels[jsonKey] ?? jsonKey;
}
/**
 * Function to strip the three letter MLS identifier off of the mlsId
 * @param mlsId
 * @returns
 */
export function formatMlsId(mlsId: string | null | undefined): string {
  if (!mlsId) return "";
  return mlsId.replace(/^[A-Z]+/, "");
}

/**
 * Format an ISO timestamp as a short human-readable "data freshness" line.
 * Used in the IDX disclosure block. "2026-06-04T16:12:47Z" -> "Jun 4, 2026 at 4:12 PM"
 */
export function formatDataFreshness(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function subtypeLabel(subtype: string): string {
  const labels: Record<string, string> = {
    restaurant: "Restaurant",
    cafe: "Café",
    fast_food: "Fast food",
    bar: "Bar",
    pub: "Pub",
    ice_cream: "Ice cream",
    supermarket: "Supermarket",
    grocery: "Grocery store",
    hardware: "Hardware store",
    doityourself: "Home center",
  };
  return labels[subtype] ?? subtype;
}

// -------------------------------------------------------------------
// URL SLUGS — SEO-friendly, collision-proof listing paths
//
// URL shape:  /listings/{address}-{postalCity}-mn-{zip}-{id}
//   e.g.       /listings/3901-w-50th-st-unit-101-edina-mn-55424-4021
//
// The human-readable part is cosmetic — it exists for SEO and shareability.
// The TRAILING id is the resolution key: the [slug].astro route parses it and
// calls GET /api/listings/{id}. This is the Zillow/Redfin pattern
// (.../{slug}/{zpid}_zpid/) and it buys two things:
//   1. Collision-proofing — two condos sharing a street address still get
//      distinct URLs because their ids differ. No de-duplication logic needed.
//   2. Self-healing 301s — a bare-id URL (/listings/4021) or a stale slug (the
//      address changed) can be permanently redirected to the canonical slug,
//      so Google consolidates ranking on ONE URL per property.
// -------------------------------------------------------------------

/**
 * Turn arbitrary text into a URL-safe slug segment.
 *   "St. Louis Park"  -> "st-louis-park"
 *   "Saint Paul"      -> "st-paul"     (NorthstarMLS also has St. Paul / St. Cloud)
 *   "3901 W 50th St"  -> "3901-w-50th-st"
 *
 * Steps, in order:
 *   normalize("NFKD") + strip marks  — decompose accented chars, drop the accent
 *   toLowerCase                       — URLs are case-insensitive; keep them lower
 *   \bsaint\b -> st                   — canonicalize the MN "Saint" spelling so
 *                                       "Saint Paul" and "St. Paul" collapse to one
 *   & -> " and "                      — cheap safety for the rare "A & B" street
 *   strip ' " .                       — kills apostrophes and the period in "St."
 *   [^a-z0-9]+ -> "-"                 — every other non-alphanumeric run -> hyphen
 *   trim leading/trailing hyphens     — no "-foo-" edges
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks
    .toLowerCase()
    .replace(/\bsaint\b/g, "st")
    .replace(/&/g, " and ")
    .replace(/['".]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Build the canonical slug (WITH trailing id) for a listing.
 * Uses postalCity (the mailing city — cleaner in rural MN where `city` can be a
 * township like "Buckman Twp"), falling back to `city` when postalCity is empty.
 * The unit marker "#101" is rewritten to "unit 101" first so it slugs to
 * "unit-101" rather than a bare "-101".
 */
export function listingSlug(l: Listing): string {
  const cityForUrl = l.postalCity?.trim() || l.city?.trim() || "";
  const addr = (l.address ?? "").replace(/#\s*/g, "unit ");
  const base = slugify([addr, cityForUrl, "MN", l.zipCode ?? ""].filter(Boolean).join(" "));
  // Guard: if base is somehow empty, the id alone still resolves.
  return base ? `${base}-${l.id}` : String(l.id);
}

/** Full site path for a listing detail page: "/listings/{slug}". */
export function listingPath(l: Listing): string {
  return `/listings/${listingSlug(l)}`;
}

/**
 * Extract the numeric listing id from a slug URL segment.
 * The id is always the final hyphen-delimited integer:
 *   "3901-w-50th-st-unit-101-edina-mn-55424-4021" -> 4021
 *   "4021"                                          -> 4021   (bare-id URL)
 * Returns null when there's no trailing integer (=> treat as 404).
 */
export function parseListingId(param: string): number | null {
  const m = param.match(/(?:^|-)(\d+)$/);
  return m ? Number(m[1]) : null;
}
