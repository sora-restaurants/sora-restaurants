import type { Deps } from "./deps.ts";

export type Receipt = {
  publicRef: string;
  createdAt: string;
  paidAt: string | null;
  subtotalCents: number;
  tipCents: number;
  vatCents: number; // VAT already inside the subtotal; 0 when the restaurant isn't VAT-registered
  splitWays: number;
  items: { name: string; quantity: number; unitPriceCents: number; notes: string }[];
};

type Row = Omit<Receipt, "subtotalCents" | "vatCents" | "splitWays"> & { status: string; paymentStatus: string; totalCents: number; items: Receipt["items"] | null };

/** GET /api/orders/status/:token -> the guest's own order status and receipt. The unguessable status token is the only key. */
export async function orderStatus(token: string, deps: Deps): Promise<Response> {
  if (!/^[0-9a-f]{32}$/.test(token)) return Response.json({ error: "not_found" }, { status: 404 });
  const [row] = await deps.db.asService<{ s: Row | null }>("select get_order_status($1) s", [token]);
  const s = row?.s;
  if (!s) return Response.json({ error: "not_found" }, { status: 404 });
  const [extra] = await deps.db.asService<{ vatCents: number; splitWays: number }>(
    'select vat_cents as "vatCents", split_ways as "splitWays" from orders where status_token = $1', [token]);
  const receipt: Receipt = { publicRef: s.publicRef, createdAt: s.createdAt, paidAt: s.paidAt, subtotalCents: s.totalCents, tipCents: s.tipCents,
    vatCents: extra?.vatCents ?? 0, splitWays: extra?.splitWays ?? 1, items: s.items ?? [] };
  return Response.json({ status: s.status, paid: s.paymentStatus === "paid", receipt }, { headers: { "cache-control": "no-store" } });
}
