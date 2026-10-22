/**
 * Listing-page neighborhood map helpers.
 *
 * The page shows a static map *image* (Mapbox Static Images API: cheap, cached by the
 * browser, no map library on the page). The interactive map loads only when the visitor
 * opens it (NeighborhoodMap.tsx), so ordinary page views don't count as Mapbox map loads.
 */

/** Detailed street style: street names, businesses, parks, schools, transit. */
export const NEIGHBORHOOD_STYLE = "mapbox/streets-v12";
/** Same detail over aerial imagery, for the map's Satellite toggle. */
export const SATELLITE_STYLE = "mapbox/satellite-streets-v12";
/** Zoom that shows the surrounding blocks with business and park labels. */
export const NEIGHBORHOOD_ZOOM = 15.5;
/** Pin color for the property (matches the search map's selected pin). */
export const PIN_COLOR = "dc2626";

/** Window event that opens the listing page's interactive neighborhood map. */
export const OPEN_MAP_EVENT = "listing:open-map";

/** Opens the listing page's interactive neighborhood map (NeighborhoodMap.tsx). */
export function openNeighborhoodMap(): void {
  window.dispatchEvent(new CustomEvent(OPEN_MAP_EVENT));
}

/**
 * URL of a static map image centered on a point, with a red pin on it (served at 2× for
 * sharp screens).
 *
 * @param width  CSS pixels (max 1280)
 * @param height CSS pixels (max 1280)
 */
export function staticMapUrl(
  token: string,
  lng: number,
  lat: number,
  width: number,
  height: number,
  zoom = NEIGHBORHOOD_ZOOM,
): string {
  const pin = `pin-l+${PIN_COLOR}(${lng},${lat})`;
  return (
    `https://api.mapbox.com/styles/v1/${NEIGHBORHOOD_STYLE}/static/${pin}/${lng},${lat},${zoom},0` +
    `/${Math.round(width)}x${Math.round(height)}@2x?access_token=${encodeURIComponent(token)}`
  );
}
