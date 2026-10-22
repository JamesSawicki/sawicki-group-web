/**
 * ListingSummary.tsx — the listing page's summary + call to action, in two forms:
 *
 *   - Card (the right-hand column on desktop; near the end of the page on phones):
 *     price, address, key stats, "Contact us" and click-to-call. On desktop its top is a
 *     media frame with Map | Photos tabs: the neighborhood map (a static image; click
 *     opens the interactive map) while the main photos are on screen, then a photo
 *     carousel slides down over it once they've scrolled away. Choosing a tab stops the
 *     automatic switch. One frame rather than map + photos stacked, so the sticky card
 *     stays shorter than a laptop screen.
 *   - Mini header (phones/tablets only): a slim bar that slides down from the top once
 *     the photos and price have scrolled away — a swipeable photo, price, address and a
 *     Contact button — and slides back up when the visitor returns to the top.
 *
 * "Scrolled away" = the #listing-hero-end marker (after the hero) is above the viewport.
 * Tapping a photo opens the page's lightbox at that photo (PhotoGallery owns it).
 */
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { openListingPhoto, photoUrl } from "../../lib/photo-utils";
import { openNeighborhoodMap } from "../../lib/map-utils";

/** id of the marker placed right after the gallery + hero on the listing page. */
export const HERO_END_ID = "listing-hero-end";

interface Props {
  /** Cloudflare photo ids, in display order. */
  photoIds: string[];
  /** Cloudflare Images account hash; without it no photos are shown. */
  accountHash?: string;
  /** Formatted list price, e.g. "$674,900". */
  price: string;
  /** Street address. */
  address: string;
  /** "Saint Louis Park, MN 55416". */
  cityLine: string;
  /** "3 bd · 2.5 ba · 2,508 sqft". */
  stats: string;
  /** Call-to-action heading, body and button label. */
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
  /** Where the contact button goes. */
  contactHref: string;
  /** Phone for click-to-call: tel: digits and display text. */
  phone: { tel: string; display: string };
  /** Static neighborhood map image for the card's frame (desktop); omitted without coordinates. */
  mapImage?: string;
}

// ─── Photo carousel (used by the card and the mini header) ────────────────────

interface CarouselProps {
  photoIds: string[];
  accountHash: string;
  /** "card": large frame with arrows; "mini": small swipeable frame. */
  size: "card" | "mini";
  address: string;
}

function PhotoCarousel({ photoIds, accountHash, size, address }: CarouselProps) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: true });
  const [selected, setSelected] = useState<number>(0);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setSelected(embla.selectedScrollSnap());
    embla.on("select", onSelect);
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla]);

  const go = useCallback(
    (step: 1 | -1) => (step === 1 ? embla?.scrollNext() : embla?.scrollPrev()),
    [embla],
  );

  const variant = size === "card" ? "mosaic" : "thumb";
  const frame = size === "card" ? "w-full h-full" : "w-16 h-12 rounded-md";

  return (
    <div className={`relative overflow-hidden bg-stone-200 shrink-0 ${frame}`}>
      <div ref={emblaRef} className="h-full overflow-hidden">
        <div className="flex h-full">
          {photoIds.map((id, i) => {
            // Load only the current photo and its neighbours, not all of them up front.
            const near =
              Math.abs(i - selected) <= 1 ||
              (selected === 0 && i === photoIds.length - 1) ||
              (selected === photoIds.length - 1 && i === 0);
            return (
              <button
                key={id}
                type="button"
                onClick={() => openListingPhoto(i)}
                className="relative min-w-full h-full"
                aria-label={`Open photo ${i + 1} of ${address}`}
              >
                {near && (
                  <img
                    src={photoUrl(accountHash, id, variant)}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {size === "card" && photoIds.length > 1 && (
        <>
          {(["prev", "next"] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => go(dir === "next" ? 1 : -1)}
              aria-label={dir === "next" ? "Next photo" : "Previous photo"}
              className={`absolute top-1/2 -translate-y-1/2 ${dir === "next" ? "right-2" : "left-2"}
                w-10 h-10 inline-flex items-center justify-center rounded-full bg-white/90 text-stone-700 shadow hover:bg-white`}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d={dir === "next" ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
              </svg>
            </button>
          ))}
          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-xs">
            {selected + 1} / {photoIds.length}
          </span>
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ListingSummary({
  photoIds,
  accountHash,
  price,
  address,
  cityLine,
  stats,
  ctaTitle,
  ctaBody,
  ctaButton,
  contactHref,
  phone,
  mapImage,
}: Props) {
  // True once the gallery + hero have scrolled out of view (above the viewport).
  const [scrolledPast, setScrolledPast] = useState<boolean>(false);
  // A scroll check rather than an IntersectionObserver: an observer only reports
  // crossings, so a jump straight past the marker (restored scroll position, a fast
  // fling) would be missed.
  useEffect(() => {
    const marker = document.getElementById(HERO_END_ID);
    if (!marker) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      setScrolledPast(marker.getBoundingClientRect().top < 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const hasPhotos = Boolean(accountHash) && photoIds.length > 0;

  // Card frame tab: automatic (map while the gallery is in view, then photos) until the
  // visitor picks one.
  const [pickedTab, setPickedTab] = useState<"map" | "photos" | null>(null);
  const showPhotos = hasPhotos && (pickedTab ? pickedTab === "photos" : scrolledPast || !mapImage);

  return (
    <>
      {/* ── Mini header (phones/tablets) ── */}
      <div
        className={`lg:hidden fixed inset-x-0 top-0 z-40 bg-white border-b border-stone-200 shadow-sm
          transition-transform duration-300 ${scrolledPast ? "translate-y-0" : "-translate-y-full"}`}
        aria-hidden={!scrolledPast}
        inert={!scrolledPast}
      >
        <div className="flex items-center gap-3 px-3 py-2">
          {hasPhotos && (
            <PhotoCarousel
              photoIds={photoIds}
              accountHash={accountHash!}
              size="mini"
              address={address}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-stone-900 leading-tight">{price}</div>
            <div className="text-xs text-stone-500 truncate">{address}</div>
          </div>
          <a
            href={contactHref}
            className="shrink-0 inline-flex items-center h-11 px-4 rounded-lg bg-stone-900 text-white text-sm font-medium"
          >
            Contact
          </a>
        </div>
      </div>

      {/* ── Card ── */}
      <div className="border border-stone-200 rounded-xl bg-white">
        {/* ── Media frame (desktop): map, with photos sliding down over it ── */}
        {(hasPhotos || mapImage) && (
          <div className="hidden lg:block relative aspect-[16/10] rounded-t-xl overflow-hidden bg-stone-200">
            {mapImage && (
              <button
                type="button"
                onClick={openNeighborhoodMap}
                className="absolute inset-0 group"
                aria-label={`Open the neighborhood map around ${address}`}
              >
                <img
                  src={mapImage}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <span className="absolute bottom-8 right-2 px-2.5 py-1.5 rounded-md bg-white/95 shadow text-xs font-medium text-stone-800 group-hover:bg-white">
                  Explore the neighborhood
                </span>
              </button>
            )}
            {hasPhotos && (
              <div
                className={`absolute inset-0 transition-transform duration-500 ${
                  showPhotos ? "translate-y-0" : "-translate-y-full"
                }`}
                aria-hidden={!showPhotos}
                inert={!showPhotos}
              >
                <PhotoCarousel
                  photoIds={photoIds}
                  accountHash={accountHash!}
                  size="card"
                  address={address}
                />
              </div>
            )}
            {mapImage && hasPhotos && (
              <div
                className="absolute top-2 left-2 z-10 inline-flex rounded-lg bg-white/95 shadow p-0.5"
                role="group"
                aria-label="Show map or photos"
              >
                {(["map", "photos"] as const).map((tab) => {
                  const active = (tab === "photos") === showPhotos;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setPickedTab(tab)}
                      aria-pressed={active}
                      className={`h-8 px-3 rounded-md text-xs font-medium ${
                        active ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100"
                      }`}
                    >
                      {tab === "map" ? "Map" : `Photos (${photoIds.length})`}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="p-6">
          {/* ── Summary ── */}
          <div className="text-2xl font-semibold text-stone-900">{price}</div>
          <div className="text-sm text-stone-700 mt-1">{address}</div>
          <div className="text-sm text-stone-500">{cityLine}</div>
          {stats && <div className="text-sm text-stone-600 mt-2">{stats}</div>}

          {/* ── Call to action ── */}
          <div className="border-t border-stone-100 mt-5 pt-5">
            <div className="font-semibold text-stone-900 mb-1">{ctaTitle}</div>
            <p className="text-sm text-stone-500 mb-4">{ctaBody}</p>
            <a
              href={contactHref}
              className="flex items-center justify-center w-full h-11 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors"
            >
              {ctaButton}
            </a>
            <a
              href={`tel:${phone.tel}`}
              className="flex items-center justify-center w-full py-3 text-sm text-stone-600 hover:text-stone-900"
            >
              or call {phone.display}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
