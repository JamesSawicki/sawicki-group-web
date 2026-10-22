/**
 * ListingChat.tsx — the listing page's AI chat, as a floating widget so it doesn't take up
 * page space and is reachable from anywhere on the page.
 *
 * Closed, it's a launcher in the bottom-right corner: a round "AI" bubble on phones and
 * tablets, an "AI chat" bar docked to the bottom edge on desktop (lg+). Open, it's a sheet
 * from the bottom on phones (with a backdrop; the page behind doesn't scroll) and a panel
 * rising from the bar on desktop. Closing only hides the panel, so the conversation is
 * still there when it's reopened. The launcher labels are placeholders for the logo.
 */
import { useState, useRef, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  /** The server builds the system prompt from this id — the client never
   *  sends prompt text (see ChatController on the API for the why). */
  listingId: number;
  apiBaseUrl: string;
}

/**
 * A single message in the chat thread.
 * `role` is a discriminated union — TypeScript uses it to narrow the type
 * when rendering (e.g. user messages go right, assistant go left).
 */
interface Message {
  role: "user" | "assistant";
  content: string;
}

const PANEL_ID = "listing-chat-panel";

// ─── Component ───────────────────────────────────────────────────────────────

export default function ListingChat({ listingId, apiBaseUrl }: Props) {
  const [open, setOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The scrollable message panel. Only this panel scrolls to the newest message —
  // never the page (scrollIntoView() scrolled the whole listing page down to the chat
  // on load), and nothing happens until there's a conversation.
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = messagesRef.current;
    if (!open || !panel || (messages.length === 0 && !isLoading)) return;
    panel.scrollTo({ top: panel.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading, open]);

  // While open: Escape closes. Desktop focuses the input; phones/tablets don't (the
  // on-screen keyboard would cover the sheet) and stop the page behind from scrolling.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const lockScroll = window.matchMedia("(max-width: 1023px)").matches;
    if (lockScroll) document.body.style.overflow = "hidden";
    else inputRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      if (lockScroll) document.body.style.overflow = "";
    };
  }, [open]);

  const sendMessage = async (): Promise<void> => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          messages: updatedMessages,
        }),
      });

      if (res.status === 429) {
        setError("Too many messages. Please wait a moment before continuing.");
        setIsLoading(false);
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const assistantContent: string =
        data?.content?.[0]?.text ?? "Sorry, I couldn't generate a response.";

      setMessages([...updatedMessages, { role: "assistant", content: assistantContent }]);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // TypeScript infers the event type from the element — no explicit annotation needed.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* ── Launcher: "AI" bubble (phones/tablets) / "AI chat" bar (desktop) ── */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls={PANEL_ID}
          aria-label="Open AI chat about this property"
          className="fixed z-40 right-4 bottom-4 w-14 h-14 rounded-full
            lg:right-6 lg:bottom-0 lg:w-72 lg:h-12 lg:rounded-none lg:rounded-t-xl lg:px-4
            flex items-center justify-center lg:justify-between
            bg-stone-900 text-white shadow-lg hover:bg-stone-700 transition-colors"
        >
          <span className="text-base font-semibold lg:hidden">AI</span>
          <span className="hidden lg:inline text-sm font-medium">AI chat</span>
          <svg
            className="hidden lg:block"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M6 15l6-6 6 6" />
          </svg>
        </button>
      )}

      {/* ── Backdrop (phones/tablets) ── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Panel: kept mounted while closed so the conversation survives ── */}
      <div
        id={PANEL_ID}
        role="dialog"
        aria-label="AI chat about this property"
        hidden={!open}
        className="fixed z-50 inset-x-0 bottom-0 h-[85dvh] rounded-t-2xl
          lg:inset-x-auto lg:right-6 lg:w-96 lg:h-[520px] lg:rounded-t-xl
          flex-col bg-white shadow-2xl border border-stone-200 [&:not([hidden])]:flex"
      >
        {/* Header (tap/click to minimize) */}
        <div className="flex items-center justify-between gap-2 pl-4 pr-1 h-12 shrink-0 rounded-t-2xl lg:rounded-t-xl bg-stone-900 text-white">
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

        {/* Message thread */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-sm text-stone-500 text-center mt-8 px-4">
              Ask anything about this property — features, the neighborhood, estimated costs, or
              next steps.
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-stone-900 text-white rounded-br-sm"
                    : "bg-stone-100 text-stone-800 rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-stone-100 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center">
                  <span
                    className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && <div className="text-xs text-red-500 text-center px-4">{error}</div>}
        </div>

        {/* Input row. 16px text on phones: iOS zooms the page into smaller inputs. */}
        <div className="border-t border-stone-200 p-3 flex gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this property..."
            disabled={isLoading}
            className="flex-1 min-w-0 text-base lg:text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-stone-400 disabled:opacity-50 disabled:bg-stone-50"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="bg-stone-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </>
  );
}
