/**
 * /robots.txt — crawl rules and the sitemap location (generated so the sitemap URL
 * follows site.siteUrl).
 *
 * Search engines may crawl everything except the API. AI crawlers (model training and
 * AI search bots) may read the blog, team and other pages but not the listing pages:
 * VERIFY-IDX — MLS rules restrict reuse of listing data, so listing access for AI bots
 * stays off until checked with NorthstarMLS. A crawler follows only the most specific
 * group naming it, so each group repeats the shared rules.
 */
import type { APIRoute } from "astro";
import { absoluteUrl } from "../lib/structured-data";

const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "PerplexityBot",
  "CCBot",
  "Bytespider",
  "meta-externalagent",
  "Amazonbot",
];

export const GET: APIRoute = () =>
  new Response(
    `# ${absoluteUrl("/")}
User-agent: *
Allow: /
Disallow: /api/

# AI crawlers: welcome on the blog and site pages; listings are off-limits for now (MLS data rules).
${AI_CRAWLERS.map((bot) => `User-agent: ${bot}`).join("\n")}
Allow: /
Disallow: /api/
Disallow: /listings

Sitemap: ${absoluteUrl("/sitemap.xml")}
`,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
