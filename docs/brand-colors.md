# Custom brand: website colors

Every color the website uses, where it comes from, and where it's used. The site's palette
is The Sawicki Group logo's navy and gold, with the Coldwell Banker palette alongside.

**How to change a color:** edit the token in `src/styles/global.css` (Tailwind classes are
built from it), mirror it in `brandColors` in `src/lib/site.config.ts` if it's there, and
update this page in the same change.

Sources:

- The Sawicki Group logo (`public/brand/sawicki/`); its colors were sampled from the logo file.
- Coldwell Banker Identity Standards, edition 12.20: color palette p. 16
  ([cb-color-palette.pdf](brand/cb-color-palette.pdf)), digital palette p. 18. The full
  manual is `2 - Web and Graphic Assets/ColdwellBankerIdentityStandards.pdf` in Jim's
  Google Drive (20 MB, not in the repo); the rules that affect the site are in
  [brand.md](brand.md#coldwell-banker-identity-standards).

## Sawicki Group colors (our accent)

| Token (class)                                | Hex       | Where it comes from                             | Used for                                                                                                                        |
| -------------------------------------------- | --------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `brand-navy` (`bg-brand-navy`, ...)          | `#212C64` | Logo navy                                       | Home page hero and "Talk to us" sections, primary buttons, initials circles                                                     |
| `brand-gold` (`bg-brand-gold`, ...)          | `#CB9833` | Logo gold (the key), sampled from the logo file | The gold accent: the market area cards' gold bar, check marks and eyebrow labels on navy, underlines, button hover, focus rings |
| `accent` (`text-accent`)                     | `#8E6A24` | Logo gold, darkened                             | Gold **text** on white or light backgrounds: eyebrow labels, "N homes for sale now", text links                                 |
| `accent-strong` (`hover:text-accent-strong`) | `#70541C` | Logo gold, darkened further                     | Hover state for gold text links                                                                                                 |

**Why two golds:** the exact logo gold is only 2.6:1 against white, too faint for small
text (WCAG AA needs 4.5:1, and our accessibility statement commits to AA). So anything
drawn (bars, icons) and anything on navy (5.0:1) uses the true logo gold, and small text
on white uses the darker `accent` (4.96:1), the same hue. Jim's older color note calls the
yellow "Complementary Yellow #CD9401"; the logo file's gold is `#CB9833`, which the site
follows.

## Buttons and hover colors

Every filled button uses one of three classes from `global.css`, so they look and hover
the same everywhere. Each hover is a clear "offset": navy turns gold, gold turns white.

| Class         | Normal                  | Hover                   | Use                                            |
| ------------- | ----------------------- | ----------------------- | ---------------------------------------------- |
| `btn-primary` | Navy, white text (13:1) | Gold, navy text (5.0:1) | The main action on a light background          |
| `btn-gold`    | Gold, navy text (5.0:1) | White, navy text        | The main action on navy (home page hero forms) |
| `btn-outline` | Navy outline and text   | Navy fill, white text   | Secondary actions beside a primary one         |

All three show a gold (or, on gold, white) focus ring for keyboard users. Add `rounded-lg`,
padding and text size as usual. The map search keeps its own blue buttons and pins
(`MapSearch.tsx`, `FilterDrawer.tsx`) so the selected filters read as part of the map.

## Coldwell Banker palette (available as tokens)

Coldwell Banker Realty is our brokerage, so their palette is available, but per their
standards it's "used sparingly to highlight copy and/or graphic elements." Their logo files
carry their blue; we don't recolor them.

| Token (class)  | Name                             | Hex       | CB tier         | Use on our site                                                              |
| -------------- | -------------------------------- | --------- | --------------- | ---------------------------------------------------------------------------- |
| `cb-blue`      | Coldwell Banker Blue (PMS 280 C) | `#012169` | Primary         | The CB logo's color; anything CB-branded                                     |
| `cb-celestial` | Celestial Blue (PMS 279 C)       | `#418FDE` | Secondary       | Available                                                                    |
| `cb-piano`     | Piano Black                      | `#2D2926` | Secondary       | Available                                                                    |
| `cb-cool-gray` | Cool Gray (PMS Cool Gray 10 C)   | `#63666A` | Secondary       | Available                                                                    |
| `cb-gray`      | Gray                             | `#A7A9AC` | Tertiary        | Available                                                                    |
| `cb-pewter`    | Pewter                           | `#B7B9BA` | Tertiary        | Available                                                                    |
| `cb-slate`     | Slate                            | `#5C86A0` | Tertiary        | Available                                                                    |
| `cb-ocean`     | Ocean                            | `#00B4BD` | Tertiary        | Available                                                                    |
| `cb-cement`    | Cement                           | `#E6DDD1` | Tertiary        | Available (a warm light background)                                          |
| `cb-carolina`  | Carolina                         | `#89D4E3` | Tertiary        | Available                                                                    |
| `cb-ui-blue`   | Digital "Blue"                   | `#1F69FF` | Digital (p. 18) | CB's product color for calls to action; not used (our buttons are navy/gold) |
| `cb-text`      | Digital "90% Black"              | `#2B2E30` | Digital (p. 18) | CB's default text color; not used (we use Tailwind's stone grays)            |

White (`#FFFFFF`) and black (`#000000`) complete CB's primary palette.

## Neutrals and status colors (Tailwind defaults)

- **Text and surfaces:** Tailwind's `stone` grays (warm, close to CB's Piano Black and
  Cement): body text `stone-600`/`stone-700`, headings `stone-900`, borders `stone-200`/`stone-300`.
- **Map search:** Tailwind `blue`/`slate` (pins, selected filters), with the base map tinted
  pale (`MapSearch.tsx`).
- **Status badges** (`listing-utils.ts`): green Active, amber Coming Soon / Pending
  information callouts (CB's standards also use amber for information), red for errors.

## Change log

- 2026-10-24: Sawicki logo gold `#CB9833` replaces `#D19B39`; `accent` changes from
  Tailwind amber-700 (`#B45309`, orange-brown) to the darker logo gold `#8E6A24`, so eyebrow
  labels and counts match the logo. Buttons use `btn-primary` / `btn-gold` / `btn-outline`
  with gold/white hovers. CB palette tokens added. Header/footer CB logo changed from black
  to CB Blue (CB allows the framed logo only in blue).
