/** /sitemap-pages.xml — the site's fixed pages. Add new top-level pages here. */
import type { APIRoute } from "astro";
import { absoluteUrl } from "../lib/structured-data";
import { urlset, xmlResponse } from "../lib/sitemap";

const PAGES = [
  "/",
  "/listings",
  "/blog",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/disclaimers",
  "/accessibility",
];

export const GET: APIRoute = () => xmlResponse(urlset(PAGES.map((p) => ({ loc: absoluteUrl(p) }))));
