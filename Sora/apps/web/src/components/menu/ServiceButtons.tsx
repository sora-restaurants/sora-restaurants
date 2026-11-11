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

/** Table service requests. The QR token is the only identity sent. */
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
    <section className="rounded-theme border border-white/40 bg-white/30 p-4 backdrop-blur-md">
      <h2 className="text-sm font-semibold">Need help?</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.type}
            type="button"
            disabled={busy}
            onClick={() => void ask(option.type)}
            className="min-h-tap rounded-full border border-white/50 bg-white/40 text-sm font-semibold"
          >
            {option.label}
          </button>
        ))}
      </div>
      {message && <p className="mt-3 text-sm">{message}</p>}
    </section>
  );
}
