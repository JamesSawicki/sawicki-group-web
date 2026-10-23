/**
 * NorthstarMLS End User License Agreement (EULA) assent, required by NorthstarMLS Rules
 * §5.8(j): once per viewing session, the visitor must agree, by an affirmative act, before
 * seeing any MLS data. `components/EulaGate.astro` asks; `pages/api/eula.ts` records the
 * answer in a session cookie (gone when the browser closes, so each visit asks again) and
 * logs it for the §5.9(b) audit trail.
 */

/** Session cookie set once the visitor agrees. No Max-Age, so it ends with the session. */
export const EULA_COOKIE = "mls_eula";

/**
 * Version of the agreement the visitor accepted (stored in the cookie and the log).
 * VERIFY-IDX: bump when the EULA text changes; NorthstarMLS requires adopting each new
 * version within 30 days. TODO-JIM: replace the provisional text on /eula with the
 * official NorthstarMLS EULA and set this to its version/date.
 */
export const EULA_VERSION = "provisional-2026-10-23";

/** Where the full agreement lives (also linked from /terms). */
export const EULA_PATH = "/eula";

/**
 * Only same-site paths may be redirect targets after a no-JavaScript accept, so the
 * endpoint can't be used to bounce visitors to another site.
 */
export function safeReturnPath(value: string | null | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/listings";
}
