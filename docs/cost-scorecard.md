# Feature cost scorecard

What each feature costs to run: page weight, requests, latency, browser memory, server
work, and billable third-party calls. **Update it with every feature** (add a row, or
re-measure when a feature changes) and keep the action list current.

- **Measured** values come from a local production build (`npm run build`, server on a
  side port, Chrome via playwright-core) against the local API. Local network, so treat
  latency as relative, not absolute.
- **Prices** are list prices from memory as of 2026-10 — verify on the vendor's pricing
  page before relying on them. Free tiers are monthly.
- Last full measurement: **2026-10-22**.

## Top actions (ranked)

| # | Issue | Impact | Fix | Effort |
|---|---|---|---|---|
| 1 | **`/listings` page is 7.1 MB of HTML**; every map pan/zoom fetches **~4.9 MB** from the API. The 200 listings are sent whole (descriptions, rooms, raw MLS fields, amenity JSON) when the map, list and preview need ~20 fields. | Phones on cellular: seconds per page load and per pan. Server CPU/memory to serialize it. TTFB 0.9–1.5 s. | API: a slim "summary" shape for `/api/listings/search` (e.g. `?view=summary`); site: use it for the map page. Expect ~95% smaller. | Small–medium |
| 2 | **No compression anywhere**: site HTML/JS/CSS and API JSON go out uncompressed (mapbox-gl: 1.76 MB instead of 476 KB gzipped). | 3–5× more bytes on first visits. | API: `server.compression.enabled=true` (Spring). Site: put Cloudflare (free) in front of the custom domain at go-live (Brotli + edge cache), or add compression in the Node server. | Small |
| 3 | **Listing chat**: Sonnet 4.5, the whole listing prompt + full history re-sent every message. | The largest *variable* cost (see estimates below). | Anthropic prompt caching for the system prompt (~90% off repeated input); evaluate Haiku 4.5 for this use. Log `usage` per message to measure real token counts. | Small |
| 4 | **Overpass (public) is slow and flaky** (40–60 s per query today, frequent 502s). | Amenity batches take hours; single-listing scoring stalls. | Already mitigated (shared tiles, resumable batches). If it stays a bottleneck: a self-hosted Overpass or a commercial POI source. | Later |

## Pages (measured, production build)

| Page | HTML | JS (uncompressed) | Images | Requests | TTFB | Load | JS heap | Third-party calls per view |
|---|---|---|---|---|---|---|---|---|
| Home `/` | ~80 KB | 0 | — | 3 | 16 ms | 0.16 s | 1.2 MB | none |
| Blog post | ~80 KB | 0 | — | 3 | 5 ms | 0.05 s | 1.2 MB | none |
| Map search `/listings` (desktop) | **7.1 MB** ⚠ | 2.0 MB (mapbox-gl 1.76 MB) | — | 25 | 1.57 s ⚠ | 2.15 s | 29 MB | 1 Mapbox map load + tiles |
| Map search `/listings` (phone) | **7.1 MB** ⚠ | 2.0 MB | — | 24 | 1.07 s | 1.57 s | 27 MB | 1 Mapbox map load + tiles |
| Listing detail (desktop) | ~150 KB | 275 KB | ~470 KB photos | 31 | 0.17 s | 0.71 s | 3 MB | 1 Mapbox static image; ~10 Cloudflare image deliveries |
| Listing detail (phone) | ~150 KB | 275 KB | ~500 KB photos | 30 | 0.09 s | 0.38 s | 2.9 MB | 1 Mapbox static image; ~10 Cloudflare image deliveries |
| + open neighborhood map | — | +1.72 MB (mapbox-gl, once) | — | +20 | — | — | +23 MB | 1 Mapbox map load + tiles |

## Features

| Feature | Where | Per use | Billable calls | Notes / guardrails |
|---|---|---|---|---|
| Map search (pins, list, filters, drawn area) | `/listings`, `MapSearch.tsx` | 1 map load per page view; 1 API search per pan/zoom (debounced 400 ms) | Mapbox GL JS map load | Capped at 200 results per fetch, nearest-first. Payload size: action #1. |
| Search box suggestions | `SearchBox.tsx`, `GET /api/listings/suggest` | 1 API call per typing pause (200 ms debounce, ≥2 chars; stale requests aborted) | none (own DB) | LIKE scan; add pg_trgm index if the table grows large. |
| Base map tint | `MapSearch.tsx` | style changes only | none | No extra requests. |
| Listing photos + lightbox | `PhotoGallery.tsx` | 5 mosaic / carousel images up front; lightbox loads on demand; strip uses 120 px thumbs | Cloudflare Images deliveries | Avoid full-size thumbnails (the old plugin loaded 2048 px). |
| Summary card + mini header | `ListingSummary.tsx` | loads only the current photo ± 1 | Cloudflare Images deliveries | Scroll handler is rAF-throttled. |
| Neighborhood map | `map-utils.ts`, `NeighborhoodMap.tsx` | 1 static image per listing view; interactive map only when opened | Mapbox Static Images; Mapbox map load on open | Never put an interactive map on page load (~1.7 MB JS + a map load per view). |
| Listing AI chat | `ListingChat.tsx`, API `/api/chat` | 1 Anthropic call per message (prompt + history) | Anthropic tokens | Rate limit: 10 messages per visitor IP. See action #3. |
| Close to Home (amenity scores) | API `amenity/` | per listing per month: 3 Mapbox isochrone calls + Overpass (shared tiles in batches) | Mapbox Isochrone API | Resumable batches; ~1,000 listings ≈ 3,000 isochrone calls/month. |
| Structured data, sitemaps, RSS, robots, llms.txt | `structured-data.ts`, `src/pages/*.ts` | sitemap-listings: 1 slim API call per crawl (cached 1 h) | none | JSON-LD adds ~5–15 KB per page. |
| Contact form | `/api/contact` | 1 email per submission | Resend | |

## Third-party pricing (verify before relying)

| Service | Used for | Free tier / month | Beyond free |
|---|---|---|---|
| Mapbox GL JS (web map loads) | map search; neighborhood map when opened | 50,000 loads | ~$5 per 1,000 |
| Mapbox Static Images | listing neighborhood image | 50,000 requests | ~$1 per 1,000 |
| Mapbox Isochrone | amenity scoring | 100,000 requests | ~$2 per 1,000 |
| Cloudflare Images | listing photos | — | ~$5 per 100k stored, ~$1 per 100k delivered |
| Anthropic Claude Sonnet 4.5 | listing chat | — | ~$3 / M input tokens, ~$15 / M output tokens |
| Overpass API (public) | amenity POIs | free (fair use) | — |
| Resend | contact email | 3,000 emails | paid plans |
| Cloud Run (site), Railway (API) | hosting | Cloud Run: 2M requests | usage-based |

## Example month (assumptions, not data)

10,000 visits → 5,000 map-search page views, 20,000 listing views, 10% open the
neighborhood map, 2% of listing views start a chat averaging 4 messages:

| Item | Volume | Cost |
|---|---|---|
| Mapbox map loads | 5,000 + 2,000 = 7,000 | $0 (free tier) |
| Mapbox static images | 20,000 | $0 (free tier) |
| Mapbox isochrones | ~3,000 | $0 (free tier) |
| Chat messages | 1,600 × ~$0.02 (est. ~5k input + ~400 output tokens) | **~$32** |
| Chat with prompt caching + Haiku 4.5 (estimate) | 1,600 | ~$3–5 |

The chat is the line to watch; everything Mapbox stays inside free tiers until traffic is
several times this.
