/**
 * ListingChat.tsx — the listing AI chat on phones and tablets: a round "AI" bubble in the
 * bottom-right corner that opens the conversation (ChatConversation) as a sheet from the
 * bottom, with a backdrop (the page behind doesn't scroll). Closing only hides the sheet,
 * so the conversation is still there when it's reopened. The "AI" label is a placeholder
 * for the logo.
 *
 * Desktop (lg+) doesn't use this: the conversation is embedded in the summary card
 * (ListingSummary.tsx), so nothing here renders there.
 */
import { useEffect, useState } from "react";
import ChatConversation from "./listing/ChatConversation";

interface Props {
  /** The server builds the system prompt from this id (see ChatController on the API). */
  listingId: number;
  apiBaseUrl: string;
  /** Street address and page path, attached to contact requests sent from the chat. */
  listingAddress: string;
  listingPath: string;
}

const PANEL_ID = "listing-chat-panel";

export default function ListingChat({ listingId, apiBaseUrl, listingAddress, listingPath }: Props) {
  const [open, setOpen] = useState<boolean>(false);

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

  return (
    <div className="lg:hidden">
      {/* ── Launcher ── */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls={PANEL_ID}
          aria-label="Open AI chat about this property"
          className="fixed z-40 right-4 bottom-4 w-14 h-14 rounded-full flex items-center justify-center
            bg-stone-900 text-white shadow-lg hover:bg-stone-700 transition-colors"
        >
          <span className="text-base font-semibold">AI</span>
        </button>
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
          />
        </div>
      </div>
    </div>
  );
}
