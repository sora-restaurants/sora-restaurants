import { z } from "zod";
import type { Deps } from "./deps.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CallInput = z.object({ qrToken: z.string().min(1).max(100) }).strict();

async function staffUser(req: Request, deps: Deps) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  return bearer ? deps.verifyStaffToken(bearer) : null;
}

/** Customer taps "Call waiter". The table, and so the restaurant, come from the QR token only. */
export async function callWaiter(input: unknown, deps: Deps): Promise<Response> {
  const parsed = CallInput.safeParse(input);
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  try {
    // One open call per table is enforced in the database; repeated taps are harmless.
    await deps.db.asService("select call_waiter($1)", [parsed.data.qrToken]);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message === "table_not_found") return Response.json({ error: "not_found" }, { status: 404 });
    throw error;
  }
}

/** Open calls in every restaurant this staff member works at (RLS limits the rows), oldest first. */
export async function listCalls(req: Request, deps: Deps): Promise<Response> {
  const userId = await staffUser(req, deps);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const calls = await deps.db.asUser(
    userId,
    `select c.id, t.label as "table", c.created_at as "createdAt", c.restaurant_id as "restaurantId"
     from waiter_calls c join tables t on t.restaurant_id = c.restaurant_id and t.id = c.table_id
     where c.status = 'open' order by c.created_at`,
  );
  return Response.json({ calls }, { headers: { "cache-control": "no-store" } });
}

/** A staff member answers a call. Another restaurant's call looks the same as a missing one. */
export async function acknowledgeCall(req: Request, callId: string, deps: Deps): Promise<Response> {
  const userId = await staffUser(req, deps);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!UUID.test(callId)) return Response.json({ error: "not_found" }, { status: 404 });
  try {
    await deps.db.asUser(userId, "select acknowledge_waiter_call($1)", [callId]);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message === "not_found") return Response.json({ error: "not_found" }, { status: 404 });
    throw error;
  }
}
