import type { Deps } from "./deps.ts";

type Env = Record<string, string | undefined>;

/**
 * Test payments for the local demo only (no real cards, no money). A real gateway replaces this with a signed
 * webhook that calls the same confirm_payment(). Refused in production like the dev staff login.
 */
export function simulatedPaymentsEnabled(env: Env = process.env): boolean {
  return env.NODE_ENV !== "production" && env.DEV_SIMULATED_PAYMENTS === "1";
}

/** Whether "Pay now" can be offered at all: only when some payment provider is available. */
export function payNowAvailable(env: Env = process.env): boolean {
  return simulatedPaymentsEnabled(env); // add: || realGatewayConfigured(env) once a gateway is chosen
}

/** POST /api/payments/simulate/:statusToken — the demo's stand-in for a gateway's "payment succeeded". */
export async function simulatePayment(statusToken: string, deps: Deps, env: Env = process.env): Promise<Response> {
  if (!simulatedPaymentsEnabled(env)) return new Response("Not found", { status: 404 });
  if (!/^[0-9a-f]{16,64}$/i.test(statusToken)) return Response.json({ error: "not_found" }, { status: 404 });
  try {
    const [row] = await deps.db.asService<{ r: { status: string } }>("select confirm_payment($1, $2) r", [statusToken, "SIMULATED"]);
    return Response.json(row.r);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "not_found") return Response.json({ error: "not_found" }, { status: 404 });
    if (message === "invalid_transition") return Response.json({ error: "invalid_transition" }, { status: 409 });
    throw error;
  }
}
