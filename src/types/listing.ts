/**
 * Listing — TypeScript interface mirroring the Spring Boot Listing entity.
 *
 * Field naming convention matches Spring's default Jackson serialization:
 * Java fields use camelCase, Jackson emits JSON keys with the same casing,
 * so we mirror them here without translation.
 *
 * All fields except id, address, and city are marked optional (`?`) because:
 *   - The real MLS feed populates fields sparsely (a condo has no lotSqft;
 *     an active-only listing has no closePrice).
 *   - The Spring entity allows nullable columns for everything except @NotBlank
 *     address and city.
 *
 * Numeric fields are `number` (TypeScript has no Integer/Long distinction;
 * JSON only has Number). Strings are string. Keep the types in step with the
 * Java entity — a wrong type here hides bugs (e.g. comparing a number to "0").
 *
 * Fields marked "JSON array" arrive as a JSON string such as '["Full","Walkout"]';
 * display them with `formatList()` / `parseList()` from listing-utils, never raw.
 */
export interface Listing {
  id: number;

  // Identity & Status
  mlsId?: string;
  listingKey?: string; // MLS Grid system key, e.g. NST2878776
  status?: string;
  contingency?: string;
  listDate?: string;
  pendingDate?: string;
  closeDate?: string;
  daysOnMarket?: number;
  listPrice?: number;
  originalListPrice?: number;
  closePrice?: number;
  offMarketDate?: string;

  // Location
  address: string;
  city: string;
  postalCity?: string; // Mailing city (RESO PostalCity) — often differs from
  // `city` in rural MN (which can be a township). Preferred
  // for SEO slugs. Already serialized by the API.
  zipCode?: string;
  county?: string;
  neighborhood?: string;
  complexSubdiv?: string;
  latitude?: number;
  longitude?: number;
  parcelNumber?: string;
  zoningDescription?: string;

  // Property Basics
  propertyType?: string; // RESO PropertySubType, e.g. Single Family Residence
  resoPropertyType?: string; // RESO PropertyType class, e.g. Residential, Land
  style?: string;
  yearBuilt?: number;
  stories?: string;
  constructionStatus?: string;
  newConstruction?: boolean;
  beds?: number;
  bathsFull?: number;
  bathsThreeQuarter?: number;
  bathsHalf?: number;
  bathsQuarter?: number;
  sqftAboveGrade?: number;
  sqftBelowGrade?: number;
  sqftTotal?: number;
  sqftMainLevel?: number;
  lotSqft?: number;
  lotDimensions?: string;
  garageStalls?: number;
  garageSqft?: number;
  pool?: string;

  // Room Details (JSON string — see listing-utils.parseRooms)
  roomInfo?: string;

  // Features
  appliances?: string; // JSON array
  basement?: string; // JSON array
  heating?: string; // JSON array
  airConditioning?: string; // JSON array
  fuelType?: string;
  fireplaceFeatures?: string;
  fireplaces?: number;
  constructionMaterials?: string; // JSON array
  exteriorFeatures?: string;
  roof?: string; // JSON array
  electric?: string;
  sewer?: string; // JSON array
  waterSource?: string; // JSON array
  fencing?: string;
  lotFeatures?: string;
  diningRoomFeatures?: string;
  familyRoomFeatures?: string;
  amenities?: string;
  parkingFeatures?: string; // JSON array
  laundryFeatures?: string; // JSON array (RESO LaundryFeatures)
  // NorthstarMLS search highlights, comma-separated, e.g.
  // "Main Floor Laundry,Main Floor Bedroom,All Living Facilities on One Level".
  specialSearch?: string;
  financing?: string;

  // Waterfront / Lake
  waterfrontFeet?: number;
  waterfrontView?: string;
  waterBodyName?: string;
  surfaceWaterType?: string;
  dnrLakeClass?: string;
  dnrLakeId?: string;
  lakeAcres?: string;
  lakeDepth?: string;
  lakeBottomType?: string;

  // HOA
  associationFee?: number;
  associationFeeFrequency?: string;
  associationFeeIncludes?: string;
  associationMgmtName?: string;
  associationMgmtPhone?: string;

  // Financial
  taxAmount?: number;
  taxYear?: number;
  taxWithAssessments?: string; // decimal string from MLS, e.g. 1069.0400

  // Schools
  elementarySchool?: string;
  middleSchool?: string;
  highSchool?: string;
  schoolDistrict?: string;
  schoolDistrictNumber?: string;

  // Agent / Office
  listAgentName?: string;
  listAgentPhone?: string;
  listAgentMlsId?: string;
  listOfficeName?: string;
  listOfficePhone?: string;
  listOfficeMlsId?: string;

  // Display
  publicRemarks?: string;
  photosCount?: number;
  directions?: string;
  amenityScores?: string;

  // MLS Grid sync metadata (Spring entity emits Instant as ISO 8601 string)
  modificationTimestamp?: string;
  originalEntryTimestamp?: string;
  mlgCanView?: boolean;
  mlgCanUse?: string; // JSON array, e.g. IDX, VOW

  // Hosted media (populated by MediaIngestionService after MLS Grid ingest).
  // photoIds and floorPlanIds are JSON arrays of {key, cfId} (legacy: plain
  // Cloudflare Image ID strings); read them with photo-utils.parsePhotoIds.
  // virtualTourUrls is a JSON array of {provider, url, label} objects.
  // mediaIngestionStatus: PENDING | IN_PROGRESS | COMPLETE | FAILED | null.
  photoIds?: string;
  floorPlanIds?: string;
  virtualTourUrls?: string;
  mediaIngestionStatus?: string;
  // Legacy MLS Grid photo link (expires; no longer displayed) and raw media JSON.
  primaryImageUrl?: string;
  mediaJson?: string;
}

/**
 * Page<T> — Spring Data's pagination wrapper.
 * Spring's PageImpl serializes to JSON in this exact shape, so we mirror it.
 */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number; // current page (0-indexed)
  size: number; // page size requested
  first: boolean;
  last: boolean;
  numberOfElements: number; // results on this page (may be less than size on last page)
}

/**
 * Room — the parsed shape of one entry from listing.roomInfo JSON.
 * roomInfo is stored as a JSON string in the database; parsed shape:
 *   [{"room":"Living Room","level":"Main","dim":"15x21"}, ...]
 */
export interface Room {
  room: string;
  level: string;
  dim: string;
}

export interface CategoryScore {
  count: number;
  nearestName?: string;
  nearestMeters?: number;
  subtypes?: Record<string, number>;
}

/** A city or ZIP code suggested by the search box, with the bounding box of its listings. */
export interface PlaceSuggestion {
  type: "city" | "zip";
  label: string;
  count: number;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** GET /api/listings/suggest: matching places and up to 5 listings. */
export interface SearchSuggestions {
  places: PlaceSuggestion[];
  listings: Listing[];
}

export interface AmenityScores {
  generatedAt: string;
  scores: Record<string, Record<string, CategoryScore>>;
  // scores["walk_10min"]["grocery"] = CategoryScore
}
