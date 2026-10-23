# Data-structure and efficiency review (2026-10-23)

Read-only review of `sawicki-group-web`, `listing-agent-api` and `sawicki-blog-agent`.
Sizes assume ~15k public listings at go-live (full NorthstarMLS feed). Items already in
`docs/cost-scorecard.md` are left out unless a finding changes them.
"Contract" = changes the API's JSON, so site + API must deploy together.

## Summary

1. **Full-entity loads that break at full-feed scale:** amenity batch (~375 MB heap at 15k),
   media backfill, sitemap, and an unbounded `size` on `/search`. S–M, no contract change.
2. **Two map-search correctness bugs:** a drawn area filters only the 200 listings nearest
   the view's center; stale fetches can overwrite newer results.
3. **Three pre-go-live data-model decisions** (cheap now, costly after URLs are indexed):
   no state field ("MN" hard-coded, Wisconsin listings exist), URLs keyed on the DB id,
   and which statuses get stored and get photos.
4. **The blog agent overwrites its weekly drafts** (monthly slug) and defaults to committing
   to `main` (deploys).

## Findings (ranked by value ÷ effort)

| # | Repo | Finding | Fix | Effort | Contract |
|---|---|---|---|---|---|
| 1 | API | Amenity batch holds every in-scope `Listing` (~25 KB each, ~150 cols + JSON) for hours, parses `amenityScores` just for version/date (`AmenityScoreService.java:404, :466`). ~350–400 MB heap at 15k. | Add `amenity_version`, `amenity_scored_at` columns; select only `id, lat, lng` of stale rows. Stopgap: native jsonb query returning ids. | M (schema) | No |
| 2 | API | `/api/listings/search` builds `PageRequest.of(page, size)` by hand (`ListingService.java:94-97`); `?size=100000` loads everything. | Clamp size ≤ 200, page ≥ 0. *(Sent to the API-defense agent.)* | S | No |
| 3 | Site | Drawn area is tested against only the 200 nearest listings of the viewport fetch (`MapSearch.tsx:442-447, 461-487`). | While an area is active, query with the polygon's bbox (nearest from its center). Later: server-side `polygon=` with JTS. | S–M | No |
| 4 | Site | Map fetches aren't aborted/ordered (`MapSearch.tsx:461-502`); an old response can replace newer pins. | AbortController in a ref (as `SearchBox` does), or a request counter. | S | No |
| 5 | Blog | Slug `rate-update-${month}-${year}` + weekly runs → overwrites (git: 4 commits for Sept, 3 for Oct on one path); can re-draft a published post. `GITHUB_BRANCH` defaults to `main`. Unescaped `title` in YAML. FRED `"."` → `NaN%`. `package.json` lists no deps; `.Dockerignore` casing (verify image build). | ISO-date slug (or skip if exists); default branch `drafts` or fail; `JSON.stringify(title)`; check `res.ok` and `"."`; declare deps; rename `.dockerignore`. | S | No |
| 6 | API | Ingest stores every status and queues media for all (`MlsGridIngestionService` `processRecord` :322-383). Closed/Expired/Withdrawn photos → potentially ~4M Cloudflare images (~$200/mo) and hundreds of GB against MLS Grid's 60 GB/24h cap. | Queue media only for `PUBLIC_STATUSES`; delete images when a listing leaves them; don't keep Expired/Withdrawn/Canceled. Confirm what the IDX feed includes before the import notice. | M | No |
| 7 | API+Site | Sitemap endpoint returns every photo id per listing (`ListingRepository.java:119-125`); site uses 5. ~30 MB per crawl at 15k. | Trim to 5 in the API (~6× smaller). Cleaner: `photoIds: string[]` (see 12). | S | No / Yes |
| 8 | API | Public listing JSON includes the raw MLS Grid `primaryImageUrl` (mapper says never serve these) and sync internals (`mlgCanView`, `mediaIngestionStatus`, `listingKey`, …). Site reads none. | `@JsonProperty(access = WRITE_ONLY)` or drop; remove from `types/listing.ts`. API-only deploy is safe. | S | Safe |
| 9 | API | Media backfill loads all non-COMPLETE listings to process N (`ListingRepository.java:85-89`, `MediaIngestionService.java:154-158`) — after import that's every row; also the restart-recovery path. | Filter `mediaJson IS NOT NULL` in SQL, `LIMIT`, ids only; partial index on status. | S | No |
| 10 | API+Site | No `stateOrProvince` on `Listing`; "MN" hard-coded in slug (`listing-utils.ts:440`), JSON-LD (`structured-data.ts:197`), and 6 components. NorthstarMLS covers western Wisconsin. | Map RESO `StateOrProvince`; add to summary + sitemap; one `cityStateZip()` helper. Or explicitly drop WI at ingest. **Decide before go-live.** | M | Yes |
| 11 | API+Site | Listing URLs end in the DB IDENTITY id; any re-import/rebuild changes every URL. | (a) Key URLs on MLS number + `by-mls` endpoint, or (b) commit to never rebuilding and document it. **Decide before go-live.** | M / S | (a) Yes |
| 12 | Site (API) | Summaries typed as full `Listing` (`MapSearch`, `ListingPreview`, `types/listing.ts:216`); stale fields/docs (`mediaJson`, `primaryImageUrl`, `Room`, schemaVersion 3→4); legacy `photoIds` `["cfId"]` parsed in 3 places. | `ListingSummary = Pick<…>`; move `SitemapEntry` to `types/`; drop legacy branch once dev has none; optionally serialize `photoIds` as cfIds only. Fix stale comments in `Listing.java`, mapper. | S | Partly |
| 13 | Site+API | Site sends whole chat history; API 400s above 20 messages (shows "Something went wrong" from the 11th user turn) and only uses 10; message `content` has no length cap (billed input). | Site sends last 10; `@Size(max=2000)` on content. *(Sent to the API-defense agent.)* | S | No |
| 14 | Site | `middleware.ts` rate-limit map: IPv6 breaks `key.split(":")[1]` cleanup (never deleted); IP from client-controlled leftmost `X-Forwarded-For` → unbounded growth. | Per-endpoint maps / windowMs per entry, size cap, trusted XFF hop. *(Sent to the API-defense agent.)* | S | No |
| 15 | API | `ALLOWED_PROPERTY_CLASSES` defined twice; statuses in three places (incl. non-RESO `TNAS`); doc vs code spelling of "Coming Soon"; `mediaIngestionStatus` is a string. | One constant; `MediaIngestionStatus` enum (`@Enumerated(STRING)`, no schema change); default refresh statuses from `PUBLIC_STATUSES`. | S | No |
| 16 | API | `mediaJson` (~10 KB) read on every full-entity load, but after COMPLETE only used for change detection. | `media_hash` column; null `mediaJson` on success. After 1 and 9. | M (schema) | No |
| 17 | API | Small: redundant `idx_listing_key` (unique already indexes); per-record office lookup on ingest (load a Map once); delta watermark only advances on stored rows; optional stored `property_category`; composite index only if Closed rows stay. | As described. | S | No |

## Fine as is (checked)

- Map GeoJSON rebuilt only when displayed listings change; clustering in Mapbox's worker.
- Hot paths over ≤ 200 listings (`find()`, per-render parse of one photo id, 200 cards) are trivial; no memo/Map index needed.
- Listing-page islands get slim derived props; `amenityScores`/`roomInfo` parsed once in SSR.
- `nearest` in `amenityScores` is unused today but needed by the planned Close to Home time strip.
- Bath total derived, not stored — fine at this size.
- JSON-array fields as strings: harmless; changing is a contract change for little gain.
- Places import (grid dedupe, single-transaction swap, batches of 1000, matching index); Overpass tile cache bounded per batch.
- Chat limiter (bounded Caffeine cache) and media executor (bounded queue, CallerRuns backpressure).
- Pagination/count query (needed for "Showing 200 of N"); suggestion queries with `LIMIT`.
- Search filters defined once and mirrored to URL and API.
- TS/Java field parity: all entity fields present with matching names/types, except item 12.
