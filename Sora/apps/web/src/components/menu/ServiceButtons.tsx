"use client";

import { useState } from "react";
import { serviceRequestAction } from "../../app/actions/service-request.ts";

const OPTIONS = [
  { type: "waiter", label: "Call waiter" },
  { type: "water", label: "Water" },
  { type: "bill", label: "Bill" },
  { type: "cutlery", label: "Cutlery" },
  { type: "other", label: "Assistance" },
] as const;

/** Table service requests. Uses the same theme tokens as the menu. */
export function ServiceButtons({ qrToken }: { qrToken: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(type: (typeof OPTIONS)[number]["type"]) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await serviceRequestAction({ qrToken, type });
      setMessage(result.ok ? "Request sent. Staff have been notified." : "We couldn't send that. Please try again.");
    } catch {
      setMessage("No connection. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-theme rounded-theme bg-surface p-pad">
      <h2 className="display text-xl">Need help?</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.type}
            type="button"
            disabled={busy}
            onClick={() => void ask(option.type)}
            className="min-h-tap rounded-theme bg-accent px-4 text-sm font-semibold text-on-accent transition-transform active:scale-95 disabled:opacity-60 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {option.label}
          </button>
        ))}
      </div>
      {message && <p className="mt-3 text-sm text-muted">{message}</p>}
    </section>
  );
}
