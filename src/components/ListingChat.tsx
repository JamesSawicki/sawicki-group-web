import { useState, useRef, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  systemPrompt: string;
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

// ─── Component ───────────────────────────────────────────────────────────────

export default function ListingChat({ systemPrompt, apiBaseUrl }: Props) {
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [input,     setInput]     = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error,     setError]     = useState<string | null>(null);

  // Typed as HTMLDivElement because we call .scrollIntoView() on it.
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

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
          systemPrompt,
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
    <div className="border border-stone-200 rounded-xl flex flex-col" style={{ height: "520px" }}>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-sm text-stone-400 text-center mt-8 px-4">
            Ask anything about this property — features, the neighborhood, estimated costs, or next steps.
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
                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-xs text-red-500 text-center px-4">{error}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div className="border-t border-stone-200 p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this property..."
          disabled={isLoading}
          className="flex-1 text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-stone-400 disabled:opacity-50 disabled:bg-stone-50"
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
  );
}
