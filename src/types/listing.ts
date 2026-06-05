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
 * JSON only has Number). Strings are string.
 */
export interface Listing {
  id: number;

  // Identity & Status
  mlsId?: string;
  status?: string;
  listDate?: string;
  pendingDate?: string;
  closeDate?: string;
  daysOnMarket?: number;
  listPrice?: number;
  originalListPrice?: number;
  closePrice?: number;

  // Location
  address: string;
  city: string;
  zipCode?: string;
  county?: string;
  neighborhood?: string;
  complexSubdiv?: string;
  latitude?: number;
  longitude?: number;

  // Property Basics
  propertyType?: string;
  style?: string;
  yearBuilt?: number;
  stories?: string;
  constructionStatus?: string;
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
  appliances?: string;
  basement?: string;
  heating?: string;
  airConditioning?: string;
  fuelType?: string;
  fireplaceFeatures?: string;
  fireplaces?: string;
  constructionMaterials?: string;
  exteriorFeatures?: string;
  roof?: string;
  electric?: string;
  sewer?: string;
  waterSource?: string;
  fencing?: string;
  lotFeatures?: string;
  diningRoomFeatures?: string;
  familyRoomFeatures?: string;
  amenities?: string;
  parkingFeatures?: string;
  laundryFeatures?: string;
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
  associationFee?: string;
  associationFeeFrequency?: string;
  associationFeeIncludes?: string;
  associationMgmtName?: string;
  associationMgmtPhone?: string;

  // Financial
  taxAmount?: string;
  taxYear?: string;
  taxWithAssessments?: string;

  // Schools
  elementarySchool?: string;
  middleSchool?: string;
  highSchool?: string;
  schoolDistrict?: string;

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
}

/**
 * Page<T> — Spring Data's pagination wrapper.
 * Spring's PageImpl serializes to JSON in this exact shape, so we mirror it.
 */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;          // current page (0-indexed)
  size: number;            // page size requested
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

export interface AmenityScores {
  generatedAt: string;
  scores: Record<string, Record<string, CategoryScore>>;
  // scores["walk_10min"]["grocery"] = CategoryScore
}