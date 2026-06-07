/**
 * site.config.ts — Single source of truth for all agent/brokerage identity data.
 *
 * Every page that needs a name, email, phone, or brokerage reference imports from here.
 * Change something once; it propagates everywhere on next build/deploy.
 *
 * `as const` makes every value a narrow literal type so TypeScript catches
 * typos at compile time rather than at runtime.
 */
export const siteConfig = {
  agent: {
    name: "Jim Sawicki",
    title: "REALTOR®",
    licenseText: "Licensed in Minnesota",
    email: "jsawicki@CBRealty.com",
    phone: "9522121586",                      // digits only, e.g. "6125550100" (used in tel: links)
    phoneDisplay: "(952) 212-1586",               // formatted, e.g. "(612) 555-0100" (used in display)
  },

  brokerage: {
    name: "Coldwell Banker Realty",
    serviceArea: "Twin Cities, Minnesota",
    state: "MN",
    stateName: "Minnesota",
  },

  site: {
    /** Marketing name — appears in nav, footer, <title>, JSON-LD, system prompts. */
    name: "The Sawicki Group",
    /** Canonical URL — no trailing slash. Update when a custom domain is set. */
    siteUrl: "https://sawicki-group-web-43343667811.us-central1.run.app",
  },

  // ─── MLS IDX compliance configuration ──────────────────────────────────────
  // Every string marked // VERIFY-IDX is currently industry-standard placeholder
  // text — defensible but not authoritative. When the NorthstarMLS IDX Display
  // Manual arrives, grep "VERIFY-IDX" across the codebase and swap each string
  // for the exact required wording. Do this BEFORE flipping on real MLS
  // ingestion to production.
  mls: {
    name: "NorthstarMLS",
    /** Short name used in inline attribution. */
    shortName: "NorthstarMLS",
    /** Year for the copyright notice — bump every January. */
    copyrightYear: 2026,
    /** VERIFY-IDX: NAR-standard reliability disclaimer. NorthstarMLS may require alternate wording. */
    reliabilityDisclaimer:
      "The information being provided is for consumers' personal, non-commercial use and may not be used for any purpose other than to identify prospective properties consumers may be interested in purchasing. Information is deemed reliable but is not guaranteed accurate by the MLS.",
    /** VERIFY-IDX: standard IDX copyright/attribution. */
    copyrightNotice:
      "© 2026 NorthstarMLS. All rights reserved. The data relating to real estate for sale on this web site comes in part from the Broker Reciprocity Program of NorthstarMLS.",
    /** VERIFY-IDX: Coldwell Banker franchise + NAR Fair Housing wording. */
    fairHousingStatement:
      "The Sawicki Group and Coldwell Banker Realty are committed to the principles of the Fair Housing Act and the Equal Opportunity Act.",
  },
} as const;

// Named re-exports so callers can destructure exactly what they need:
//   import { agent, brokerage, site, mls } from "../lib/site.config";
export const { agent, brokerage, site, mls } = siteConfig;
