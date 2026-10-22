/**
 * /sitemap-listings.xml — every for-sale and pending listing page (the API decides which:
 * GET /api/listings/sitemap; VERIFY-IDX: no sold listings on the public site), with its
 * MLS last-modified time and a few photos (image sitemap).
 *
 * If the API is unreachable this answers 503 rather than an empty sitemap, so crawlers
 * retry later instead of concluding every listing is gone.
 */
import type { APIRoute } from "astro";
import type { Listing } from "../types/listing";
import { fetchWithTimeout } from "../lib/api";
import { listingPath } from "../lib/listing-utils";
import { parsePhotoIds, photoUrl } from "../lib/photo-utils";
import { absoluteUrl } from "../lib/structured-data";
import { urlset, xmlResponse } from "../lib/sitemap";

/** One row of GET /api/listings/sitemap. */
interface SitemapEntry {
  id: number;
  address?: string;
  city?: string;
  postalCity?: string;
  zipCode?: string;
  modificationTimestamp?: string;
  photoIds?: string;
}

/** Photos per listing in the image sitemap; the first few are the ones that matter. */
const IMAGES_PER_LISTING = 5;

export const GET: APIRoute = async () => {
  const apiBase = process.env.PUBLIC_API_BASE_URL || import.meta.env.PUBLIC_API_BASE_URL;
  const accountHash =
    process.env.PUBLIC_CF_IMAGES_ACCOUNT_HASH || import.meta.env.PUBLIC_CF_IMAGES_ACCOUNT_HASH;

  let entries: SitemapEntry[];
  try {
    const res = await fetchWithTimeout(`${apiBase}/api/listings/sitemap`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    entries = (await res.json()) as SitemapEntry[];
  } catch (e) {
    console.error("[sitemap-listings] API unavailable:", e);
    return new Response("Listings sitemap temporarily unavailable", {
      status: 503,
      headers: { "Retry-After": "3600" },
    });
  }

  return xmlResponse(
    urlset(
      entries.map((e) => ({
        // The slug only needs the address fields, which these rows carry.
        loc: absoluteUrl(listingPath(e as unknown as Listing)),
        lastmod: e.modificationTimestamp,
        images: accountHash
          ? parsePhotoIds(e.photoIds)
              .slice(0, IMAGES_PER_LISTING)
              .map((id) => photoUrl(accountHash, id, "heroDesktop"))
          : [],
      })),
    ),
  );
};
