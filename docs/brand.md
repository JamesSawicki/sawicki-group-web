# Brand: where to change names, logos, bios and contact details

Every brand item lives in **`src/lib/site.config.ts`**. Edit it there and the change
shows up on every page, in the footer, JSON-LD, `llms.txt`, RSS and emails on the next
build. Values still unknown are empty with a `TODO-JIM:` comment (grep for it); the site
leaves empty values out rather than showing a blank. Never guess a license number or
contact detail.

| To change...                         | Edit                                                                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| The team name or tagline             | `site.name` (the `SITE_NAME` const), `site.tagline`                                                                                           |
| The logo                             | Put the file in `public/`, then set `logos.full` (or `mark`, `fullOnDark`) with its `src`, `width`, `height` and `alt`                        |
| What the header shows                | `site.headerLogo`: `"wordmark"` (the name in type, today), `"full"`, `"mark"` or `"fullOnDark"`                                               |
| The favicon                          | Put the file in `public/` and set `site.faviconPath`                                                                                          |
| The link-preview image               | Replace `public/og-default.jpg` (1200×630) or set `site.ogImagePath`                                                                          |
| A bio, headshot or highlights        | That person's entry in `team` (Jim's is the `jim` const above it). A member with a `bio` gets an About-page profile automatically             |
| A phone number                       | The person's `phone: { tel: "digits only", display: "(952) 212-1586" }`; office/brokerage phones in `office.phone` / `brokerage.phone`        |
| An email                             | The person's `email` (Jim's is also where the contact form sends)                                                                             |
| A license number                     | The person's `licenseNumber` (shown in the footer and JSON-LD) or `brokerage.licenseNumber`                                                   |
| The brokerage name, logo, phone, URL | `brokerage` (shown in the footer on every page and on the Contact page: NorthstarMLS §5.8(a)(ii) and Minnesota ad rules)                      |
| The office address                   | `office` (JSON-LD shows the address once `streetAddress` is set)                                                                              |
| Social links                         | `social` (URL) and `socialLabels` (link text); TypeScript requires both                                                                       |
| The chat bubble's "AI" placeholder   | `chatBubble.label`, or set `logos.mark` (the bubble uses it as its image once the island reads `chatBubble`)                                  |
| The blog's name / AI byline          | `site.blogName`, `site.aiAuthorName`                                                                                                          |
| The accent color (eyebrows, links)   | `--color-accent` / `--color-accent-strong` in `src/styles/global.css` (classes `text-accent`, `hover:text-accent-strong`)                     |
| The logo colors                      | `--color-brand-navy` / `--color-brand-gold` in `src/styles/global.css`, and `brandColors` in `site.config.ts` for code that can't use classes |
| MLS disclaimers                      | `mls` — VERIFY-IDX wording; follow NorthstarMLS rules, don't reword casually                                                                  |

## Logo files

Brokerage logos (supplied by Jim, 2026-10-23) live in `public/brand/coldwell-banker/` and are
served at `/brand/coldwell-banker/<file>`. Use them only as Coldwell Banker's brand rules allow
(TODO-JIM: confirm the approved lockup and minimum size with the broker).

| File | Layout | Color / background | Size (px) |
| --- | --- | --- | --- |
| `cbr-horizontal-black.png` | Boxed mark beside two-line wordmark | Black, transparent | 1709×400 |
| `cbr-horizontal-black.jpg` | Same | Black on white | 1709×400 |
| `cbr-vertical-black.png` | Boxed mark above wordmark | Black, transparent | 2000×1144 |
| `cbr-vertical-black.jpg` | Same | Black on white | 2000×1144 |
| `cbr-horizontal-white.png` | Mark beside two-line wordmark | White, transparent (dark backgrounds) | 1642×440 |
| `cbr-oneline-white.png` | Mark + "COLDWELL BANKER \| REALTY" on one line | White, transparent | 2150×220 |
| `cbr-vertical-white.png` | Mark above one-line wordmark | White, transparent | 2000×1210 |
| `cbr-stacked-white.png` | Mark above two-line wordmark | White, transparent | 1100×1386 |

On our white pages the horizontal black PNG is the natural choice (header/footer credit);
the white versions are for dark backgrounds (e.g. a dark footer or photo overlays).

## Components

Markup that shows brand items uses these (in `src/components/brand/`), so it never repeats:

- `Logo.astro` — any logo slot; falls back to the name in type if a variant's file isn't set.
- `ContactLine.astro` — a phone (tel:) or email (mailto:) link; renders nothing if unset.
- `BrokerageCredit.astro` — our brokerage's logo, name, service area, license, phone.
- `TeamMemberProfile.astro` — a team member's About-page profile.
- `../Footer.astro` — the site footer (brokerage block, social links, license line).

React islands import plain data straight from `site.config.ts` (e.g.
`import { chatBubble, primaryContact } from "../lib/site.config"`); each section is its
own export, so only that piece ships to the browser.

## Still hardcoded elsewhere (to move onto the config)

- `src/components/ListingChat.tsx` — the bubble's "AI" text (use `chatBubble`).
- `src/components/listing/ContactRequestCard.tsx` — "The Sawicki Group" twice (use `site.name`).
- `src/pages/blog/index.astro`, `src/pages/blog/[id].astro` — "The Sawicki Group AI" byline
  (use `site.aiAuthorName`), "Market Updates" headings (`site.blogName`), `text-amber-*`
  (`text-accent`).
- `src/pages/rss.xml.ts` — author "Jim Sawicki" (use `primaryContact.name`), AI byline
  (`site.aiAuthorName`), "Market Updates" (`site.blogName`).
- `src/lib/api.ts` — "The Sawicki Group" in the 503 page title (use `site.name`).
- `src/pages/api/contact.ts` — uses the deprecated `agent` (use `primaryContact`).
- `src/components/listing/SummarySidebar.astro` — uses the deprecated `agent`.
- `src/pages/privacy.astro` — uses the deprecated `agent`; `text-amber-*`.
- `src/pages/404.astro`, `src/components/ListingCard.astro`, `src/lib/listing-utils.ts` —
  `text-amber-*` (use `text-accent`).
- `src/components/ListingDisclosure.astro` — EHO and NorthstarMLS logos are text placeholders.
- `public/favicon.svg`, `public/favicon.ico` — still Astro's default icon.
