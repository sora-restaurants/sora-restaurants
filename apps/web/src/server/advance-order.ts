import { log, requestIdOf } from "./log.ts";
import type { Deps } from "./deps.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The board's buttons. Which moves are allowed from which status lives in the kitchen_move SQL function. */
export const BOARD_MOVES = ["preparing", "ready", "served", "rejected", "cancelled"] as const;
export type BoardMove = (typeof BOARD_MOVES)[number];

const json = (status: number, body: object) => Response.json(body, { status });

/** POST /api/kitchen/orders/:id/advance  { "to": "preparing" | "ready" | "served" | "rejected" | "cancelled" } */
export async function advanceOrder(req: Request, orderId: string, deps: Deps): Promise<Response> {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const userId = bearer ? await deps.verifyStaffToken(bearer) : null;
  if (!userId) return json(401, { error: "unauthorized" });
  if (!UUID.test(orderId)) return json(404, { error: "not_found" });

  const to = await req.json().then((body: { to?: unknown }) => body?.to, () => undefined);
  if (!BOARD_MOVES.includes(to as BoardMove)) return json(400, { error: "invalid_target" });

  try {
    // One call, one transaction: a multi-step move (Start) happens completely or not at all.
    // Restaurant and role come from the staff user's session inside the database, never from the request.
    await deps.db.asUser(userId, "select kitchen_move($1, $2)", [orderId, to]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "not_found") return json(404, { error: "not_found" });
    if (message === "invalid_transition") return json(409, { error: "invalid_transition" });
    log("error", "kitchen_move failed", { requestId: requestIdOf(req), error: message });
    return json(500, { error: "internal" });
  }
  return json(200, { status: to });
}
