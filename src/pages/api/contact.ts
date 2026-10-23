import type { APIRoute } from "astro";
import { Resend } from "resend";
import { agent, site } from "../../lib/site.config";

const resend = new Resend(import.meta.env.RESEND_API_KEY);

/** Escapes text for the email's HTML (form values and AI-drafted text are untrusted). */
const esc = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

export const POST: APIRoute = async ({ request }) => {
  // Parse the form data from the request body
  const data = await request.formData();
  const name = data.get("name")?.toString().trim();
  const email = data.get("email")?.toString().trim();
  const phone = data.get("phone")?.toString().trim();
  const intent = data.get("intent")?.toString().trim();
  const message = data.get("message")?.toString().trim();
  // Sent by the listing chat's contact card: which listing the request is about. Only a
  // site listing path is accepted, so the email can't carry an arbitrary link.
  const listingAddress = data.get("listingAddress")?.toString().trim().slice(0, 200);
  const rawPath = data.get("listingPath")?.toString().trim() ?? "";
  const listingUrl = /^\/listings\/[a-z0-9-]+$/.test(rawPath)
    ? new URL(rawPath, site.siteUrl).toString()
    : "";

  // Basic validation — return 400 if required fields are missing
  if (!name || !email || !message) {
    return new Response(
      JSON.stringify({ success: false, error: "Name, email, and message are required." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    await resend.emails.send({
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

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Resend error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to send message. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
