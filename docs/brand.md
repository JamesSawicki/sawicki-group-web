# Brand: where to change names, logos, bios and contact details

Every brand item lives in **`src/lib/site.config.ts`**. Edit it there and the change
shows up on every page, in the footer, JSON-LD, `llms.txt`, RSS and emails on the next
build. Values still unknown are empty with a `TODO-JIM:` comment (grep for it); the site
leaves empty values out rather than showing a blank. Never guess a license number or
contact detail.

| To change...                         | Edit                                                                                                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The team name or tagline             | `site.name` (the `SITE_NAME` const), `site.tagline`                                                                                                                                             |
| The logo                             | Replace the original in `public/brand/sawicki/`, run `npm run brand:assets` (rebuilds the web copies and icons), and update the sizes in `logos` if they changed                                |
| What the header shows                | `site.headerLogo`: `"compact"` (today), any other `logos` variant, or `"wordmark"` (the name in type)                                                                                           |
| The favicon / home-screen icon       | Built by `npm run brand:assets` (`favicon.ico`, `favicon-32.png`, `apple-touch-icon.png`, `icon-512.png`); paths in `site.faviconPath`, `site.appleTouchIconPath`                               |
| The link-preview image               | Replace `public/og-default.jpg` (1200×630) or set `site.ogImagePath`                                                                                                                            |
| A bio, headshot or highlights        | That person's entry in `team` (Jim's is the `jim` const above it). A member with a `bio` gets an About-page profile automatically; `brokerageSince` (a year) shows on the home page's team card |
| A phone number                       | The person's `phone: { tel: "digits only", display: "(952) 212-1586" }`; office/brokerage phones in `office.phone` / `brokerage.phone`                                                          |
| An email                             | The person's `email` (Jim's is also where the contact form sends; a home-page lead goes to its area's specialist's email, Jim's if unset)                                                       |
| A home-page market                   | `markets`: name, places, map box (`bounds`), specialist (`specialistId`), optional photo (`image`)                                                                                              |
| Track-record figures / designations  | `proofPoints` (value, label, source); the home page's proof bar appears once there's one                                                                                                        |
| Client reviews                       | `reviews`: exact words, with permission, plus where they were posted; the home page section appears once there's one                                                                            |
| A license number                     | The person's `licenseNumber` (shown in the footer and JSON-LD) or `brokerage.licenseNumber`                                                                                                     |
| The brokerage name, logo, phone, URL | `brokerage` (shown in the footer on every page and on the Contact page: NorthstarMLS §5.8(a)(ii) and Minnesota ad rules); `logoOnDark` is the white logo for navy sections                      |
| The office address                   | `office` (JSON-LD shows the address once `streetAddress` is set)                                                                                                                                |
| Social links                         | `social` (URL) and `socialLabels` (link text); TypeScript requires both                                                                                                                         |
| The chat bubble's "AI" label         | `chatBubble.label`. It stays "AI" rather than our logo: the chat must always read as AI (§5.8(e)), and the 4:1 key is a sliver in the round bubble                                              |
| The blog's name / AI byline          | `site.blogName`, `site.aiAuthorName`                                                                                                                                                            |
| The accent color (eyebrows, links)   | `--color-accent` / `--color-accent-strong` in `src/styles/global.css` (classes `text-accent`, `hover:text-accent-strong`)                                                                       |
| The logo colors                      | `--color-brand-navy` / `--color-brand-gold` in `src/styles/global.css`, and `brandColors` in `site.config.ts` for code that can't use classes                                                   |
| MLS disclaimers                      | `mls` — VERIFY-IDX wording; follow NorthstarMLS rules, don't reword casually                                                                                                                    |

## Logo files

Our team logo (supplied by Jim, 2026-10-24) lives in `public/brand/sawicki/`: the originals
(1370×433 transparent PNGs) and the web copies `npm run brand:assets` builds from them.
Wherever our logo appears, the Coldwell Banker Realty logo appears beside or right under it
(header, home page hero, footer), as Minn. Stat. 82.69 requires for a team name.

| File                                    | What                                         | Used for (`logos` variant)      |
| --------------------------------------- | -------------------------------------------- | ------------------------------- |
| `sawicki-full-color.png`                | Original: navy S + name, gold key + tagline  | source                          |
| `sawicki-full-reverse.png`              | Original: white S + name + tagline, gold key | source                          |
| `sawicki-full-black.png`                | Original: all black                          | print / one-color uses          |
| `sawicki-full-white.png`                | Original: all white                          | photo overlays                  |
| `sawicki-icon-navy.jpg`                 | Original: SG key on a navy square (556×557)  | social profile picture          |
| `logo-compact-web.png`                  | Key + name, no tagline (640×160)             | `compact`: header, footer       |
| `logo-compact-on-dark-web.png`          | Same, white type                             | `compactOnDark`: home page hero |
| `logo-full-web.png`                     | Key + name + tagline (800×253)               | `full`: JSON-LD logo            |
| `logo-full-on-dark-web.png`             | Same, white type                             | `fullOnDark`                    |
| `mark-web.png` / `mark-on-dark-web.png` | The SG key alone (400×100)                   | `mark` / `markOnDark`           |

The tagline is only legible when the logo is at least ~300px wide, so small slots use the
compact version. `public/logo.png` and `public/og-default.jpg` (link previews) are the full
logo on white. The banner and presentation JPGs Jim sent (handshake/skyline photo, 3:2
slides) aren't on the site: the photo's stock license is unknown (TODO-JIM if wanted).

Brokerage logos (supplied by Jim, 2026-10-23; blue versions 2026-10-24) live in
`public/brand/coldwell-banker/` and are served at `/brand/coldwell-banker/<file>`. Use them
only as the rules below allow.

| File                             | Layout                                         | Color / background                                                                                              | Size (px) |
| -------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------- |
| `cbr-horizontal-blue.png`        | Framed (boxed) mark beside two-line wordmark   | CB Blue, transparent: **the site's logo on light backgrounds** (web copy `cbr-horizontal-blue-web.png`, 342×81) | 1709×400  |
| `cbr-horizontal-blue.jpg`        | Same                                           | CB Blue on white                                                                                                | 1709×400  |
| `cbr-vertical-blue.png` / `.jpg` | Framed mark above wordmark                     | CB Blue                                                                                                         | 2000×1144 |
| `cbr-stacked-blue.png` / `.jpg`  | Framed mark above two-line wordmark            | CB Blue                                                                                                         | 1100×1320 |
| `cbr-horizontal-black.png`       | Boxed mark beside two-line wordmark            | Black, transparent (not for the site: see rules)                                                                | 1709×400  |
| `cbr-horizontal-black.jpg`       | Same                                           | Black on white                                                                                                  | 1709×400  |
| `cbr-vertical-black.png`         | Boxed mark above wordmark                      | Black, transparent                                                                                              | 2000×1144 |
| `cbr-vertical-black.jpg`         | Same                                           | Black on white                                                                                                  | 2000×1144 |
| `cbr-horizontal-white.png`       | Mark beside two-line wordmark                  | White, transparent (dark backgrounds)                                                                           | 1642×440  |
| `cbr-oneline-white.png`          | Mark + "COLDWELL BANKER \| REALTY" on one line | White, transparent                                                                                              | 2150×220  |
| `cbr-vertical-white.png`         | Mark above one-line wordmark                   | White, transparent                                                                                              | 2000×1210 |
| `cbr-stacked-white.png`          | Mark above two-line wordmark                   | White, transparent                                                                                              | 1100×1386 |

On white pages the site uses the horizontal **blue** logo (header, footer, disclosures);
on navy it uses the white monogram logo `cbr-horizontal-white.png` (home page hero).

## Coldwell Banker Identity Standards

From the Coldwell Banker Identity Standards (edition 12.20; full manual in Jim's Google
Drive, `2 - Web and Graphic Assets/ColdwellBankerIdentityStandards.pdf`; colors in
[brand-colors.md](brand-colors.md)). The rules that affect the website:

- **Team logo next to theirs (p. 11):** "When shown with the Coldwell Banker logo, agent
  logos must be outside the safety distance around the CB logo, and must be no larger than
  the CB logo." The safety distance is half the height of the blue logo box, and nothing
  else (copy, graphics, divider lines) may sit inside it. So our logo is never taller than
  CB's beside it, with at least half its height of space between them (header, hero, footer).
- **Framed logo color (p. 11–12):** the framed logo (blue box) only in CB Blue (PMS 280),
  never reversed onto a dark background; the monogram logo only in white. So: blue framed
  logo on white pages, white monogram logo on navy. The black versions Jim supplied aren't
  used on the site.
- **Don'ts (p. 11):** no effects, stretching, angles, nothing over or inside the mark,
  never use the mark as a word in a sentence.
- **Minimum size (p. 10):** the logo mark at least 1/8" wide (about 12px on screen); ours
  is 28–44px tall.
- **The name in text (p. 61):** "Coldwell Banker" is an adjective, never a noun ("the
  Coldwell Banker® System", not "join Coldwell Banker"); no punctuation between Coldwell
  Banker and the DBA; no all caps or bold for it in copy.
- **Required disclaimer (p. 60):** "The Minimum Required Disclaimers must appear whenever
  the Coldwell Banker Mark is used," including on websites. For company-owned offices the
  manual gives: "Owned by a subsidiary of Realogy Brokerage Group LLC. Coldwell Banker is a
  registered service mark owned by Coldwell Banker Real Estate LLC." The 2020 manual names
  Realogy, which has since changed its name, so **TODO-JIM: get the current wording from the
  broker** (`brokerage.trademarkNotice` in site.config.ts; the footer shows it once set).
- **Digital (p. 18):** CB's own apps use white space, black text and blue for calls to
  action. Our site uses our navy/gold for actions instead (team brand), which their
  standards don't forbid for an agent site; the CB logo itself always keeps its blue.
- **Fonts (p. 20–22):** CB's brand fonts are Geometos Neue, Helvetica Neue LT Std and
  Adobe Garamond Pro (licensed; files in Drive under `CBBurnet Fonts`). The site keeps its
  own web fonts; CB lists Arial as its web-safe font.

HUD's official Equal Housing Opportunity logo (public domain, from
[hud.gov/contactus/hudgraphics](https://www.hud.gov/contactus/hudgraphics)) is in
`public/brand/hud/`: `equal-housing-opportunity.png` (120×128 web copy, used by
`ListingDisclosure.astro`) and the original 2-inch GIF. HUD's rule: the house picture never
appears without the words "Equal Housing Opportunity".

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
- `src/components/listing/SummarySidebar.astro` — uses the deprecated `agent`.
- `src/pages/privacy.astro` — uses the deprecated `agent`; `text-amber-*`.
- `src/pages/404.astro`, `src/components/ListingCard.astro`, `src/lib/listing-utils.ts` —
  `text-amber-*` (use `text-accent`).
- `src/components/ListingDisclosure.astro` — EHO and NorthstarMLS logos are text placeholders.
- `public/favicon.svg`, `public/favicon.ico` — still Astro's default icon.
