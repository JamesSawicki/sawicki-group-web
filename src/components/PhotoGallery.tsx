/**
 * PhotoGallery.tsx — listing-detail hero gallery.
 *
 * Mobile-first design with two render modes determined by CSS media query:
 *   Desktop (≥ md / 768px): 5-photo MOSAIC — one large primary tile (spans
 *     2 rows) plus 4 satellite tiles in a 2×2 grid. The last visible tile
 *     overlays a "+N more" badge when more than 5 photos exist.
 *   Mobile (< md):          Swipeable single-photo CAROUSEL (Embla) with
 *     position dots.
 *
 * Click any photo (either layout) → opens fullscreen LIGHTBOX with
 * pinch-zoom, swipe, thumbnail strip, fullscreen toggle, and counter.
 *
 * Floor plans render as a separate filter inside the lightbox, reachable via
 * an action chip below the gallery. Virtual tours render as external-link
 * chips (open in new tab — Matterport/iGUIDE/etc. handle their own UI).
 *
 * ── Required npm deps ─────────────────────────────────────────────────────
 *   embla-carousel-react
 *   yet-another-react-lightbox
 *
 * ── Required CSS (import in [id].astro frontmatter, NOT here) ─────────────
 *   yet-another-react-lightbox/styles.css
 *   yet-another-react-lightbox/plugins/thumbnails.css
 *   yet-another-react-lightbox/plugins/counter.css
 * Astro's pattern for island CSS is to import in the page that mounts the
 * island. Importing CSS inside the island TSX works in some bundlers but is
 * unreliable across Vite/Astro builds.
 *
 * ── Hydration directive ───────────────────────────────────────────────────
 * Mount as `client:visible` on [id].astro — only hydrates when scrolled into
 * view, which keeps JS off pages that don't need it. (The gallery is the
 * hero so it hydrates almost immediately, but client:visible still defers
 * by one paint frame vs client:load.)
 */

import { useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";

interface VirtualTourLink {
  provider: string;
  url: string;
  label: string;
}

interface PhotoGalleryProps {
  photoIds?: string[];
  floorPlanIds?: string[];
  virtualTourUrls?: VirtualTourLink[];
  /** Cloudflare Images account hash — required to build delivery URLs. */
  accountHash?: string;
}

type Variant = "thumb" | "card" | "heroMobile" | "heroDesktop" | "mosaic" | "lightbox";

function url(hash: string, id: string, variant: Variant): string {
  return `https://imagedelivery.net/${hash}/${id}/${variant}`;
}

export default function PhotoGallery({
  photoIds = [],
  floorPlanIds = [],
  virtualTourUrls = [],
  accountHash,
}: PhotoGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxSet, setLightboxSet] = useState<"photos" | "floorPlans">("photos");

  const [emblaRef] = useEmblaCarousel({ loop: false });

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!accountHash) {
    return (
      <div className="aspect-[16/9] bg-stone-100 rounded-xl flex items-center justify-center text-stone-400 text-sm">
        Photo hosting not configured
      </div>
    );
  }
  if (
    photoIds.length === 0 &&
    floorPlanIds.length === 0 &&
    virtualTourUrls.length === 0
  ) {
    return (
      <div className="aspect-[16/9] bg-stone-100 rounded-xl flex items-center justify-center text-stone-400 text-sm">
        Photos coming soon
      </div>
    );
  }

  const openLightbox = (set: "photos" | "floorPlans", index: number) => {
    setLightboxSet(set);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const activeIds = lightboxSet === "photos" ? photoIds : floorPlanIds;
  const slides = activeIds.map((id) => ({
    src: url(accountHash, id, "lightbox"),
  }));

  // Take up to 5 photos for the mosaic, but track how many exist for the
  // "+N more" overlay on the last tile.
  const mosaicPhotos = photoIds.slice(0, 5);
  const extraCount = Math.max(0, photoIds.length - 5);

  return (
    <div>
      {/* ── Desktop mosaic ──────────────────────────────────────────────── */}
      <div className="hidden md:grid grid-cols-3 grid-rows-2 gap-2 aspect-[16/9] rounded-xl overflow-hidden">
        {/* Primary tile — spans 2 rows on the left */}
        {mosaicPhotos[0] ? (
          <button
            type="button"
            onClick={() => openLightbox("photos", 0)}
            className="row-span-2 bg-stone-200 overflow-hidden group"
            aria-label="Open photo 1 in lightbox"
          >
            <img
              src={url(accountHash, mosaicPhotos[0], "heroDesktop")}
              alt="Listing photo 1"
              loading="eager"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </button>
        ) : (
          <div className="row-span-2 bg-stone-100" />
        )}

        {/* Four satellite tiles in a 2×2 grid */}
        {[1, 2, 3, 4].map((i) =>
          mosaicPhotos[i] ? (
            <button
              key={i}
              type="button"
              onClick={() => openLightbox("photos", i)}
              className="bg-stone-200 overflow-hidden group relative"
              aria-label={`Open photo ${i + 1} in lightbox`}
            >
              <img
                src={url(accountHash, mosaicPhotos[i], "mosaic")}
                alt={`Listing photo ${i + 1}`}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              {/* "+N more" overlay on the last visible tile when more photos exist */}
              {i === 4 && extraCount > 0 && (
                <div className="absolute inset-0 bg-black/45 flex items-center justify-center text-white font-medium text-sm pointer-events-none">
                  + {extraCount} more
                </div>
              )}
            </button>
          ) : (
            <div key={i} className="bg-stone-100" />
          )
        )}
      </div>

      {/* ── Mobile carousel ─────────────────────────────────────────────── */}
      <div className="md:hidden">
        <div
          className="overflow-hidden rounded-xl aspect-[4/3] bg-stone-200"
          ref={emblaRef}
        >
          <div className="flex h-full">
            {photoIds.map((id, i) => (
              <div key={id} className="min-w-full h-full">
                <button
                  type="button"
                  onClick={() => openLightbox("photos", i)}
                  className="block w-full h-full"
                  aria-label={`Open photo ${i + 1} in lightbox`}
                >
                  <img
                    src={url(accountHash, id, "heroMobile")}
                    alt={`Listing photo ${i + 1}`}
                    loading={i === 0 ? "eager" : "lazy"}
                    className="w-full h-full object-cover"
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
        {photoIds.length > 1 && (
          <div className="text-center text-xs text-stone-500 mt-2">
            Swipe through {photoIds.length} photos
          </div>
        )}
      </div>

      {/* ── Action chips: View all / Floor plans / Virtual tours ────────── */}
      <div className="flex flex-wrap gap-2 mt-4">
        {photoIds.length > 0 && (
          <button
            type="button"
            onClick={() => openLightbox("photos", 0)}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            View all {photoIds.length} photo{photoIds.length === 1 ? "" : "s"}
          </button>
        )}

        {floorPlanIds.length > 0 && (
          <button
            type="button"
            onClick={() => openLightbox("floorPlans", 0)}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="1" />
              <path d="M3 12h18M12 3v18" />
            </svg>
            Floor plan{floorPlanIds.length === 1 ? "" : `s (${floorPlanIds.length})`}
          </button>
        )}

        {virtualTourUrls.map((tour, i) => (
          <a
            key={i}
            href={tour.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path d="M3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
            </svg>
            {tour.label}
          </a>
        ))}
      </div>

      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={slides}
        plugins={[Zoom, Thumbnails, Counter, Fullscreen]}
        zoom={{
          maxZoomPixelRatio: 3,
          scrollToZoom: true,
        }}
        thumbnails={{
          position: "bottom",
          width: 80,
          height: 60,
          gap: 8,
        }}
        carousel={{
          finite: true,
        }}
      />
    </div>
  );
}
