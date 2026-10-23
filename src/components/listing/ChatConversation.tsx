/**
 * ChatConversation.tsx — the listing AI chat itself: message thread, starter questions,
 * input, and contact-request cards. Used in two places:
 *   - embedded in the summary card on desktop (ListingSummary.tsx), in place of the old
 *     "Contact us about this listing" button, since the chat can take contact requests;
 *   - inside the floating "AI" bubble's sheet on phones/tablets (ListingChat.tsx).
 *
 * Sends { listingId, messages } (text only) to the API's /api/chat and shows its
 * { reply, contactRequest? }. A contactRequest renders as ContactRequestCard, which the
 * visitor edits and sends; the AI never sends anything itself.
 */
import { useEffect, useRef, useState } from "react";
import ContactRequestCard, { type ContactRequest } from "./ContactRequestCard";
import { SHOWING_REQUEST } from "../../lib/chat-events";

interface Props {
  /** The server builds the system prompt from this id; the client never sends prompt text. */
  listingId: number;
  apiBaseUrl: string;
  /** Street address and page path, attached to contact requests sent from the chat. */
  listingAddress: string;
  listingPath: string;
  /** Whether the conversation is on screen (it only scrolls itself to new messages then). */
  active: boolean;
  /**
   * Opening line shown as the assistant's first bubble, with reply buttons (phones). It's
   * written here, not by the AI, so opening the chat costs nothing until the visitor asks.
   */
  greeting?: string;
  /** A message to send as the visitor (e.g. from the mini header's Contact); sent once per id. */
  pendingMessage?: { text: string; id: number };
}

/** A message in the thread; assistant replies may carry a contact request. */
interface Message {
  role: "user" | "assistant";
  content: string;
  contactRequest?: ContactRequest;
}

/** POST /api/chat response from listing-agent-api. */
interface ChatReply {
  reply: string;
  contactRequest?: ContactRequest;
}

/** One-tap starters shown before the first message (labels and what they send). */
/** Reply buttons under the greeting (phones). */
const GREETING_REPLIES = [
  { label: "Tell me more", text: "Tell me more about this home: what stands out?" },
  { label: "Schedule a showing", text: SHOWING_REQUEST },
  { label: "What's nearby?", text: "What's nearby: groceries, parks, coffee, transit?" },
];

const STARTERS = [
  { label: "Schedule a showing", text: SHOWING_REQUEST },
  { label: "What's nearby?", text: "What's nearby: groceries, parks, coffee, transit?" },
  { label: "Taxes & fees", text: "What are the property taxes and any HOA fees?" },
];

export default function ChatConversation({
  listingId,
  apiBaseUrl,
  listingAddress,
  listingPath,
  active,
  greeting,
  pendingMessage,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Only the thread scrolls to the newest message, never the page, and only once
  // there's a conversation (scrollIntoView() used to scroll the whole page on load).
  const threadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const thread = threadRef.current;
    if (!active || !thread || (messages.length === 0 && !isLoading)) return;
    thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading, active]);

  const send = async (text: string): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const updated: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(updated);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          // Text only: contact cards stay in the browser.
          messages: updated.map(({ role, content }) => ({ role, content })),
        }),
      });
      if (res.status === 429) {
        setError("Too many messages. Please wait a moment before continuing.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ChatReply;
      setMessages([
        ...updated,
        {
          role: "assistant",
          content: data.reply || "Sorry, I couldn't generate a response.",
          contactRequest: data.contactRequest,
        },
      ]);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Send a message handed in from outside (once per id).
  const sentPendingId = useRef<number | null>(null);
  useEffect(() => {
    if (!pendingMessage || sentPendingId.current === pendingMessage.id) return;
    sentPendingId.current = pendingMessage.id;
    send(pendingMessage.text);
  }, [pendingMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      {/* ── Thread ── */}
      <div
        ref={threadRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4"
      >
        {greeting && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed bg-stone-100 text-stone-800">
              {greeting}
              {messages.length === 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {GREETING_REPLIES.map((r) => (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => send(r.text)}
                      className="h-9 px-3 rounded-full bg-white border border-stone-300 text-xs font-medium text-stone-800 hover:bg-stone-50"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!greeting && messages.length === 0 && (
          <div className="text-center px-2 mt-2">
            {/* Hidden on short windows so the starters fit in the desktop card. */}
            <p className="text-sm text-stone-500 [@media(max-height:640px)]:hidden">
              Ask anything about this home: features, the neighborhood, costs, or a showing. We can
              pass your request straight to our team.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {STARTERS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => send(s.text)}
                  className="h-9 px-3 rounded-full border border-stone-300 text-xs font-medium text-stone-700 hover:bg-stone-100"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                msg.role === "user"
                  ? "bg-stone-900 text-white rounded-br-sm"
                  : "bg-stone-100 text-stone-800 rounded-bl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Contact requests the AI prepared: the visitor reviews and sends them. */}
        {messages.map(
          (msg, i) =>
            msg.contactRequest && (
              <ContactRequestCard
                key={`contact-${i}`}
                draft={msg.contactRequest}
                listingAddress={listingAddress}
                listingPath={listingPath}
              />
            ),
        )}

        {isLoading && (
          <div className="flex justify-start" aria-label="Assistant is typing">
            <div className="bg-stone-100 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {error && <div className="text-xs text-red-500 text-center px-4">{error}</div>}
      </div>

      {/* ── Input. 16px text on phones: iOS zooms the page into smaller inputs. ── */}
      <form
        className="border-t border-stone-200 p-3 flex gap-2 shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this property..."
          aria-label="Ask about this property"
          disabled={isLoading}
          className="flex-1 min-w-0 text-base lg:text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-stone-400 disabled:opacity-50 disabled:bg-stone-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-stone-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </div>
  );
}
