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
    email: "jamesvsawicki@gmail.com",
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
} as const;

// Named re-exports so callers can destructure exactly what they need:
//   import { agent, brokerage, site } from "../lib/site.config";
export const { agent, brokerage, site } = siteConfig;
