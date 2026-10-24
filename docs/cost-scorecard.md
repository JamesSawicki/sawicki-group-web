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

> **Claude API spend limit: $10/month** (set by Jim in the Anthropic console, 2026-10-24).
> A hard ceiling shared by the listing chat and the blog agent: at the limit the chat says
> the assistant is unavailable and the blog run fails (alert emails Jim). **Watch usage after
> launch and raise it before it binds** (listing-agent-api `docs/abuse-protection.md` §3.6).

## Top actions (ranked)

| # | Issue | Impact | Fix | Status |
|---|---|---|---|---|
| 1 | Static JS/CSS (`/_astro/*`) still go out uncompressed — mapbox-gl is 1.76 MB instead of ~476 KB gzipped. They bypass Astro middleware. | First visit to map search downloads ~2 MB of JS (cached for a year after). | Go-live: Cloudflare (free) in front of the custom domain (Brotli + edge cache), or precompressed assets served by a custom Node server. | Go-live checklist |
| 2 | API search still loads full listing rows from Postgres and slims them in Java. | ~90 ms per search locally; DB → app transfer of full rows. | A JPA projection query for `view=summary` if search latency grows. | Watch |
| 3 | Pages send no `Cache-Control`: every listing/blog/home view renders on Cloud Run and (listings) calls the API. | Server work and API calls scale 1:1 with views. | Go-live, with the CDN: a short edge cache on HTML (e.g. `s-maxage=300, stale-while-revalidate`) so most views never reach Cloud Run. | Go-live checklist |
| 5 | Abuse guardrails need console/infra settings that code can't set. | Without them a flood is limited only by our code caps. | Anthropic console monthly limit (~$20), Mapbox URL restriction on the public token, Cloud Run `--max-instances=3`, GCP budget alerts, Railway usage limit, `SITE_API_KEY` on both sides (commands in listing-agent-api `docs/abuse-protection.md`). | Go-live checklist |
| 4 | Overpass (public) is slow and flaky (40–60 s per query, frequent 502s). | Amenity batches take hours. | Mitigated: shared tiles, resumable batches, 90-day refresh. Self-hosted Overpass or a POI vendor if it stays a bottleneck. | Mitigated |

### Done (2026-10-22 lean pass)

| Fix | Before | After |
|---|---|---|
| Map search uses slim listings (`view=summary`, ~20 fields) | `/listings` HTML 7.13 MB; each pan/zoom 4.93 MB | HTML 387 KB (31 KB gzipped); each pan/zoom 79 KB (10 KB gzipped) |
| API gzip (`server.compression`) | none | JSON ~7× smaller (full listing search 4.93 MB → 698 KB) |
| Site gzip for dynamic responses (`middleware.ts`) | none | HTML/XML/JSON ~5–10× smaller (home 15 KB → 3.7 KB; sitemap-listings 191 KB → 27 KB) |
| 60 s browser caching of search + suggest | every pan re-fetched | repeat views/Back reuse responses |
| Summary card / mini header load photos only when shown | desktop 11, phone 10 Cloudflare deliveries per listing view | desktop 6, phone 4 |
| Chat: Haiku 4.5, 400-token reply cap, last 10 messages, usage logged, plain-text replies | Sonnet 4.5, 600 cap, unbounded history | measured 648 in + 67 out tokens ≈ $0.001 / message |
| Chat on Haiku 5.5, thinking off (2026-10-24) | Haiku 4.5 ($1 / $5 per M) | $0.10 / $0.50 per M; ~$0.0033 → ~$0.0004 / message even with ~30% more tokens counted (test: 476 in + 114 out tokens) |
| Blog agent payments computed in code; Opus 5.5 (2026-10-24) | Sonnet 5, model did the math | measured 997 in + 1,587 out ≈ 3.6¢ / weekly post (~16¢ / month); `BLOG_MODEL=claude-sonnet-5-5` about halves it |
| Amenity refresh every 90 days (was ~monthly) | ~3 isochrone calls / listing / month | ~1 / listing / month |

### Done (2026-10-22 second pass)

| Fix | Before | After |
|---|---|---|
| Removed unused public `GET /api/listings` (every row, sold included) | 32 MB per call to anyone | gone |
| Listing JSON no longer includes `mediaJson` (importer-only, write-only in JSON) | 20.4 KB per listing view (API → site) | 10.5 KB |
| Deleted MLS listings now remove their Cloudflare photos (cleanup read only the legacy id format) | every removed listing's photos stayed stored and billed | deleted |
| `spring.jpa.open-in-view=false` | DB connection held while JSON is written | released when the query returns |
| Site Docker image: two stages, production deps only, node:24-slim, `.env.local` excluded | 801 MB | 498 MB (faster Cloud Run cold starts) |
| Listing page: phone chat hydrates below `lg` only (`client:media`); mapbox-gl CSS loads when the neighborhood map opens | desktop loaded the chat bubble JS + 40 KB map CSS on every view | neither until needed |

## Pages (measured, production build)

Transfer sizes are what Chrome received (HTML compressed; `/_astro` JS not yet — action #1).

| Page | HTML | JS | Images | Requests | TTFB (warm) | Load | JS heap | Third-party calls per view |
|---|---|---|---|---|---|---|---|---|
| Home `/` (lead page, 2026-10-23; was 3.7 KB gz, 0 JS, 3 requests) | 10.3 KB gz | 206 KB (React 177 KB, hydrated on idle; ~65 KB once gzipped, action #1) | 15 KB (logos) | 14 | ~12–18 ms (counts cached) | 0.20–0.27 s | 2.3 MB | none |
| Blog post (prerendered) | ~80 KB (static file, not gzipped) | 0 | — | 3 | ~7 ms | 0.04 s | 1.2 MB | none |
| Map search `/listings` (desktop) | **31 KB gz** (was 7.1 MB) | 2.0 MB (mapbox-gl 1.76 MB) | — | 25 | ~220 ms (was 1.57 s) | 1.07 s (was 2.15 s) | 24 MB (was 29) | 1 Mapbox map load + tiles |
| Map search `/listings` (phone) | 31 KB gz | 2.0 MB | — | 20 | ~220 ms | 1.13 s (was 1.57 s) | 20 MB (was 27) | 1 Mapbox map load + tiles |
| Listing detail (desktop) | ~25 KB gz | 275 KB (less now: no chat bubble JS, no map CSS) | 365 KB (was 468) | 26 | ~0.1–0.3 s | 0.6–1.0 s | 3 MB | 1 Mapbox static image; 6 Cloudflare deliveries (was 11) |
| Listing detail (phone) | ~25 KB gz | 275 KB | 357 KB (was 506) | 24 | ~0.1 s | 0.31 s | 2.9 MB | 1 Mapbox static image; 4 Cloudflare deliveries (was 10) |
| + open neighborhood map | — | +1.72 MB (mapbox-gl, once) | — | +20 | — | — | +23 MB | 1 Mapbox map load + tiles |

## Features

| Feature | Where | Per use | Billable calls | Notes / guardrails |
|---|---|---|---|---|
| Map search (pins, list, filters, drawn area) | `/listings`, `MapSearch.tsx` | 1 map load per page view; 1 API search per pan/zoom (debounced 400 ms, cached 60 s) | Mapbox GL JS map load | Capped at 200 results, nearest-first; `view=summary` (~10 KB gz per fetch). Drawn area (2026-10-23): up to 1,000 per fetch over the area's bounds (~50 KB gz, ~0.2 s API locally for 295–752 listings), "Show more" pages beyond; the map bills per load, not per pin, and list photos lazy-load, so no extra paid calls. Stale fetches are aborted. Never request full listings for the map. |
| Search box suggestions | `SearchBox.tsx`, `GET /api/listings/suggest` | 1 API call per typing pause (200 ms debounce, ≥2 chars; stale requests aborted) | none (own DB) | LIKE scan; add pg_trgm index if the table grows large. |
| Base map tint | `MapSearch.tsx` | style changes only | none | No extra requests. |
| Listing photos + lightbox | `PhotoGallery.tsx` | 5 mosaic / carousel images up front; lightbox loads on demand; strip uses 120 px thumbs | Cloudflare Images deliveries | Avoid full-size thumbnails (the old plugin loaded 2048 px). |
| Summary card + mini header | `ListingSummary.tsx` | loads only the current photo ± 1 | Cloudflare Images deliveries | Scroll handler is rAF-throttled. |
| Neighborhood map | `map-utils.ts`, `NeighborhoodMap.tsx` | 1 static image per listing view; interactive map only when opened | Mapbox Static Images; Mapbox map load on open | Never put an interactive map on page load (~1.7 MB JS + a map load per view). |
| Listing AI chat | `ListingChat.tsx`, API `/api/chat` | 1 Anthropic call per message (~2,150 in + ~100 out tokens, measured: full features + Close to Home + contact tool; was ~650 in) | Anthropic tokens | Haiku 5.5 (`app.chat.model`, thinking off); last 10 messages; 400-token cap; 10 messages / IP / hour. Usage logged per message. |
| Close to Home (amenity scores) | API `amenity/` | per listing every 90 days: 3 Mapbox isochrone calls + Overpass (shared tiles in batches) + Matrix lookups for the nearest lists (measured 45 suburban, ~65 city; ≤70 elements) + 1 Directions request (street point) | Mapbox Isochrone, Matrix and Directions APIs | Resumable batches; ~1,000 listings ≈ 1,000 isochrone calls/month. Matrix: each batch stops at `amenity.scoring.batch-matrix-budget` (90,000) and the next run resumes, so even 5,000+ production listings (~300k elements) roll out over ~3–4 months inside the free tier instead of a ~$400 first rescore. Self-hosted Valhalla (~$15–25/mo) if that's too slow. |
| Close to Home time strip (desktop, 2026-10-23) | `CloseToHomeTimeStrip.astro` | renders from the listing's stored `nearest` data: measured +34 KB HTML (2.75 KB gzipped) for 15 icons, no JS, no requests | none | Same stored scores as the list; no extra Mapbox or Overpass calls. |
| Overture places import (Close to Home blend) | API `OverturePlacesImporter` | monthly: one DuckDB read of Overture's public Parquet files for MN + border (~28k places, ~25 s, measured 2026-10-23); scoring reads them from Postgres | none (public data, no key) | ~28k rows in `places`. Credit "Overture Maps Foundation". Adds no Overpass or Mapbox calls. |
| Structured data, sitemaps, RSS, robots, llms.txt | `structured-data.ts`, `src/pages/*.ts` | sitemap-listings: 1 slim API call per crawl (cached 1 h) | none | JSON-LD adds ~5–15 KB per page. |
| Phone chat nudge + greeting | `ListingChat.tsx`, `lib/chat-events.ts` | a 1 s timer + scroll/photo listeners until it fires (once per visit) | none: the greeting is written in, not generated; an AI call only happens when the visitor asks | ~1 KB of JS. |
| Logging & monitoring | API `logging/`, Actuator; site `middleware.ts` | 1 access line per request; 1 line per outbound call (media downloads/uploads at DEBUG); metrics in memory | none (log storage: Railway plan / Cloud Logging 50 GiB free) | Prod INFO + JSON; all-SQL logging off (was on in every profile), slow SQL > 200 ms only. ~1 KB of logs per request. |
| Contact form | `/api/contact` | 1 email per submission | Resend | Same-origin only, honeypot, 5 / 15 min and 20 / day per visitor, 50 / day site-wide (Resend free tier is 100/day). Home-page lead forms (2026-10-23) use the same endpoint and caps. |
| Home page lead page (2026-10-23) | `pages/index.astro`, `components/home/`, `lib/markets.ts` | Live for-sale counts: 4 API calls (3 `size=1` searches + data-as-of) per 10 minutes per instance, cached in memory, failures too (1.5 s budget; the numbers just disappear if the API is down). Hero search: the map's `SearchBox` (React, `client:idle`), 1 suggest call per typing pause. Buy/Sell switch is CSS-only; the forms' script is <1 KB. | none (own API; Resend per lead) | The React runtime is the page's main cost (177 KB raw). If home-page weight matters more than the type-ahead, swap it for a plain form that opens /listings (0 JS). Area cards are typographic (no map images), so no Mapbox calls. |
| GA4 analytics (2026-10-23) | `analytics/Analytics.astro`, `lib/analytics.ts` | +157 KB (gtag.js ~155 KB, browser-cached) loaded after `load`, so no effect on first paint/LCP; our chunk 4.5 KB gz; +2 requests per first page view; +270–330 ms idle script after load; +2.1 MB heap | none (GA4 standard is free) | Off when no ID, opted out, or GPC. No Google Tag Manager or extra pixels without measuring. |
| Blog preview cards (2026-10-23) | `/og/blog/<post>.png`, `lib/og-image.ts` | built once per post at build time (~0.1 s each); ~47–50 KB PNG fetched only by social sites when a post is shared | none | Static files; build-only packages (satori, sharp, Inter) stay out of the runtime image. |
| Share buttons (2026-10-23) | `ShareButtons.astro` (listing hero; blog post top + end) | +6 KB HTML per row (1.5 KB gz); one 1.1 KB script (0.6 KB gz), cached; nothing else until a click | none (plain share links; no network SDKs or pixels) | Shared URLs carry `utm_source`/`utm_medium=social_share`; clicks are GA4 `share` events. |
| EULA gate (2026-10-23) | `EulaGate.astro`, `/api/eula` | once per browser session on `/listings` and listing pages: ~1 KB script + 1 small POST; no reload when JS is on | none | The map still loads behind the dialog, so a visitor who never agrees still costs one Mapbox map load (as before). |
| Audit trail §5.9(b) (2026-10-23) | site `lib/audit.ts`, middleware; API `logging/AuditLog` | 1 small JSON log line per /listings page view, search, listing lookup and chat message; the `X-Audit-Session` header makes the browser send a CORS preflight (OPTIONS) before API calls, cached by the browser (Spring's default 30 min) | none (Cloud Logging: well inside the 50 GiB/month free ingestion; 18-month bucket ≈ $0.02/month) | ~0.3–0.5 KB per line. No personal data or typed text. |
| Abuse protection (2026-10-23) | API `abuse/`; site `middleware.ts` | ~µs per request (in-memory buckets); API ≤ ~10 MB at the 50k-client cap; site ≤ 20k entries per window | none (alert emails ≤ 12/day, Resend free tier) | Worst case Anthropic with caps: 300 calls/day ≈ $1–3.60/day; the Anthropic console limit is the hard ceiling. Mapbox/Cloudflare calls are batch-only; their caps are backstops. |

## Third-party pricing (verify before relying)

| Service | Used for | Free tier / month | Beyond free |
|---|---|---|---|
| Mapbox GL JS (web map loads) | map search; neighborhood map when opened | 50,000 loads | ~$5 per 1,000 |
| Mapbox Static Images | listing neighborhood image | 50,000 requests | ~$1 per 1,000 |
| Mapbox Isochrone | amenity scoring | 100,000 requests | ~$2 per 1,000 |
| Mapbox Matrix | Close to Home nearest lists (travel distance/time) | 100,000 elements (origins × destinations) | $2.00 per 1,000 to 500k, then $1.60, then $1.20 (checked 2026-10-23) |
| Mapbox Directions | street point per scored listing (1 request); Phase 2 routes (tabled) | 100,000 requests | $2.00 per 1,000 to 500k (checked 2026-10-23) |
| Cloudflare Images | listing photos | — | ~$5 per 100k stored, ~$1 per 100k delivered |
| Anthropic Claude Haiku 5.5 | listing chat | — | $0.10 / M input, $0.50 / M output (prompts ≤ 100K tokens; was Haiku 4.5 at $1 / $5) |
| Anthropic Claude Opus 5.5 | weekly blog draft | — | $4 / M input, $20 / M output (Sonnet 5.5: $2 / $10) |
| Overpass API (public) | amenity POIs | free (fair use) | — |
| Overture Maps (places) | stores/restaurants OSM lacks | free (public S3, open licenses) | — |
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
| Mapbox Matrix (nearest lists, 90-day refresh) | ~1,000 listings × ~55 / 3 ≈ 18k elements | $0 (free tier) |
| Chat messages (Haiku 5.5; ~2,800 in + ~130 out tokens) | 1,600 × ~$0.0004 | **~$0.60** (was ~$5.30 on Haiku 4.5) |
| Bandwidth: map search pans (say 10 per visit) | 50,000 × 10 KB | ~0.5 GB (was ~245 GB at 4.9 MB each) |

Everything stays inside free tiers at this traffic; the remaining lever is CDN
compression for the static JS (action #1).
