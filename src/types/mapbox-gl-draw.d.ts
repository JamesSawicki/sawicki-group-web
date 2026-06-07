/**
 * Minimal ambient module declaration for @mapbox/mapbox-gl-draw v1.5.x.
 *
 * The library does not ship TypeScript types and there is no maintained
 * @types/mapbox__mapbox-gl-draw package compatible with mapbox-gl v3.
 * This declaration covers only what MapSearch.tsx actually uses.
 * Expand it here if you add MapboxDraw API calls in the future.
 *
 * Full API reference: https://github.com/mapbox/mapbox-gl-draw/blob/main/docs/API.md
 */
declare module "@mapbox/mapbox-gl-draw" {
  import type mapboxgl from "mapbox-gl";

  interface MapboxDrawOptions {
    /** Hide the default Draw toolbar (we use our own button overlay). */
    displayControlsDefault?: boolean;
    defaultMode?: string;
  }

  /**
   * MapboxDraw implements IControl so it can be passed to map.addControl().
   * IControl requires onAdd / onRemove — Draw provides both internally.
   */
  export default class MapboxDraw implements mapboxgl.IControl {
    constructor(options?: MapboxDrawOptions);
    onAdd(map: mapboxgl.Map): HTMLElement;
    onRemove(map: mapboxgl.Map): void;
    /** Remove all drawn features and reset to empty state. */
    deleteAll(): this;
    /** Switch the draw mode (e.g. "draw_polygon", "simple_select"). */
    changeMode(mode: string): this;
  }
}
