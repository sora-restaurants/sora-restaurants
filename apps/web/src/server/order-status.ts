import type { Deps } from "./deps.ts";

/** GET /api/orders/status/:token -> the guest's own order status. The unguessable status token is the only key. */
export async function orderStatus(token: string, deps: Deps): Promise<Response> {
  if (!/^[0-9a-f]{32}$/.test(token)) return Response.json({ error: "not_found" }, { status: 404 });
  const [row] = await deps.db.asService<{ s: { status: string } | null }>("select get_order_status($1) s", [token]);
  if (!row?.s) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ status: row.s.status }, { headers: { "cache-control": "no-store" } });
}
