"use server";

type ReceiptLine = { name: string; quantity: number; notes: string[]; priceCents: number };

export async function sendReceiptAction(input: {
  to: string;
  publicRef: string;
  lines: ReceiptLine[];
  totalCents: number;
  tipPercent: number;
  splitWays: number;
  weeklySpecials: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const to = input.to.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false, error: "invalid" };

  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "not_configured" };

  const tip = Math.round(input.totalCents * input.tipPercent / 100);
  const grand = input.totalCents + tip;
  const each = input.splitWays > 1 ? Math.round(grand / input.splitWays) : grand;

  const rows = input.lines.map((l) => {
    const note = l.notes.length ? `<div style="color:#666;font-size:12px">${l.notes.join(", ")}</div>` : "";
    return `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${l.quantity}× ${l.name}${note}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-variant-numeric:tabular-nums">R ${(l.priceCents / 100).toFixed(2)}</td></tr>`;
  }).join("");

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
      <p style="margin:0;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#111;font-weight:700">Sora</p>
      <h1 style="margin:8px 0 4px;font-size:28px">Your receipt</h1>
      <p style="margin:0 0 20px;color:#666">Order ${input.publicRef}</p>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      <div style="margin-top:16px;font-size:15px">
        <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>R ${(input.totalCents / 100).toFixed(2)}</span></div>
        ${tip ? `<div style="display:flex;justify-content:space-between;margin-top:4px"><span>Tip ${input.tipPercent}%</span><span>R ${(tip / 100).toFixed(2)}</span></div>` : ""}
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-weight:700;font-size:18px"><span>Total</span><span>R ${(grand / 100).toFixed(2)}</span></div>
        ${input.splitWays > 1 ? `<p style="margin:8px 0 0;color:#666;font-size:13px">Split ${input.splitWays} ways · about R ${(each / 100).toFixed(2)} each</p>` : ""}
      </div>
      <p style="margin:24px 0 0;color:#666;font-size:13px">Thank you for ordering at Sora. This is a demo receipt.</p>
      ${input.weeklySpecials ? `<p style="margin:8px 0 0;color:#666;font-size:13px">You’ll also get our weekly specials.</p>` : ""}
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RECEIPT_FROM || "Sora <receipts@sora.restaurant>",
      to: [to],
      subject: `Your Sora receipt · ${input.publicRef}`,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: text.slice(0, 200) || "send_failed" };
  }
  return { ok: true };
}
