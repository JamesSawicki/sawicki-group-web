/**
 * NeighborhoodMap.tsx — full-screen interactive map of the listing's neighborhood,
 * opened from the summary card's map frame (desktop) or the "Neighborhood" button
 * (phones) via openNeighborhoodMap() (lib/map-utils.ts).
 *
 * The page only shows a static map image; this component loads mapbox-gl on first open
 * (a dynamic import of the library and its CSS, so neither is part of the listing page) and
 * only then counts as a Mapbox map load. Streets style for maximum detail (street names,
 * businesses, parks, schools), with a Satellite toggle; the property is the only pin.
 * Closes with the X button, Escape, or a click on the dark backdrop.
 */
import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import {
  NEIGHBORHOOD_STYLE,
  NEIGHBORHOOD_ZOOM,
  OPEN_MAP_EVENT,
  PIN_COLOR,
  SATELLITE_STYLE,
} from "../../lib/map-utils";
import mapboxCssUrl from "mapbox-gl/dist/mapbox-gl.css?url";

/**
 * Adds mapbox-gl's stylesheet on first open. Imported as a URL (`?url`), not as CSS:
 * Astro links every CSS import an island can reach, even dynamic ones, so a plain import
 * would load it on every listing view.
 */
function loadMapboxCss(): void {
  if (document.querySelector(`link[href="${mapboxCssUrl}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = mapboxCssUrl;
  document.head.appendChild(link);
}

interface Props {
  /** Property location. */
  latitude: number;
  longitude: number;
  /** Street address, for the title and the pin's label. */
  address: string;
  /** Public Mapbox token. */
  mapboxToken: string;
}

export default function NeighborhoodMap({ latitude, longitude, address, mapboxToken }: Props) {
  const [open, setOpen] = useState<boolean>(false);
  const [satellite, setSatellite] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Opened by other parts of the page.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_MAP_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_MAP_EVENT, onOpen);
  }, []);

  // While open: Escape closes, the page behind doesn't scroll, focus starts on Close.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Create the map the first time it's opened (kept afterwards, so reopening is instant).
  useEffect(() => {
    if (!open || mapRef.current || !containerRef.current) return;
    let cancelled = false;
    (async () => {
      loadMapboxCss();
      const { default: mapboxgl } = await import("mapbox-gl");
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = mapboxToken;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: `mapbox://styles/${NEIGHBORHOOD_STYLE}`,
        center: [longitude, latitude],
        zoom: NEIGHBORHOOD_ZOOM,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
      map.addControl(new mapboxgl.ScaleControl({ unit: "imperial" }), "bottom-left");
      new mapboxgl.Marker({ color: `#${PIN_COLOR}` })
        .setLngLat([longitude, latitude])
        .setPopup(new mapboxgl.Popup({ offset: 30, closeButton: false }).setText(address))
        .addTo(map);
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
    };
  }, [open, latitude, longitude, address, mapboxToken]);

  // Streets / Satellite.
  useEffect(() => {
    mapRef.current?.setStyle(`mapbox://styles/${satellite ? SATELLITE_STYLE : NEIGHBORHOOD_STYLE}`);
  }, [satellite]);

  // The container is hidden while closed; tell the map its size once it's visible again.
  useEffect(() => {
    if (open) mapRef.current?.resize();
  }, [open]);

  useEffect(() => () => mapRef.current?.remove(), []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Neighborhood map: ${address}`}
      hidden={!open}
      className="fixed inset-0 z-50 bg-black/80 p-0 sm:p-6"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div className="relative w-full h-full sm:rounded-xl overflow-hidden bg-stone-100">
        {/* Wrapper does the positioning: mapbox-gl.css sets the map container itself to
            position: relative, which would collapse an absolutely positioned container. */}
        <div className="absolute inset-0">
          <div ref={containerRef} className="w-full h-full" />
        </div>

        {/* ── Title + controls (top-left) ── */}
        <div className="absolute top-3 left-3 right-16 flex flex-wrap items-center gap-2">
          <div className="px-3 h-11 inline-flex items-center rounded-lg bg-white/95 shadow text-sm font-medium text-stone-900 max-w-full truncate">
            {address}
          </div>
          <div
            className="inline-flex rounded-lg bg-white/95 shadow p-1"
            role="group"
            aria-label="Map style"
          >
            {[
              { label: "Streets", value: false },
              { label: "Satellite", value: true },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setSatellite(option.value)}
                aria-pressed={satellite === option.value}
                className={`h-9 px-3 rounded-md text-sm ${
                  satellite === option.value
                    ? "bg-stone-900 text-white"
                    : "text-stone-700 hover:bg-stone-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Close (top-right; zoom buttons are bottom-right) ── */}
        <button
          ref={closeRef}
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close map"
          className="absolute top-3 right-3 z-10 w-11 h-11 inline-flex items-center justify-center rounded-full bg-white shadow text-stone-700 hover:bg-stone-100"
        >
          <svg
            width="20"
            height="20"
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
    </div>
  );
}
