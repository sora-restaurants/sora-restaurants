import type { Deps } from "./deps.ts";

export type OrderProgress = {
  publicRef: string;
  status: string;
  totalCents: number;
  updatedAt: string;
  items: { name: string; quantity: number }[];
};

/** The customer's view of one order. The random status token is the only key; no login, no other orders. */
export async function orderStatus(statusToken: string, deps: Deps): Promise<Response> {
  if (!/^[0-9a-f]{16,64}$/i.test(statusToken)) return Response.json({ error: "not_found" }, { status: 404 });
  const [row] = await deps.db.asService<{ s: OrderProgress | null }>("select get_order_status($1) s", [statusToken]);
  if (!row?.s) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(row.s, { headers: { "cache-control": "no-store" } });
}
