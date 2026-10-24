/**
 * site.config.ts — the one place for brand and identity data: names, logos, team bios,
 * phone numbers, emails, the brokerage and office, social links, and MLS wording.
 *
 * Change something here and it shows up everywhere on the next build (pages, footer,
 * JSON-LD, llms.txt, RSS, emails). See docs/brand.md for "to change X, edit Y".
 *
 * Each section is its own exported const (not just properties of one object) so a React
 * island can `import { chatBubble } from "../lib/site.config"` and the bundler ships only
 * that piece to the browser.
 *
 * Rules:
 *  - Never invent contact details or license numbers. Unknown values stay empty ("" or
 *    null) with a `TODO-JIM:` comment; components and JSON-LD omit empty values.
 *  - Strings marked VERIFY-IDX follow NorthstarMLS display rules; don't reword casually.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** An image in /public, with its intrinsic size (for width/height attributes and JSON-LD). */
export interface BrandImage {
  /** Path under /public, e.g. "/logo.png". */
  src: string;
  /** Intrinsic width in pixels. */
  width: number;
  /** Intrinsic height in pixels. */
  height: number;
  /** Alt text: what the image says, not what it looks like. */
  alt: string;
}

/** A phone number in both forms we need. */
export interface Phone {
  /** Digits only, e.g. "6125550100" (tel: links; JSON-LD adds the +1). */
  tel: string;
  /** Formatted for display, e.g. "(612) 555-0100". */
  display: string;
}

/** A labeled fact shown under a team member's bio ("Experience: 15+ years"). */
export interface Highlight {
  label: string;
  value: string;
}

/** One person on the team. Optional fields are omitted everywhere until filled in. */
export interface TeamMember {
  /** Stable id: the JSON-LD @id fragment (`{siteUrl}/#{id}`). Don't change it once live. */
  id: string;
  name: string;
  /** e.g. "REALTOR®". */
  jobTitle?: string;
  email?: string;
  phone?: Phone;
  /** Minnesota real estate license number. Never guessed. */
  licenseNumber?: string;
  /** Year they joined our brokerage (a year, not "N years", so it never goes stale). */
  brokerageSince?: number;
  /** Square-ish portrait in /public; shown on the About page when set. */
  headshot?: BrandImage;
  /** Bio paragraphs (plain text). A member with a bio gets a profile on the About page. */
  bio?: string[];
  /** Short facts shown under the bio on the About page. */
  highlights?: Highlight[];
}

/** Which logo a slot shows: an image variant, or the site name set in type. */
export type LogoVariant =
  "full" | "compact" | "mark" | "fullOnDark" | "compactOnDark" | "markOnDark" | "wordmark";

// ─── Site ────────────────────────────────────────────────────────────────────

/** Marketing name — nav, footer, <title>, JSON-LD, emails, system prompts. */
const SITE_NAME = "The Sawicki Group";

export const site = {
  /** Marketing name — nav, footer, <title>, JSON-LD, emails, system prompts. */
  name: SITE_NAME,
  /** Tagline from the logo. */
  tagline: "Exceptional Real Estate Marketing & Acquisition",
  /** Default meta description for pages that don't set their own. */
  description:
    "Twin Cities real estate expert serving Minneapolis, Saint Paul, and surrounding communities.",
  /** Canonical URL — no trailing slash. Update when a custom domain is set. */
  siteUrl: "https://sawicki-group-web-43343667811.us-central1.run.app",
  /** Default link-preview image (1200×630), in /public. */
  ogImagePath: "/og-default.jpg",
  /** Browser-tab icon, in /public (the SG letters on navy; /favicon.ico has 16/32/48px). */
  faviconPath: "/favicon-32.png",
  /** Phone home-screen icon (180×180, the SG key on navy). */
  appleTouchIconPath: "/apple-touch-icon.png",
  /** What the header shows: "wordmark" (the name in type) or a logo image variant. */
  headerLogo: "compact" as LogoVariant,
  /** Name of the blog (nav, RSS, JSON-LD). */
  blogName: "Market Updates",
  /** Byline for AI-written blog posts. */
  aiAuthorName: `${SITE_NAME} AI`,
  /** @deprecated Use `logos.full.src` (same file). Kept so existing imports keep working. */
  logoPath: "/logo.png",
};

// ─── Logos ───────────────────────────────────────────────────────────────────

/**
 * Logo files in /public. Render them with `components/brand/Logo.astro`; a variant that's
 * null falls back to the wordmark, so a slot can name a logo before the file exists.
 *
 * Web copies in /brand/sawicki/, built from the originals there by `npm run brand:assets`
 * (scripts/brand-assets.mjs). Our team logo always appears with the Coldwell Banker Realty
 * logo nearby (Minn. Stat. 82.69: a team name only with the brokerage conspicuous).
 */
export const logos: Record<Exclude<LogoVariant, "wordmark">, BrandImage | null> = {
  /** Full logo: SG key, name and tagline, on light backgrounds (the tagline needs ~300px of width). Also the JSON-LD logo. */
  full: {
    src: "/brand/sawicki/logo-full-web.png",
    width: 800,
    height: 253,
    alt: `${site.name}: ${site.tagline}`,
  },
  /** SG key and name, no tagline (too small to read at header size). The header logo. */
  compact: {
    src: "/brand/sawicki/logo-compact-web.png",
    width: 640,
    height: 160,
    alt: site.name,
  },
  /** The SG key alone (4:1), on light backgrounds. */
  mark: {
    src: "/brand/sawicki/mark-web.png",
    width: 400,
    height: 100,
    alt: site.name,
  },
  /** Full logo with white type and the gold key, for large navy areas (the tagline needs ~300px of width). */
  fullOnDark: {
    src: "/brand/sawicki/logo-full-on-dark-web.png",
    width: 800,
    height: 253,
    alt: `${site.name}: ${site.tagline}`,
  },
  /** SG key and name with white type, for navy sections (the home page hero). */
  compactOnDark: {
    src: "/brand/sawicki/logo-compact-on-dark-web.png",
    width: 640,
    height: 160,
    alt: site.name,
  },
  /** The SG key with a white S, for navy sections. */
  markOnDark: {
    src: "/brand/sawicki/mark-on-dark-web.png",
    width: 400,
    height: 100,
    alt: site.name,
  },
};

/**
 * Brand colors from the logo. Tailwind classes use the tokens in `src/styles/global.css`
 * (`text-brand-navy`, `text-accent`, ...); keep the two in sync. Listed here for code that
 * can't use classes (inline email styles, Mapbox paint).
 */
export const brandColors = {
  navy: "#212c64",
  /** The logo's gold, sampled from the logo file (docs/brand-colors.md). */
  gold: "#cb9833",
  /** Gold for text on light backgrounds (passes WCAG AA); `text-accent` in CSS. */
  goldText: "#8e6a24",
  /** Coldwell Banker Blue (PMS 280 C). */
  cbBlue: "#012169",
} as const;

// ─── Brokerage ───────────────────────────────────────────────────────────────

/**
 * Our brokerage. NorthstarMLS §5.8(a)(ii): its name, logo and contact info must be at
 * least as prominent as any other brokerage's on the site; Minnesota requires the
 * broker's name in advertising. `components/brand/BrokerageCredit.astro` renders it.
 */
export const brokerage: {
  name: string;
  /** Licensed entity name, if it differs from the trade name (Minn. Stat. 82.69). */
  legalName: string;
  /** Primary managing broker, if the broker wants it shown. */
  primaryBroker: string;
  serviceArea: string;
  state: string;
  stateName: string;
  logo: BrandImage | null;
  /** White version of `logo`, for dark backgrounds (the home page hero). */
  logoOnDark: BrandImage | null;
  licenseNumber: string;
  /**
   * Coldwell Banker's required trademark disclaimer, shown in the footer whenever it's set
   * (CB Identity Standards p. 60). TODO-JIM: get the current wording from the broker; the
   * 2020 manual's version names Realogy Brokerage Group, which has since been renamed.
   */
  trademarkNotice: string;
  phone: Phone | null;
  url: string;
} = {
  name: "Coldwell Banker Realty",
  /**
   * The licensed entity Coldwell Banker Realty operates under in Minnesota (Jim, 2026-10-23;
   * Minn. Stat. 82.68: business is conducted in the broker's licensed name).
   */
  legalName: "Burnet Realty LLC",
  /** TODO-JIM: primary managing broker's name, if it should be shown. */
  primaryBroker: "",
  serviceArea: "Twin Cities, Minnesota",
  state: "MN",
  stateName: "Minnesota",
  /**
   * Horizontal framed logo in Coldwell Banker Blue, a 342×81 web copy of public/brand/
   * coldwell-banker/cbr-horizontal-blue.png (built by `npm run brand:assets`). CB allows the
   * framed logo only in CB Blue, on light backgrounds (Identity Standards p. 11–12).
   */
  logo: {
    src: "/brand/coldwell-banker/cbr-horizontal-blue-web.png",
    width: 342,
    height: 81,
    alt: "Coldwell Banker Realty",
  },
  /** White monogram logo for navy sections: 342×92 web copy of cbr-horizontal-white.png. */
  logoOnDark: {
    src: "/brand/coldwell-banker/cbr-horizontal-white-web.png",
    width: 342,
    height: 92,
    alt: "Coldwell Banker Realty",
  },
  /** License numbers aren't required on the site (the brokerage confirmed, 2026-10-23). */
  licenseNumber: "",
  /** TODO-JIM: CB's required trademark disclaimer (see the interface note). */
  trademarkNotice: "",
  /** TODO-JIM: brokerage/office main phone (or leave null to show only ours). */
  phone: null,
  /** TODO-JIM: brokerage website, if it should be linked. */
  url: "",
};

/**
 * The official office: Coldwell Banker Realty, Wayzata. Structured data omits the address
 * until the street address is filled in.
 */
export const office: {
  name: string;
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  phone: Phone | null;
} = {
  name: "Coldwell Banker Realty – Wayzata",
  /** TODO-JIM: Wayzata office street address. */
  streetAddress: "",
  addressLocality: "Wayzata",
  addressRegion: "MN",
  /** TODO-JIM: Wayzata office ZIP code. */
  postalCode: "",
  /** TODO-JIM: Wayzata office phone. */
  phone: null,
};

// ─── Team ────────────────────────────────────────────────────────────────────

/** Jim: the site's main contact (contact form recipient, click-to-call, blog author). */
const jim = {
  id: "jim-sawicki",
  name: "Jim Sawicki",
  jobTitle: "REALTOR®",
  email: "jsawicki@CBRealty.com",
  phone: { tel: "9522121586", display: "(952) 212-1586" },
  /** Optional: not required by the brokerage (2026-10-23); shown in the footer and JSON-LD if set. */
  licenseNumber: "",
  // TODO-JIM: headshot — add `headshot: { src: "/team/jim-sawicki.jpg", width, height, alt }`.
  bio: [
    "I've spent over 15 years helping buyers and sellers navigate the Twin Cities real estate market — from first-time buyers finding their footing in a competitive market, to long-time homeowners making their next move after decades in the same neighborhood.",
    "In between, I went back to school and earned a degree in Computer Science. That background shapes how I work. I use data, technology, and systems thinking to give my clients an edge. That means sharper pricing analysis, faster response times, and tools that most agents simply don't have access to.",
    "My focus is Saint Paul and Minneapolis proper. Crocus Hill, Mac-Groveland, Highland Park, Linden Hills, Northeast, and the surrounding neighborhoods I know block by block. I don't try to cover the entire metro. I cover my market well.",
    "If you're thinking about buying or selling in the Twin Cities, I'd rather have a real conversation than send you a brochure. Reach out and let's talk.",
  ],
  /** Licensed with Coldwell Banker Realty since 2008 (Jim, 2026-10-23). */
  brokerageSince: 2008,
  highlights: [
    { label: "Experience", value: "Licensed since 2008" },
    { label: "Focus Area", value: "Minneapolis & Saint Paul" },
  ],
} satisfies TeamMember;

/**
 * Everyone on the team, in display order (JSON-LD Person nodes, llms.txt, About page).
 * Add title/email/phone/bio per person only once confirmed — never invent contact details.
 */
export const team: TeamMember[] = [
  jim,
  // TODO-JIM: Kathy's title, email, phone, license number, headshot and bio. With a bio she
  // gets her own profile on the About page automatically. brokerageSince: Jim recalls
  // "maybe 1996"; confirm the year before setting it.
  { id: "kathy-sawicki", name: "Kathy Sawicki" },
];

/** The site's main contact (Jim). Use this rather than `team[0]`. */
export const primaryContact = jim;

/**
 * @deprecated Use `primaryContact` (or `team`). Jim's details in the original flat shape,
 * derived from his team entry so they can't drift; kept so existing imports keep working.
 */
export const agent = {
  name: jim.name,
  title: jim.jobTitle,
  licenseText: "Licensed in Minnesota",
  email: jim.email,
  /** Digits only (tel: links). */
  phone: jim.phone.tel,
  /** Formatted for display. */
  phoneDisplay: jim.phone.display,
};

// ─── Markets ─────────────────────────────────────────────────────────────────

/** A map box in degrees, as `/listings` takes it in its URL (minLat, maxLat, ...). */
export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** One of the areas the home page is organized around, with the team member who covers it. */
export interface MarketArea {
  /** Stable id: sent with home-page leads (`area`) so /api/contact can route them. */
  id: string;
  /** Display name, e.g. "Lake Minnetonka & West Metro". */
  name: string;
  /** `team` id of the specialist; leads for this area go to their email (Jim's if unset). */
  specialistId: string;
  /** Places we name on the card: facts about where, never about who lives there. */
  places: string[];
  /**
   * The area's map box: the card's "Search" link opens /listings on it, and the home page
   * counts the for-sale listings inside it. Approximate; boxes don't overlap.
   */
  bounds: MapBounds;
  /** Optional photo of the area (one we own the rights to); the card is typographic without it. */
  image: BrandImage | null;
}

/**
 * The three markets, in display order (Jim, 2026-10-23): Kathy covers Lake Minnetonka and
 * the outer west metro; Jim covers Minneapolis with the south metro and Saint Paul with the
 * east metro.
 */
export const markets: MarketArea[] = [
  {
    id: "lake-minnetonka",
    name: "Lake Minnetonka & West Metro",
    specialistId: "kathy-sawicki",
    places: [
      "Wayzata",
      "Minnetonka",
      "Orono",
      "Excelsior",
      "Mound",
      "Minnetrista",
      "Independence",
      "Medina",
    ],
    bounds: { minLat: 44.86, maxLat: 45.08, minLng: -93.82, maxLng: -93.4 },
    image: null, // TODO-JIM: a Lake Minnetonka photo we own (about 1200×800)
  },
  {
    id: "minneapolis",
    name: "Minneapolis & South Metro",
    specialistId: "jim-sawicki",
    places: ["Minneapolis", "Edina", "Richfield", "Bloomington", "Burnsville", "Lakeville"],
    bounds: { minLat: 44.62, maxLat: 45.06, minLng: -93.4, maxLng: -93.17 },
    image: null, // TODO-JIM: a Minneapolis photo we own
  },
  {
    id: "saint-paul",
    name: "Saint Paul & East Metro",
    specialistId: "jim-sawicki",
    places: ["Saint Paul", "Roseville", "Maplewood", "Woodbury", "Stillwater", "Eagan"],
    bounds: { minLat: 44.78, maxLat: 45.1, minLng: -93.17, maxLng: -92.75 },
    image: null, // TODO-JIM: a Saint Paul photo we own
  },
];

// ─── Proof ───────────────────────────────────────────────────────────────────

/** A fact about our track record, shown in the home page's proof bar. */
export interface ProofPoint {
  /** The figure, e.g. "250+". */
  value: string;
  /** What it counts, e.g. "homes sold". */
  label: string;
  /** Where it can be checked (kept for us; shown as a footnote when set). */
  source: string;
}

/**
 * Track-record facts (homes sold, volume, designations, awards). Only numbers we can back
 * with records; the proof bar is hidden while this is empty.
 * TODO-JIM: supply figures + their source (e.g. "Coldwell Banker production report, 2025").
 */
export const proofPoints: ProofPoint[] = [];

/** A client review, quoted exactly and with the client's permission. */
export interface Review {
  /** The client's words, unedited (FTC 16 CFR 465: no edited or invented reviews). */
  quote: string;
  /** How the client agreed to be named, e.g. "Sarah K.". */
  name: string;
  /** e.g. "Sold in Wayzata, 2025". */
  context: string;
  /** Where it was posted, e.g. "Google", "Zillow". */
  source: string;
  /** Link to the original review, if public. */
  url: string;
}

/** Client reviews for the home page; the section is hidden while this is empty. */
export const reviews: Review[] = [];

// ─── Social and chat ─────────────────────────────────────────────────────────

/** Official social profiles (footer links, schema.org sameAs). Add each channel as it goes live. */
export const social = {
  facebook: "https://www.facebook.com/TheSawickiGroup/",
};

/** Link text for each social profile (TypeScript requires one per channel in `social`). */
export const socialLabels: Record<keyof typeof social, string> = {
  facebook: "Facebook",
};

/**
 * The listing chat's avatar (the round bubble on phones). Shows `image` when set,
 * otherwise `label`. Plain data so the React island can import it.
 */
export const chatBubble: { label: string; image: BrandImage | null } = {
  label: "AI",
  // Stays the "AI" label: the chat must always read as AI (NorthstarMLS §5.8(e)), and the
  // 4:1 SG key would be a sliver in the 28px round bubble.
  image: null,
};

// ─── MLS IDX compliance ──────────────────────────────────────────────────────
// Strings marked // VERIFY-IDX follow the NorthstarMLS Rules (eff. 2026-07-01) in
// docs/compliance/. The listing disclaimer and limited-use notice live in
// ListingDisclosure.astro. When a new rules edition arrives, grep "VERIFY-IDX" and
// re-check each string against it.
export const mls = {
  name: "NorthstarMLS",
  /** Short name used in inline attribution. */
  shortName: "NorthstarMLS",
  /** Year for the copyright notice — bump every January. */
  copyrightYear: 2026,
  /**
   * VERIFY-IDX: copyright/attribution. The 2026 rules replaced the old "Broker Reciprocity
   * Program" with limited electronic advertising (§5.10–5.11); the compilation copyright
   * belongs to the Regional Multiple Listing Service of Minnesota, Inc. (§8.3).
   */
  copyrightNotice:
    "© 2026 Regional Multiple Listing Service of Minnesota, Inc. All rights reserved. Listing data from NorthstarMLS; listings of other brokerages are displayed under NorthstarMLS limited electronic advertising rules.",
  /** VERIFY-IDX: Coldwell Banker franchise + NAR Fair Housing wording. */
  fairHousingStatement:
    "The Sawicki Group and Coldwell Banker Realty are committed to the principles of the Fair Housing Act and the Equal Opportunity Act.",
  /**
   * VERIFY-IDX: §5.5(a), the required line under any summary of MLS data (counts, market
   * stats), followed by the period: "... for the period (date) through (date)."
   */
  compositeReportSource:
    "Based on information from the REGIONAL MULTIPLE LISTING SERVICE OF MINNESOTA, INC for the period",
} as const;

// ─── Everything at once ──────────────────────────────────────────────────────

/** All sections in one object, for callers that want `siteConfig.x`. */
export const siteConfig = {
  agent,
  brokerage,
  team,
  primaryContact,
  office,
  markets,
  proofPoints,
  reviews,
  social,
  socialLabels,
  site,
  logos,
  brandColors,
  chatBubble,
  mls,
};
