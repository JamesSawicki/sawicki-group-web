/**
 * photo-utils.ts — pure helpers for Cloudflare Images URLs and the
 * JSON-string fields on Listing.
 *
 * Cloudflare Images delivery URL pattern:
 *   https://imagedelivery.net/{account-hash}/{image-id}/{variant}
 *
 * Variants are configured in the Cloudflare dashboard. Current set:
 *   thumb        — 120px (chat refs, future agent strip)
 *   card         — 480px (search results, portfolio grid, map popup)
 *   heroMobile   — 800px (mobile hero carousel)
 *   heroDesktop  — 1280px (desktop mosaic primary tile)
 *   mosaic       — 640px (desktop mosaic satellite tiles)
 *   lightbox     — 2048px (fullscreen lightbox + 2x zoom)
 *
 * Format negotiation (AVIF/WebP/JPEG) is automatic at delivery time via
 * the request Accept header — no URL params required.
 */

export type PhotoVariant =
  | "thumb"
  | "card"
  | "heroMobile"
  | "heroDesktop"
  | "mosaic"
  | "lightbox";

/**
 * Builds a Cloudflare Images delivery URL.
 * Returns empty string when accountHash is missing — caller should guard.
 *
 * accountHash is supplied as an explicit argument (rather than read from env
 * inside this helper) so the helper works identically in SSR frontmatter,
 * React islands, and unit tests. Pages read the env var once and pass it
 * down to gallery components as a prop.
 */
export function photoUrl(
  accountHash: string | undefined,
  id: string,
  variant: PhotoVariant,
): string {
  if (!accountHash || !id) return "";
  return `https://imagedelivery.net/${accountHash}/${id}/${variant}`;
}

/**
 * Parses Listing.photoIds / Listing.floorPlanIds — a JSON array of CF Image IDs.
 * Returns [] on null, empty, or malformed input. Never throws.
 */
export function parsePhotoIds(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string" && v.length > 0);
  } catch {
    return [];
  }
}

/**
 * One virtual tour link from a listing's virtualTourUrls JSON.
 * provider: "matterport" | "iguide" | "youtube" | "vimeo" | "external"
 * label:    display text, defaults to "Virtual Tour" if not provided upstream
 */
export interface VirtualTourLink {
  provider: string;
  url: string;
  label: string;
}

export function parseVirtualTourUrls(
  json: string | null | undefined,
): VirtualTourLink[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is { url?: unknown; provider?: unknown; label?: unknown } =>
        typeof v === "object" && v !== null && typeof (v as Record<string, unknown>).url === "string",
      )
      .map((v) => ({
        url: String(v.url),
        provider: typeof v.provider === "string" ? v.provider : "external",
        label: typeof v.label === "string" ? v.label : "Virtual Tour",
      }));
  } catch {
    return [];
  }
}

/**
 * Whether a listing has any hosted media to show.
 * Used to decide between rendering the gallery and the "Photos coming soon"
 * placeholder.
 */
export function hasHostedMedia(
  photoIdsJson: string | null | undefined,
  floorPlanIdsJson: string | null | undefined,
  virtualTourUrlsJson: string | null | undefined,
): boolean {
  return (
    parsePhotoIds(photoIdsJson).length > 0 ||
    parsePhotoIds(floorPlanIdsJson).length > 0 ||
    parseVirtualTourUrls(virtualTourUrlsJson).length > 0
  );
}
