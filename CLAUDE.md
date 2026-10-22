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
- **Chat island** (`ListingChat.tsx`) sends `{ listingId, messages }` only; the API owns the
  prompt.
- **Types** for API data are in `src/types/listing.ts`; keep them in sync with the API's
  `Listing` entity.
- **MLS/IDX compliance:** listing disclosures (`ListingDisclosure.astro`) and anything marked
  `VERIFY-IDX` in `site.config.ts` follow NorthstarMLS display rules; don't change that
  wording casually.
- **Blog posts** in `src/content/blog/` arrive as `draft: true`; publishing means flipping
  that to `false`.

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
  `src/lib/search-filters.ts` and mirrored into the URL. Tapping a pin or list row opens `search/ListingPreview.tsx` (photo-first card: bottom of the map on phones; on desktop inside a Mapbox popup anchored to the pin). Each fetch returns at most 200
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
- **Listing AI chat** (`ListingChat.tsx`) is a floating widget placed by the listing page:
  an "AI" bubble bottom-right on phones (opens a bottom sheet) and an "AI chat" bar docked
  bottom-right on desktop (opens a panel). Both labels are placeholders for the logo.
- **Check it:** `npm run audit:mobile` (with `npm run dev` running) loads every main page at
  375 / 768 / 1280px, fails on any page wider than the screen, reports small tap targets and
  text, and saves phone screenshots to `.audit/`. For a quick look, Chrome DevTools device
  mode: F12, then Ctrl+Shift+M.

## More context

Cross-repo identifiers, URLs and env var details: `../cowork-context/project-identifiers_6-6-26.md`.
Keep this file current: when a convention or workflow changes, update it in the same change.
