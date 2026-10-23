/**
 * ContactRequestCard.tsx — a contact request the listing chat's AI prepared (via its
 * request_contact tool), shown in the chat for the visitor to check, edit and send.
 *
 * Nothing is sent until the visitor presses Send: it then posts to the site's own contact
 * endpoint (/api/contact: emails the team, rate-limited), with the listing attached.
 */
import { useState } from "react";
import { site } from "../../lib/site.config";

/** Fields the AI filled in (all editable here). */
export interface ContactRequest {
  name: string;
  email: string;
  phone: string;
  message: string;
}

interface Props {
  /** The AI's draft. */
  draft: ContactRequest;
  /** Street address and page path of the listing, attached to the email. */
  listingAddress: string;
  listingPath: string;
}

type Status = "editing" | "sending" | "sent" | "error";

export default function ContactRequestCard({ draft, listingAddress, listingPath }: Props) {
  const [fields, setFields] = useState<ContactRequest>(draft);
  const [status, setStatus] = useState<Status>("editing");
  const [error, setError] = useState<string>("");

  const set = (key: keyof ContactRequest) => (e: { target: { value: string } }) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  const send = async (): Promise<void> => {
    setStatus("sending");
    const form = new FormData();
    form.set("name", fields.name);
    form.set("email", fields.email);
    form.set("phone", fields.phone);
    form.set("message", fields.message);
    form.set("intent", "Request from the listing chat");
    form.set("listingAddress", listingAddress);
    form.set("listingPath", listingPath);
    try {
      const res = await fetch("/api/contact", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success)
        throw new Error(data.error || "Couldn't send. Please try again.");
      setStatus("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send. Please try again.");
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        Sent. {site.name} will be in touch with {fields.name || "you"} soon.
      </div>
    );
  }

  const input =
    "w-full rounded-md border border-stone-300 px-2.5 py-2 text-base lg:text-sm focus:outline-none focus:border-stone-500";
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 space-y-2 text-sm">
      <div className="font-medium text-stone-900">Your request</div>
      <label className="block">
        <span className="text-xs text-stone-500">Name</span>
        <input className={input} value={fields.name} onChange={set("name")} />
      </label>
      <label className="block">
        <span className="text-xs text-stone-500">Email</span>
        <input className={input} type="email" value={fields.email} onChange={set("email")} />
      </label>
      <label className="block">
        <span className="text-xs text-stone-500">Phone (optional)</span>
        <input className={input} type="tel" value={fields.phone} onChange={set("phone")} />
      </label>
      <label className="block">
        <span className="text-xs text-stone-500">Message</span>
        <textarea className={input} rows={3} value={fields.message} onChange={set("message")} />
      </label>
      <div className="text-xs text-stone-500">About: {listingAddress}</div>
      {status === "error" && <div className="text-xs text-red-600">{error}</div>}
      <button
        type="button"
        onClick={send}
        disabled={status === "sending" || !fields.name.trim() || !fields.email.trim()}
        className="w-full h-11 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-50"
      >
        {status === "sending" ? "Sending…" : `Send to ${site.name}`}
      </button>
    </div>
  );
}
