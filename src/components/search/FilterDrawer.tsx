/**
 * FilterDrawer.tsx — the search criteria panel for map search.
 *
 * Slides in from the left: over the map with a dimmed backdrop on phones/tablets, and
 * over the listings column on desktop (the map stays visible). It's opened and closed by
 * a narrow "Filters" tab on the drawer's right edge — while the drawer is closed, the tab
 * peeks out at the left edge of the screen. Swiping the drawer left also closes it.
 *
 * Edits go into a local draft; nothing is applied until "Show results", so the map
 * doesn't refetch on every keystroke. MapSearch owns the open state and the query.
 */
import { useEffect, useRef, useState } from "react";
import {
  BATH_OPTIONS,
  BED_OPTIONS,
  EMPTY_FILTERS,
  GARAGE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  type SearchFilters,
} from "../../lib/search-filters";

interface Props {
  /** Whether the drawer is shown. */
  open: boolean;
  /** Number of filters currently applied, shown on the tab. */
  activeCount: number;
  /** Called when the tab is pressed or the closed tab is swiped right. */
  onOpen: () => void;
  /** Filters currently applied to the map (the draft starts from these on each open). */
  filters: SearchFilters;
  /** Called with the edited filters when the visitor presses "Show results". */
  onApply: (filters: SearchFilters) => void;
  /** Called to close without applying (tab, X, backdrop tap, swipe left, Escape). */
  onClose: () => void;
}

// Horizontal swipe distance (px) that counts as a deliberate open/close gesture.
const SWIPE_PX = 50;

// Shared input styling: 44px tall controls for easy tapping.
const fieldClass =
  "w-full h-11 px-3 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelClass = "block text-sm font-medium text-slate-700 mb-1";

export default function FilterDrawer({
  open,
  activeCount,
  onOpen,
  filters,
  onApply,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<SearchFilters>(filters);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // Each time the drawer opens, start editing from what's currently applied.
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  // Escape closes the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Swipe left on the open drawer closes it; swipe right on the closed tab opens it.
  // Only mostly-horizontal swipes count, so scrolling the form isn't mistaken for one.
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return;
    if (open && dx < 0) onClose();
    if (!open && dx > 0) onOpen();
  };

  const set = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <>
      {/* ── Backdrop (phones/tablets only) ── */}
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-black/40 transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Panel ── */}
      {/* Phones/tablets: fixed full-height sheet from the left edge of the screen.
          Desktop: absolute over the listings column, inside MapSearch's relative wrapper.
          Closed = translated fully off the left edge, leaving only the tab visible. */}
      <aside
        aria-label="Search filters"
        className={`fixed inset-y-0 left-0 z-50 w-[85%] max-w-sm lg:absolute lg:z-20 lg:w-96 lg:max-w-none
          bg-white transition-transform duration-200
          ${open ? "translate-x-0 shadow-xl lg:shadow-lg" : "-translate-x-full"}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* ── Edge tab: label reads bottom-to-top; rides on the drawer's right edge ── */}
        <button
          type="button"
          onClick={open ? onClose : onOpen}
          className="absolute left-full top-1/2 -translate-y-1/2 w-9 py-4 flex flex-col items-center gap-2
            bg-white border border-l-0 border-slate-300 rounded-r-lg shadow-md
            text-sm font-semibold text-slate-700 hover:bg-slate-50"
          aria-controls="search-filters"
          aria-expanded={open}
          aria-label={
            open ? "Hide filters" : `Show filters${activeCount ? ` (${activeCount} active)` : ""}`
          }
        >
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs">
              {activeCount}
            </span>
          )}
          <span className="[writing-mode:vertical-rl] rotate-180 tracking-wide">Filters</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>

        {/* Contents are inert while closed, so keyboard focus can't land off-screen. */}
        <div id="search-filters" className="h-full flex flex-col" inert={!open}>
          <div className="flex items-center justify-between px-4 h-14 border-b border-slate-200 flex-shrink-0">
            <h2 className="font-semibold text-slate-900">Filters</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 inline-flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
              aria-label="Close filters"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <form
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              onApply(draft);
            }}
          >
            {/* ── Status ── */}
            <div>
              <label htmlFor="f-status" className={labelClass}>
                Status
              </label>
              <select
                id="f-status"
                className={fieldClass}
                value={draft.status}
                onChange={(e) => set("status", e.target.value)}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* ── Price ── */}
            <div>
              <span className={labelClass}>Price</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  aria-label="Minimum price"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="10000"
                  placeholder="Min"
                  className={fieldClass}
                  value={draft.minPrice}
                  onChange={(e) => set("minPrice", e.target.value)}
                />
                <input
                  aria-label="Maximum price"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="10000"
                  placeholder="Max"
                  className={fieldClass}
                  value={draft.maxPrice}
                  onChange={(e) => set("maxPrice", e.target.value)}
                />
              </div>
            </div>

            {/* ── Beds / baths ── */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="f-beds" className={labelClass}>
                  Beds
                </label>
                <select
                  id="f-beds"
                  className={fieldClass}
                  value={draft.minBeds}
                  onChange={(e) => set("minBeds", e.target.value)}
                >
                  <option value="">Any</option>
                  {BED_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}+
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="f-baths" className={labelClass}>
                  Baths
                </label>
                <select
                  id="f-baths"
                  className={fieldClass}
                  value={draft.minBaths}
                  onChange={(e) => set("minBaths", e.target.value)}
                >
                  <option value="">Any</option>
                  {BATH_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}+
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Property type ── */}
            <div>
              <label htmlFor="f-type" className={labelClass}>
                Property type
              </label>
              <select
                id="f-type"
                className={fieldClass}
                value={draft.propertyType}
                onChange={(e) => set("propertyType", e.target.value)}
              >
                {PROPERTY_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* ── Size & location ── */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="f-sqft" className={labelClass}>
                  Min sqft
                </label>
                <input
                  id="f-sqft"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="100"
                  placeholder="e.g. 2000"
                  className={fieldClass}
                  value={draft.minSqft}
                  onChange={(e) => set("minSqft", e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="f-garage" className={labelClass}>
                  Garage
                </label>
                <select
                  id="f-garage"
                  className={fieldClass}
                  value={draft.minGarageStalls}
                  onChange={(e) => set("minGarageStalls", e.target.value)}
                >
                  <option value="">Any</option>
                  {GARAGE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}+ car
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="f-city" className={labelClass}>
                City
              </label>
              <input
                id="f-city"
                type="text"
                placeholder="e.g. Edina"
                className={fieldClass}
                value={draft.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </div>

            <div>
              <span className={labelClass}>Year built</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  aria-label="Built from year"
                  type="number"
                  inputMode="numeric"
                  placeholder="From"
                  className={fieldClass}
                  value={draft.minYearBuilt}
                  onChange={(e) => set("minYearBuilt", e.target.value)}
                />
                <input
                  aria-label="Built to year"
                  type="number"
                  inputMode="numeric"
                  placeholder="To"
                  className={fieldClass}
                  value={draft.maxYearBuilt}
                  onChange={(e) => set("maxYearBuilt", e.target.value)}
                />
              </div>
            </div>

            {/* ── Features ── */}
            <fieldset>
              <legend className={labelClass}>Features</legend>
              <label className="flex items-center gap-3 h-11 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-slate-300"
                  checked={draft.waterfront}
                  onChange={(e) => set("waterfront", e.target.checked)}
                />
                Waterfront
              </label>
              <label className="flex items-center gap-3 h-11 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-slate-300"
                  checked={draft.pool}
                  onChange={(e) => set("pool", e.target.checked)}
                />
                Pool
              </label>
            </fieldset>

            {/* ── List order ── */}
            <div>
              <label htmlFor="f-sort" className={labelClass}>
                Sort list by
              </label>
              <select
                id="f-sort"
                className={fieldClass}
                value={draft.sortBy}
                onChange={(e) => set("sortBy", e.target.value)}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Hidden submit so Enter in any field applies. */}
            <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
          </form>

          {/* ── Actions (pinned to the bottom of the panel) ── */}
          <div className="flex gap-2 px-4 py-3 border-t border-slate-200 flex-shrink-0">
            <button
              type="button"
              onClick={() => setDraft(EMPTY_FILTERS)}
              className="h-11 px-4 rounded-md border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => onApply(draft)}
              className="flex-1 h-11 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
            >
              Show results
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
