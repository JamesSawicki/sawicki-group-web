/**
 * MapSearch.jsx — Interactive map search island with polygon draw.
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
 * to pan around to see details."
 */
import { formatPrice, formatBathTotal, formatSqft } from "../lib/listing-utils";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
// CSS for both libraries is imported in map.astro — not here.

// ─── Formatting helpers ───────────────────────────────────────────────────────

// ─── GeoJSON helpers ──────────────────────────────────────────────────────────

function listingsToGeoJSON(listings) {
  return {
    type: "FeatureCollection",
    features: listings
      .filter(l => l.latitude != null && l.longitude != null)
      .map(l => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [l.longitude, l.latitude] },
        properties: {
          id:           String(l.id),
          address:      l.address,
          city:         l.city ?? "",
          listPrice:    l.listPrice ?? 0,
          beds:         l.beds ?? 0,
          baths:        formatBathTotal(l),
          sqftTotal:    l.sqftTotal ?? 0,
          priceDisplay: formatPrice(l.listPrice),
          sqftDisplay:  formatSqft(l.sqftTotal),
        },
      })),
  };
}

function buildPopupHTML(props) {
  return `
    <div style="min-width:220px;font-family:inherit;">
      <div style="font-size:1.1rem;font-weight:700;color:#0f172a;margin-bottom:.25rem">
        ${props.priceDisplay}
      </div>
      <div style="font-size:.875rem;color:#334155;margin-bottom:.125rem">${props.address}</div>
      <div style="font-size:.8rem;color:#64748b;margin-bottom:.5rem">${props.city}, MN</div>
      <div style="font-size:.8rem;color:#334155;margin-bottom:.75rem">
        ${props.beds} bd &nbsp;·&nbsp; ${props.baths} ba &nbsp;·&nbsp; ${props.sqftDisplay} sqft
      </div>
      <a href="/listings/${props.id}"
         style="display:inline-block;background:#1e40af;color:#fff;
                font-size:.8rem;padding:.375rem .875rem;
                border-radius:.375rem;text-decoration:none;">
        View Details
      </a>
    </div>
  `;
}

// ─── Point-in-polygon helper ──────────────────────────────────────────────────

/**
 * Returns true if listing coordinates fall inside the GeoJSON polygon.
 * Wrapped in try/catch — Turf throws on malformed geometry, which can happen
 * mid-draw if an event fires with an incomplete polygon.
 */
function listingInPolygon(listing, polygon) {
  if (listing.latitude == null || listing.longitude == null) return false;
  try {
    return booleanPointInPolygon(
      { type: "Feature", geometry: { type: "Point", coordinates: [listing.longitude, listing.latitude] } },
      polygon
    );
  } catch {
    return false;
  }
}

// ─── Sidebar card ─────────────────────────────────────────────────────────────

function SidebarCard({ listing, isSelected, onClick }) {
  const gradients = [
    "from-slate-400 to-slate-600",
    "from-blue-400 to-blue-700",
    "from-emerald-400 to-emerald-700",
    "from-amber-400 to-amber-700",
    "from-purple-400 to-purple-700",
    "from-rose-400 to-rose-700",
  ];
  const gradient = gradients[listing.id % gradients.length];

  return (
    <div
      onClick={onClick}
      className={`flex gap-3 p-3 rounded-lg mb-2 cursor-pointer border transition-colors
        ${isSelected
          ? "border-blue-500 bg-blue-50"
          : "border-stone-100 hover:border-stone-300 hover:bg-stone-50"}`}
    >
      <div className={`w-16 h-16 rounded shrink-0 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
        <svg className="h-6 w-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-slate-900 text-sm">{formatPrice(listing.listPrice)}</div>
        <div className="text-xs text-slate-700 truncate mt-0.5">{listing.address}</div>
        <div className="text-xs text-slate-500">{listing.city}, MN</div>
        <div className="text-xs text-slate-600 mt-1">
          {listing.beds ?? "—"} bd &nbsp;·&nbsp; {formatBathTotal(listing)} ba &nbsp;·&nbsp; {formatSqft(listing.sqftTotal)} sqft
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MapSearch({
  initialListings = [],
  initialBbox,
  initialStatus = "Active",
  apiBaseUrl,
  mapboxToken,
}) {
  const mapContainerRef  = useRef(null);
  const mapRef           = useRef(null);
  const drawRef          = useRef(null);
  const debounceRef      = useRef(null);
  const popupRef         = useRef(null);

  // Keep polygon in a ref so the moveend closure always sees the latest value
  // without needing to re-register the event listener on each state change.
  const activePolygonRef = useRef(null);

  const [listings,      setListings]      = useState(initialListings);
  const [selectedId,    setSelectedId]    = useState(null);
  const [isLoading,     setIsLoading]     = useState(false);
  const [activePolygon, setActivePolygon] = useState(null);
  const [isDrawing,     setIsDrawing]     = useState(false);

  // ── Derived listing set ────────────────────────────────────────────────────
  // When a polygon is active, filter listings to those inside it.
  // useMemo recalculates automatically whenever listings or activePolygon changes,
  // so the sidebar and map markers stay in sync without manual coordination.
  const displayedListings = useMemo(() => {
    if (!activePolygon) return listings;
    return listings.filter(l => listingInPolygon(l, activePolygon));
  }, [listings, activePolygon]);

  // ── Sync map markers with displayedListings ────────────────────────────────
  // Fires whenever displayedListings changes — covers both viewport fetches
  // (listings state updates) and polygon draw/clear (activePolygon changes).
  useEffect(() => {
    const source = mapRef.current?.getSource("listings");
    if (!source) return;
    source.setData(listingsToGeoJSON(displayedListings));
  }, [displayedListings]);

  // ── Fetch listings for current viewport ───────────────────────────────────
  const fetchForViewport = useCallback(async (bounds, status) => {
    setIsLoading(true);
    try {
      const url = new URL(`${apiBaseUrl}/api/listings/search`);
      url.searchParams.set("minLat", bounds.getSouth().toFixed(5));
      url.searchParams.set("maxLat", bounds.getNorth().toFixed(5));
      url.searchParams.set("minLng", bounds.getWest().toFixed(5));
      url.searchParams.set("maxLng", bounds.getEast().toFixed(5));
      url.searchParams.set("status", status);
      url.searchParams.set("size",   "200");

      // Keep URL shareable (bbox only — polygon is ephemeral client state)
      const pageUrl = new URL(window.location.href);
      pageUrl.searchParams.set("minLat", bounds.getSouth().toFixed(4));
      pageUrl.searchParams.set("maxLat", bounds.getNorth().toFixed(4));
      pageUrl.searchParams.set("minLng", bounds.getWest().toFixed(4));
      pageUrl.searchParams.set("maxLng", bounds.getEast().toFixed(4));
      window.history.replaceState({}, "", pageUrl);

      const res  = await fetch(url.toString());
      if (!res.ok) return;
      const data = await res.json();

      // setListings triggers useMemo → displayedListings recomputes →
      // useEffect above syncs map markers. No manual source.setData needed here.
      setListings(data.content);
    } catch (_) {
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  // ── Draw handlers ──────────────────────────────────────────────────────────

  const startDraw = useCallback(() => {
    if (!drawRef.current) return;
    drawRef.current.deleteAll();
    activePolygonRef.current = null;
    setActivePolygon(null);
    drawRef.current.changeMode("draw_polygon");
    setIsDrawing(true);
  }, []);

  const cancelDraw = useCallback(() => {
    if (!drawRef.current) return;
    drawRef.current.changeMode("simple_select");
    setIsDrawing(false);
  }, []);

  const clearPolygon = useCallback(() => {
    if (!drawRef.current) return;
    drawRef.current.deleteAll();
    activePolygonRef.current = null;
    setActivePolygon(null);
    setIsDrawing(false);
  }, []);

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
    });

    mapRef.current = map;

    // Navigation controls (top-right)
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    // ── Mapbox Draw ──────────────────────────────────────────────────────────
    // displayControlsDefault: false — hide the default Draw toolbar entirely.
    // We provide our own button overlay on the map canvas.
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      defaultMode: "simple_select",
    });
    map.addControl(draw);
    drawRef.current = draw;

    // draw.create fires when the user double-clicks to close a polygon.
    map.on("draw.create", (e) => {
      const polygon = e.features[0];
      activePolygonRef.current = polygon;
      setActivePolygon(polygon);
      setIsDrawing(false);
    });

    // draw.delete fires when the user presses Delete/Backspace on a selected shape.
    map.on("draw.delete", () => {
      activePolygonRef.current = null;
      setActivePolygon(null);
      setIsDrawing(false);
    });

    // draw.update fires when the user drags a vertex to reshape the polygon.
    map.on("draw.update", (e) => {
      const polygon = e.features[0];
      activePolygonRef.current = polygon;
      setActivePolygon(polygon);
    });

    // draw.modechange handles Escape (user cancels mid-draw)
    map.on("draw.modechange", (e) => {
      if (e.mode === "simple_select") setIsDrawing(false);
    });

    map.on("load", () => {
      map.addSource("listings", {
        type:          "geojson",
        data:          listingsToGeoJSON(initialListings),
        cluster:       true,
        clusterRadius: 50,
        clusterMaxZoom: 14,
      });

      map.addLayer({
        id: "clusters", type: "circle", source: "listings",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"],
            "#3b82f6", 5, "#1d4ed8", 20, "#1e3a8a"],
          "circle-radius": ["step", ["get", "point_count"],
            18, 5, 24, 20, 32],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "cluster-count", type: "symbol", source: "listings",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font":  ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size":  12,
        },
        paint: { "text-color": "#ffffff" },
      });

      map.addLayer({
        id: "unclustered-point", type: "circle", source: "listings",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color":        "#2563eb",
          "circle-radius":       8,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "selected-point", type: "circle", source: "listings",
        filter: ["==", ["get", "id"], ""],
        paint: {
          "circle-color":        "#dc2626",
          "circle-radius":       11,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", "clusters", (e) => {
        const [feature] = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        map.getSource("listings").getClusterExpansionZoom(
          feature.properties.cluster_id,
          (err, zoom) => {
            if (!err) map.easeTo({ center: feature.geometry.coordinates, zoom });
          }
        );
      });

      map.on("click", "unclustered-point", (e) => {
        const [feature] = e.features;
        if (popupRef.current) popupRef.current.remove();
        popupRef.current = new mapboxgl.Popup({ offset: 15 })
          .setLngLat(feature.geometry.coordinates.slice())
          .setHTML(buildPopupHTML(feature.properties))
          .addTo(map);
      });

      const setCursor = c => () => (map.getCanvas().style.cursor = c);
      map.on("mouseenter", "clusters",          setCursor("pointer"));
      map.on("mouseleave", "clusters",          setCursor(""));
      map.on("mouseenter", "unclustered-point", setCursor("pointer"));
      map.on("mouseleave", "unclustered-point", setCursor(""));
    });

    // Debounced viewport change → fetch new listings
    map.on("moveend", () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchForViewport(map.getBounds(), initialStatus);
      }, 400);
    });

    return () => {
      clearTimeout(debounceRef.current);
      if (popupRef.current) popupRef.current.remove();
      map.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sidebar card click → pan + highlight ──────────────────────────────────
  const handleSidebarClick = useCallback((listing) => {
    if (!mapRef.current || listing.latitude == null) return;
    setSelectedId(listing.id);
    mapRef.current.setFilter("selected-point", ["==", ["get", "id"], String(listing.id)]);
    mapRef.current.flyTo({
      center: [listing.longitude, listing.latitude],
      zoom:   Math.max(mapRef.current.getZoom(), 14),
      speed:  1.2,
    });
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!mapboxToken) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="bg-white border border-red-200 rounded-lg p-8 max-w-md text-center shadow">
          <div className="text-red-600 font-semibold mb-2">Mapbox token missing</div>
          <p className="text-sm text-slate-600">
            Add <code className="bg-slate-100 px-1 rounded">PUBLIC_MAPBOX_TOKEN=pk.your-token</code> to
            {" "}<code className="bg-slate-100 px-1 rounded">sawicki-group-web/.env.local</code> and
            restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex" style={{ height: "calc(100vh - 5rem)" }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <div className="w-96 flex-shrink-0 flex flex-col border-r border-stone-200 bg-white">
        <div className="flex-shrink-0 px-4 py-3 border-b border-stone-100">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              {isLoading ? "Searching…" : (
                activePolygon
                  ? `${displayedListings.length} of ${listings.length} in drawn area`
                  : `${listings.length} listing${listings.length !== 1 ? "s" : ""} in view`
              )}
            </span>
            <a href="/search" className="text-xs text-blue-600 hover:text-blue-700">
              Filter view →
            </a>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {displayedListings.length === 0 && !isLoading && (
            <div className="text-center py-12 text-sm text-slate-500">
              {activePolygon
                ? "No listings inside the drawn area. Try redrawing a larger shape."
                : "No listings in this area. Pan the map to explore."}
            </div>
          )}
          {displayedListings.map(listing => (
            <SidebarCard
              key={listing.id}
              listing={listing}
              isSelected={selectedId === listing.id}
              onClick={() => handleSidebarClick(listing)}
            />
          ))}
        </div>
      </div>

      {/* ── Map ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* ── Draw controls — top-left, opposite NavigationControl ───────── */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">

          {/* Three-state button: idle / drawing / polygon-active */}
          <button
            onClick={isDrawing ? cancelDraw : activePolygon ? clearPolygon : startDraw}
            className={`
              px-3 py-1.5 rounded text-sm font-medium shadow-md border
              transition-colors whitespace-nowrap
              ${isDrawing
                ? "bg-red-500 text-white border-red-600 hover:bg-red-600"
                : activePolygon
                ? "bg-blue-600 text-white border-blue-700 hover:bg-blue-700"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"}
            `}
          >
            {isDrawing ? "Cancel" : activePolygon ? "Clear Area" : "Draw Area"}
          </button>

          {/* Instruction pill — only visible while user is actively drawing */}
          {isDrawing && (
            <div className="bg-white/95 text-slate-600 text-xs px-2.5 py-1.5 rounded shadow border border-slate-200 leading-snug">
              Click to place points.<br />Double-click to finish.
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