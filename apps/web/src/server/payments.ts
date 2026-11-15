import type { Deps } from "./deps.ts";

type Env = Record<string, string | undefined>;

/**
 * Test payments for the local demo only (no real cards, no money). A real gateway replaces this with a signed
 * webhook that calls the same confirm_payment(). Refused in production like the dev staff login.
 */
export function simulatedPaymentsEnabled(env: Env = process.env): boolean {
  return (env.NODE_ENV !== "production" && env.DEV_SIMULATED_PAYMENTS === "1") || Boolean(hostedDemoTable(env));
}

function hostedDemoTable(env: Env): string | undefined {
  return env.VERCEL === "1" && env.VERCEL_ENV === "preview" ? env.DEMO_PAYMENT_TABLE_TOKEN || undefined : undefined;
}

export function payNowAvailable(qrToken: string, env: Env = process.env): boolean {
  if (env.NODE_ENV !== "production" && env.DEV_SIMULATED_PAYMENTS === "1") return true;
  return hostedDemoTable(env) === qrToken;
}

const eligibleOrder = `
  from orders o
  join tables t on t.restaurant_id = o.restaurant_id and t.id = o.table_id
  join restaurants r on r.id = o.restaurant_id
  where o.status_token = $1 and o.payment_choice = 'pay_now'
    and t.active and r.status = 'active' and ($2::text is null or t.qr_token = $2)
`;

export async function canSimulateOrder(statusToken: string, deps: Deps, env: Env = process.env): Promise<boolean> {
  if (!simulatedPaymentsEnabled(env) || !/^[0-9a-f]{16,64}$/i.test(statusToken)) return false;
  const [row] = await deps.db.asService<{ allowed: boolean }>(
    `select exists (select 1 ${eligibleOrder}) allowed`,
    [statusToken, hostedDemoTable(env) ?? null],
  );
  return row.allowed;
}

/** POST /api/payments/simulate/:statusToken — the demo's stand-in for a gateway's "payment succeeded". */
export async function simulatePayment(statusToken: string, deps: Deps, env: Env = process.env): Promise<Response> {
  if (!simulatedPaymentsEnabled(env) || !/^[0-9a-f]{16,64}$/i.test(statusToken)) return new Response("Not found", { status: 404 });
  try {
    const [row] = await deps.db.asService<{ r: { status: string } }>(
      `select confirm_payment(o.status_token, 'SIMULATED') r ${eligibleOrder}`,
      [statusToken, hostedDemoTable(env) ?? null],
    );
    return row ? Response.json(row.r) : new Response("Not found", { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "not_found") return Response.json({ error: "not_found" }, { status: 404 });
    if (message === "invalid_transition") return Response.json({ error: "invalid_transition" }, { status: 409 });
    throw error;
  }
}
