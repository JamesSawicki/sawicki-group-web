/**
 * MapSearch.tsx — Interactive map search island with polygon draw.
 *
 * Phase 1: bbox search, markers, clusters, sidebar (complete)
 * Phase 2: this file (complete)
 * Phase 3: polygon draw with client-side point-in-polygon filtering (this update)
 *
 * Polygon filtering architecture — client-side with Turf.js:
 *   1. User draws polygon with Mapbox Draw
 *   2. draw.create fires → store polygon in state + ref
 *   3. useMemo recomputes displayedListings (listings filtered by polygon)
 *   4. useEffect syncs map markers with displayedListings
 *   5. fetchForViewport still runs on moveend — useMemo re-applies filter automatically
 *
 * Why client-side rather than server-side?
 *   H2 (and PostgreSQL without PostGIS) can't do polygon queries at the db layer.
 *   Server-side would require: bbox query → all results → JTS in-memory filter →
 *   re-paginate. That's identical work to what useMemo does here, just over the
 *   network. Client-side is simpler and equally fast at our data scale.
 *   When PostGIS arrives, server-side becomes worthwhile; the UI stays the same.
 *
 * Polygon state persists across pans: draw a polygon, pan away, results update
 * as listings enter/leave the viewport but the polygon filter stays active.
 * This lets buyers say "show me everything in this neighborhood, even if I need
 * to pan around to see details." The area is kept in the page URL (`area=`, see
 * lib/search-area.ts), so it survives reloads, Back from a listing, and shared links.
 *
 * Touch: Mapbox Draw's touchend handler always calls preventDefault(), which swallows
 * the taps Mapbox turns into clicks — with Draw attached, tapping a listing dot did
 * nothing on phones. So Draw is attached only while the visitor is drawing; once the
 * shape is finished it's rendered by our own "drawn-area" layers and Draw is removed.
 * Tilt and rotate gestures are disabled: for browsing homes they only disorient, and
 * two-finger vertical drags would tilt instead of pan.
 *
 * Search criteria: this is the site's single search page (/search). Filters live in
 * FilterDrawer; applying them refetches the current viewport, and every fetch (pan, zoom,
 * apply) sends the active filters and mirrors them into the page URL so a search can be
 * bookmarked or shared. Each fetch is capped at 200 and asks for the listings nearest
 * the view's center (sortBy=nearest); the visitor's chosen sort orders them here.
 */
import {
  formatPrice,
  formatBathTotal,
  formatSqft,
  listingPath,
  mlsNumber,
  displayAddress,
} from "../lib/listing-utils";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { ListingSummary, Page, PlaceSuggestion } from "../types/listing";
import FilterDrawer from "./search/FilterDrawer";
import ListingPreview from "./search/ListingPreview";
import SearchBox from "./search/SearchBox";
import { saveLastSearchUrl } from "../lib/search-return";
import { parsePhotoIds, photoUrl } from "../lib/photo-utils";
import {
  applyFiltersToParams,
  countActiveFilters,
  MAP_API_SORT,
  sortListings,
  type SearchFilters,
} from "../lib/search-filters";
import { setAreaParam, type SearchArea } from "../lib/search-area";
import { track, trackFilters } from "../lib/analytics";
import { auditHeaders } from "../lib/audit-session";
// CSS for both libraries is imported in search.astro — not here.

// ─── Types ────────────────────────────────────────────────────────────────────

interface Bbox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

interface Props {
  initialListings?: ListingSummary[];
  /** Total matches in the initial viewport (can exceed initialListings, which is capped). */
  initialTotal?: number;
  initialBbox: Bbox;
  /** Filters from the page URL, already applied to initialListings by the server. */
  initialFilters: SearchFilters;
  /** Hand-drawn area from the page URL (`area=`), or null. */
  initialArea?: SearchArea | null;
  apiBaseUrl: string;
  mapboxToken: string;
  /** Cloudflare Images account hash, for listing photos in the preview card and list. */
  photoAccountHash?: string;
}

/**
 * GeoJSON properties stored on each map marker. Only the listing id: a tapped pin is
 * looked up in the current listings, and the preview card renders from that summary.
 */
interface MarkerProperties {
  id: string;
}

/**
 * Shape of the payload MapboxDraw attaches to draw.create / draw.update events.
 * Used only inside the onDrawPolygon / onDrawModeChange helpers below — never
 * referenced directly in component code.
 */
interface DrawEvent {
  features: GeoJSON.Feature<GeoJSON.Polygon>[];
  mode?: string;
}

// ─── GeoJSON helpers ──────────────────────────────────────────────────────────

function listingsToGeoJSON(listings: ListingSummary[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: listings
      .filter((l) => l.latitude != null && l.longitude != null)
      .map((l) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [l.longitude!, l.latitude!],
        },
        properties: { id: String(l.id) } satisfies MarkerProperties,
      })),
  };
}

// ─── Base map tint ────────────────────────────────────────────────────────────

/**
 * Soft colors for the base map's water, green space and civic land. The "light" style
 * paints all of these gray; the data is already in the tiles, so tinting is a style
 * change only (no extra requests, no extra cost). Kept pale so the blue listing pins
 * stay the strongest color on the map.
 */
const BASE_MAP_TINT = {
  water: "#bcd6ec",
  park: "#d5e8c6", // parks, grass, sports fields, national/state parks
  wood: "#c8dfb6",
  school: "#ecdcc2",
  cemetery: "#dfe6d6",
};

/** Applies BASE_MAP_TINT to Mapbox's light-v11 style. Call once the style has loaded. */
function tintBaseMap(map: mapboxgl.Map): void {
  const t = BASE_MAP_TINT;
  map.setPaintProperty("water", "fill-color", t.water);
  map.setPaintProperty("waterway", "line-color", t.water);
  map.setPaintProperty("national-park", "fill-color", t.park);
  // "landuse" colors by class; anything not listed keeps the style's own gray.
  map.setPaintProperty("landuse", "fill-color", [
    "match",
    ["get", "class"],
    ["park", "grass", "pitch"],
    t.park,
    "wood",
    t.wood,
    map.getPaintProperty("landuse", "fill-color"),
  ]);
  // The light style doesn't draw schools or cemeteries at all. Add them in a layer of our
  // own, beneath "landuse" so sports fields still show on school grounds. (Hospitals are
  // left out on purpose: buyers rarely ask, and fewer colors keep the pins prominent.)
  map.addLayer(
    {
      id: "landuse-civic",
      type: "fill",
      source: "composite",
      "source-layer": "landuse",
      filter: ["match", ["get", "class"], ["school", "cemetery"], true, false],
      paint: {
        "fill-color": ["match", ["get", "class"], "school", t.school, t.cemetery],
      },
    },
    "landuse",
  );
}

// ─── Point-in-polygon helper ──────────────────────────────────────────────────

/**
 * Returns true if listing coordinates fall inside the GeoJSON polygon.
 * Wrapped in try/catch — Turf throws on malformed geometry, which can happen
 * mid-draw if an event fires with an incomplete polygon.
 */
/** Where a Mapbox popup attaches to its point ("bottom" = the card sits above the pin). */
type PopupAnchor = NonNullable<mapboxgl.PopupOptions["anchor"]>;

/** Space between the pin and the preview card, px. */
const POPUP_GAP = 14;
/** Height of Mapbox's popup tip (the little arrow), which sits between pin and card, px. */
const POPUP_TIP = 10;
/** Breathing room kept between the card and the map's edges, px. */
const POPUP_MARGIN = 8;
/** Space the card keeps clear at the top of the map: the search box lives there, px. */
const POPUP_TOP_CLEARANCE = 64;

/**
 * Picks where the desktop preview card goes so all of it stays on the map, in order of
 * preference: above the pin, below it, beside it (centered, then shifted down or up), on
 * the side with more room first. Above/below shift sideways near the map's left/right
 * edge. If nothing fits (a very short map), the position that hides the least wins, with
 * `pan`: how far to pan the map (px, for `map.panBy`) so that it does.
 *
 * @param width - the rendered card's size, px (0 before it has rendered)
 */
function popupAnchor(
  map: mapboxgl.Map,
  lngLat: [number, number],
  width: number,
  height: number,
): { anchor: PopupAnchor; pan: [number, number] } {
  const { x, y } = map.project(lngLat);
  const mapWidth = map.getContainer().clientWidth;
  const mapHeight = map.getContainer().clientHeight;
  const g = POPUP_GAP + POPUP_TIP; // pin-to-card distance (a little less at corners)
  const [w, h] = [width, height];

  // Above/below: centered on the pin unless that crosses a side edge.
  const horizontal =
    x - w / 2 < POPUP_MARGIN ? "-left" : x + w / 2 > mapWidth - POPUP_MARGIN ? "-right" : "";
  const shift = horizontal === "-left" ? 0 : horizontal === "-right" ? -w : -w / 2;
  // Beside: the side with more room first ("left" anchor = card to the right of the pin).
  const sides: ("left" | "right")[] = mapWidth - x >= x ? ["left", "right"] : ["right", "left"];
  const sideLeft = (side: "left" | "right") => (side === "left" ? x + g : x - g - w);

  // [anchor, card's left, card's top] in map pixels, best first.
  const candidates: [PopupAnchor, number, number][] = [
    [`bottom${horizontal}` as PopupAnchor, x + shift, y - g - h],
    [`top${horizontal}` as PopupAnchor, x + shift, y + g],
    ...sides.flatMap((side): [PopupAnchor, number, number][] => [
      [side, sideLeft(side), y - h / 2],
      [`top-${side}`, sideLeft(side), y + g],
      [`bottom-${side}`, sideLeft(side), y - g - h],
    ]),
  ];
  // How far the card would have to move to sit inside the usable area ([0, 0] = fits).
  const overflow = ([, left, top]: [PopupAnchor, number, number]): [number, number] => [
    Math.max(0, left + w - (mapWidth - POPUP_MARGIN)) - Math.max(0, POPUP_MARGIN - left),
    Math.max(0, top + h - (mapHeight - POPUP_MARGIN)) - Math.max(0, POPUP_TOP_CLEARANCE - top),
  ];
  const hidden = (c: [PopupAnchor, number, number]) =>
    Math.abs(overflow(c)[0]) + Math.abs(overflow(c)[1]);
  const fitting = candidates.find((c) => hidden(c) === 0);
  if (fitting) return { anchor: fitting[0], pan: [0, 0] };
  const best = candidates.reduce((a, c) => (hidden(c) < hidden(a) ? c : a));
  return { anchor: best[0], pan: overflow(best) };
}

/** Listings per fetch: the 200 nearest the view's center, or up to 1,000 in a drawn area. */
const VIEW_FETCH_SIZE = 200;
const AREA_FETCH_SIZE = 1000;

interface Box {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** The map view as a plain box. */
function boundsBox(b: mapboxgl.LngLatBounds): Box {
  return { minLat: b.getSouth(), maxLat: b.getNorth(), minLng: b.getWest(), maxLng: b.getEast() };
}

/** The bounding box of a drawn area (its outer ring). */
function areaBounds(area: SearchArea): Box {
  const ring = area.geometry.coordinates[0] ?? [];
  const lngs = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

function listingInPolygon(
  listing: ListingSummary,
  polygon: GeoJSON.Feature<GeoJSON.Polygon>,
): boolean {
  if (listing.latitude == null || listing.longitude == null) return false;
  try {
    return booleanPointInPolygon(
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [listing.longitude, listing.latitude] },
        properties: {},
      },
      polygon,
    );
  } catch {
    return false;
  }
}

// ─── Draw event helpers ───────────────────────────────────────────────────────

/**
 * Registers a typed handler for MapboxDraw polygon events (create / update).
 *
 * Why this exists: mapbox-gl's MapEvents is a `type` alias, not an `interface`,
 * so module augmentation is impossible — there is no way to teach the map's
 * type system about draw events without patching the library itself. This
 * function is the single cast site. All component code calls it with clean types.
 */
function onDrawPolygon(
  map: mapboxgl.Map,
  type: "draw.create" | "draw.update",
  handler: (polygon: GeoJSON.Feature<GeoJSON.Polygon>) => void,
): void {
  map.on(type as string, (e: unknown) => {
    const feature = (e as DrawEvent).features?.[0];
    if (feature) handler(feature);
  });
}

/** Same boundary isolation for draw.modechange events. */
function onDrawModeChange(map: mapboxgl.Map, handler: (mode: string) => void): void {
  map.on("draw.modechange" as string, (e: unknown) => {
    handler((e as DrawEvent).mode ?? "");
  });
}

// ─── Sidebar card ─────────────────────────────────────────────────────────────

interface SidebarCardProps {
  listing: ListingSummary;
  isSelected: boolean;
  onClick: () => void;
  /** Cloudflare account hash; with it, listings that have photos show a thumbnail. */
  photoAccountHash?: string;
}

function SidebarCard({ listing, isSelected, onClick, photoAccountHash }: SidebarCardProps) {
  const firstPhotoId = parsePhotoIds(listing.photoIds)[0];
  const thumb = firstPhotoId ? photoUrl(photoAccountHash, firstPhotoId, "card") : "";
  const gradients = [
    "from-slate-400 to-slate-600",
    "from-blue-400 to-blue-700",
    "from-emerald-400 to-emerald-700",
    "from-amber-400 to-amber-700",
    "from-purple-400 to-purple-700",
    "from-rose-400 to-rose-700",
  ];
  const gradient = gradients[listing.id % gradients.length];

  // A real link to the listing (crawlable; Ctrl/Cmd/middle-click opens it in a new tab).
  // A plain click previews it on the map instead.
  return (
    <a
      href={listingPath(listing)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onClick();
      }}
      className={`flex gap-3 p-3 rounded-lg mb-2 cursor-pointer border transition-colors
        ${
          isSelected
            ? "border-blue-500 bg-blue-50"
            : "border-stone-100 hover:border-stone-300 hover:bg-stone-50"
        }`}
    >
      {thumb ? (
        <img
          src={thumb}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-16 h-16 rounded shrink-0 object-cover bg-slate-100"
        />
      ) : (
        <div
          className={`w-16 h-16 rounded shrink-0 bg-gradient-to-br ${gradient} flex items-center justify-center`}
        >
          <svg
            className="h-6 w-6 text-white/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-slate-900 text-sm">{formatPrice(listing.listPrice)}</div>
        <div className="text-xs text-slate-700 truncate mt-0.5">{displayAddress(listing)}</div>
        <div className="text-xs text-slate-500">{listing.city}, MN</div>
        <div className="text-xs text-slate-600 mt-1">
          {listing.beds ?? "—"} bd &nbsp;·&nbsp; {formatBathTotal(listing)} ba &nbsp;·&nbsp;{" "}
          {formatSqft(listing.sqftTotal)} sqft
        </div>
      </div>
    </a>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MapSearch({
  initialListings = [],
  initialTotal = 0,
  initialBbox,
  initialFilters,
  initialArea = null,
  apiBaseUrl,
  mapboxToken,
  photoAccountHash,
}: Props) {
  // Refs typed to their concrete DOM/library types so method calls type-check.
  // `| null` because useRef starts null and the map is created asynchronously.
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const debounceRef = useRef<number | null>(null);
  // Captured once in the load handler so all subsequent .setData() and
  // .getClusterExpansionZoom() calls are fully typed — no per-call cast needed.
  const sourceRef = useRef<mapboxgl.GeoJSONSource | null>(null);

  // Keep polygon in a ref so the moveend closure always sees the latest value
  // without needing to re-register the event listener on each state change.
  const activePolygonRef = useRef<SearchArea | null>(initialArea);

  const [listings, setListings] = useState<ListingSummary[]>(initialListings);
  // How many listings match the viewport in total. Each fetch returns at most 200, so when
  // zoomed out this is larger than listings.length and the header says to zoom in.
  const [totalInView, setTotalInView] = useState<number>(initialTotal);
  // Latest listings for map event handlers, which are registered once at load.
  const listingsRef = useRef<ListingSummary[]>(initialListings);
  useEffect(() => {
    listingsRef.current = listings;
  }, [listings]);
  // Listing shown in the preview card (null = no card). Kept as the object, so the card
  // stays put even if a refetch drops that listing from the current results.
  const [preview, setPreview] = useState<ListingSummary | null>(null);

  // Desktop (lg+) shows the preview on the pin, in a Mapbox popup whose content is the
  // ListingPreview React component (rendered via a portal into popupContainer).
  // Phones/tablets show it as a sheet along the bottom of the map instead.
  const [isDesktop, setIsDesktop] = useState<boolean>(false);
  const [popupContainer, setPopupContainer] = useState<HTMLDivElement | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    setPopupContainer(document.createElement("div"));
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activePolygon, setActivePolygon] = useState<SearchArea | null>(initialArea);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  // Touch devices get tap-based drawing instructions. Set after mount (no window in SSR).
  const [isTouch, setIsTouch] = useState<boolean>(false);
  useEffect(() => setIsTouch(window.matchMedia("(pointer: coarse)").matches), []);
  // Typed handle on our own source that renders the finished drawn polygon.
  const drawnSourceRef = useRef<mapboxgl.GeoJSONSource | null>(null);

  // Search criteria. The ref lets the moveend closure (registered once) read the latest.
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const filtersRef = useRef<SearchFilters>(initialFilters);
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);
  const activeFilterCount = countActiveFilters(filters);

  // ── Derived listing set ────────────────────────────────────────────────────
  // When a polygon is active, filter listings to those inside it.
  // useMemo recalculates automatically whenever listings or activePolygon changes,
  // so the sidebar and map markers stay in sync without manual coordination.
  // The API returns the listings nearest the view's center; order them by the visitor's sort.
  const displayedListings = useMemo<ListingSummary[]>(() => {
    const inArea = activePolygon
      ? listings.filter((l) => listingInPolygon(l, activePolygon))
      : listings;
    return sortListings(inArea, filters.sortBy);
  }, [listings, activePolygon, filters.sortBy]);

  // ── Sync map markers with displayedListings ────────────────────────────────
  // Fires whenever displayedListings changes — covers both viewport fetches
  // (listings state updates) and polygon draw/clear (activePolygon changes).
  // The ref hands the latest set to the map's load handler, which may run after this
  // effect (e.g. with a drawn area restored from the URL).
  const displayedListingsRef = useRef<ListingSummary[]>(displayedListings);
  useEffect(() => {
    displayedListingsRef.current = displayedListings;
    sourceRef.current?.setData(listingsToGeoJSON(displayedListings));
  }, [displayedListings]);

  // ── Fetch listings for current viewport ───────────────────────────────────
  // Only the newest request may update the map: each fetch aborts the one before it, so a
  // slow response for an old view can't replace pins for the current one.
  const fetchAbortRef = useRef<AbortController | null>(null);
  // "Show more" in a drawn area: the next page of the same query.
  const areaPageRef = useRef<number>(0);
  const fetchForViewport = useCallback(
    async (bounds: mapboxgl.LngLatBounds, page = 0): Promise<void> => {
      fetchAbortRef.current?.abort();
      const controller = new AbortController();
      fetchAbortRef.current = controller;
      setIsLoading(true);
      try {
        // With a drawn area, search the area's own bounds (up to 1,000, then "Show more")
        // instead of the 200 nearest the view's center, so a large area isn't cut short.
        const area = activePolygonRef.current;
        const q = area ? areaBounds(area) : boundsBox(bounds);
        const url = new URL(`${apiBaseUrl}/api/listings/search`);
        url.searchParams.set("minLat", q.minLat.toFixed(5));
        url.searchParams.set("maxLat", q.maxLat.toFixed(5));
        url.searchParams.set("minLng", q.minLng.toFixed(5));
        url.searchParams.set("maxLng", q.maxLng.toFixed(5));
        applyFiltersToParams(filtersRef.current, url.searchParams);
        url.searchParams.set("sortBy", MAP_API_SORT); // the chosen sort is applied above
        url.searchParams.set("size", String(area ? AREA_FETCH_SIZE : VIEW_FETCH_SIZE));
        if (page > 0) url.searchParams.set("page", String(page));
        url.searchParams.set("view", "summary"); // ~20 fields per listing, not ~150

        // Keep the URL shareable: viewport + filters + drawn area.
        const pageUrl = new URL(window.location.href);
        applyFiltersToParams(filtersRef.current, pageUrl.searchParams);
        setAreaParam(pageUrl.searchParams, activePolygonRef.current);
        pageUrl.searchParams.set("minLat", bounds.getSouth().toFixed(4));
        pageUrl.searchParams.set("maxLat", bounds.getNorth().toFixed(4));
        pageUrl.searchParams.set("minLng", bounds.getWest().toFixed(4));
        pageUrl.searchParams.set("maxLng", bounds.getEast().toFixed(4));
        window.history.replaceState({}, "", pageUrl);
        // Remember this search so listing pages can offer "Back to map" to it.
        saveLastSearchUrl(pageUrl.pathname + pageUrl.search);

        const res = await fetch(url.toString(), {
          signal: controller.signal,
          headers: auditHeaders(), // ties the API's audit line to this visit (§5.9(b))
        });
        if (!res.ok) return;
        const data = (await res.json()) as Page<ListingSummary>;

        // setListings triggers useMemo → displayedListings recomputes →
        // useEffect above syncs map markers. No manual source.setData needed here.
        areaPageRef.current = page;
        setListings((prev) => (page > 0 ? [...prev, ...data.content] : data.content));
        setTotalInView(data.page.totalElements);
      } catch {
        // Aborted (a newer request took over) or a network error: the next moveend retries.
      } finally {
        if (fetchAbortRef.current === controller) setIsLoading(false);
      }
    },
    [apiBaseUrl],
  );

  // A drawn area holds more listings than one fetch returned: load the next page.
  const showMoreInArea = useCallback((): void => {
    if (mapRef.current) fetchForViewport(mapRef.current.getBounds()!, areaPageRef.current + 1);
  }, [fetchForViewport]);

  // ── Draw handlers ──────────────────────────────────────────────────────────

  // Draw is only attached for the duration of a drawing session (see header comment).
  const detachDraw = useCallback((): void => {
    const map = mapRef.current;
    if (map && drawRef.current) map.removeControl(drawRef.current);
    drawRef.current = null;
  }, []);

  const startDraw = useCallback((): void => {
    const map = mapRef.current;
    if (!map) return;
    activePolygonRef.current = null;
    setActivePolygon(null);
    if (!drawRef.current) {
      // displayControlsDefault: false — we provide our own button, not Draw's toolbar.
      drawRef.current = new MapboxDraw({
        displayControlsDefault: false,
        defaultMode: "simple_select",
      });
      map.addControl(drawRef.current);
    }
    drawRef.current.changeMode("draw_polygon");
    setIsDrawing(true);
    track("map_draw", { action: "start" });
  }, []);

  const cancelDraw = useCallback((): void => {
    detachDraw();
    setIsDrawing(false);
  }, [detachDraw]);

  const clearPolygon = useCallback((): void => {
    detachDraw();
    activePolygonRef.current = null;
    setActivePolygon(null);
    setIsDrawing(false);
    track("map_draw", { action: "clear" });
    // Back to the 200 nearest the view's center.
    if (mapRef.current) fetchForViewport(mapRef.current.getBounds()!);
  }, [detachDraw, fetchForViewport]);

  // Render the finished polygon with our own layers (Draw is gone by then), and mirror it
  // into the page URL and the saved "Back to map" search.
  useEffect(() => {
    drawnSourceRef.current?.setData({
      type: "FeatureCollection",
      features: activePolygon ? [activePolygon] : [],
    });
    const pageUrl = new URL(window.location.href);
    setAreaParam(pageUrl.searchParams, activePolygon);
    window.history.replaceState({}, "", pageUrl);
    saveLastSearchUrl(pageUrl.pathname + pageUrl.search);
  }, [activePolygon]);

  // ── Map initialization (once on mount) ────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapboxToken) {
      console.warn("[MapSearch] PUBLIC_MAPBOX_TOKEN is not set.");
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      bounds: [
        [initialBbox.minLng, initialBbox.minLat],
        [initialBbox.maxLng, initialBbox.maxLat],
      ],
      fitBoundsOptions: { padding: 40 },
      // Flat, north-up map: no rotate or tilt (by mouse or touch).
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    map.touchZoomRotate.disableRotation(); // pinch still zooms; twisting no longer rotates

    mapRef.current = map;

    // Zoom buttons (top-right); no compass since the map can't rotate.
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    // ── Mapbox Draw events ───────────────────────────────────────────────────
    // Draw itself is attached in startDraw(); these listeners fire only while it is.
    onDrawPolygon(map, "draw.create", (polygon) => {
      activePolygonRef.current = polygon;
      setActivePolygon(polygon);
      track("map_draw", { action: "complete" });
      fetchForViewport(map.getBounds()!); // search the whole area, not just the view
    });

    // Draw returns to simple_select when a shape is finished or the visitor presses
    // Escape. Either way the session is over: detach Draw (after Draw finishes handling
    // its own event) so taps reach the map again.
    onDrawModeChange(map, (mode) => {
      if (mode !== "simple_select") return;
      setIsDrawing(false);
      window.setTimeout(() => {
        if (drawRef.current) map.removeControl(drawRef.current);
        drawRef.current = null;
      }, 0);
    });

    map.on("load", () => {
      tintBaseMap(map);
      // A drawn area restored from the URL: the server-rendered results are the 200 nearest
      // the view's center, so fetch the area itself.
      if (activePolygonRef.current) fetchForViewport(map.getBounds()!);

      // Finished drawn area, below the listing layers.
      map.addSource("drawn-area", {
        type: "geojson",
        // A restored area (from the URL) is drawn as soon as the map loads.
        data: {
          type: "FeatureCollection",
          features: activePolygonRef.current ? [activePolygonRef.current] : [],
        },
      });
      drawnSourceRef.current = map.getSource("drawn-area") as mapboxgl.GeoJSONSource;
      map.addLayer({
        id: "drawn-area-fill",
        type: "fill",
        source: "drawn-area",
        paint: { "fill-color": "#2563eb", "fill-opacity": 0.08 },
      });
      map.addLayer({
        id: "drawn-area-line",
        type: "line",
        source: "drawn-area",
        paint: { "line-color": "#2563eb", "line-width": 2, "line-dasharray": [2, 1] },
      });

      map.addSource("listings", {
        type: "geojson",
        data: listingsToGeoJSON(displayedListingsRef.current),
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 14,
      });
      // Capture the typed source once. getSource() returns AnySourceImpl;
      // this is the only cast in the file that touches GeoJSONSource.
      sourceRef.current = map.getSource("listings") as mapboxgl.GeoJSONSource;

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "listings",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#3b82f6", 5, "#1d4ed8", 20, "#1e3a8a"],
          "circle-radius": ["step", ["get", "point_count"], 18, 5, 24, 20, 32],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "listings",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
      });

      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "listings",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#2563eb",
          "circle-radius": 8,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "unclustered-hit",
        // Invisible 22px ring around each 8px dot: an easy target for a fingertip.
        type: "circle",
        source: "listings",
        filter: ["!", ["has", "point_count"]],
        paint: { "circle-radius": 22, "circle-color": "#000000", "circle-opacity": 0 },
      });

      map.addLayer({
        id: "selected-point",
        type: "circle",
        source: "listings",
        filter: ["==", ["get", "id"], ""],
        paint: {
          "circle-color": "#dc2626",
          "circle-radius": 11,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Tap a cluster → zoom into it (ignored while drawing, when taps place points).
      map.on("click", "clusters", (e) => {
        if (drawRef.current) return;
        const [feature] = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        // Clusters are points; checking narrows the geometry type (and skips a missed tap).
        if (!sourceRef.current || feature?.geometry.type !== "Point") return;
        const [lng, lat] = feature.geometry.coordinates;
        sourceRef.current.getClusterExpansionZoom(
          feature.properties!["cluster_id"] as number,
          (err, zoom) => {
            if (!err && zoom != null) map.easeTo({ center: [lng, lat], zoom });
          },
        );
      });

      // Tap a pin → preview card (ignored while drawing, when taps place points).
      map.on("click", "unclustered-hit", (e) => {
        if (drawRef.current) return;
        const id = (e.features?.[0]?.properties as MarkerProperties | undefined)?.id;
        const listing = listingsRef.current.find((l) => String(l.id) === id);
        if (!listing) return;
        setPreview(listing);
        setSelectedId(listing.id);
        map.setFilter("selected-point", ["==", ["get", "id"], String(listing.id)]);
        track("listing_preview_open", {
          listing_id: mlsNumber(listing) ?? String(listing.id),
          source: "pin",
        });
      });

      // Tap empty map → close the preview.
      map.on("click", (e) => {
        if (drawRef.current) return;
        const hit = map.queryRenderedFeatures(e.point, { layers: ["unclustered-hit", "clusters"] });
        if (hit.length === 0) {
          setPreview(null);
          map.setFilter("selected-point", ["==", ["get", "id"], ""]);
        }
      });

      const setCursor = (c: string) => () => {
        map.getCanvas().style.cursor = c;
      };
      map.on("mouseenter", "clusters", setCursor("pointer"));
      map.on("mouseleave", "clusters", setCursor(""));
      map.on("mouseenter", "unclustered-hit", setCursor("pointer"));
      map.on("mouseleave", "unclustered-hit", setCursor(""));
    });

    // Debounced viewport change → fetch new listings
    map.on("moveend", () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        fetchForViewport(map.getBounds()!);
      }, 400);
    });

    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
      map.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Remember the search as first loaded, too (the URL already holds its state).
  useEffect(() => saveLastSearchUrl(window.location.pathname + window.location.search), []);

  // Coming back from a listing (browser Back or "Back to map", which uses history.back())
  // can restore this page from the back/forward cache: a frozen snapshot, not a reload.
  // Mobile browsers may tear down the map's WebGL context or workers while it's frozen,
  // leaving a map that pans but never redraws its pins. Reload instead; the URL already
  // holds the viewport, filters and drawn area, so the visitor lands on the same search.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => e.persisted && window.location.reload();
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // ── Apply new search criteria → refetch the current viewport ──────────────
  const applyFilters = useCallback(
    (next: SearchFilters): void => {
      filtersRef.current = next;
      setFilters(next);
      trackFilters(next);
      // Phones/tablets: close so the updated map is visible. Desktop has room to keep the
      // drawer open beside the map for further tweaking.
      if (window.matchMedia("(max-width: 1023px)").matches) setFiltersOpen(false);
      if (mapRef.current) fetchForViewport(mapRef.current.getBounds()!);
    },
    [fetchForViewport],
  );
  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  const openFilters = useCallback(() => {
    setFiltersOpen(true);
    track("filters_open", {});
  }, []);

  // Keep the anchored popup in step with the preview (desktop only). We pick the anchor
  // ourselves (popupAnchor) instead of Mapbox's auto-anchor: Mapbox measures the popup
  // before React has rendered the card into it, so on short screens it chose "below the
  // pin" and the card ran off the bottom of the map. Re-placed when the card's size
  // changes and after the map moves; changing the anchor means recreating the popup.
  const placePopup = useCallback(
    (allowPan: boolean = false) => {
      const map = mapRef.current;
      const container = popupContainer;
      const listing = previewRef.current;
      if (!map || !container || !listing || listing.latitude == null || listing.longitude == null) {
        popupRef.current?.remove();
        return;
      }
      const lngLat: [number, number] = [listing.longitude, listing.latitude];
      // A card that's off the map (between popups) measures 0: use its last real size.
      if (container.offsetHeight > 0) {
        popupSizeRef.current = [container.offsetWidth, container.offsetHeight];
      }
      const [width, height] = popupSizeRef.current;
      const { anchor, pan } = popupAnchor(map, lngLat, width, height);
      if (popupRef.current && popupAnchorRef.current !== anchor) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (!popupRef.current) {
        popupRef.current = new mapboxgl.Popup({
          closeButton: false, // the card has its own
          closeOnClick: false, // MapSearch's map click handler decides
          maxWidth: "none",
          offset: POPUP_GAP,
          anchor,
          className: "listing-preview-popup",
        }).setDOMContent(container);
        popupAnchorRef.current = anchor;
      }
      popupRef.current.setLngLat(lngLat).addTo(map);
      // A short map where no position fits: nudge the map so the card does. Only when the
      // card opens or resizes, so it never fights the visitor dragging the map.
      if (allowPan && (pan[0] !== 0 || pan[1] !== 0) && height > 0) {
        map.panBy(pan, { duration: 300 });
      }
    },
    [popupContainer],
  );

  const popupAnchorRef = useRef<PopupAnchor | null>(null);
  const popupSizeRef = useRef<[number, number]>([0, 0]);
  const previewRef = useRef<ListingSummary | null>(null);
  useEffect(() => {
    previewRef.current = isDesktop ? preview : null;
    placePopup(true);
  }, [preview, isDesktop, placePopup]);

  // The card's height settles after React renders it (and its photo box lays out).
  useEffect(() => {
    if (!popupContainer) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.height > 0) placePopup(true); // 0 = between popups
    });
    observer.observe(popupContainer);
    return () => observer.disconnect();
  }, [popupContainer, placePopup]);

  // After a pan/zoom the pin may sit somewhere else on screen.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onMoveEnd = () => placePopup();
    map.on("moveend", onMoveEnd);
    return () => void map.off("moveend", onMoveEnd);
  }, [placePopup]);
  useEffect(() => () => void popupRef.current?.remove(), []);

  // ── Search box picks ───────────────────────────────────────────────────────
  // A city or ZIP: frame its listings (the move triggers the usual refetch).
  const goToPlace = useCallback((place: PlaceSuggestion): void => {
    setPreview(null);
    mapRef.current?.fitBounds(
      [
        [place.minLng, place.minLat],
        [place.maxLng, place.maxLat],
      ],
      { padding: 60, maxZoom: 14 },
    );
  }, []);

  // A listing: fly to it and open its preview (it may not be in the current results yet).
  const goToListing = useCallback((listing: ListingSummary): void => {
    const map = mapRef.current;
    if (!map || listing.latitude == null || listing.longitude == null) return;
    setPreview(listing);
    setSelectedId(listing.id);
    map.setFilter("selected-point", ["==", ["get", "id"], String(listing.id)]);
    track("listing_preview_open", {
      listing_id: mlsNumber(listing) ?? String(listing.id),
      source: "search",
    });
    map.flyTo({ center: [listing.longitude, listing.latitude], zoom: Math.max(map.getZoom(), 15) });
  }, []);

  const closePreview = useCallback((): void => {
    setPreview(null);
    mapRef.current?.setFilter("selected-point", ["==", ["get", "id"], ""]);
  }, []);

  // ── Sidebar card click → pan + highlight + preview ────────────────────────
  const handleSidebarClick = useCallback((listing: ListingSummary): void => {
    if (!mapRef.current || listing.latitude == null) return;
    setSelectedId(listing.id);
    setPreview(listing);
    track("listing_preview_open", {
      listing_id: mlsNumber(listing) ?? String(listing.id),
      source: "list",
    });
    mapRef.current.setFilter("selected-point", ["==", ["get", "id"], String(listing.id)]);
    mapRef.current.flyTo({
      center: [listing.longitude!, listing.latitude],
      zoom: Math.max(mapRef.current.getZoom(), 14),
      speed: 1.2,
    });
    // Below lg the map sits above the list, so bring it back into view to show the pan.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      mapContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!mapboxToken) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="bg-white border border-red-200 rounded-lg p-8 max-w-md text-center shadow">
          <div className="text-red-600 font-semibold mb-2">Mapbox token missing</div>
          <p className="text-sm text-slate-600">
            Add <code className="bg-slate-100 px-1 rounded">PUBLIC_MAPBOX_TOKEN=pk.your-token</code>{" "}
            to <code className="bg-slate-100 px-1 rounded">sawicki-group-web/.env.local</code> and
            restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  // Layout: below lg (1024px) the map comes first at 60% of the screen height and the
  // listings follow underneath in normal page scroll — people search by browsing pins.
  // From lg up: listings sidebar on the left, map filling the rest of the viewport.
  return (
    <div className="relative flex flex-col lg:flex-row lg:h-[calc(100vh-5rem)]">
      <FilterDrawer
        open={filtersOpen}
        activeCount={activeFilterCount}
        onOpen={openFilters}
        filters={filters}
        onApply={applyFilters}
        onClose={closeFilters}
      />

      {/* ── Sidebar (below the map on small screens) ─────────────────────── */}
      <div className="order-2 lg:order-1 w-full lg:w-96 lg:flex-shrink-0 flex flex-col border-t lg:border-t-0 lg:border-r border-stone-200 bg-white">
        <div className="flex-shrink-0 px-4 py-3 border-b border-stone-100">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              {isLoading
                ? "Searching…"
                : activePolygon
                  ? `${displayedListings.length} in drawn area`
                  : totalInView > listings.length
                    ? `Showing ${listings.length} of ${totalInView}`
                    : `${listings.length} listing${listings.length !== 1 ? "s" : ""} in view`}
            </span>
            {!isLoading && !activePolygon && totalInView > listings.length && (
              <span className="text-xs text-slate-500">Zoom in to see all</span>
            )}
          </div>
        </div>

        <div className="lg:flex-1 lg:overflow-y-auto px-3 py-3">
          {displayedListings.length === 0 && !isLoading && (
            <div className="text-center py-12 text-sm text-slate-500">
              {activePolygon
                ? "No listings inside the drawn area. Try redrawing a larger shape."
                : activeFilterCount > 0
                  ? "No listings here match your filters. Pan the map or loosen the filters."
                  : "No listings in this area. Pan the map to explore."}
            </div>
          )}
          {displayedListings.map((listing) => (
            <SidebarCard
              key={listing.id}
              listing={listing}
              isSelected={selectedId === listing.id}
              onClick={() => handleSidebarClick(listing)}
              photoAccountHash={photoAccountHash}
            />
          ))}
          {/* ── Show more (drawn area holding more than one fetch) ── */}
          {activePolygon && totalInView > listings.length && (
            <button
              type="button"
              onClick={showMoreInArea}
              disabled={isLoading}
              className="w-full mt-2 py-3 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              {isLoading ? "Loading…" : "Show more in this area"}
            </button>
          )}
        </div>
      </div>

      {/* ── Map (first on small screens) ─────────────────────────────────── */}
      <div className="order-1 lg:order-2 relative h-[60vh] lg:h-auto lg:flex-1">
        <div ref={mapContainerRef} className="w-full h-full" />

        {preview && !isDesktop && (
          <ListingPreview listing={preview} accountHash={photoAccountHash} onClose={closePreview} />
        )}
        {preview &&
          isDesktop &&
          popupContainer &&
          createPortal(
            <ListingPreview
              listing={preview}
              accountHash={photoAccountHash}
              onClose={closePreview}
              placement="popup"
            />,
            popupContainer,
          )}

        {/* ── Search box — top-left, leaving room for the zoom buttons ─────── */}
        <div className="absolute top-3 left-3 right-14 lg:right-auto lg:w-96 z-20">
          <SearchBox
            apiBaseUrl={apiBaseUrl}
            status={filters.status}
            onSelectPlace={goToPlace}
            onSelectListing={goToListing}
          />
        </div>

        {/* ── Draw controls — below the search box ─────────────────────────── */}
        <div className="absolute top-16 left-3 z-10 flex flex-col items-start gap-1.5">
          {/* Three-state button: idle / drawing / polygon-active */}
          <button
            onClick={isDrawing ? cancelDraw : activePolygon ? clearPolygon : startDraw}
            className={`
              px-3 py-2 rounded text-sm font-medium shadow-md border
              transition-colors whitespace-nowrap
              ${
                isDrawing
                  ? "bg-red-500 text-white border-red-600 hover:bg-red-600"
                  : activePolygon
                    ? "bg-blue-600 text-white border-blue-700 hover:bg-blue-700"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }
            `}
          >
            {isDrawing ? "Cancel" : activePolygon ? "Clear Area" : "Draw Area"}
          </button>

          {/* Instruction pill — only visible while user is actively drawing */}
          {isDrawing && (
            <div className="bg-white/95 text-slate-600 text-xs px-2.5 py-1.5 rounded shadow border border-slate-200 leading-snug">
              {isTouch ? "Tap to place points." : "Click to place points."}
              <br />
              {isTouch ? "Tap the first point to finish." : "Double-click to finish."}
            </div>
          )}
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/90 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-full shadow">
            Updating…
          </div>
        )}
      </div>
    </div>
  );
}
