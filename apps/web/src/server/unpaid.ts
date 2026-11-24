import type { Deps } from "./deps.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function staffUser(req: Request, deps: Deps) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  return bearer ? deps.verifyStaffToken(bearer) : null;
}

/** GET /api/staff/unpaid — pay-after orders still to collect, oldest first (RLS: own restaurants only). */
export async function listUnpaid(req: Request, deps: Deps): Promise<Response> {
  const userId = await staffUser(req, deps);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const orders = await deps.db.asUser(
    userId,
    `select u.id, u.public_ref as "publicRef", t.label as "table", u.status, u.total_cents as "totalCents",
            u.created_at as "createdAt"
     from unpaid_orders u join tables t on t.restaurant_id = u.restaurant_id and t.id = u.table_id
     order by u.created_at`,
  );
  return Response.json({ orders }, { headers: { "cache-control": "no-store" } });
}

/** POST /api/staff/orders/:id/paid — collected at the table or till. */
export async function markPaid(req: Request, orderId: string, deps: Deps): Promise<Response> {
  const userId = await staffUser(req, deps);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!UUID.test(orderId)) return Response.json({ error: "not_found" }, { status: 404 });
  try {
    await deps.db.asUser(userId, "select mark_order_paid($1)", [orderId]);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message === "not_found") return Response.json({ error: "not_found" }, { status: 404 });
    if (error instanceof Error && error.message === "not_payable") return Response.json({ error: "not_payable" }, { status: 409 });
    throw error;
  }
}
