# Feature cost scorecard

What each feature costs to run: page weight, requests, latency, browser memory, server
work, and billable third-party calls. **Update it with every feature** (add a row, or
re-measure when a feature changes) and keep the action list current.

- **Measured** values come from a local production build (`npm run build`, server on a
  side port, Chrome via playwright-core) against the local API. Local network, so treat
  latency as relative, not absolute.
- **Prices** are list prices from memory as of 2026-10 — verify on the vendor's pricing
  page before relying on them. Free tiers are monthly.
- Last full measurement: **2026-10-22** (after the lean pass; "before" kept for reference).

## Top actions (ranked)

| # | Issue | Impact | Fix | Status |
|---|---|---|---|---|
| 1 | Static JS/CSS (`/_astro/*`) still go out uncompressed — mapbox-gl is 1.76 MB instead of ~476 KB gzipped. They bypass Astro middleware. | First visit to map search downloads ~2 MB of JS (cached for a year after). | Go-live: Cloudflare (free) in front of the custom domain (Brotli + edge cache), or precompressed assets served by a custom Node server. | Go-live checklist |
| 2 | API search still loads full listing rows from Postgres and slims them in Java. | ~90 ms per search locally; DB → app transfer of full rows. | A JPA projection query for `view=summary` if search latency grows. | Watch |
| 3 | Overpass (public) is slow and flaky (40–60 s per query, frequent 502s). | Amenity batches take hours. | Mitigated: shared tiles, resumable batches, 90-day refresh. Self-hosted Overpass or a POI vendor if it stays a bottleneck. | Mitigated |

### Done (2026-10-22 lean pass)

| Fix | Before | After |
|---|---|---|
| Map search uses slim listings (`view=summary`, ~20 fields) | `/listings` HTML 7.13 MB; each pan/zoom 4.93 MB | HTML 387 KB (31 KB gzipped); each pan/zoom 79 KB (10 KB gzipped) |
| API gzip (`server.compression`) | none | JSON ~7× smaller (full listing search 4.93 MB → 698 KB) |
| Site gzip for dynamic responses (`middleware.ts`) | none | HTML/XML/JSON ~5–10× smaller (home 15 KB → 3.7 KB; sitemap-listings 191 KB → 27 KB) |
| 60 s browser caching of search + suggest | every pan re-fetched | repeat views/Back reuse responses |
| Summary card / mini header load photos only when shown | desktop 11, phone 10 Cloudflare deliveries per listing view | desktop 6, phone 4 |
| Chat: Haiku 4.5, 400-token reply cap, last 10 messages, usage logged, plain-text replies | Sonnet 4.5, 600 cap, unbounded history | measured 648 in + 67 out tokens ≈ $0.001 / message |
| Amenity refresh every 90 days (was ~monthly) | ~3 isochrone calls / listing / month | ~1 / listing / month |

## Pages (measured, production build)

Transfer sizes are what Chrome received (HTML compressed; `/_astro` JS not yet — action #1).

| Page | HTML | JS | Images | Requests | TTFB (warm) | Load | JS heap | Third-party calls per view |
|---|---|---|---|---|---|---|---|---|
| Home `/` | 3.7 KB gz | 0 | — | 3 | ~20 ms | 0.34 s | 1.2 MB | none |
| Blog post (prerendered) | ~80 KB (static file, not gzipped) | 0 | — | 3 | ~7 ms | 0.04 s | 1.2 MB | none |
| Map search `/listings` (desktop) | **31 KB gz** (was 7.1 MB) | 2.0 MB (mapbox-gl 1.76 MB) | — | 25 | ~220 ms (was 1.57 s) | 1.07 s (was 2.15 s) | 24 MB (was 29) | 1 Mapbox map load + tiles |
| Map search `/listings` (phone) | 31 KB gz | 2.0 MB | — | 20 | ~220 ms | 1.13 s (was 1.57 s) | 20 MB (was 27) | 1 Mapbox map load + tiles |
| Listing detail (desktop) | ~25 KB gz | 275 KB | 365 KB (was 468) | 26 | ~0.1–0.3 s | 0.6–1.0 s | 3 MB | 1 Mapbox static image; 6 Cloudflare deliveries (was 11) |
| Listing detail (phone) | ~25 KB gz | 275 KB | 357 KB (was 506) | 24 | ~0.1 s | 0.31 s | 2.9 MB | 1 Mapbox static image; 4 Cloudflare deliveries (was 10) |
| + open neighborhood map | — | +1.72 MB (mapbox-gl, once) | — | +20 | — | — | +23 MB | 1 Mapbox map load + tiles |

## Features

| Feature | Where | Per use | Billable calls | Notes / guardrails |
|---|---|---|---|---|
| Map search (pins, list, filters, drawn area) | `/listings`, `MapSearch.tsx` | 1 map load per page view; 1 API search per pan/zoom (debounced 400 ms, cached 60 s) | Mapbox GL JS map load | Capped at 200 results, nearest-first; `view=summary` (~10 KB gz per fetch). Never request full listings for the map. |
| Search box suggestions | `SearchBox.tsx`, `GET /api/listings/suggest` | 1 API call per typing pause (200 ms debounce, ≥2 chars; stale requests aborted) | none (own DB) | LIKE scan; add pg_trgm index if the table grows large. |
| Base map tint | `MapSearch.tsx` | style changes only | none | No extra requests. |
| Listing photos + lightbox | `PhotoGallery.tsx` | 5 mosaic / carousel images up front; lightbox loads on demand; strip uses 120 px thumbs | Cloudflare Images deliveries | Avoid full-size thumbnails (the old plugin loaded 2048 px). |
| Summary card + mini header | `ListingSummary.tsx` | loads only the current photo ± 1 | Cloudflare Images deliveries | Scroll handler is rAF-throttled. |
| Neighborhood map | `map-utils.ts`, `NeighborhoodMap.tsx` | 1 static image per listing view; interactive map only when opened | Mapbox Static Images; Mapbox map load on open | Never put an interactive map on page load (~1.7 MB JS + a map load per view). |
| Listing AI chat | `ListingChat.tsx`, API `/api/chat` | 1 Anthropic call per message (~2,150 in + ~100 out tokens, measured: full features + Close to Home + contact tool; was ~650 in) | Anthropic tokens | Haiku 4.5 (`app.chat.model`); last 10 messages; 400-token cap; 10 messages / IP / hour. Usage logged per message. |
| Close to Home (amenity scores) | API `amenity/` | per listing every 90 days: 3 Mapbox isochrone calls + Overpass (shared tiles in batches) | Mapbox Isochrone API | Resumable batches; ~1,000 listings ≈ 1,000 isochrone calls/month. |
| Structured data, sitemaps, RSS, robots, llms.txt | `structured-data.ts`, `src/pages/*.ts` | sitemap-listings: 1 slim API call per crawl (cached 1 h) | none | JSON-LD adds ~5–15 KB per page. |
| Logging & monitoring | API `logging/`, Actuator; site `middleware.ts` | 1 access line per request; 1 line per outbound call (media downloads/uploads at DEBUG); metrics in memory | none (log storage: Railway plan / Cloud Logging 50 GiB free) | Prod INFO + JSON; all-SQL logging off (was on in every profile), slow SQL > 200 ms only. ~1 KB of logs per request. |
| Contact form | `/api/contact` | 1 email per submission | Resend | |

## Third-party pricing (verify before relying)

| Service | Used for | Free tier / month | Beyond free |
|---|---|---|---|
| Mapbox GL JS (web map loads) | map search; neighborhood map when opened | 50,000 loads | ~$5 per 1,000 |
| Mapbox Static Images | listing neighborhood image | 50,000 requests | ~$1 per 1,000 |
| Mapbox Isochrone | amenity scoring | 100,000 requests | ~$2 per 1,000 |
| Cloudflare Images | listing photos | — | ~$5 per 100k stored, ~$1 per 100k delivered |
| Anthropic Claude Haiku 4.5 | listing chat | — | ~$1 / M input tokens, ~$5 / M output tokens (Sonnet 4.5: ~$3 / ~$15) |
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
| Mapbox isochrones | ~1,000 | $0 (free tier) |
| Chat messages (Haiku 4.5, measured tokens) | 1,600 × ~$0.0027 | **~$4.30** |
| Bandwidth: map search pans (say 10 per visit) | 50,000 × 10 KB | ~0.5 GB (was ~245 GB at 4.9 MB each) |

Everything stays inside free tiers at this traffic; the remaining lever is CDN
compression for the static JS (action #1).
