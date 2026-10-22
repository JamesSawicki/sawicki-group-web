/**
 * Search filters for the map search page: their shape, the options offered, and how they
 * map to and from URL query parameters (which double as listing-api query parameters).
 *
 * Shared by the server render (search.astro's first fetch) and the browser (MapSearch's
 * refetches), so both always send the API the same thing.
 */

/** Every filter as the string a form field holds; "" means "not set". */
export interface SearchFilters {
  status: string;
  minPrice: string;
  maxPrice: string;
  minBeds: string;
  minBaths: string;
  minSqft: string;
  city: string;
  propertyType: string;
  minGarageStalls: string;
  minYearBuilt: string;
  maxYearBuilt: string;
  waterfront: boolean;
  pool: boolean;
  sortBy: string;
}

/** Status shown when nothing is chosen; not counted as an "active" filter. */
export const DEFAULT_STATUS = "Active";
/** Default list order; not counted as an "active" filter. */
export const DEFAULT_SORT = "price_desc";

export const EMPTY_FILTERS: SearchFilters = {
  status: DEFAULT_STATUS,
  minPrice: "",
  maxPrice: "",
  minBeds: "",
  minBaths: "",
  minSqft: "",
  city: "",
  propertyType: "",
  minGarageStalls: "",
  minYearBuilt: "",
  maxYearBuilt: "",
  waterfront: false,
  pool: false,
  sortBy: DEFAULT_SORT,
};

// ─── Options ─────────────────────────────────────────────────────────────────
// `value` is what the API receives. Status values must match the data exactly
// (sold listings are "Closed"); property types are categories the API expands.

export const STATUS_OPTIONS = [
  { value: "Active", label: "For sale" },
  { value: "Active,Pending,Coming Soon", label: "For sale + pending + coming soon" },
  { value: "Coming Soon", label: "Coming soon" },
  { value: "Pending", label: "Pending" },
  { value: "Closed", label: "Sold" },
];

export const PROPERTY_TYPE_OPTIONS = [
  { value: "", label: "Any type" },
  { value: "Single Family", label: "Single family" },
  { value: "Townhouse", label: "Townhouse / twin home" },
  { value: "Condo", label: "Condo" },
  { value: "Multi-Family", label: "Multi-family" },
];

export const BED_OPTIONS = [1, 2, 3, 4, 5, 6];
export const BATH_OPTIONS = [1, 1.5, 2, 2.5, 3, 4, 5];
export const GARAGE_OPTIONS = [1, 2, 3, 4];

export const SORT_OPTIONS = [
  { value: "price_desc", label: "Price: high to low" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "newest", label: "Newest" },
  { value: "dom_asc", label: "Days on market" },
  { value: "sqft_desc", label: "Largest" },
];

// ─── URL <-> filters ─────────────────────────────────────────────────────────

/** Reads filters from URL query parameters, falling back to the defaults. */
export function filtersFromParams(params: URLSearchParams): SearchFilters {
  const get = (key: keyof SearchFilters) => params.get(key) ?? "";
  return {
    status: params.get("status") || DEFAULT_STATUS,
    minPrice: get("minPrice"),
    maxPrice: get("maxPrice"),
    minBeds: get("minBeds"),
    minBaths: get("minBaths"),
    minSqft: get("minSqft"),
    city: get("city"),
    propertyType: get("propertyType"),
    minGarageStalls: get("minGarageStalls"),
    minYearBuilt: get("minYearBuilt"),
    maxYearBuilt: get("maxYearBuilt"),
    waterfront: params.get("waterfront") === "true",
    pool: params.get("pool") === "true",
    sortBy: params.get("sortBy") || DEFAULT_SORT,
  };
}

/**
 * Writes filters into `params` (an API URL's or the page URL's): sets the ones that have
 * a value and removes the rest, so URLs stay short and the API never gets empty strings.
 */
export function applyFiltersToParams(filters: SearchFilters, params: URLSearchParams): void {
  for (const [key, value] of Object.entries(filters) as [keyof SearchFilters, string | boolean][]) {
    if (value === "" || value === false) params.delete(key);
    else params.set(key, String(value));
  }
}

/** How many filters differ from the defaults; shown on the "Filters" button. */
export function countActiveFilters(filters: SearchFilters): number {
  return (Object.keys(filters) as (keyof SearchFilters)[]).filter((key) => {
    if (key === "sortBy") return false;
    return filters[key] !== EMPTY_FILTERS[key];
  }).length;
}
