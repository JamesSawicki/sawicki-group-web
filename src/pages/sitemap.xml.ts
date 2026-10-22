/**
 * /sitemap.xml — the sitemap index, pointing at the three sitemaps below. This is the
 * URL submitted to Google Search Console / Bing and named in robots.txt.
 */
import type { APIRoute } from "astro";
import { absoluteUrl } from "../lib/structured-data";
import { xmlEscape, xmlResponse } from "../lib/sitemap";

const SITEMAPS = ["/sitemap-pages.xml", "/sitemap-blog.xml", "/sitemap-listings.xml"];

export const GET: APIRoute = () =>
  xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SITEMAPS.map((p) => `<sitemap><loc>${xmlEscape(absoluteUrl(p))}</loc></sitemap>`).join("\n")}
</sitemapindex>
`);
