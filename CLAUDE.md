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

## More context

Cross-repo identifiers, URLs and env var details: `../cowork-context/project-identifiers_6-6-26.md`.
Keep this file current: when a convention or workflow changes, update it in the same change.
