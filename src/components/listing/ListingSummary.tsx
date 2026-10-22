/**
 * ListingSummary.tsx — the listing page's summary + call to action, in two forms:
 *
 *   - Card (the right-hand column on desktop; near the end of the page on phones):
 *     price, address, key stats, "Contact us" and click-to-call. On desktop, once the
 *     main photos have scrolled out of view, a single-photo carousel slides open at the
 *     top of the card.
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
  const frame = size === "card" ? "aspect-[4/3] rounded-t-xl" : "w-16 h-12 rounded-md";

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
        {/* Photo frame: desktop only, slides open once the main photos are out of view. */}
        {hasPhotos && (
          <div
            className={`hidden lg:grid transition-[grid-template-rows] duration-300 ${
              scrolledPast ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
            aria-hidden={!scrolledPast}
            inert={!scrolledPast}
          >
            <div className="min-h-0 overflow-hidden">
              <PhotoCarousel
                photoIds={photoIds}
                accountHash={accountHash!}
                size="card"
                address={address}
              />
            </div>
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
