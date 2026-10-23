/**
 * POST /api/contact: emails the team a contact-form or chat contact-card request (Resend).
 *
 * Every send is a billable, reputation-bearing email, so it's guarded in layers:
 * middleware.ts checks the Origin and declared size and rate-limits per visitor; here the
 * body read is capped, a hidden honeypot field catches form-filling bots, fields are
 * length-capped, and a daily cap on sends bounds the total however many visitors there are.
 */
import type { APIRoute } from "astro";
import { Resend } from "resend";
import { agent, site } from "../../lib/site.config";
import { clientIpFrom, logAbuse } from "../../middleware";

const resend = new Resend(import.meta.env.RESEND_API_KEY);

/** Escapes text for the email's HTML (form values and AI-drafted text are untrusted). */
const esc = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

// ─── Limits ──────────────────────────────────────────────────────────────────

/** Largest body read; the middleware rejects bigger declared sizes before this. */
const MAX_BODY_BYTES = 16 * 1024;

/**
 * Emails per UTC day across all visitors (per server instance). Real inquiries are a few a
 * day; Resend's free tier is 100/day. Over the cap the visitor is asked to call or email.
 */
const DAILY_SEND_CAP =
  Number(process.env.CONTACT_DAILY_SEND_CAP || import.meta.env.CONTACT_DAILY_SEND_CAP) || 50;
let sendDay = "";
let sentToday = 0;

/** Field length caps (characters). */
const MAX = { name: 120, email: 200, phone: 40, intent: 100, message: 5000 };

const json = (status: number, body: object): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Reads the body as form data, or null if it's over MAX_BODY_BYTES or unreadable. */
async function readForm(request: Request): Promise<FormData | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return await new Response(body, { headers: request.headers }).formData();
  } catch {
    return null;
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {
  const ip = clientIpFrom(request);
  const data = await readForm(request);
  if (!data) {
    logAbuse({ abuseType: "bad_request", rule: "contact", status: 413, ip });
    return json(413, { success: false, error: "That message is too long. Please shorten it." });
  }

  // Honeypot: a field people never see (hidden in the form), which bots fill in. Answer
  // "sent" so the bot learns nothing, and send nothing.
  if (data.get("website")?.toString().trim()) {
    logAbuse({ abuseType: "bad_request", rule: "contact_honeypot", status: 200, ip });
    return json(200, { success: true });
  }

  const field = (key: keyof typeof MAX): string | undefined =>
    data.get(key)?.toString().trim() || undefined;
  const name = field("name");
  const email = field("email");
  const phone = field("phone");
  const intent = field("intent");
  const message = field("message");
  // Sent by the listing chat's contact card: which listing the request is about. Only a
  // site listing path is accepted, so the email can't carry an arbitrary link.
  const listingAddress = data.get("listingAddress")?.toString().trim().slice(0, 200);
  const rawPath = data.get("listingPath")?.toString().trim() ?? "";
  const listingUrl = /^\/listings\/[a-z0-9-]+$/.test(rawPath)
    ? new URL(rawPath, site.siteUrl).toString()
    : "";

  // Basic validation — return 400 if required fields are missing
  if (!name || !email || !message) {
    return json(400, { success: false, error: "Name, email, and message are required." });
  }
  const tooLong = (Object.keys(MAX) as (keyof typeof MAX)[]).find(
    (k) => (field(k)?.length ?? 0) > MAX[k],
  );
  if (tooLong || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    logAbuse({ abuseType: "bad_request", rule: "contact", status: 400, ip });
    return json(400, {
      success: false,
      error: tooLong
        ? `Please shorten the ${tooLong} field (up to ${MAX[tooLong]} characters).`
        : "Please enter a valid email address.",
    });
  }

  // Daily cap on emails sent (spend + sender reputation), counted before sending.
  const today = new Date().toISOString().slice(0, 10);
  if (today !== sendDay) {
    sendDay = today;
    sentToday = 0;
  }
  if (sentToday >= DAILY_SEND_CAP) {
    logAbuse({ abuseType: "spend_cap", rule: "resend", status: 503, ip });
    return json(503, {
      success: false,
      error: `We couldn't send your message right now. Please call or email us at ${agent.email}.`,
    });
  }
  sentToday++;

  try {
    // Resend reports most failures in `error` rather than throwing.
    const { error } = await resend.emails.send({
      from: `${site.name} <onboarding@resend.dev>`, // Resend's test sender — works without a verified domain
      to: agent.email,
      replyTo: email,
      subject: `New inquiry from ${name}${listingAddress ? ` about ${listingAddress}` : ""} — ${site.name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1612;">New Contact Form Submission</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #7a7060; width: 140px;">Name</td>
              <td style="padding: 8px 0; font-weight: 600;">${esc(name)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #7a7060;">Email</td>
              <td style="padding: 8px 0;"><a href="mailto:${esc(email)}">${esc(email)}</a></td>
            </tr>
            ${
              phone
                ? `
            <tr>
              <td style="padding: 8px 0; color: #7a7060;">Phone</td>
              <td style="padding: 8px 0;">${esc(phone)}</td>
            </tr>`
                : ""
            }
            ${
              intent
                ? `
            <tr>
              <td style="padding: 8px 0; color: #7a7060;">Looking to</td>
              <td style="padding: 8px 0;">${esc(intent)}</td>
            </tr>`
                : ""
            }
            ${
              listingAddress
                ? `
            <tr>
              <td style="padding: 8px 0; color: #7a7060;">Listing</td>
              <td style="padding: 8px 0;">${listingUrl ? `<a href="${esc(listingUrl)}">${esc(listingAddress)}</a>` : esc(listingAddress)}</td>
            </tr>`
                : ""
            }
            <tr>
              <td style="padding: 8px 0; color: #7a7060; vertical-align: top;">Message</td>
              <td style="padding: 8px 0;">${esc(message)}</td>
            </tr>
          </table>
        </div>
      `,
    });
    if (error) throw new Error(error.name);

    return json(200, { success: true });
  } catch (error) {
    // The error only: never the form's content.
    console.error("Resend error:", error instanceof Error ? error.message : "unknown");
    return json(500, { success: false, error: "Failed to send message. Please try again." });
  }
};
