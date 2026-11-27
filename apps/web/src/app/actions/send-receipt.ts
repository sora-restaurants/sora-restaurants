"use server";

import { prodDeps } from "../../server/prod-deps.ts";

const esc = (v: unknown) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]!);

/** Emails the receipt for a real order. Lines and total come from the database by status token, never from the client. */
// shortcut: no per-order send limit; each email needs a real placed order, add a sent_at column if abused.
export async function sendReceiptAction(input: {
  to: string;
  statusToken: string;
  splitWays: number;
  weeklySpecials: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const to = String(input.to ?? "").trim();
  if (to.length > 200 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to)) return { ok: false, error: "invalid" };
  if (!/^[0-9a-f]{32}$/.test(String(input.statusToken))) return { ok: false, error: "not_found" };
  const splitWays = [1, 2, 3, 4].includes(input.splitWays) ? input.splitWays : 1;

  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "not_configured" };

  const [row] = await prodDeps().db.asService<{ s: { publicRef: string; totalCents: number; tipCents: number; items: { name: string; quantity: number }[] | null } | null }>(
    "select get_order_status($1) s", [input.statusToken]);
  const order = row?.s;
  if (!order) return { ok: false, error: "not_found" };

  // One receipt per order, so a placed order can't be used to spam an inbox.
  const [claim] = await prodDeps().db.asService<{ ok: boolean }>("select claim_receipt($1) ok", [input.statusToken]);
  if (!claim?.ok) return { ok: false, error: "already_sent" };

  const tip = order.tipCents ?? 0; // the tip saved on the order, so the email matches the screen
  const grand = order.totalCents + tip;
  const each = splitWays > 1 ? Math.round(grand / splitWays) : grand;
  const rows = (order.items ?? []).map((l) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${l.quantity}× ${esc(l.name)}</td></tr>`).join("");
  const input2 = { publicRef: esc(order.publicRef), totalCents: order.totalCents, splitWays, weeklySpecials: Boolean(input.weeklySpecials) };

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
      <p style="margin:0;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#111;font-weight:700">Sora</p>
      <h1 style="margin:8px 0 4px;font-size:28px">Your receipt</h1>
      <p style="margin:0 0 20px;color:#666">Order ${input2.publicRef}</p>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      <div style="margin-top:16px;font-size:15px">
        <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>R ${(input2.totalCents / 100).toFixed(2)}</span></div>
        ${tip ? `<div style="display:flex;justify-content:space-between;margin-top:4px"><span>Tip</span><span>R ${(tip / 100).toFixed(2)}</span></div>` : ""}
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-weight:700;font-size:18px"><span>Total</span><span>R ${(grand / 100).toFixed(2)}</span></div>
        ${input2.splitWays > 1 ? `<p style="margin:8px 0 0;color:#666;font-size:13px">Split ${input2.splitWays} ways · about R ${(each / 100).toFixed(2)} each</p>` : ""}
      </div>
      <p style="margin:24px 0 0;color:#666;font-size:13px">Thank you for ordering at Sora.</p>
      ${input2.weeklySpecials ? `<p style="margin:8px 0 0;color:#666;font-size:13px">You’ll also get our weekly specials.</p>` : ""}
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RECEIPT_FROM || "Sora <receipts@sora.restaurant>",
      to: [to],
      subject: `Your Sora receipt · ${input2.publicRef}`,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("receipt email failed", res.status, text.slice(0, 500));
    // Let the guest try again: the claim only stands for an email that actually went out.
    await prodDeps().db.asService("update orders set receipt_sent_at = null where status_token = $1", [input.statusToken]).catch(() => {});
    return { ok: false, error: "send_failed" };
  }
  return { ok: true };
}
