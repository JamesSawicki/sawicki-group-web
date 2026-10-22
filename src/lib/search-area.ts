/**
 * The map search's hand-drawn area, stored in the page URL like the viewport and filters,
 * so it survives reloads, Back from a listing, bookmarks and shared links.
 *
 * Format: `area=lng,lat,lng,lat,…` — the shape's corners at 5 decimals (~1 m), without
 * the closing point. Only the site reads it (the map filters listings to the shape in the
 * browser); the API never receives it.
 */

/** URL query parameter that holds the drawn area. */
export const AREA_PARAM = "area";

/** A drawn search area (a GeoJSON polygon, as Mapbox Draw produces). */
export type SearchArea = GeoJSON.Feature<GeoJSON.Polygon>;

/** Sets the area parameter on `params`, or removes it when there is no area. */
export function setAreaParam(params: URLSearchParams, area: SearchArea | null): void {
  const ring = area?.geometry.coordinates[0];
  if (!ring || ring.length < 4) {
    params.delete(AREA_PARAM);
    return;
  }
  const corners = ring.slice(0, -1); // drop the closing point; it repeats the first
  params.set(
    AREA_PARAM,
    corners.flatMap(([lng, lat]) => [lng.toFixed(5), lat.toFixed(5)]).join(","),
  );
}

/** Reads the area parameter; null when missing or malformed (a bad link just shows no area). */
export function areaFromParams(params: URLSearchParams): SearchArea | null {
  const numbers = (params.get(AREA_PARAM) ?? "").split(",").map(Number);
  if (numbers.length < 6 || numbers.length % 2 !== 0 || !numbers.every(Number.isFinite)) {
    return null;
  }
  const corners: GeoJSON.Position[] = [];
  for (let i = 0; i < numbers.length; i += 2) corners.push([numbers[i], numbers[i + 1]]);
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [[...corners, corners[0]]] },
  };
}
