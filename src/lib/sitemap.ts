/**
 * Helpers for the XML endpoints (sitemaps, RSS): escaping and response headers.
 * The endpoints themselves live in src/pages (sitemap.xml.ts, sitemap-*.xml.ts, rss.xml.ts).
 */

/** Escapes text for XML element content and attribute values. */
export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** One sitemap <url> entry, with optional last-modified date and image URLs. */
export interface SitemapUrl {
  loc: string;
  lastmod?: string | Date | null;
  images?: string[];
}

/** A <urlset> document (with the image-sitemap namespace when any entry has images). */
export function urlset(urls: SitemapUrl[]): string {
  const body = urls
    .map((u) => {
      const lastmod = u.lastmod ? new Date(u.lastmod).toISOString() : "";
      const images = (u.images ?? [])
        .map((src) => `<image:image><image:loc>${xmlEscape(src)}</image:loc></image:image>`)
        .join("");
      return `<url><loc>${xmlEscape(u.loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}${images}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${body}
</urlset>
`;
}

/** Response for an XML document; crawlers may cache it for an hour. */
export function xmlResponse(xml: string, contentType = "application/xml"): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": `${contentType}; charset=utf-8`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
