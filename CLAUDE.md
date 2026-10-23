# sawicki-group-web

The Sawicki Group (Coldwell Banker) website: Astro 7 SSR (Node adapter) with React islands
and Tailwind. Listing pages are server-rendered from `listing-agent-api`; blog posts are
Markdown content collections, drafted weekly by `sawicki-blog-agent`.

## ⚠️ Deploys

- **Work happens on `dev`** (tracks `origin/dev`); commit and push there freely. `main` is
  the deploy branch and only moves at go-live, with Jim's explicit go-ahead.
- **Pushing to `main` deploys to Cloud Run** (Cloud Build trigger `sawicki-group-web-main`).
  Never push `main` without Jim's explicit go-ahead. **Merging a PR into `main` deploys too**,
  including the blog agent's `drafts` → `main` PRs.
- **Currently OFF (since 2026-10-22, until go-live):** the Cloud Build trigger
  `sawicki-group-web-main` is disabled and the Cloud Run service's ingress is `internal`
  (public URL returns 404). To go live again:
  `gcloud run services update sawicki-group-web --region=us-central1 --ingress=all`, and
  re-enable the trigger (describe it to YAML, set `disabled: false`, `gcloud builds triggers import`).
- **Ship with the API.** Changes to listing fields or the chat contract must deploy in the
  same window as the matching `listing-agent-api` change.

## Run locally

```bash
npm run dev      # http://localhost:4321 — needs the API running (see listing-agent-api)
npm run build    # local production build; does not deploy
```

- **Docker image** (`Dockerfile`, built by Cloud Build): two stages, and the runtime ships
  only `dist/` + production dependencies. Build-time-only packages (Tailwind, types) belong
  in `devDependencies`, or they bloat the image.
- Restart `npm run dev` after editing `.env.local` (Vite reads it once at startup).
- **On a phone (same Wi-Fi):** run `npm run dev -- --host` and open `http://<PC-LAN-IP>:4321`.
  For the map and chat to work there, `.env.local` points `PUBLIC_API_BASE_URL` at the PC's
  LAN IP (not `localhost`), and the API's `dev` profile allows `192.168.*` / `10.*` origins
  (`app.cors.extra-origin-patterns`). If the PC's IP changes, update `.env.local`.
- Env vars: `PUBLIC_API_BASE_URL`, `PUBLIC_MAPBOX_TOKEN`, `PUBLIC_CF_IMAGES_ACCOUNT_HASH`
  (`.env.local`); `RESEND_API_KEY` for the contact form. Never commit `.env*`.

## Conventions

- **Env access in SSR code:** `process.env.X || import.meta.env.X` (Cloud Run sets
  `process.env` at runtime; dev falls back to Vite's `import.meta.env`).
- **API calls from SSR pages** go through `fetchWithTimeout` in `src/lib/api.ts`. A 404 from
  the API → `Astro.rewrite("/404")`; other failures → `serviceUnavailableResponse()` (503).
  Never let an API failure produce a 500 or a hanging render.
- **Listing URLs** are SEO slugs ending in the numeric id. Build them with `listingPath()`
  and parse them with `parseListingId()` (`src/lib/listing-utils.ts`); never hand-build
  `/listings/${id}`. `pages/listings/[id].astro` receives the full slug as its param.
- **Formatting** (prices, baths, lots, amenity scores, labels) lives in
  `src/lib/listing-utils.ts`; reuse it rather than formatting inline.
- **Photos:** use `src/lib/photo-utils.ts`. `photoIds` may be the current
  `[{key, cfId}]` format or the legacy `[cfId]` format; the parser handles both.
- **Chat** (`listing/ChatConversation.tsx`, used by the desktop summary card and the phone
  bubble `ListingChat.tsx`) sends `{ listingId, messages }` (text only); the API
  owns the prompt (listing details + Close to Home) and replies `{ reply, contactRequest? }`.
  A `contactRequest` (the AI's request_contact tool) renders as `listing/ContactRequestCard.tsx`:
  the visitor edits and sends it via `/api/contact`, so the AI never sends anything itself.
- **Types** for API data are in `src/types/listing.ts`; keep them in sync with the API's
  `Listing` entity.
- **MLS/IDX compliance:** listing disclosures (`ListingDisclosure.astro`) and anything marked
  `VERIFY-IDX` in `site.config.ts` follow NorthstarMLS display rules; don't change that
  wording casually.
- **Blog posts** in `src/content/blog/` arrive as `draft: true`; publishing means flipping
  that to `false`.

## Logging

- Every request gets a request id (`middleware.ts` + `lib/request-context.ts`), echoed as
  `X-Request-Id`; `fetchWithTimeout` forwards it to the API, so a page view and the API
  calls behind it share one id in the logs. Use `fetchWithTimeout` for every SSR API call.
- Never log chat or contact-form content, API keys, or full visitor IPs. (A JSON access log
  for the site is on the to-do list.)

## Cost scorecard (every feature)

`docs/cost-scorecard.md` tracks what each feature costs: page weight, requests, latency,
browser memory, server work and billable third-party calls (Mapbox, Cloudflare Images,
Anthropic, ...). **Every feature adds or updates its row** (measure on a production build;
see the doc's header for how) and its effect on the ranked action list. Prefer designs
that keep paid calls off page load (e.g. static map images, libraries loaded on demand).

## Machine-readable data (structured data, sitemaps, feeds)

Goal: as much accurate machine-readable data as the MLS rules allow.

- **JSON-LD on every page.** `Layout.astro` emits one schema.org `@graph`: the site-wide
  entities from `lib/structured-data.ts` (WebSite, the agency as RealEstateAgent, each
  team member as Person, the Wayzata office) plus the page's own nodes via the `jsonLd`
  prop. Build page nodes with the helpers there (`listingNodes`, `blogPostNodes`,
  `webPage`, `breadcrumbList`); link entities by `@id`, never duplicate them.
- **Only state what's known.** Omit missing values; never invent addresses, dates or
  contact details (team/office/social details live in `site.config.ts`).
- **VERIFY-IDX:** a listing's offer is made by the listing brokerage, never us; no sold
  listings anywhere public: they're planned for subscribers only, the public API serves
  only Active/Coming Soon/Pending (a sold listing's page is a 404) and the map has no
  "Sold" filter; AI
  crawlers are kept off `/listings` in `robots.txt.ts`; `llms.txt` doesn't list listing data.
- **Canonical + link previews:** canonical URLs and all absolute URLs come from
  `site.siteUrl` (update it with the custom domain). Pages with a query string (e.g.
  `/listings?minBeds=3`) are `noindex, follow` with the plain page as canonical. Open
  Graph/Twitter tags default to `/og-default.jpg`; listings use their first photo.
- **Endpoints:** `/sitemap.xml` (index) → `sitemap-pages.xml` (add new top-level pages
  there), `sitemap-blog.xml`, `sitemap-listings.xml` (from API `GET /api/listings/sitemap`;
  503 if the API is down); `/robots.txt`, `/llms.txt`, `/rss.xml`, all in `src/pages/*.ts`.

## Code organization and comments

Goal: any file can be read top to bottom and understood without outside context.

**Pages are thin; sections are components.** A page does routing, data fetching, redirects
and `<head>` data, then lays out section components — the markup should read like a table
of contents. Listing-detail sections live in `src/components/listing/` (one component per
visible section). Extract a section into a component once it passes ~40 lines of markup or
is reused; extract a repeated markup pattern into a small helper component (e.g.
`DetailRow.astro`) instead of copy-pasting it.

**Every `.astro` file follows the same layout:**

1. **Header block** (TSDoc `/** ... */`, 3–6 lines): what the file renders and any
   non-obvious decision. Don't list "used by" — it goes stale; use Find All References.
2. **`interface Props`** with a TSDoc line on each prop.
3. **Frontmatter in a fixed order**, each part under a divider comment
   (`// ─── Name ───...`): imports → props → data fetching → derived values.
4. **Markup** with section markers (`{/* ── Name ── */}`) that match the frontmatter names.

**Comment the why, not the what.** Explain decisions, constraints, and gotchas ("rewrite to
/404 so the status code is a real 404"); don't narrate code ("set the title"). Keep
compliance tags like `VERIFY-IDX` greppable. Update or delete a comment when the code under
it changes — a stale comment is worse than none.

**TSDoc on exports.** Exported functions and types in `src/lib/` and component props get a
`/** ... */` summary (plus `@param` when a parameter's meaning or units aren't obvious).
VS Code shows these on hover.

**Formatting and linting** (run before committing):

```bash
npm run format    # Prettier (incl. .astro) — rewrites files
npm run lint      # ESLint (TypeScript, Astro, TSDoc checks) — warnings are to-dos, errors must be fixed
```

## Responsive design (every change must work on a phone)

Many visitors browse on phones, and map search is the primary way people look for homes.

- **Mobile-first Tailwind.** Unprefixed classes describe the phone layout; add `sm:` (640px),
  `md:` (768px), `lg:` (1024px) for wider screens. A multi-column grid is
  `grid-cols-1 md:grid-cols-3`, never a bare `grid-cols-3` (short stat grids excepted).
- **No fixed widths without a breakpoint.** `w-96`, `min-w-[...]` or a fixed `height` must be
  scoped (`lg:w-96`), or the page gets wider than a 375px screen.
- **Tap targets ≥ 44px tall** for anything a thumb hits (nav, buttons, list rows); text links
  get padding (`py-2`) for a taller hit area. Text no smaller than 12px (`text-xs`).
- **Patterns in use:** header links move into a dropdown below `md` (`Header.astro`). Search
  is one page, `/listings` (`/search` and `/map` 301 there): the map comes first with listings
  underneath below `lg` and beside it from `lg` up (`MapSearch.tsx`), and criteria live in a
  drawer opened by a vertical "Filters" edge tab on the left (`search/FilterDrawer.tsx`; tap or swipe; "Show results" closes it only below `lg`) whose filters are defined once in
  `src/lib/search-filters.ts` and mirrored into the URL. Tapping a pin or list row opens `search/ListingPreview.tsx` (photo-first card: bottom of the map on phones; on desktop inside a Mapbox popup anchored to the pin, placed by `popupAnchor()` in
  `MapSearch.tsx`: above, below or beside the pin, whichever keeps the whole card on the map,
  nudging a very short map if nothing fits). Each fetch returns at most 200
  listings, the ones nearest the view's center (API `sortBy=nearest`; the visitor's sort is
  applied in the browser); when more match, the header reads "Showing 200 of N · Zoom in to
  see all". A search box over the map (`search/SearchBox.tsx`, API `/api/listings/suggest`)
  suggests cities/ZIPs (frames them) and listings (flies to one and previews it) from our
  own data. List rows are real links to the listing (crawlable; a plain click previews).
  The hand-drawn area is kept in the URL too (`area=`, `lib/search-area.ts`). If
  the page comes back from the back/forward cache (Back from a listing), it reloads rather
  than trusting a frozen map.
- **Map colors:** the search map uses Mapbox `light-v11`, tinted in `MapSearch.tsx`
  (`tintBaseMap` / `BASE_MAP_TINT`): pale blue water, green parks, tan schools. Keep tints
  pale so the blue listing pins stay the strongest color; it's style-only (no extra cost).
- **Listing page photos & summary:** `PhotoGallery.tsx` (mosaic on desktop, swipe carousel
  on phones) owns the one lightbox, with our own all-photos thumbnail strip; other islands
  open it with `openListingPhoto(i)` (`lib/photo-utils.ts`). `listing/ListingSummary.tsx`
  is the summary card and the phones' slide-down mini header. Desktop: the card is always
  sticky and capped to the window height (media frame max 32vh, chat flexes and scrolls
  inside), with a Map | Photos frame whose photos slide in once the gallery scrolls past
  `#listing-hero-end`, then price/stats and the embedded chat. Phones: price/stats + Contact
  button and click-to-call at the end of the page.
- **Listing neighborhood map:** the page shows only static Mapbox images
  (`lib/map-utils.ts`: the summary card's Map tab on desktop, the Neighborhood button by
  "Back to map" on phones); `listing/NeighborhoodMap.tsx` loads mapbox-gl only when one
  is clicked (streets-v12 + Satellite), adding mapbox-gl's CSS as a `?url` link at that
  moment (a normal CSS import, even a dynamic one, gets linked on every page). Keep it that way: an interactive map on page
  load would add ~1 MB of JS and a billable map load to every listing view.
- **Listing AI chat:** the conversation is `listing/ChatConversation.tsx`. Desktop embeds it in
  the summary card (in place of a "Contact us" button, with a direct contact link + phone
  under it; the card fits the window and the chat scrolls inside it). Phones/tablets open it
  from a round "AI" bubble bottom-right (`ListingChat.tsx`, a bottom sheet, `client:media` so
  desktops never download it) that opens with a
  written greeting + reply buttons (no AI call until the visitor asks). Nudge: after 15 s of
  visible time plus 5 photos viewed or half the page scrolled, the bubble pulses (not with
  reduced motion) and "Questions about this home?" appears; once per visit (sessionStorage).
  The mini header's Contact opens the chat with a showing request. Page events live in
  `lib/chat-events.ts`. "AI" is a placeholder for the logo.
- **Check it:** `npm run audit:mobile` (with `npm run dev` running) loads every main page at
  375 / 768 / 1280px, fails on any page wider than the screen, reports small tap targets and
  text, and saves phone screenshots to `.audit/`. For a quick look, Chrome DevTools device
  mode: F12, then Ctrl+Shift+M.

## More context

Cross-repo identifiers, URLs and env var details: `../cowork-context/project-identifiers_6-6-26.md`.
Keep this file current: when a convention or workflow changes, update it in the same change.
