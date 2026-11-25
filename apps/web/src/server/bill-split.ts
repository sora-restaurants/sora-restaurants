import type { Deps } from "./deps.ts";
import { staffUser } from "./unpaid.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{32}$/;
const ERRORS: Record<string, number> = { not_found: 404, invalid: 400, nothing_to_split: 409, split_locked: 409 };

/** Maps the database's raise exception codes to HTTP; anything else is a real fault. */
async function run(fn: () => Promise<unknown>): Promise<Response> {
  try {
    await fn();
    return new Response(null, { status: 204 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (ERRORS[code]) return Response.json({ error: code }, { status: ERRORS[code] });
    throw error;
  }
}

/** Body: { ways: 2..12, assign?: { [orderItemId]: shareNo } }. */
async function readSplit(req: Request): Promise<{ ways: number; assign: Record<string, number> } | null> {
  const body = await req.json().catch(() => null);
  if (!body || !Number.isInteger(body.ways)) return null;
  const assign = body.assign ?? {};
  if (typeof assign !== "object" || Array.isArray(assign) || Object.keys(assign).length > 100) return null;
  return { ways: body.ways, assign };
}

/** GET /api/orders/status/:token/bill — the guest's table bill: shares and dishes not yet split. */
export async function guestBill(token: string, deps: Deps): Promise<Response> {
  if (!TOKEN.test(token)) return Response.json({ error: "not_found" }, { status: 404 });
  const [row] = await deps.db.asService<{ b: unknown }>("select get_table_bill($1) b", [token]);
  if (!row?.b) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(row.b, { headers: { "cache-control": "no-store" } });
}

/** POST /api/orders/status/:token/bill — a guest splits their table's bill. */
export async function guestSplit(req: Request, token: string, deps: Deps): Promise<Response> {
  if (!TOKEN.test(token)) return Response.json({ error: "not_found" }, { status: 404 });
  const split = await readSplit(req);
  if (!split) return Response.json({ error: "invalid" }, { status: 400 });
  return run(() => deps.db.asService("select guest_split_bill($1, $2, $3::text::jsonb)", [token, split.ways, JSON.stringify(split.assign)]));
}

/** POST /api/staff/tables/:tableId/split — a waiter splits a table's open bill. */
export async function staffSplit(req: Request, tableId: string, deps: Deps): Promise<Response> {
  const userId = await staffUser(req, deps);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!UUID.test(tableId)) return Response.json({ error: "not_found" }, { status: 404 });
  const split = await readSplit(req);
  if (!split) return Response.json({ error: "invalid" }, { status: 400 });
  return run(() => deps.db.asUser(userId, "select staff_split_bill($1, $2, $3::text::jsonb)", [tableId, split.ways, JSON.stringify(split.assign)]));
}

/** POST /api/staff/shares/:shareId/paid — one person's share collected. */
export async function markSharePaid(req: Request, shareId: string, deps: Deps): Promise<Response> {
  const userId = await staffUser(req, deps);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!UUID.test(shareId)) return Response.json({ error: "not_found" }, { status: 404 });
  return run(() => deps.db.asUser(userId, "select mark_share_paid($1)", [shareId]));
}
