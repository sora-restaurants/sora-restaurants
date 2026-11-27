"use client";

import { useState } from "react";
import { sendReceiptAction } from "../../app/actions/send-receipt.ts";
import { formatRand } from "../../lib/money.ts";
import type { Receipt as ReceiptData } from "../../server/order-status.ts";

const when = (iso: string) => new Date(iso).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", dateStyle: "medium", timeStyle: "short" });

/** Plain-text receipt for the guest to send to themselves on WhatsApp. No phone number or business account involved. */
export function receiptText(r: ReceiptData, restaurant: string, table: string): string {
  const lines = r.items.map((i) => `${i.quantity}x ${i.name}${i.notes ? ` (${i.notes})` : ""}  ${formatRand(i.unitPriceCents * i.quantity)}`);
  return [
    `${restaurant} receipt`,
    `Order ${r.publicRef} · ${table}`,
    when(r.paidAt ?? r.createdAt),
    "",
    ...lines,
    "",
    `Subtotal ${formatRand(r.subtotalCents)}`,
    ...(r.tipCents ? [`Tip ${formatRand(r.tipCents)}`] : []),
    `Total ${formatRand(r.subtotalCents + r.tipCents)}`,
    ...(r.vatCents ? [`Includes VAT ${formatRand(r.vatCents)}`] : []),
    ...(r.splitWays > 1 ? [`Split ${r.splitWays} ways: about ${formatRand(Math.round((r.subtotalCents + r.tipCents) / r.splitWays))} each`] : []),
    r.paidAt ? "Paid, thank you" : "Demo payment, not charged",
  ].join("\n");
}

const EMAIL_ERRORS: Record<string, string> = {
  invalid: "That email address doesn't look right.",
  already_sent: "This receipt was already emailed.",
  not_configured: "Email receipts aren't switched on here yet. Use Save or WhatsApp.",
};

export function Receipt({ receipt: r, restaurant, table, statusToken, email = "", weeklySpecials = false }: { receipt: ReceiptData; restaurant: string; table: string; statusToken?: string; email?: string; weeklySpecials?: boolean }) {
  const [to, setTo] = useState(email);
  const [mail, setMail] = useState<{ kind: "idle" | "sending" | "sent" } | { kind: "error"; message: string }>({ kind: "idle" });
  async function sendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!statusToken || mail.kind === "sending") return;
    setMail({ kind: "sending" });
    const res = await sendReceiptAction({ to, statusToken, splitWays: r.splitWays, weeklySpecials }).catch(() => ({ ok: false as const, error: "network" }));
    setMail(res.ok ? { kind: "sent" } : { kind: "error", message: EMAIL_ERRORS[res.error] ?? "We couldn't send the email. Please try again, or use Save or WhatsApp." });
  }
  return (
    <div className="mt-6 text-left">
      <div className="rounded-theme border border-line bg-surface p-4">
        <p className="text-sm opacity-80">Order <strong>{r.publicRef}</strong> · {when(r.paidAt ?? r.createdAt)}</p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {r.items.map((i, n) => (
            <li key={n} className="flex justify-between gap-3">
              <span>{i.quantity}× {i.name}{i.notes ? <span className="block text-sm opacity-70">{i.notes}</span> : null}</span>
              <span className="tabular-nums">{formatRand(i.unitPriceCents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 border-t border-line pt-3 tabular-nums">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatRand(r.subtotalCents)}</dd></div>
          {r.tipCents ? <div className="flex justify-between"><dt>Tip</dt><dd>{formatRand(r.tipCents)}</dd></div> : null}
          <div className="mt-1 flex justify-between text-lg font-bold"><dt>Total</dt><dd>{formatRand(r.subtotalCents + r.tipCents)}</dd></div>
          {r.vatCents ? <div className="flex justify-between text-sm opacity-70"><dt>Includes VAT</dt><dd>{formatRand(r.vatCents)}</dd></div> : null}
          {r.splitWays > 1 ? <div className="flex justify-between text-sm opacity-70"><dt>Split {r.splitWays} ways</dt><dd>about {formatRand(Math.round((r.subtotalCents + r.tipCents) / r.splitWays))} each</dd></div> : null}
        </dl>
        {r.paidAt ? null : <p className="mt-2 text-sm opacity-70">Demo payment, not charged</p>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 print:hidden">
        <button type="button" onClick={() => window.print()} className="min-h-12 rounded-full border border-line font-semibold active:scale-95">Save receipt</button>
        <a href={`https://wa.me/?text=${encodeURIComponent(receiptText(r, restaurant, table))}`} className="grid min-h-12 place-items-center rounded-full bg-accent font-semibold text-on-accent active:scale-95">Send to WhatsApp</a>
      </div>
      {statusToken ? (
        <form onSubmit={sendEmail} className="mt-3 flex gap-2 print:hidden">
          <label htmlFor="receipt-email" className="sr-only">Email address for the receipt</label>
          <input id="receipt-email" type="email" required value={to} onChange={(e) => setTo(e.target.value)} placeholder="Email me the receipt" autoComplete="email"
            className="min-h-12 min-w-0 flex-1 rounded-full border border-line bg-bg px-4" />
          <button type="submit" disabled={mail.kind === "sending" || mail.kind === "sent"} className="min-h-12 shrink-0 rounded-full border border-line px-5 font-semibold active:scale-95 disabled:opacity-60">
            {mail.kind === "sending" ? "Sending…" : mail.kind === "sent" ? "Sent" : "Email"}
          </button>
        </form>
      ) : null}
      {mail.kind === "sent" && <p role="status" className="mt-2 text-sm">Receipt sent to {to}.</p>}
      {mail.kind === "error" && <p role="alert" className="mt-2 text-sm font-bold">{mail.message}</p>}
    </div>
  );
}
