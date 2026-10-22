/**
 * Remembers the visitor's last map search (path + query: viewport and filters) for the
 * current browser tab, so a listing page can offer "Back to map" to exactly that search.
 *
 * Uses sessionStorage (per tab, cleared when the tab closes). Every access is wrapped:
 * storage can be unavailable (private modes, disabled storage), and losing the "back"
 * target must never break a page.
 */

const KEY = "sawicki:lastSearchUrl";

/** The map search page; listing pages live under it (/listings/<slug>), which don't count. */
const isSearchUrl = (pathAndQuery: string): boolean => /^\/listings(\?|$)/.test(pathAndQuery);

/** Saves a search URL, e.g. "/listings?minLat=…&minBeds=3". Only map search URLs are kept. */
export function saveLastSearchUrl(pathAndQuery: string): void {
  if (!isSearchUrl(pathAndQuery)) return;
  try {
    sessionStorage.setItem(KEY, pathAndQuery);
  } catch {
    // Storage unavailable — "Back to map" falls back to a fresh search.
  }
}

/** The last saved search URL for this tab, or null if there isn't one. */
export function readLastSearchUrl(): string | null {
  try {
    const value = sessionStorage.getItem(KEY);
    return value && isSearchUrl(value) ? value : null;
  } catch {
    return null;
  }
}
