import type { Deps } from "./deps.ts";

export type Receipt = {
  publicRef: string;
  createdAt: string;
  paidAt: string | null;
  subtotalCents: number;
  tipCents: number;
  items: { name: string; quantity: number; unitPriceCents: number; notes: string }[];
};

type Row = Omit<Receipt, "subtotalCents"> & { status: string; paymentStatus: string; totalCents: number; items: Receipt["items"] | null };

/** GET /api/orders/status/:token -> the guest's own order status and receipt. The unguessable status token is the only key. */
export async function orderStatus(token: string, deps: Deps): Promise<Response> {
  if (!/^[0-9a-f]{32}$/.test(token)) return Response.json({ error: "not_found" }, { status: 404 });
  const [row] = await deps.db.asService<{ s: Row | null }>("select get_order_status($1) s", [token]);
  const s = row?.s;
  if (!s) return Response.json({ error: "not_found" }, { status: 404 });
  const receipt: Receipt = { publicRef: s.publicRef, createdAt: s.createdAt, paidAt: s.paidAt, subtotalCents: s.totalCents, tipCents: s.tipCents, items: s.items ?? [] };
  return Response.json({ status: s.status, paid: s.paymentStatus === "paid", receipt }, { headers: { "cache-control": "no-store" } });
}
