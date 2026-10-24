/**
 * ListingChat.tsx — the listing AI chat on phones and tablets: a round "AI" bubble in the
 * bottom-right corner that opens the conversation (ChatConversation) as a sheet from the
 * bottom, with a backdrop (the page behind doesn't scroll). Closing only hides the sheet,
 * so the conversation is still there when it's reopened. The "AI" label is a placeholder
 * for the logo.
 *
 * The sheet opens with a written greeting ("want to know more, or schedule a showing?")
 * and reply buttons. Other parts of the page open it via openListingChat() (the mini
 * header's Contact button starts a showing request).
 *
 * Nudge: once a visitor shows real interest — 15 s of time on the page while it's
 * visible, plus 5 photos viewed or half the page scrolled — the bubble pulses a few times
 * and a "Questions about this home?" bubble appears beside it. Once per visit (tab
 * session), never after the chat has been opened, and not while the photo lightbox or
 * neighborhood map is open. No pulse for visitors who prefer reduced motion.
 *
 * Desktop (lg+) doesn't use this: the conversation is embedded in the summary card.
 */
import { useEffect, useRef, useState } from "react";
import ChatConversation from "./listing/ChatConversation";
import { OPEN_CHAT_EVENT, PHOTO_VIEWED_EVENT } from "../lib/chat-events";
import { track } from "../lib/analytics";
import { chatBubble } from "../lib/site.config";

interface Props {
  /** The server builds the system prompt from this id (see ChatController on the API). */
  listingId: number;
  apiBaseUrl: string;
  /** Street address and page path, attached to contact requests sent from the chat. */
  listingAddress: string;
  listingPath: string;
}

const PANEL_ID = "listing-chat-panel";

// ─── Nudge settings ───────────────────────────────────────────────────────────
const NUDGE_AFTER_MS = 15_000;
const NUDGE_MIN_PHOTOS = 5;
const NUDGE_SCROLL_FRACTION = 0.5;
/** sessionStorage flag: the nudge has been shown (or the chat opened) in this visit. */
const NUDGED_KEY = "sawicki:chatNudged";

function alreadyNudged(): boolean {
  try {
    return sessionStorage.getItem(NUDGED_KEY) === "1";
  } catch {
    return false;
  }
}

function markNudged(): void {
  try {
    sessionStorage.setItem(NUDGED_KEY, "1");
  } catch {
    // Storage unavailable: worst case the nudge can show again on another listing.
  }
}

/** The photo lightbox or the neighborhood map is open (don't interrupt them). */
function overlayOpen(): boolean {
  return Boolean(
    document.querySelector(".yarl__root") ||
    document.querySelector('[role="dialog"][aria-modal="true"]:not([hidden])'),
  );
}

export default function ListingChat({ listingId, apiBaseUrl, listingAddress, listingPath }: Props) {
  const [open, setOpen] = useState<boolean>(false);
  const [nudge, setNudge] = useState<boolean>(false);
  const [pending, setPending] = useState<{ text: string; id: number } | undefined>();
  const openRef = useRef<boolean>(false);
  openRef.current = open;

  const street = listingAddress.split(",")[0] || "this home";
  const greeting = `Hi! Want to know more about ${street}, or schedule a showing?`;

  const openChat = (message?: string): void => {
    setOpen(true);
    setNudge(false);
    markNudged();
    track("chat_open", { trigger: message ? "contact_button" : "bubble" });
    if (message) setPending({ text: message, id: Date.now() });
  };

  // Opened from elsewhere on the page (openListingChat).
  useEffect(() => {
    const onOpen = (e: Event) => openChat((e as CustomEvent<{ message?: string }>).detail?.message);
    window.addEventListener(OPEN_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpen);
  }, []);

  // While open: Escape closes, and the page behind stops scrolling. No auto-focus: the
  // on-screen keyboard would cover the sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  // Nudge (phones/tablets only; see the header comment).
  useEffect(() => {
    if (!window.matchMedia("(max-width: 1023px)").matches || alreadyNudged()) return;
    const photosSeen = new Set<number>();
    let scrolledHalf = false;
    let visibleMs = 0;

    const onPhoto = (e: Event) => {
      const index = (e as CustomEvent<{ index?: number }>).detail?.index;
      if (typeof index === "number") photosSeen.add(index);
    };
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= NUDGE_SCROLL_FRACTION) scrolledHalf = true;
    };
    const timer = window.setInterval(() => {
      if (openRef.current) {
        window.clearInterval(timer); // they found the chat on their own
        return;
      }
      if (document.visibilityState !== "visible") return;
      visibleMs += 1000;
      const interested = photosSeen.size >= NUDGE_MIN_PHOTOS || scrolledHalf;
      if (visibleMs < NUDGE_AFTER_MS || !interested || overlayOpen()) return;
      window.clearInterval(timer);
      markNudged();
      setNudge(true);
      track("chat_nudge_shown", {});
    }, 1000);

    window.addEventListener(PHOTO_VIEWED_EVENT, onPhoto);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(PHOTO_VIEWED_EVENT, onPhoto);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div className="lg:hidden">
      {/* ── Launcher (pulses when nudging) ── */}
      {!open && (
        <button
          type="button"
          onClick={() => openChat()}
          aria-expanded={false}
          aria-controls={PANEL_ID}
          aria-label="Open AI chat about this property"
          className="fixed z-40 right-4 bottom-4 w-14 h-14 rounded-full flex items-center justify-center
            btn-primary shadow-lg"
        >
          {nudge && (
            <span
              className="absolute inset-0 rounded-full bg-brand-navy/50 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_3] motion-reduce:hidden"
              aria-hidden="true"
            />
          )}
          {chatBubble.image ? (
            <img
              src={chatBubble.image.src}
              alt=""
              width={28}
              height={28}
              className="relative w-7 h-7"
            />
          ) : (
            <span className="relative text-base font-semibold">{chatBubble.label}</span>
          )}
        </button>
      )}

      {/* ── Nudge: "Questions about this home?" beside the bubble ── */}
      {nudge && !open && (
        <div
          role="status"
          className="fixed z-40 right-20 bottom-5 flex items-center h-11 pl-4 pr-1 rounded-full bg-white border border-stone-200 shadow-lg"
        >
          <button
            type="button"
            onClick={() => openChat()}
            className="text-sm font-medium text-stone-900 whitespace-nowrap"
          >
            Questions about this home?
          </button>
          <button
            type="button"
            onClick={() => setNudge(false)}
            aria-label="Dismiss"
            className="w-9 h-9 ml-1 inline-flex items-center justify-center rounded-full text-stone-500 hover:bg-stone-100"
          >
            <svg
              width="14"
              height="14"
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
      )}

      {/* ── Backdrop ── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sheet: kept mounted while closed so the conversation survives ── */}
      <div
        id={PANEL_ID}
        role="dialog"
        aria-label="AI chat about this property"
        hidden={!open}
        className="fixed z-50 inset-x-0 bottom-0 h-[85dvh] rounded-t-2xl flex-col bg-white shadow-2xl
          border border-stone-200 pb-[env(safe-area-inset-bottom)] [&:not([hidden])]:flex"
      >
        <div className="flex items-center justify-between gap-2 pl-4 pr-1 h-12 shrink-0 rounded-t-2xl bg-stone-900 text-white">
          <span className="text-sm font-medium">
            AI chat <span className="font-normal text-stone-300">· about this property</span>
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Minimize chat"
            className="w-11 h-11 inline-flex items-center justify-center rounded-full hover:bg-white/10"
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
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          <ChatConversation
            listingId={listingId}
            apiBaseUrl={apiBaseUrl}
            listingAddress={listingAddress}
            listingPath={listingPath}
            active={open}
            greeting={greeting}
            pendingMessage={pending}
          />
        </div>
        <div className="shrink-0 px-4 pb-2 text-xs text-stone-500 text-center">
          Prefer the contact form?{" "}
          <a href="/contact" className="underline">
            Contact us
          </a>
        </div>
      </div>
    </div>
  );
}
