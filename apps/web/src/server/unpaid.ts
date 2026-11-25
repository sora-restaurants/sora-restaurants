import type { Deps } from "./deps.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function staffUser(req: Request, deps: Deps) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  return bearer ? deps.verifyStaffToken(bearer) : null;
}

/** GET /api/staff/unpaid — pay-after orders and split-bill shares still to collect, oldest first (RLS: own restaurants only). */
export async function listUnpaid(req: Request, deps: Deps): Promise<Response> {
  const userId = await staffUser(req, deps);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const orders = await deps.db.asUser(
    userId,
    `select u.id, u.public_ref as "publicRef", t.label as "table", u.status, u.total_cents as "totalCents",
            u.created_at as "createdAt"
     from unpaid_orders u join tables t on t.restaurant_id = u.restaurant_id and t.id = u.table_id
       join orders o on o.id = u.id
     where o.bill_split_id is null
     order by u.created_at`,
  );
  const shares = await deps.db.asUser(
    userId,
    `select b.id, t.label as "table", b.share_no as "shareNo", b.ways, b.amount_cents as "amountCents", b.items
     from bill_shares b join table_sessions s on s.id = b.table_session_id join tables t on t.id = s.table_id
     where b.paid_at is null
     order by b.created_at, b.share_no`,
  );
  return Response.json({ orders, shares }, { headers: { "cache-control": "no-store" } });
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

/** GET /api/staff/tables — the floor for waiters: every table, whether it's seated, for how long, and what's owed. */
export async function listTables(req: Request, deps: Deps): Promise<Response> {
  const userId = await staffUser(req, deps);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const tables = await deps.db.asUser(
    userId,
    `select t.id, t.label, s.opened_at as "openedAt",
       (select count(*)::int from orders o where o.table_session_id = s.id) as "orders",
       (select count(*)::int from orders o where o.table_session_id = s.id and o.status in ('submitted','accepted','preparing','ready')) as "inKitchen",
       (select coalesce(sum(u.total_cents), 0)::int from unpaid_orders u join orders o on o.id = u.id where o.table_session_id = s.id and o.bill_split_id is null)
         + (select coalesce(sum(b.amount_cents), 0)::int from bill_shares b where b.table_session_id = s.id and b.paid_at is null) as "unpaidCents",
       exists (select 1 from waiter_calls c where c.table_id = t.id and c.status = 'open') as "calling"
     from tables t left join table_sessions s on s.table_id = t.id and s.status = 'open'
     where t.active and is_member(t.restaurant_id, array['owner','manager','waiter'])
     order by s.opened_at is null, t.label`,
  );
  return Response.json({ tables }, { headers: { "cache-control": "no-store" } });
}
