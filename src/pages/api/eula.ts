/**
 * POST /api/eula: the visitor agreed to the NorthstarMLS EULA (lib/eula.ts). Sets the session
 * cookie and logs the assent (§5.9(b) audit trail). The gate's script calls it with
 * fetch (204); without JavaScript the gate's form posts here and we redirect back (303).
 */
import type { APIRoute } from "astro";
import { auditLog } from "../../lib/audit";
import { EULA_COOKIE, EULA_VERSION, safeReturnPath } from "../../lib/eula";

export const POST: APIRoute = async ({ request, cookies }) => {
  const form = await request.formData().catch(() => null);
  const returnTo = safeReturnPath(form?.get("return")?.toString());

  // Session cookie: no expiry, so the next browser session asks again ("once during each
  // viewing session"). Readable by the server (to skip the dialog) and harmless if forged.
  cookies.set(EULA_COOKIE, EULA_VERSION, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure:
      new URL(request.url).protocol === "https:" ||
      request.headers.get("x-forwarded-proto") === "https",
  });

  // One audit line per assent (§5.9(b)): time (log timestamp), version, session + request
  // id. No IP or other personal data (CLAUDE.md logging rules).
  auditLog("eula_accept", { version: EULA_VERSION });

  if (request.headers.get("accept")?.includes("application/json")) {
    return new Response(null, { status: 204 });
  }
  return new Response(null, { status: 303, headers: { Location: returnTo } });
};
