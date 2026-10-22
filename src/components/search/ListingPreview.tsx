/**
 * ListingPreview.tsx — the card shown when a listing pin (or list row) is tapped on the
 * search map: first photo, status, price, address, key stats, and a link to the details.
 *
 * Two placements (chosen by MapSearch):
 *   - "sheet" (phones/tablets): a compact horizontal card across the bottom of the map.
 *   - "popup" (desktop): a taller card, photo on top, rendered inside a Mapbox popup
 *     anchored to the pin, so it sits on the dot and moves with the map.
 * Dismissed with the X, Escape, or (touch) a swipe down; MapSearch also closes it when
 * the visitor clicks empty map.
 */
import { useEffect, useRef } from "react";
import type { Listing } from "../../types/listing";
import {
  formatBathTotal,
  formatPrice,
  formatSqft,
  isPositive,
  listingPath,
  statusBadgeClasses,
  statusLabel,
} from "../../lib/listing-utils";
import { parsePhotoIds, photoUrl } from "../../lib/photo-utils";

interface Props {
  /** The listing to preview. */
  listing: Listing;
  /** Cloudflare Images account hash; without it (or without photos) a placeholder shows. */
  accountHash?: string;
  /** Called when the card is dismissed. */
  onClose: () => void;
  /** "sheet" = bottom of the map (phones/tablets); "popup" = inside a pin popup (desktop). */
  placement?: "sheet" | "popup";
}

const PLACEMENT_CLASSES = {
  sheet: "absolute z-20 left-2 right-2 bottom-2",
  popup: "relative w-72",
};

// Downward swipe distance (px) that dismisses the card on touch screens.
const SWIPE_DOWN_PX = 50;

export default function ListingPreview({
  listing,
  accountHash,
  onClose,
  placement = "sheet",
}: Props) {
  const touchStartY = useRef<number | null>(null);

  // Escape dismisses the card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ─── Derived values ────────────────────────────────────────────────────────
  const photoIds = parsePhotoIds(listing.photoIds);
  const photo = photoIds.length ? photoUrl(accountHash, photoIds[0], "card") : "";
  const photoCount = photoIds.length || listing.photosCount || 0;
  const detailUrl = listingPath(listing);
  const stats = [
    isPositive(listing.beds) ? `${listing.beds} bd` : null,
    `${formatBathTotal(listing)} ba`,
    isPositive(listing.sqftTotal) ? `${formatSqft(listing.sqftTotal)} sqft` : null,
  ].filter(Boolean);

  return (
    <div
      role="dialog"
      aria-label={`Preview: ${listing.address}`}
      className={`${PLACEMENT_CLASSES[placement]}
        bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden`}
      onTouchStart={(e) => (touchStartY.current = e.touches[0].clientY)}
      onTouchEnd={(e) => {
        const start = touchStartY.current;
        touchStartY.current = null;
        if (start != null && e.changedTouches[0].clientY - start > SWIPE_DOWN_PX) onClose();
      }}
    >
      {/* The whole card (except the close button) opens the listing. */}
      <a
        href={detailUrl}
        className="flex lg:flex-col text-left hover:bg-slate-50 transition-colors"
      >
        {/* ── Photo ── */}
        <div className="relative w-36 shrink-0 lg:w-full h-32 lg:h-44 bg-slate-100">
          {photo ? (
            <img
              src={photo}
              alt={`Photo of ${listing.address}`}
              className="w-full h-full object-cover"
              loading="eager"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-slate-200 to-slate-300 text-slate-500">
              <svg
                width="28"
                height="28"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              <span className="text-xs">Photos coming soon</span>
            </div>
          )}
          {photoCount > 1 && photo && (
            <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs">
              1 / {photoCount}
            </span>
          )}
        </div>

        {/* ── Details ── */}
        <div className="min-w-0 flex-1 p-3 pr-10 lg:pr-3">
          {listing.status && (
            <span className={statusBadgeClasses(listing.status)}>
              {statusLabel(listing.status)}
            </span>
          )}
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {formatPrice(listing.listPrice)}
          </div>
          <div className="text-sm text-slate-700 truncate">{listing.address}</div>
          <div className="text-xs text-slate-500 truncate">
            {listing.city}, MN{listing.zipCode ? ` ${listing.zipCode}` : ""}
          </div>
          <div className="mt-1 text-xs text-slate-600">{stats.join(" · ")}</div>
          {/* Future: amenity score chips (walk/bike/drive access) go here. */}
          <div className="mt-2 text-sm font-medium text-blue-600">View details →</div>
        </div>
      </a>

      {/* ── Close (sits over the card's top-right corner) ── */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-1.5 right-1.5 w-9 h-9 inline-flex items-center justify-center rounded-full
          bg-white/90 text-slate-600 shadow hover:bg-white"
        aria-label="Close preview"
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
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
