/**
 * Page events for the listing chat on phones (ListingChat.tsx), so other islands can talk
 * to it without sharing state:
 *   - photo views (PhotoGallery, the mini header's photo) feed the chat nudge's
 *     "has seen at least N photos" signal;
 *   - openListingChat() opens the chat sheet, optionally sending a first message (the
 *     mini header's Contact button starts a showing request this way).
 */

export const PHOTO_VIEWED_EVENT = "listing:photo-viewed";
export const OPEN_CHAT_EVENT = "listing:open-chat";

/** Record that the visitor has seen photo `index` (0-based) of this listing. */
export function notePhotoViewed(index: number): void {
  window.dispatchEvent(new CustomEvent(PHOTO_VIEWED_EVENT, { detail: { index } }));
}

/** Open the phone chat; with `message`, send it as the visitor's first message. */
export function openListingChat(message?: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: { message } }));
}

/** What the "Schedule a showing" actions send (one wording everywhere). */
export const SHOWING_REQUEST = "I'd like to schedule a showing.";
