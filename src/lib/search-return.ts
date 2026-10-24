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

/** Where a listing page's "Back to map" goes (see backToMapTarget). */
export interface BackToMapTarget {
  /** The last map search in this tab, or the plain map search page. */
  href: string;
  /** True when there's a saved search ("Back to map"); false: "Search on the map". */
  hasSearch: boolean;
  /** True when browser Back returns to that exact search, scroll position included. */
  useHistory: boolean;
}

/**
 * Where "Back to map" should go from the current listing page. Browser only (reads
 * sessionStorage, the referrer and history); every "Back to map" control uses this, so the
 * top link, the phones' mini header and the desktop summary card all behave the same.
 */
export function backToMapTarget(): BackToMapTarget {
  const saved = readLastSearchUrl();
  // Came straight from the map in this tab? Going back in history restores the page as it
  // was, including the results list's scroll position.
  let cameFromSearch = false;
  try {
    const ref = new URL(document.referrer);
    cameFromSearch = ref.origin === location.origin && ref.pathname === "/listings";
  } catch {
    // No or unparseable referrer: use the saved link.
  }
  return {
    href: saved ?? "/listings",
    hasSearch: saved !== null,
    useHistory: saved !== null && cameFromSearch && history.length > 1,
  };
}

/** Click handler for a "Back to map" link: browser Back when that restores the search. */
export function followBackToMap(event: { preventDefault(): void }, target: BackToMapTarget): void {
  if (!target.useHistory) return; // the link's href does the rest
  event.preventDefault();
  history.back();
}
