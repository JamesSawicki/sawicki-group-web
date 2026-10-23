/**
 * SearchBox.tsx — the type-ahead box over the search map. As the visitor types an
 * address (or part of one), a city or a ZIP code, it suggests matching places and
 * listings from our own data (GET /api/listings/suggest). Choosing a place frames it on
 * the map; choosing a listing flies to it and opens its preview (both handled by
 * MapSearch through the callbacks).
 *
 * Keyboard: ↑/↓ move through suggestions, Enter picks (the first one if none is
 * highlighted), Escape closes. Built as an ARIA combobox so screen readers announce it.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { Listing, PlaceSuggestion, SearchSuggestions } from "../../types/listing";
import { formatPrice, mlsNumber } from "../../lib/listing-utils";
import { track } from "../../lib/analytics";

interface Props {
  /** Base URL of listing-agent-api. */
  apiBaseUrl: string;
  /** The map's status filter, so suggestions match what the map will show. */
  status: string;
  /** A city or ZIP was chosen. */
  onSelectPlace: (place: PlaceSuggestion) => void;
  /** A listing was chosen. */
  onSelectListing: (listing: Listing) => void;
}

type Option = { kind: "place"; place: PlaceSuggestion } | { kind: "listing"; listing: Listing };

// Wait this long after the last keystroke before asking the API.
const DEBOUNCE_MS = 200;
const MIN_CHARS = 2;

export default function SearchBox({ apiBaseUrl, status, onSelectPlace, onSelectListing }: Props) {
  const [query, setQuery] = useState<string>("");
  const [options, setOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [active, setActive] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // ─── Fetch suggestions (debounced; a newer keystroke cancels the older request) ───
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_CHARS) {
      setOptions([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const url = new URL(`${apiBaseUrl}/api/listings/suggest`);
        url.searchParams.set("q", q);
        url.searchParams.set("status", status);
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as SearchSuggestions;
        setOptions([
          ...data.places.map((place): Option => ({ kind: "place", place })),
          ...data.listings.map((listing): Option => ({ kind: "listing", listing })),
        ]);
        setActive(-1);
      } catch {
        // Aborted or offline: keep the previous suggestions.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, status, apiBaseUrl]);

  const choose = (option: Option | undefined): void => {
    if (!option) return;
    if (option.kind === "place") {
      setQuery(option.place.label);
      onSelectPlace(option.place);
      // A city or ZIP from our own data, never the typed text.
      track("search_select", {
        kind: "place",
        place_type: option.place.type,
        search_term: option.place.label,
      });
    } else {
      setQuery(option.listing.address);
      onSelectListing(option.listing);
      track("search_select", {
        kind: "listing",
        listing_id: mlsNumber(option.listing) ?? String(option.listing.id),
      });
    }
    setOpen(false);
    inputRef.current?.blur(); // hides the phone keyboard so the map is visible
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (options.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(options[active] ?? options[0]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && query.trim().length >= MIN_CHARS;
  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <div className="relative">
      {/* ── Input ── */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="Search by address, city or ZIP"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          placeholder="Address, city or ZIP"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="w-full h-11 pl-10 pr-10 rounded-lg border border-slate-300 bg-white shadow-md
            text-base lg:text-sm text-slate-900 placeholder:text-slate-400
            focus:outline-none focus:border-slate-500 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            // mousedown, so the input keeps focus and the list stays open
            onMouseDown={(e) => {
              e.preventDefault();
              setQuery("");
              setOptions([]);
            }}
            className="absolute right-0 top-0 w-11 h-11 inline-flex items-center justify-center text-slate-400 hover:text-slate-600"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Suggestions ── */}
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-[50vh] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl py-1"
        >
          {options.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-500">
              {loading ? "Searching…" : `No homes match “${query.trim()}”`}
            </li>
          )}
          {options.map((option, i) => (
            <li
              key={
                option.kind === "place"
                  ? `p-${option.place.type}-${option.place.label}`
                  : `l-${option.listing.id}`
              }
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              // mousedown + preventDefault: choose before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                choose(option);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex items-center gap-3 px-4 min-h-11 py-2 cursor-pointer ${i === active ? "bg-slate-100" : ""}`}
            >
              {option.kind === "place" ? (
                <>
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-400 w-8 shrink-0">
                    {option.place.type === "zip" ? "ZIP" : "City"}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-sm text-slate-900">
                    {option.place.label}
                  </span>
                  <span className="text-xs text-slate-500 shrink-0">
                    {option.place.count} {option.place.count === 1 ? "home" : "homes"}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-400 w-8 shrink-0">
                    Home
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-sm text-slate-900">
                      {option.listing.address}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {option.listing.city}, MN {option.listing.zipCode ?? ""} ·{" "}
                      {formatPrice(option.listing.listPrice)}
                    </span>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
