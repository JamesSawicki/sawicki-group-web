/**
 * markets.ts — the home page's three market areas (defined in site.config.ts): who covers
 * each, and how many homes are for sale in each right now. Server-only (it uses the SSR
 * fetch helper); the map-search link is `mapSearchPath` in search-filters.ts.
 *
 * The counts are a "user-composite report" (NorthstarMLS §5.3(a)): a summary in which no
 * single listing is identifiable, so the page needs no EULA gate, only the §5.5(a) source
 * line (`compositeReportNotice`). They're cached in memory for 10 minutes, so the home page
 * costs the API 4 calls per 10 minutes per instance however many people visit, and a slow
 * or dead API just hides the numbers (the home page never fails because of the API).
 */
import { fetchWithTimeout } from "./api";
import {
  markets,
  mls,
  primaryContact,
  team,
  type MarketArea,
  type TeamMember,
} from "./site.config";

// ─── Lookups ─────────────────────────────────────────────────────────────────

/** The team member who covers `area` (Jim when the id doesn't match anyone). */
export function specialistFor(area: MarketArea): TeamMember {
  return team.find((member) => member.id === area.specialistId) ?? primaryContact;
}

/** The market with this id, or undefined (form input: never trusted to match). */
export function marketById(id: string | undefined): MarketArea | undefined {
  return markets.find((area) => area.id === id);
}

// ─── Live counts ─────────────────────────────────────────────────────────────

/** For-sale counts per market id, and the date of the MLS data they come from. */
export interface MarketCounts {
  /** Active listings inside each market's box, by market id. */
  counts: Record<string, number>;
  /** When our MLS data was last updated (the period the §5.5 line names). */
  asOf: Date;
}

const CACHE_MS = 10 * 60 * 1000;
// A short budget: the counts are a nice-to-have on the most visited page.
const TIMEOUT_MS = 1500;

let cached: { value: MarketCounts | null; at: number } | undefined;

/**
 * For-sale counts for every market, or null if the API didn't answer (the page then
 * leaves the numbers out). Cached for 10 minutes, failures included, so a down API
 * isn't asked again on every view.
 */
export async function marketCounts(): Promise<MarketCounts | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const value = await fetchMarketCounts();
  cached = { value, at: Date.now() };
  return value;
}

async function fetchMarketCounts(): Promise<MarketCounts | null> {
  const apiBase = process.env.PUBLIC_API_BASE_URL || import.meta.env.PUBLIC_API_BASE_URL;
  try {
    const [asOfRes, ...countRes] = await Promise.all([
      fetchWithTimeout(`${apiBase}/api/listings/data-as-of`, { timeoutMs: TIMEOUT_MS }),
      ...markets.map((area) => {
        const url = new URL(`${apiBase}/api/listings/search`);
        for (const [key, value] of Object.entries(area.bounds)) {
          url.searchParams.set(key, String(value));
        }
        url.searchParams.set("status", "Active"); // "For sale", the map's default
        url.searchParams.set("size", "1"); // only totalElements is read
        url.searchParams.set("view", "summary");
        return fetchWithTimeout(url, { timeoutMs: TIMEOUT_MS });
      }),
    ]);
    if (!asOfRes.ok || countRes.some((res) => !res.ok)) return null;
    const { asOf } = (await asOfRes.json()) as { asOf: string | null };
    if (!asOf) return null; // empty database: no data, no claim
    // Spring's paged JSON nests the total under `page` (older versions put it at the top).
    const totals = await Promise.all(
      countRes.map(async (res) => {
        const body = (await res.json()) as {
          page?: { totalElements?: number };
          totalElements?: number;
        };
        return body.page?.totalElements ?? body.totalElements;
      }),
    );
    if (!totals.every((n) => typeof n === "number")) return null;
    return {
      counts: Object.fromEntries(markets.map((area, i) => [area.id, totals[i] as number])),
      asOf: new Date(asOf),
    };
  } catch {
    return null;
  }
}

/**
 * VERIFY-IDX: the §5.5(a) disclosure for the counts: what was counted, then the required
 * source line for the period (a snapshot, so the period is the one day).
 */
export function compositeReportNotice(asOf: Date): string {
  const day = asOf.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  });
  return (
    `Homes for sale: Active listings in NorthstarMLS inside each area's map boundary, as of ${day}. ` +
    `${mls.compositeReportSource} ${day} through ${day}.`
  );
}
