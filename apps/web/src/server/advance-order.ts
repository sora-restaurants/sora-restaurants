import type { Deps } from "./deps.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The board has three moves, one tap each. A move may take more than one database step
 * (a new ticket goes submitted -> accepted -> preparing); advance_order enforces every step and the role.
 */
const MOVES: Record<string, Record<string, string[]>> = {
  preparing: { submitted: ["accepted", "preparing"], accepted: ["preparing"] },
  ready: { preparing: ["ready"] },
  served: { ready: ["served"] },
};

const json = (status: number, body: object) => Response.json(body, { status });

/** POST /api/kitchen/orders/:id/advance  { "to": "preparing" | "ready" | "served" } */
export async function advanceOrder(req: Request, orderId: string, deps: Deps): Promise<Response> {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const userId = bearer ? await deps.verifyStaffToken(bearer) : null;
  if (!userId) return json(401, { error: "unauthorized" });
  if (!UUID.test(orderId)) return json(404, { error: "not_found" });

  const to = await req.json().then((body: { to?: unknown }) => body?.to, () => undefined);
  if (typeof to !== "string" || !(to in MOVES)) return json(400, { error: "invalid_target" });

  // Read as the staff user: RLS hides other restaurants' orders, so they look exactly like missing ones.
  const [order] = await deps.db.asUser<{ status: string }>(userId, "select status from orders where id = $1", [orderId]);
  if (!order) return json(404, { error: "not_found" });
  const steps = MOVES[to][order.status];
  if (!steps) return json(409, { error: "invalid_transition", status: order.status });

  try {
    // shortcut: steps run as separate transactions, so a failure mid-way can leave a ticket at "accepted"
    // (it still shows in the Cooking column and the next tap continues it); a single SQL function would make it atomic.
    for (const step of steps) {
      await deps.db.asUser(userId, "select advance_order($1, $2)", [orderId, step]);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "not_found") return json(404, { error: "not_found" });
    if (message === "invalid_transition") return json(409, { error: "invalid_transition" });
    console.error("advance_order failed", { error: message });
    return json(500, { error: "internal" });
  }
  return json(200, { status: to });
}
