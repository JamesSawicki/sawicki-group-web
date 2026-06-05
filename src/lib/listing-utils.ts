import type { Listing, Room } from "../types/listing";
import type { AmenityScores } from "../types/listing";
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
// LOT SIZE — display sqft for small lots, acres for larger
//
// Real estate convention: anything under ~0.25 acres reads naturally in
// sqft (e.g. "8,712 sqft"). Larger lots feel right in acres ("2.5 acres").
// 0.25 acres = 10,890 sqft. We use that threshold.
// 1 acre = 43,560 sqft (the magic real estate number).
// -------------------------------------------------------------------

export function formatLot(sqft: number | undefined): string {
  if (sqft == null) return "—";
  const acres = sqft / 43560;
  if (acres < 0.25) return `${sqft.toLocaleString("en-US")} sqft`;
  return `${acres.toFixed(2)} acres`;
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
  return status;
}

/**
 * Returns Tailwind class string for the status badge.
 * Designed for: <span class="...">{label}</span>
 */
export function statusBadgeClasses(status: string | undefined): string {
  const base = "inline-block px-2 py-1 text-xs font-semibold rounded";
  switch (status) {
    case "Active":      return `${base} bg-green-100 text-green-800`;
    case "Pending":     return `${base} bg-amber-100 text-amber-800`;
    case "Coming Soon": return `${base} bg-purple-100 text-purple-800`;
    case "TNAS":        return `${base} bg-red-100 text-red-800`;
    case "Sold":        return `${base} bg-slate-200 text-slate-700`;
    default:            return `${base} bg-slate-100 text-slate-600`;
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
    return Array.isArray(parsed) ? parsed as Room[] : [];
  } catch {
    return [];
  }
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
 * Display a distance in meters, switching to km past 1000m.
 * 580 -> "580 m", 1230 -> "1.2 km"
 */
export function formatDistance(meters: number | undefined): string {
  if (meters === undefined || meters === null) return "—";
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Map our internal category and subtype keys to display labels.
 * Kept here so the Astro page stays template-focused.
 */
export function categoryLabel(jsonKey: string): string {
  const labels: Record<string, string> = {
    grocery: "Grocery",
    restaurants: "Food & drink",
    pharmacy: "Pharmacy",
    hardware: "Hardware",
  };
  return labels[jsonKey] ?? jsonKey;
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