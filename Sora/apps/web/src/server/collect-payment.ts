import type { Deps } from "./deps.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (status: number, body: object) => Response.json(body, { status });

/** Staff collection. Runs as the signed-in user so is_member is enforced in the database. */
export async function collectCounterPayment(req: Request, paymentId: string, deps: Deps): Promise<Response> {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const userId = bearer ? await deps.verifyStaffToken(bearer) : null;
  if (!userId) return json(401, { error: "unauthorized" });
  if (!UUID.test(paymentId)) return json(404, { error: "not_found" });

  try {
    await deps.db.asUser(userId, "select mark_counter_collected($1)", [paymentId]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "not_found") return json(404, { error: "not_found" });
    if (message === "invalid_transition") return json(409, { error: "invalid_transition" });
    console.error("mark_counter_collected failed", { error: message });
    return json(500, { error: "internal" });
  }
  return json(200, { status: "succeeded" });
}
